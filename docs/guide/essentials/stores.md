# 状态管理

状态层是 **Pinia + 一套手写缓存**：store 里不放持久化插件，落盘全部走 `@antdv/shared` 的 `cache`（或直接 `localStorage`）。这一点和多数模板不同——没有 `pinia-plugin-persistedstate`，所以"哪些状态会留下来"是个显式决定，而不是一个 `persist: true` 开关。

```ts
// apps/web/src/main.ts:58-59
const pinia = createPinia();
app.use(pinia);
```

`createPinia` / `defineStore` 在自动导入的 `imports` 列表里（`internal/vite-config/src/plugins/auto-import.ts:24` 的 `['vue', '@vueuse/core', 'pinia', VueRouterAutoImports]`），所以 store 文件里不写 import 也能用。组件不在这个范围内 —— 子包组件与 antdv-next 组件一律显式 import，见[外部模块](/guide/essentials/external)。

## 一共六个 store，住在两个地方

| store | id / 位置 | 管什么 | 谁在消费 |
| --- | --- | --- | --- |
| user | `packages/stores/src/user.ts:17` | 登录 / 登出 / token / refreshToken / roles / permissions / `hasPermission` | `views/login/index.vue:41`、请求层运行时 `plugins/request-runtime.ts:18-23`、路由守卫 `router/guards/index.ts:49`、`utils/ws.ts:341`、权限指令 `directives/index.ts:35` |
| route | `packages/stores/src/route.ts:48` | `backendMenus` / `menus` / `allowedNames` / `allowedPaths` / `isLoaded` | 动态路由守卫（`router/guards/index.ts:59-82`）、菜单管理页 |
| app | `packages/stores/src/app.ts:23` | 偏好的**派生视图**：把 preferences 展平成 ref + `updateSetting` + `toggles` | `App.vue:12`、`packages/layouts/src/basic/layout.vue:41` 与设置抽屉 |
| tabs | `packages/stores/src/tabs.ts:34` | 标签列表、`activeKey`、`maximizedKey` | `packages/layouts/src/hooks/use-tabs.ts:39`、`use-layout.ts:153`、`use-page-cache.ts:78` |
| dict | `apps/web/src/stores/modules/dict.ts:55` | 字典 map + `getOptions` / `getLabel` | 启动时 `apps/web/src/layouts/index.vue:32` 拉取，各系统管理页读字典 |
| auth | `apps/web/src/stores/modules/auth.ts:13` | token + userInfo + roles（**与 user 重复，全仓无消费者**） | 无人使用，见下方警告 |

前四个在 `@antdv/stores`（`packages/stores/src/`），后两个是应用私有 store，住在 `apps/web/src/stores/modules/`。这条边界是硬的：只有这两个地方 `defineStore`，其余 `packages/*`（layouts、ui-kit、hooks……）**一个都没有**——共享包要状态就从外面接 props / inject，不许自己起 store。

`packages/stores/src/session.ts` 不是 store，是**会话作废的登记处**：`onSessionReset(handler)` 登记、`notifySessionReset()` 逐个跑（`session.ts:18-21`、`:29-37`）。页面缓存这类"住在别的包里"的派生状态靠它清理（`packages/layouts/src/hooks/use-page-cache.ts:74`）——直接 import 会让依赖方向倒过来（stores → layouts），包图成环。

::: warning 出口是两个，别走错包`@antdv/stores` 的 barrel 全量导出五个模块：`packages/stores/src/index.ts:1-5`（app / route / session / tabs / user）。`apps/web/src/stores/index.ts:1-2` 只 re-export auth / dict，所以 `~/stores` 里**拿不到**那四个 —— 应用代码统一 `import { useUserStore } from '@antdv/stores'`，私有 store 走 `~/stores`。:::

## 约定

- **清一色 setup store**：`defineStore(id, () => { ... })`，getter 用 `computed` 返回、动作用具名函数返回，最后整体 `return { ... }`（`auth.ts:13-44`、`route.ts:421-438`）。没有 option store 写法。
- 命名 `useXxxStore`，文件名与 id 对应。
- **组件外使用**：没有 `pinia` 实例注入技巧，一律在函数/守卫回调里即时调用（`router/guards/index.ts:49`、`plugins/request-runtime.ts:18`、`directives/index.ts:35`）。这意味着不能在模块顶层拿 store——那时 pinia 还没装。
- 登出只有一个聚合出口：`user.ts:163-169` 先把 token 与用户信息置空、删掉两个缓存键，再调 `clearDerivedSession()`（`:85-89`），由它依次跑 `notifySessionReset()`（页面缓存等外部登记项）、`useRouteStore().resetRoutes()`、`useTabsStore().reset()`。新增需要清理的状态就登记到 `onSessionReset`，不要散着写在登出流程里。

## 持久化：手写，且各 key 规则不同

