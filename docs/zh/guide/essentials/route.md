# 路由与菜单

这个应用的路由是**三层拼出来的**，再加**一份后端菜单**：文件约定路由生成页面记录 → 布局插件给它们套上外壳 → 静态路由与兜底补齐 → 登录后按 `/menus` 的返回裁剪注册表。搞清这四层，"页面白屏 / 布局没了 / 进不去 403"这类问题基本都能自己定位。

## 路由表是怎么组装的

```ts
// apps/web/src/router/index.ts:20-22
function buildAppRoutes(autoRoutes: RouteRecordRaw[]): RouteRecordRaw[] {
  return [...constantRoutes, ...setupLayouts(autoRoutes), catchAllRoute];
}
```

| 来源 | 内容 | 事实来源 |
| --- | --- | --- |
| 约定路由 | `src/views` 下的 `.vue`/`.tsx` 按目录生成路径，路由名由 `getFileBasedRouteName` 推导 | `internal/vite-config/src/plugins/vue.ts:18-37`，类型落在 `apps/web/types/router.d.ts` |
| 布局层 | `vite-plugin-vue-layouts-next` 把页面塞进 `{ component: LayoutWrapper, meta.isLayout }` 的**无名父记录** | `internal/vite-config/src/plugins/vue.ts:52-55`、`apps/web/src/router/index.ts:51` |
| 静态路由 | `/`→`/login`、`/login`、`/register`、`/redirect/:path(.*)` | `apps/web/src/router/routes.ts:7-56` |
| 兜底 | `/:pathMatch(.*)*` → `/error/404` | `apps/web/src/router/routes.ts:58-68` |

排除规则要记住三条：`**/*/components/*` 不进路由表（页面内私有组件）、`account|login|register/**` 的 `index` 不当约定路由处理、布局插件同样跳过 `**/components/**` 与 `**/widgets/**`。

Router 本体：`createWebHashHistory()` + `strict: true` + 每次导航滚回顶部（`apps/web/src/router/index.ts:33-41`）。

::: warning

`/redirect/:path(.*)` 必须显式注册 `views/redirect/index.vue` 只会生成精确匹配的 `/redirect`，接不住标签页"刷新当前"用的 `/redirect/system/user`。它写在 `constantRoutes` 里，先于约定路由生效（`apps/web/src/router/routes.ts:39-45`）。删它之前先想清楚标签页刷新怎么补救。
:::

## meta 里能写什么

类型定义在 `packages/types/src/app-router.ts:3-12`：

| 字段 | 谁在读 | 说明 |
| --- | --- | --- |
| `title` | 标题守卫 + 菜单 + 标签页 + 面包屑 | 字面字符串，**不走 i18n** |
| `requiresAuth` | 鉴权守卫（`packages/router/src/meta.ts:12-19`） | 缺省即"要登录"，所以公开页要显式写 `false` |
| `hidden` | 菜单渲染时剔除 | 只在渲染层剔，路由仍然可直达 |
| `icon` | 侧栏 / 图标栏 / 标签页 / 面包屑 | Iconify 名，如 `carbon:dashboard` |
| `keepAlive` | 页面缓存集合 | 与"标签页是否开着"共同决定缓存，见[布局、菜单与标签页](/zh/guide/in-depth/layout) |
| `layout` | `'blank' \| 'default'` | 登录/注册/错误页用 `blank` |
| `roles` / `permissions` | **没有消费者** | 按钮级权限另走指令，见[权限、指令与光标](/zh/guide/in-depth/access) |

另外装配层还会读两个**没写进 `RouteMeta`** 的字段：`meta.microApp` （`packages/layouts/src/basic/layout.vue:285`）与 `meta.noTransition`（`:294`）。目前仓库里没有路由设置它们，用之前记得补类型。

## 守卫：固定五段

顺序写死在 `packages/router/src/guards/index.ts:36-75`，依赖注入在 `apps/web/src/router/guards/index.ts:38-111`：

```
progress → auth → dynamicRoutes → title → navLog
```

