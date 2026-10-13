# 缓存

持久化是**手写的**：没有 `pinia-plugin-persistedstate`（依赖表里没有它，store 文件里也没有 `persist` 选项），落盘全部走 `packages/shared/src/cache/**` 或直接 `localStorage`。所以"哪些状态会留下来"是一个显式决定，每个 key 的规则还各不相同。这篇讲实现、key 从哪来、加密的真实开关，以及读不出来时发生了什么。

## 实现：`packages/shared/src/cache/**`

| 文件 | 内容 |
| --- | --- |
| `index.ts` | `createCache()` 工厂（`:60`）、模块级单例 `cache`（`:196`）、兼容旧 API 的 `localStorageCacheStorage`（`:199-203`）、`buildStorageKey`（`:40`） |
| `storage.ts` | 三个存储适配器 + `createStorage(type)` 分派（`:56-68`），单例导出 `localStorageAdapter` / `sessionStorageAdapter` / `memoryStorageAdapter`（`:70-72`） |
| `encrypt.ts` | SM4 加解密（`sm-crypto`）：异步版 `encryptValue` / `decryptValue`（`:107,122`）、同步版 `encryptValueSync` / `decryptValueSync`（`:135,144`）、`shouldEncrypt()`（`:152`） |
| `tokenCrypto.ts` | Token 专用：`encryptToken` / `decryptToken`（`:77,106`），走 `jose` 的 JWE，与上面的 SM4 是两套 |
| `types.ts` | `StorageType`（`:4`）、`CacheItem`（`:17`）、`CacheStorage`（`:29`）、`CacheInstance`（`:38`） |
| `memory.ts` | `MemoryCache` 类（`:16`）—— **没被 `index.ts` 导出，也不在 tsdown 入口里，外部拿不到**，是死代码 |

**只有三个存储介质**：`'local'` / `'session'` / `'memory'`（`types.ts:4`，`storage.ts:56-68` 的 switch 只这三个 case）。 `memory` 适配器就是一个模块级 `Map`（`storage.ts:4`），不是 `memory.ts` 那个带定时器的类。

### 接口形状

`CacheInstance`（`types.ts:38-57`）九个方法：`getItem` / `setItem` / `removeItem` / `hasItem` / `clear` / `keys` / `getExpire` / `setExpire` / `touch`。`clear()` 与 `keys()` 的作用域是**当前前缀**，不是整份 localStorage（`index.ts:136-150`）。

`CacheStorage`（`types.ts:29-35`）的返回类型写成 `T | Promise<T>` 的联合，是给异步适配器留的口， **当前三个适配器全是同步的**；`index.ts:97-101,138-149` 里的 `isPromise` 判断只是防御。

### TTL 与序列化

- 落盘的不是裸值，而是一层信封 `CacheItem`：`{ value, expire, createTime, time }`（`types.ts:17-26`，构造处 `index.ts:122-132`；`time` 是标注 `@deprecated` 的兼容字段）。
- `setItem(key, value, expire?)` 的 **`expire` 单位是秒**，`> 0` 才换算成 `createTime + expire * 1000`，否则记 `0` = 永不过期（`index.ts:126`）。
- 过期是**读时判定**，不是定时器：`getItem` 发现 `Date.now() > item.expire` 就删掉该键并返回 `null` （`index.ts:114-117`）。`touch()` 只给本来就会过期的条目续期，缺省 3600 秒（`index.ts:170-180`）。
- 序列化链：`JSON.stringify(信封)` → 需要加密时再套一层 SM4（十六进制串）→ 交给适配器（`index.ts:81-84`）。反序列化失败一律 `catch` 成 `null`（`index.ts:87-94`）。

## key 从哪来：前缀 + 枚举 + 各自的字面量

真实键名 = `` `${prefix}_${业务key}` ``（`index.ts:40-45` 的 `buildStorageKey`）。前缀由应用启动时注入：

```ts
// apps/web/src/bootstrap/env.ts:1-7（原样，未删改）
import { configureSharedEnv } from '@antdv/shared/env';
configureSharedEnv({
  cacheEncryptKey: import.meta.env.VITE_CACHE_ENCRYPT_KEY,
  cachePrefix: import.meta.env.VITE_APP_TITLE ?? 'app_cache',
  minioPublicUrl: import.meta.env.VITE_MINIO_PUBLIC_URL,
  production: import.meta.env.PROD,
});
```

