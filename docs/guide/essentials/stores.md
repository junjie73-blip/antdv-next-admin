# 状态管理

状态层是 **Pinia + 一套手写缓存**：store 里不放持久化插件，落盘全部走 `@antdv/shared` 的 `cache`（或直接 `localStorage`）。这一点和多数模板不同——没有 `pinia-plugin-persistedstate`，所以"哪些状态会留下来"是个显式决定，而不是一个 `persist: true` 开关。

```ts
// apps/web/src/main.ts:44-45
const pinia = createPinia();
app.use(pinia);
```

`createPinia` / `defineStore` 同时被自动导入注册（`internal/vite-config/src/plugins/auto-import.ts:77`），所以 store 文件里看不到 import 也能用。

## 一共六个 store

全部在 `apps/web/src/stores/modules/`，`packages/*` 里**一个都没有**（共享包不许碰 store）。

| store | id / 位置 | 管什么 | 谁在消费 |
| --- | --- | --- | --- |
| user | `user.ts:18` | 登录 / 登出 / token / refreshToken / roles / permissions / `hasPermission` | `views/login/index.vue:23`、请求层 `fetcher.ts:75`、路由守卫、`utils/ws.ts:339` |
| route | `route.ts:49` | `backendMenus` / `menus` / `allowedNames` / `allowedPaths` / `isLoaded` | 动态路由守卫（`router/guards/index.ts:53-95`）、菜单管理页 |
| app | `app.ts:20` | 偏好的**派生视图**：把 preferences 展平成 ref + `updateSetting` + `toggles` | `App.vue:18`、布局与设置抽屉 |
| tabs | `tabs.ts:33` | 标签列表、`activeKey`、`maximizedKey` | `useTabs.ts:37`、`useLayout.ts:163`、`usePageCache.ts:67` |
| dict | `dict.ts:55` | 字典 map + `getOptions` / `getLabel` | 启动时 `layouts/index.vue:153` 拉取 |
| auth | `auth.ts:13` | token + userInfo + roles（**与 user 重复，全仓无消费者**） | 无人使用，见下方警告 |

::: warning `stores/index.ts` 只 re-export 四个 `stores/index.ts:1-4` 导出 app / auth / dict / route，**tabs 与 user 必须从 `~/stores/modules/*` 直接 import**。这不是笔误，是历史遗留的收敛缺口，已记在待办里。:::

## 约定

- **清一色 setup store**：`defineStore(id, () => { ... })`，getter 用 `computed` 返回、动作用具名函数返回（`auth.ts:18-43`、`route.ts:354-371`）。没有 option store 写法。
- 命名 `useXxxStore`，文件名与 id 对应。
- **组件外使用**：没有 `pinia` 实例注入技巧，一律在函数/守卫回调里即时调用（`router/guards/index.ts:53`、`fetcher.ts:75`、`directives/index.ts:35`）。这意味着不能在模块顶层拿 store——那时 pinia 还没装。
- 登出只有一个聚合出口：`user.ts:126-150` 里依次 `resetPageCache()`、 `useRouteStore().resetRoutes()`、`useTabsStore().reset()`。新增需要清理的状态就加在这里，不要各处散着写。

## 持久化：手写，且各 key 规则不同

`cache` 的拼接规则是 `` `${prefix}_${key}` ``，prefix 在启动时由 `apps/web/src/bootstrap/env.ts:4` 注入，取 `VITE_APP_TITLE`（实际值 `Antdv Admin`， `apps/web/.env:2`），并且**每次读写时重新解析**（`packages/shared/src/cache/index.ts:40-45,75`）。生产环境写入值经 SM4 加密（`packages/shared/src/cache/encrypt.ts:152-154`）。

| 持久化内容 | key | 写法 | 事实来源 |
| --- | --- | --- | --- |
| token / 用户信息 | `auth_token` / `refresh_token` | `encryptToken` 后落盘，token 过期 24h | `user.ts:14-15,51-61` |
| 标签页 | `tabsState` | `watch` 里 `cache.setItem` | `tabs.ts:15,41-50` |
| 字典 | 按字典码 | `localStorageCacheStorage` + **1 小时 TTL** | `dict.ts:33-53` |
| 菜单"导航显示"覆盖 | `xy-menu-hidden-overrides` | 裸 `localStorage`，不走 cache 前缀 | `route.ts:27,39-47` |
| 偏好设置 | `appSetting`（带前缀） | preferences store 自己 persist | `packages/preferences/src/store.ts:104-105,144-150` |
| 语言 | `locale` | **裸 key**，与偏好的 `locale` 是两套 | `src/locales/index.ts:11`、`composables/web/useLocale.ts:20-25` |

::: warning `VITE_NAMESPACE` 是个死变量它只出现在 `apps/web/.env:1`、`types/env.d.ts:31` 和这份文档里，**没有任何代码路径读它**。想按环境隔离 localStorage，目前只能靠 `VITE_APP_TITLE` 前缀（改 title 会让全部旧缓存失效，这是它的实际效果）。别指望设个 namespace 就能多标签隔离。:::

## app store 是偏好的门面，不是第二份状态

真正的所有权在 `packages/preferences`：`createPreferences()` 给出一组 ref/computed， `updateSetting` / `toggle` 提交后同步 persist + 写 DOM（`store.ts:99-214,160-168`）。 `app.ts:28-95` 用 `pick()` / `toRef` 把它**展平**成 `appStore.primaryColor` 这类只读 ref， `app.ts:100-124` 再把 `updateSetting`、`toggles.*` 暴露成写入 API。

所以：

- 读配置 → `appStore.xxx`（或 `appStore.appSetting` 拿整份）
- 写配置 → `appStore.updateSetting({...})` / `appStore.toggles.xxx()`
- **不要**在 app store 里加新的 `ref` 存业务状态，那是给偏好用的门面层
- 判断当前是深是浅要用 `resolvedTheme` / `isSystemDark`（`app.ts:41-48`、 `theme-mode.ts:15-21`），因为默认 `theme: 'auto'`，`appStore.theme` 可能是 `'auto'`

详见[主题与偏好设置](/guide/in-depth/theme)。

## 该放 store，还是不该

| 情况 | 放哪 |
| --- | --- |
| 跨路由存活、刷新后要在（登录态、菜单、标签页、偏好、字典） | store + 显式持久化 |
| 跨路由存活、刷新可以没有（页面缓存集合、请求 loading） | store，不持久化 |
| 只有父组件和子组件要 | `provide` / `inject` 或 props，别进全局 |
| 一个页面的表单草稿 | 组件内 `ref` |

::: tip 想加一个新 store 照着 `dict.ts` 写：setup store、`defineStore('dict')` 风格的第一参数用稳定 id、需要落盘就在 `watch` 里显式 `cache.setItem`，并在 `user.ts` 的登出流程里加清理。别忘了同步更新 `stores/index.ts` 的导出，或者直接按 `~/stores/modules/xxx` 引。:::