1. **progress**（`guards/progress.ts:24-52`）：NProgress 起/停。必须返回 `undefined`，返回别的会把导航吞掉。
2. **auth**（`guards/auth.ts:14-37`）：已登录访问登录页→踢回首页；`requiresAuth: false` 或白名单放行；否则跳 `LOGIN_PATH` 并带 `query.redirect`。白名单与首页常量在 `apps/web/src/config/constants.ts:9-18`（`HOME_PATH = '/dashboard/analysis'`）。
3. **dynamicRoutes**（`guards/dynamic-route.ts:51-104`）：首次导航懒加载 `loadRoutes()`；加载失败**吞掉异常后放行**（`:71-78`）；`canAccess({name, path})` 不通过→ `/error/403`；点在目录节点上→ `resolveDirectory` 落到第一个可见子页（应用实现 `apps/web/src/router/guards/index.ts:85-91`）。
4. **title**（`guards/title.ts:20-51`）：`页面标题 | VITE_APP_TITLE`，并滚回顶部。
5. **navLog**：埋点。应用侧还额外挂了一个 `beforeEach` 做注册表自愈（`:129-132`）。

## 菜单来自后端，不来自路由表

::: warning

这是最容易搞反的一点侧栏**不是**从 routes 递归出来的。登录后 `GET /menus` 返回菜单树（`apps/web/src/stores/modules/route.ts:112-117`），前端只做三件事：
:::

1. `normalize()` 把后端字段映射成内部结构：`menuName → title`，带 `icon/hidden/isExternal/path/keepAlive/children`； **不排序**，顺序就是数组顺序（`route.ts:86-99`）。
2. `attachMenuPaths()` 拿菜单去路由表里反查真实 path，五级优先级匹配（`packages/shared/src/utils/menu.ts:258-314`）。菜单里写了个路由表没有的 path，页面就打不开。
3. `syncRouteRegistry()` 反过来**裁剪路由**：白名单豁免、`requiresAuth: false` 豁免、父节点因子节点保留而保留、重复 path 取首个，增量 `addRoute`/`removeRoute` （**从不用 `clearRoutes`**）（`route.ts:189-263`、`packages/shared/src/utils/menu.ts:82-106`）。

渲染层：`buildMenuItems` 的 key 依次取 `name → path → title`（`menu.ts:32-36,561-591`），外链渲染成 `<a target="_blank">`（`:440-455`），顶层节点按布局蓝图分派到顶栏 / 图标栏 / 侧栏（`packages/layouts/src/menu-source.ts:165-191`），嵌套树**不拍平**。

本地还有个只影响显示的"导航显示"开关，落在 `localStorage['xy-menu-hidden-overrides']` （`route.ts:27,324-331`）—— 它不改变可访问性，藏起来的路由照样能直达。

## dev 下的 HMR 坑

改任何一个页面文件都会让 `vue-router/auto-routes` 重新求值，它自带的 HMR 是 `clearRoutes()` → 逐条 `addRoute(裸路由)`，而裸路由**没有布局父记录**。所以这里接管了 `handleHotUpdate`，用同一个 `buildAppRoutes` 把整张表重铺一遍（`router/index.ts:46-73`）。

表现与结论：

- 自己写 HMR 分支、只"补布局"的增量修补是**错**的——静态路由（登录、`/redirect/**`、404 兜底）会被同一次 `clearRoutes()` 清掉，漏掉兜底就是"乱敲地址白屏"。
- 裁剪用的快照 `appRoutes` 只在启动时定格一次（`router/index.ts:31`、 `stores/modules/route.ts:289-292`），HMR 不会让它漂移。
- 这段只影响 dev：`import.meta.hot` 在生产构建里被常量替换，整段不进包。

## 加一个页面要动几处

| 场景 | 要做的 |
| --- | --- |
| 新增一个能看到的页面 | 建 `src/views/xxx/index.vue`（约定路由自动收），再在后端菜单里加一条 `path` 指向它 |
| 新增一个不进菜单的页面 | 建文件 + `meta: { hidden: true, requiresAuth: true }`，直达 URL |
| 新增公开页 | 放进 `constantRoutes` 并显式 `requiresAuth: false`，同时加进 `WHITE_LIST` |
| 只想让它套空白布局 | `meta.layout = 'blank'` |

::: warning

只建文件不加菜单的结果路由存在、守卫能进，但侧栏看不到——因为侧栏读的是 `/menus`。反过来，只加菜单不建文件， `attachMenuPaths` 反查不到 path，点击不跳转。两边都得有。
:::

## 微前端路由

注册表按 `baseroute` 匹配子应用，loader 支持 `webcomponent` / `iframe`，总开关是 `VITE_MICRO_APP`（`apps/web/src/config/micro-app.ts:5-12`）。视图读 `meta.microApp`，同源时用 sandbox（`views/micro-app/SubAppView.vue:38`、`packages/types/src/menu.ts:24-31`）。
