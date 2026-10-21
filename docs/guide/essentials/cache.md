# 缓存

持久化是**手写的**：没有 `pinia-plugin-persistedstate`（依赖表里没有它，store 文件里也没有 `persist` 选项），落盘全部走 `packages/core/base/shared/src/cache/**` 或直接 `localStorage`。所以"哪些状态会留下来"是一个显式决定，每个 key 的规则还各不相同。这篇讲实现、key 从哪来、加密的真实开关，以及读不出来时发生了什么。

## 实现：`packages/core/base/shared/src/cache/**`

| 文件 | 内容 |
| --- | --- |
| `index.ts` | `createCache()` 工厂（`:60`）、模块级单例 `cache`（`:197`）、兼容旧 API 的 `localStorageCacheStorage`（`:200-204`）、`buildStorageKey`（`:40`） |
| `storage.ts` | 三个存储适配器 + `createStorage(type)` 分派（`:56-68`），单例导出 `localStorageAdapter` / `sessionStorageAdapter` / `memoryStorageAdapter`（`:70-72`） |
| `encrypt.ts` | SM4 加解密（`sm-crypto`）：异步版 `encryptValue` / `decryptValue`（`:107,122`）、同步版 `encryptValueSync` / `decryptValueSync`（`:135,144`）、`shouldEncrypt()`（`:152`） |
| `tokenCrypto.ts` | Token 专用：`encryptToken` / `decryptToken`（`:77,106`），走 `jose` 的 JWE，与上面的 SM4 是两套 |
| `types.ts` | `StorageType`（`:4`）、`CacheItem`（`:17`）、`CacheStorage`（`:29`）、`CacheInstance`（`:38`） |
| `memory.ts` | `MemoryCache` 类（`:16`）与单例 `memoryCache`（`:95`）—— `cache/index.ts` 不导出它们，全仓也零调用点；`tsdown.config.ts` 的 `src/*/*.ts` 确实会把它编成 `dist/cache/memory.js`，所以 `@antdv/shared/cache/memory` 手工 import 是能解析的，只是没人该用（见[工具与共享能力](/guide/essentials/utils)） |

**只有三个存储介质**：`'local'` / `'session'` / `'memory'`（`types.ts:4`，`storage.ts:56-68` 的 switch 只这三个 case）。 `memory` 适配器就是一个模块级 `Map`（`storage.ts:4`），不是 `memory.ts` 那个带定时器的类。

### 接口形状

`CacheInstance`（`types.ts:38-57`）九个方法：`getItem` / `setItem` / `removeItem` / `hasItem` / `clear` / `keys` / `getExpire` / `setExpire` / `touch`。`clear()` 与 `keys()` 的作用域是**当前前缀**，不是整份 localStorage（`index.ts:136-150`）。

`CacheStorage`（`types.ts:29-35`）的返回类型写成 `T | Promise<T>` 的联合，是给异步适配器留的口， **当前三个适配器全是同步的**；`index.ts:97-101,138-149` 里的 `isPromise` 判断只是防御。

### TTL 与序列化

- 落盘的不是裸值，而是一层信封 `CacheItem`：`{ value, expire, createTime, time }`（`types.ts:17-26`，构造处 `index.ts:123-133`；`time` 是标注 `@deprecated` 的兼容字段）。
- `setItem(key, value, expire?)` 的 **`expire` 单位是秒**，`> 0` 才换算成 `createTime + expire * 1000`，否则记 `0` = 永不过期（`index.ts:127`）。
- 过期是**读时判定**，不是定时器：`getItem` 发现 `Date.now() > item.expire` 就删掉该键并返回 `null` （`index.ts:115-118`）。`touch()` 只给本来就会过期的条目续期，缺省 3600 秒（`index.ts:171-181`）。
- 序列化链：`JSON.stringify(信封)` → 需要加密时再套一层 SM4（十六进制串）→ 交给适配器（`index.ts:82-85`）。反序列化失败一律 `catch` 成 `null`（`index.ts:88-95`）。

## key 从哪来：前缀 + 枚举 + 各自的字面量

真实键名 = `` `${prefix}_${业务key}` ``（`index.ts:40-45` 的 `buildStorageKey`）。前缀由应用启动时注入：

```ts
// apps/web/src/bootstrap/env.ts:1-7（原样，未删改）
import { configureSharedEnv } from '@antdv/shared/utils/env';
configureSharedEnv({
  cacheEncryptKey: import.meta.env.VITE_CACHE_ENCRYPT_KEY,
  cachePrefix: import.meta.env.VITE_APP_TITLE ?? 'app_cache',
  minioPublicUrl: import.meta.env.VITE_MINIO_PUBLIC_URL,
  production: import.meta.env.PROD,
});
```