`VITE_APP_TITLE` 的实际值是 `Antdv Admin`（`apps/web/.env:2`）。

两个细节值得记住：前缀**含空格**（`VITE_APP_TITLE` 原样，`apps/web/.env:2` 的实际值是 `Antdv Admin`，于是盘上真的出现 `Antdv Admin_auth_token` 这种键名），未注入时兜底 `'app_cache'` （`packages/shared/src/env.ts:27`）；前缀和加密开关都是**每次读写时重新解析**，不在建实例时定型（`index.ts:68-78`），因为 `export const cache = createCache()` 在模块求值阶段就跑了，一定早于 `configureSharedEnv()`。这条时序有个回归用例钉着（`packages/shared/__tests__/cache.test.ts:147-183`）。

### `CacheKey` 枚举只有一部分在用

`apps/web/src/enums/cache.ts:2-19` 定义了 8 项，但**只有 `DICT_DATA` 有代码引用** （`stores/modules/dict.ts:6,35,49,133`）。其余 7 项（`ACCESS_TOKEN` / `REFRESH_TOKEN` / `USER_INFO` / `ROLES` / `PERMISSIONS` / `THEME` / `SIDEBAR`）全仓无引用，而且它们的值（`app_cache_access_token`）和应用真正写进去的键（`auth_token`）根本不是一回事 —— 别把它们当"缓存键的唯一来源"。

**没有 `LOCALE`。** 语言切换改造后 locale 不再单独存一份，只活在偏好的快照里；测试直接断言了这一点：持久化只有一份、`app_cache_locale` 必须为 `null`（`apps/web/src/locales/__tests__/locale.spec.ts:100-104`）。

实际在盘上的键：

| 真实键（不含前缀） | 谁写 | 写法 | 出处 |
| --- | --- | --- | --- |
| `auth_token` | user store / 请求层 | 登录路径把值先经 `encryptToken`（JWE）再进 cache、TTL 24h；**刷新路径 `cache.setItem(TOKEN_KEY, newAccess)` 没加密**，且不传 TTL | `stores/modules/user.ts:14,55,106`、`fetcher.ts:129` |
| `user_info` | user store | `cache.setItem`，无 TTL | `user.ts:15,60` |
| `refresh_token` | **只有请求层** | `cache.setItem`，无 TTL | `fetcher.ts:130`，键名来自 `config/constants.ts:4` |
| `tabsState` | tabs store | `watch` 里整体写回 | `stores/modules/tabs.ts:15,41-50` |
| `antdv_dict_data` | dict store | 走 `localStorageCacheStorage`，信封外**又套一层** `loadedAt` 判 1 小时过期 | `dict.ts:35,49`、`enums/cache.ts:4` |
| `appSetting` | preferences（自带 `createCache`） | `PREFERENCES_CACHE_KEY`，永不过期 | `packages/preferences/src/store.ts:21,104,146` |
| `xy-menu-hidden-overrides` | route store | **裸 `localStorage` + 裸 JSON**，不走 cache、没有前缀 | `stores/modules/route.ts:27,31,43` |
| `chunk-upload:<hash>` | 上传组件 | **裸 `localStorage`**，自有 `updatedAt` 7 天过期 | `components/common/Upload/constants.ts:8-9`、`Upload/utils.ts:50-52,56-60` |

`config/constants.ts` 里的 `TOKEN_EXPIRES_IN` / `REFRESH_TOKEN_EXPIRE` / `PERMISSIONS_KEY` 无任何引用（`TOKEN_EXPIRE` 的三处命中是 `user.ts:16` 自己的同名局部常量）。`VITE_NAMESPACE` 同样没人读，它不参与键拼接（见[配置](/guide/essentials/config)）。

## 加密：SM4 只在生产构建里，而且密钥不是你以为的那个

`shouldEncrypt()` 就是 `isProduction()`（`encrypt.ts:152-154` → `env.ts:48-50`），而 `production` 来自 `bootstrap/env.ts:6` 的 `import.meta.env.PROD`。**没有独立的加密开关**：dev 永远明文、build 永远密文， `VITE_CACHE_ENCRYPT_KEY` 开不开都不影响这条判定。想按实例关掉，只能 `createCache({ encrypt: false })` （`index.ts:63,76`）。