`cache` 的拼接规则是 `` `${prefix}_${key}` ``，prefix 在启动时由 `apps/web/src/bootstrap/env.ts:4` 注入，取 `VITE_APP_TITLE`（实际值 `Antdv Admin`，`apps/web/.env:2`），并且**每次读写时重新解析**（`packages/core/base/shared/src/cache/index.ts:40-45,75`）。生产环境写入值经 SM4 加密（`packages/core/base/shared/src/cache/encrypt.ts:152-154`），开发环境明文。

| 持久化内容 | key | 写法 | 事实来源 |
| --- | --- | --- | --- |
| 访问令牌 / 用户信息 | `auth_token` / `user_info` | `encryptToken` 后落盘，token 过期 24h | `packages/enums/src/cache.ts:7-16`、`user.ts:14-15,56-66` |
| 刷新令牌 | `refresh_token` | 读写都在请求层运行时注入的回调里 | `plugins/request-runtime.ts:22,24` |
| 标签页 | `tabsState` | `watch` 里 `cache.setItem` | `tabs.ts:16,42-51` |
| 字典 | `antdv_dict_data`（整表一个键） | `localStorageCacheStorage` + **1 小时 TTL**（`loadedAt` 字段自己判） | `dict.ts:33-53`、`cache/index.ts:200-204` |
| 菜单"导航显示"覆盖 | `xy-menu-hidden-overrides` | 裸 `localStorage`，不走 cache 前缀也不加密 | `route.ts:26,38-46` |
| 偏好设置（含 `locale`） | `appSetting`（带前缀） | preferences 实例自己 `persist`，每次 commit 都写 | `preferences.ts:31-32,71-77,87-97` |

::: warning `VITE_NAMESPACE` 是个死变量它只出现在 `apps/web/.env:1`、`apps/web/types/env.d.ts:28` 和这份文档里，**没有任何代码路径读它**。想按环境隔离 localStorage，目前只能靠 `VITE_APP_TITLE` 前缀（改 title 会让全部旧缓存失效，这是它的实际效果）。别指望设个 namespace 就能多标签隔离。:::

## app store 是偏好的门面，不是第二份状态

真正的所有权在 `packages/core/preferences`：`createPreferences()` 给出一组 ref/computed（`packages/core/preferences/src/preferences.ts:27`），`updateSetting` / `toggle` 提交后由 `commit()` 同步 persist + 写 DOM（`:87-97`，写 DOM 的具体动作在 `update-css-variables.ts`）。`app.ts:29-97` 用 `pick()` / `toRef` 把它**展平**成 `appStore.primaryColor` 这类只读 ref，`app.ts:102-126` 再把 `updateSetting`、`resetSetting`、`toggles.*` 暴露成写入 API。

语言没有第二份状态：`locale` 只是偏好快照里的一个字段（`app.ts:97`），写入唯一一条路是 `appStore.updateSetting({ locale })`，之后由 `useLocaleSync` 把它展开成 i18n 文案、`<html lang>`、dayjs 与组件内置文案四件事（`apps/web/src/composables/useLocale.ts:32-61`）。`apps/web/src/locales/index.ts:11-19` 里的 `locale: 'zh-CN'` 只是 createI18n 的初始值，不是第二个真相来源。

所以：

- 读配置 → `appStore.xxx`（或 `appStore.appSetting` 拿整份）
- 写配置 → `appStore.updateSetting({...})` / `appStore.toggles.xxx()`
- **不要**在 app store 里加新的 `ref` 存业务状态，那是给偏好用的门面层
- 判断当前是深是浅要用 `resolvedTheme` / `isSystemDark`（`app.ts:43-51`、`packages/utils/src/theme-mode.ts:14-21`），因为默认 `theme: 'auto'`，`appStore.theme` 可能是 `'auto'`

详见[主题与偏好设置](/guide/in-depth/theme)。

## 该放 store，还是不该

| 情况 | 放哪 |
| --- | --- |
| 跨路由存活、刷新后要在（登录态、菜单、标签页、偏好、字典） | store + 显式持久化 |
| 跨路由存活、刷新可以没有（页面缓存集合、请求 loading） | store，不持久化 |
| 只有父组件和子组件要 | `provide` / `inject` 或 props，别进全局 |
| 一个页面的表单草稿 | 组件内 `ref` |

::: tip 想加一个新 store应用级状态照 `apps/web/src/stores/modules/dict.ts` 写，跨包共享的才进 `packages/stores/src/`：setup store、`defineStore('xxx')` 的第一参数用稳定 id、需要落盘就在 `watch` 里显式 `cache.setItem`，键名加进 `packages/enums/src/cache.ts` 的 `CacheKey`，并在登出流程（或 `onSessionReset` 登记）里加清理。别忘了同步 `packages/stores/src/index.ts` 或 `apps/web/src/stores/index.ts` 的导出。:::