`VITE_APP_TITLE` 的实际值是 `Antdv Admin`（`apps/web/.env:2`）。

两个细节值得记住：前缀**含空格**（`VITE_APP_TITLE` 原样，`apps/web/.env:2` 的实际值是 `Antdv Admin`，于是盘上真的出现 `Antdv Admin_auth_token` 这种键名），未注入时兜底 `'app_cache'` （`packages/core/base/shared/src/utils/env.ts:27`）；前缀和加密开关都是**每次读写时重新解析**，不在建实例时定型（`index.ts:68-78`），因为 `export const cache = createCache()` 在模块求值阶段就跑了，一定早于 `configureSharedEnv()`。这条时序有个回归用例钉着（`packages/core/base/shared/__tests__/cache.test.ts:147-183`）。

### `CacheKey` 枚举

`packages/enums/src/cache.ts:8-16` 定义 4 项，且每一项都真的被引用：`DICT_DATA`（`apps/web/src/stores/modules/dict.ts:35,49,133`）、`ACCESS_TOKEN`（`packages/stores/src/user.ts:14` 解构成 `TOKEN_KEY`）、`REFRESH_TOKEN`（`apps/web/src/plugins/request-runtime.ts:22,24`）、`USER_INFO`（`user.ts:14` 解构成 `USER_INFO_KEY`）。枚举值就是落盘键名（`auth_token` / `refresh_token` / `user_info` / `antdv_dict_data`），和应用真正写进去的键一致，可以当唯一来源用（文件顶部的注释就写着"新增成员前先确认写入方和读取方都用了它"）。

**没有 `ROLES` / `PERMISSIONS` / `THEME` / `SIDEBAR` / `LOCALE`。** 角色与权限活在 user store 的内存态（跟着 `user_info` 一起存），偏好（含主题、语言）自成一份 `appSetting`，菜单可见性覆盖走裸 `localStorage`（见下表）—— 都不占 `CacheKey`。语言切换改造后 locale 不再单独存一份，只活在偏好的快照里；测试直接断言了这一点：持久化只有一份、`app_cache_locale` 必须为 `null`（`apps/web/src/locales/__tests__/locale.spec.ts:80-82`）。

实际在盘上的键：

| 真实键（不含前缀） | 谁写 | 写法 | 出处 |
| --- | --- | --- | --- |
| `auth_token` | user store | 登录与刷新都走 `setToken`，值先经 `encryptToken`（JWE）再进 cache，TTL 默认 `TOKEN_EXPIRE`（24h）；**仅当加密抛错才降级写明文**（`:143-144`） | `packages/stores/src/user.ts:56,60,136,144` |
| `user_info` | user store | `cache.setItem`，无 TTL | `user.ts:14,65` |
| `refresh_token` | **只有请求层** | `cache.setItem`，**不加密、无 TTL**（与 token 不同） | `apps/web/src/plugins/request-runtime.ts:24`，键名 `CacheKey.REFRESH_TOKEN`（`packages/enums/src/cache.ts`） |
| `tabsState` | tabs store | `watch` 里整体写回 | `packages/stores/src/tabs.ts:16,42-51` |
| `antdv_dict_data` | dict store | 走 `localStorageCacheStorage`，信封外**又套一层** `loadedAt` 判 1 小时过期 | `apps/web/src/stores/modules/dict.ts:35,48-49`、`packages/enums/src/cache.ts` |
| `appSetting` | preferences（自带 `createCache`） | `PREFERENCES_CACHE_KEY`，`options.expire` 缺省即永不过期 | `packages/core/preferences/src/constants.ts:11`、`preferences.ts:31-32,71-73` |
| `xy-menu-hidden-overrides` | route store | **裸 `localStorage` + 裸 JSON**，不走 cache、没有前缀 | `packages/stores/src/route.ts:26,30,42` |
| `chunk-upload:<hash>` | 上传组件 | **裸 `localStorage`**，自有 `updatedAt` 7 天过期 | `packages/core/ui-kit/common-ui/src/components/chunk-upload/constants.ts:8-9`、`packages/core/ui-kit/common-ui/src/components/chunk-upload/utils.ts:50-52,56-60` |

`apps/web/src/config/constants.ts` 现在只剩路由白名单与两个路径（`WHITE_LIST` / `HOME_PATH` / `LOGIN_PATH`），文件头的注释直接把缓存键名推给了 `@antdv/enums`：「缓存键名不在这里，统一在 `@antdv/enums` 的 `CacheKey`」。早先那份 `TOKEN_EXPIRES_IN` / `REFRESH_TOKEN_EXPIRE` / `PERMISSIONS_KEY` 已经从这个文件里删掉了，全仓零引用 —— 别照着旧文档去那里找键名。真正在用的过期常量是 `packages/stores/src/user.ts:15` 的局部 `TOKEN_EXPIRE`（`24 * 60 * 60`，秒）。`VITE_NAMESPACE` 只在 `apps/web/types/env.d.ts:28` 留了个类型声明，没有任何读取方，也不参与键拼接（见[配置](/guide/essentials/config)）。