::: warning 缓存值的 SM4 密钥是前缀，不是 `VITE_CACHE_ENCRYPT_KEY` `index.ts:81-84` 把**解析出来的前缀当作 key 传进** `encryptValueSync(json, prefix)`，而 `encryptValueSync` 的实现是 `padKey(key || getBaseKey())`（`encrypt.ts:135-136`）—— `key` 永远非空，于是 `getBaseKey()` / `getCacheEncryptKey()` 这条链在缓存读写路径上**走不到**。后果有三个：

1. `VITE_CACHE_ENCRYPT_KEY`（`apps/web/.env.production:14`）实际上不参与缓存加解密； `config.md:50` 说它是"缓存加密密钥，长度要求见缓存"，代码里它只是被 `configureSharedEnv` 存进配置对象（`env.ts:34-36`），缓存路径一次都不读它。
2. 生产环境缺这个变量**不会**触发 `env.ts:57-66` 那个"必须配置密钥"的抛错，那条分支在缓存路径上是死代码。
3. SM4 密钥 = `padKey(VITE_APP_TITLE)`（截断/补齐到 32 字符，`encrypt.ts:18,93-98`）。也就是说 **改 title 同时改了键名和密钥**，跨项目抄同一个 title 等于共用一把密钥。

派生密钥那一套（SHA-256 + 设备指纹，`encrypt.ts:40-75`）只服务于异步版 `encryptValue` / `decryptValue`，而这两个函数**全仓没有调用方**。:::

Token 的值另有机制，且不受 `shouldEncrypt` 影响：`encryptToken()` 用 `jose` 的 `EncryptJWT` （`alg: 'dir'` + `A256GCM`，`tokenCrypto.ts:86-90`），密钥由 PBKDF2（10 万次迭代）从**设备指纹**派生（`tokenCrypto.ts:21-69`），指纹因子含 `navigator.userAgent`、`navigator.language`、`screen.width/height`、时区偏移（`:22-28`）。它在 dev 也加密，所以本地 localStorage 里的 token 是 JWE 串。

## store 侧怎么用，以及登出清理出口

唯一聚合出口是 `useUserStore().logout()`（`stores/modules/user.ts:163-169`）：内存态置空 → `cache.removeItem(TOKEN_KEY)` + `cache.removeItem(USER_INFO_KEY)` → `resetPageCache()` （`layouts/composables/usePageCache.ts:63-67`）→ `useRouteStore().resetRoutes()` → `useTabsStore().reset()`。请求层的 `forceLogout()` 不自己清，就调它（`apps/web/src/composables/web/request/fetcher.ts:72-88`）。新增需要清理的状态就加在这里。

| 读写点 | 位置 |
| --- | --- |
| store 初始化即读缓存 | `user.ts:20-24`、`tabs.ts:23-31,34`、`dict.ts:56`（`loadFromStorage()`） |
| 变更后写回 | `user.ts:55,60,106`、`tabs.ts:41-50`、`dict.ts:49`、`preferences/src/store.ts:160-168`（commit 即 persist） |
| 请求层兜底读 token | `fetcher.ts:96,101,188-190,218` |
| 手动"清缓存并退出" | `layouts/components/SettingDrawer/components/SettingFooter.vue:45-47`：`cache.clear()` + `localStorage.clear()` + `sessionStorage.clear()` |

::: warning 这条链上有四处对不上（读代码得到，不是猜测）

- **`logout()` 不清 `refresh_token`**：`user.ts:129-130` 只删 `auth_token` 与 `user_info`，而 `fetcher.ts:130` 写过的 `refresh_token` 会留在盘上（`cache.clear()` 那种全清才带得走）。
- **登录流程从不写 `refresh_token`**：`user.ts:63-124` 的响应体里只有 `user.token`。于是 `doRefreshToken()` 第一次就撞上 `缺少 refresh token`（`fetcher.ts:97`）。
- **`userStore.refreshToken` 这个属性不存在**：`fetcher.ts:96,190` 读它，而 user store 的 return 列表（`user.ts:163-181`）里没有 `refreshToken`，运行时恒为 `undefined`，实际取值全靠 `cache.getItem`。
- **`setToken` 的第二个形参被当过期时间用了**：`fetcher.ts:128` 传的是 `newRefresh`，签名却是 `setToken(newToken: string, expire?: number)`（`user.ts:51`），字符串进 `expire && expire > 0` 判定为假 → 刷新后的 token **不带 TTL**。