## 加密：SM4 只在生产构建里，而且密钥不是你以为的那个

`shouldEncrypt()` 就是 `isProduction()`（`encrypt.ts:152-154` → `env.ts:50-52`），而 `production` 来自 `bootstrap/env.ts:6` 的 `import.meta.env.PROD`。**没有独立的加密开关**：dev 永远明文、build 永远密文， `VITE_CACHE_ENCRYPT_KEY` 开不开都不影响这条判定。想按实例关掉，只能 `createCache({ encrypt: false })` （`index.ts:63,76`）。

::: warning

缓存值的 SM4 密钥是前缀，不是 `VITE_CACHE_ENCRYPT_KEY` `index.ts:82-85` 把**解析出来的前缀当作 key 传进** `encryptValueSync(json, prefix)`，而 `encryptValueSync` 的实现是 `padKey(key || getBaseKey())`（`encrypt.ts:135-136`）—— `key` 永远非空，于是 `getBaseKey()` / `getCacheEncryptKey()` 这条链在缓存读写路径上**走不到**。后果有三个：

1. `VITE_CACHE_ENCRYPT_KEY`（`apps/web/.env.production:15`）实际上不参与缓存加解密；配置页 `guide/essentials/config.md:38` 说它是"缓存加密密钥，长度要求见缓存"，代码里它只是被 `configureSharedEnv` 存进配置对象（`env.ts:36-38`），缓存路径一次都不读它。
2. 生产环境缺这个变量**不会**触发 `env.ts:59-68` 那个"必须配置密钥"的抛错，那条分支在缓存路径上是死代码。
3. SM4 密钥 = `padKey(VITE_APP_TITLE)`（截断/补齐到 32 字符，`encrypt.ts:18,93-98`）。也就是说 **改 title 同时改了键名和密钥**，跨项目抄同一个 title 等于共用一把密钥。

派生密钥那一套（SHA-256 + 设备指纹，`encrypt.ts:40-75`）只服务于异步版 `encryptValue` / `decryptValue`，而这两个函数**全仓没有调用方**。:::

Token 的值另有机制，且不受 `shouldEncrypt` 影响：`encryptToken()` 用 `jose` 的 `EncryptJWT` （`alg: 'dir'` + `A256GCM`，`tokenCrypto.ts:86-90`），密钥由 PBKDF2（10 万次迭代）从**设备指纹**派生（`tokenCrypto.ts:21-69`），指纹因子含 `navigator.userAgent`、`navigator.language`、`screen.width/height`、时区偏移（`:22-28`）。它在 dev 也加密，所以本地 localStorage 里的 token 是 JWE 串。

## store 侧怎么用，以及登出清理出口

唯一聚合出口是 `useUserStore().logout()`（`packages/stores/src/user.ts:164-169`）：内存态置空 → `cache.removeItem(TOKEN_KEY)` + `cache.removeItem(USER_INFO_KEY)` → `clearDerivedSession()`（`:85-89`，依次 `notifySessionReset()` 让页面缓存等外部登记项自清、`useRouteStore().resetRoutes()`、`useTabsStore().reset()`）。请求层的 `forceLogout()` 不自己清，它只调用入口注入的 `onLogout`（`packages/request/src/fetcher.ts:73-76`），由应用把 `logout()` 接回去（`apps/web/src/plugins/request-runtime.ts:18`）。新增需要清理的状态就登记到 `onSessionReset`，不要散着写在登出流程里。

| 读写点 | 位置 |
| --- | --- |
| store 初始化即读缓存 | `packages/stores/src/user.ts:19-23`、`tabs.ts:25,34`、`apps/web/src/stores/modules/dict.ts:56`（`loadFromStorage()`） |
| 变更后写回 | `user.ts:60,65`（setToken / setUserInfo）、`tabs.ts:42-51`、`dict.ts:49`、`packages/core/preferences/src/preferences.ts:71-73`（commit 即 persist） |
| 请求层兜底读 token | `packages/request/src/fetcher.ts:96,102,193-194,214,222` |
| 手动"清缓存并退出" | `packages/layouts/src/widgets/setting-drawer/components/setting-footer.vue:47-49`：`cache.clear()` + `localStorage.clear()` + `sessionStorage.clear()` |

::: warning 这条链上仍有两处对不上（读代码得到，不是猜测）

- **`logout()` 不清 `refresh_token`**：`user.ts:164-169` 只删 `auth_token` 与 `user_info`，而 `request-runtime.ts:24` 写过的 `refresh_token` 会留在盘上（`cache.clear()` 那种全清才带得走）。
- **登录流程从不写 `refresh_token`**：`user.ts` 的登录响应体里只有 `user.token`（`:96-104`），全程没有调用 `setRefresh`。于是第一次 `doRefreshToken()` 撞上 `tokens.refresh()` 返回空 → `缺少 refresh token`（`fetcher.ts:96-97`）。

两个曾经的缺陷已经修掉、别再照旧文档找：`initToken()` 现在在 `main.ts:153` 被 await 调用，刷新后 `token.value` 是 `decryptToken` **之后**的明文，不是 JWE 串（回归用例 `packages/stores/__tests__/user-session.test.ts:166-212`）；刷新令牌改走 `request-runtime.ts:24` 的 `setRefresh`（`cache.setItem`，明文、无 TTL），不再拿 `setToken` 的第二个形参当过期时间用。另外 `clearDict()` 全仓仍无调用方，登出不会清字典缓存，靠的是那条 1 小时 `loadedAt` 自然过期（`apps/web/src/stores/modules/dict.ts:39,133`）。:::

## 浏览器存储的真实使用情况

| 介质 | 状态 |
| --- | --- |
| `localStorage` | 主战场：cache 的默认介质 + 两处裸用（`packages/stores/src/route.ts:30,42`、`packages/core/ui-kit/common-ui/src/components/chunk-upload/utils.ts:56,83,91`） |
| `sessionStorage` | **有适配器，无人使用**。`createStorage('session')` 只在 `storage.ts:71` 导出成 `sessionStorageAdapter`，全仓没有 `createCache({ type: 'session' })`；应用代码里唯一的 session 操作是 SettingFooter 那次 `clear()` |
| `memory` | `type: 'memory'` 只出现在 `packages/core/base/shared/__tests__/cache.test.ts:137`，应用没用 |
| IndexedDB | **没有**。源码里 `indexedDB` 零命中，只有 PWA 打开时（`VITE_PWA`）构建产物里的 workbox 运行时会用（`apps/web/dist/workbox-*.js`），跟应用状态持久化无关 |

## 失效的代价

改了前缀（`VITE_APP_TITLE`）或加密形态之后，旧缓存**读不出来是不报错的**：

- `deserialize` 把解密异常和 JSON 解析异常一起 `catch` 成 `null`（`index.ts:88-95`）， `getItem` 见 `null` 就返回 `null`（`:107-109`）—— 表现得跟"没有缓存"一模一样。
- 用户视角的后果：token 读不回 → 守卫视为未登录 → 回登录页；偏好读不回 → `readSaved()` 的 `try/catch` 返回 `undefined`（`packages/core/preferences/src/preferences.ts:62-69`）→ 界面退回默认值；标签页读不回 → 空标签列表。没有一处会告诉你"是被前缀/密钥挡掉的"。
- **旧键变成孤儿**：`clear()` 只删 `startsWith(prefix)` 的键（`index.ts:136-143`），换了前缀之后旧数据再也清不掉，只能整份 `localStorage.clear()`（SettingFooter 那个按钮就是干这个的）。
- 跨介质同理：dev 写的明文在 build 里解不开，换前缀后按新前缀的密钥也解不开 —— `cache.test.ts:106-118` 就是把"另一套前缀解密失败并降级为 `null`"这个行为钉住的用例。
- Token 那条链的失效条件更微妙：设备指纹变了（浏览器升级、改时区、换屏幕/旋转、`navigator.language` 变化）→ 派生密钥变 → `decryptToken` 对 JWE 串返回 `null`（`tokenCrypto.ts:106-139`，只有不含 `.` 的旧明文才回退）。表现就是"没换密码却掉登录"。

::: tip

加一份持久化状态之前先决定键放哪：跟应用生命周期走的就照 `dict.ts` —— `CacheKey` 加一项（顺手真的引用它）、在 `watch` 里 `cache.setItem`、并把它加进 `user.ts` 的 `logout()` 清理列表。只是界面外观的偏好不要自己开 key，走 `packages/core/preferences`（见 [状态管理](/guide/essentials/stores)）。裸 `localStorage` 只留给"跟缓存语义无关"的数据（菜单可见性覆盖、分片续传进度），并自己带上过期判定。:::

## 相关页面

- [状态管理](/guide/essentials/stores) —— 六个 store 与持久化分工
- [工具](/guide/essentials/utils) —— `cache` 在哪一层、怎么被复用
- [配置](/guide/essentials/config) —— `VITE_APP_TITLE` / `VITE_CACHE_ENCRYPT_KEY` 的读取链
- [基础概念](/guide/essentials/concepts) —— 包为什么不许读 `import.meta.env`
- [常见问题](/guide/other/faq)