另外两个"没人调"的点：`initToken()` 被导出但全仓无调用（`user.ts:30-40,174`），所以刷新后 `token.value` 是 `decryptToken` **之前**的 JWE 串；`clearDict()` 同理（`dict.ts:131-134`），登出并不会清字典缓存，靠的是那条 1 小时 `loadedAt` 自然过期。:::

## 浏览器存储的真实使用情况

| 介质 | 状态 |
| --- | --- |
| `localStorage` | 主战场：cache 的默认介质 + 两处裸用（`route.ts:31,43`、`Upload/utils.ts:56,83,91`） |
| `sessionStorage` | **有适配器，无人使用**。`createStorage('session')` 只在 `storage.ts:71` 导出成 `sessionStorageAdapter`，全仓没有 `createCache({ type: 'session' })`；应用代码里唯一的 session 操作是 SettingFooter 那次 `clear()` |
| `memory` | `type: 'memory'` 只出现在 `packages/shared/__tests__/cache.test.ts:137`，应用没用 |
| IndexedDB | **没有**。源码里 `indexedDB` 零命中，只有 PWA 打开时（`VITE_PWA`）构建产物里的 workbox 运行时会用（`apps/web/dist/workbox-*.js`），跟应用状态持久化无关 |

## 失效的代价

改了前缀（`VITE_APP_TITLE`）或加密形态之后，旧缓存**读不出来是不报错的**：

- `deserialize` 把解密异常和 JSON 解析异常一起 `catch` 成 `null`（`index.ts:87-94`）， `getItem` 见 `null` 就返回 `null`（`:107-109`）—— 表现得跟"没有缓存"一模一样。
- 用户视角的后果：token 读不回 → 守卫视为未登录 → 回登录页；偏好读不回 → `readSaved()` 的 `try/catch` 返回 `undefined`（`packages/preferences/src/store.ts:135-142`）→ 界面退回默认值；标签页读不回 → 空标签列表。没有一处会告诉你"是被前缀/密钥挡掉的"。
- **旧键变成孤儿**：`clear()` 只删 `startsWith(prefix)` 的键（`index.ts:136-143`），换了前缀之后旧数据再也清不掉，只能整份 `localStorage.clear()`（SettingFooter 那个按钮就是干这个的）。
- 跨介质同理：dev 写的明文在 build 里解不开，换前缀后按新前缀的密钥也解不开 —— `cache.test.ts:106-118` 就是把"另一套前缀解密失败并降级为 `null`"这个行为钉住的用例。
- Token 那条链的失效条件更微妙：设备指纹变了（浏览器升级、改时区、换屏幕/旋转、`navigator.language` 变化）→ 派生密钥变 → `decryptToken` 对 JWE 串返回 `null`（`tokenCrypto.ts:106-139`，只有不含 `.` 的旧明文才回退）。表现就是"没换密码却掉登录"。

::: tip 加一份持久化状态之前先决定键放哪：跟应用生命周期走的就照 `dict.ts` —— `CacheKey` 加一项（顺手真的引用它）、在 `watch` 里 `cache.setItem`、并把它加进 `user.ts` 的 `logout()` 清理列表。只是界面外观的偏好不要自己开 key，走 `packages/preferences`（见 [状态管理](/guide/essentials/stores)）。裸 `localStorage` 只留给"跟缓存语义无关"的数据（菜单可见性覆盖、分片续传进度），并自己带上过期判定。:::

## 相关页面

- [状态管理](/guide/essentials/stores) —— 六个 store 与持久化分工
- [工具](/guide/essentials/utils) —— `cache` 在哪一层、怎么被复用
- [配置](/guide/essentials/config) —— `VITE_APP_TITLE` / `VITE_CACHE_ENCRYPT_KEY` 的读取链
- [基础概念](/guide/essentials/concepts) —— 包为什么不许读 `import.meta.env`
- [常见问题](/guide/other/faq)
