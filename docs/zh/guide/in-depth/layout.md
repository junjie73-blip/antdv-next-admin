# 布局、菜单与标签页

这一页讲"一个路由页面上线后要经过哪些层"，以及每层的职责边界 —— 改样式、加交互、排查 "页面怎么没撑满 / 内边距怎么叠了两层"这类问题，都从这里入手。

## 布局形态由"区域蓝图"描述

7 种形态定义在 `@antdv/types` 的 `LayoutMode`：

```
full-content · horizontal · mixed-two-column · mixed-vertical · side-nav · two-column · vertical
```

**"有哪些形态"属于类型包，"每种形态长什么样"属于 `@antdv/layouts`**，后者用一份 `LAYOUT_BLUEPRINTS` 把每种形态拆成可枚举的开关：

| 字段 | 含义 |
| --- | --- |
| `chromeless` | 出不出外壳（顶栏 / 侧栏 / 标签页） |
| `headerNavVisible` / `headerNavDepth` | 顶栏放导航还是放面包屑，导航展开到第几级 |
| `navRailVisible` / `railDepth` | 图标栏出不出来，承载第几级 |
| `sidebarSource` / `sidebarPresentation` | 侧栏数据来自整棵树、当前顶栏分组，还是不出；`drawer`（浮层抽屉，盖在内容区上）还是 `inline`（常驻，挤占内容区宽度） |
| `hideSidebarWhenEmpty` | 侧栏没内容时整块消失，不占宽度 |
| `headerLead` | 顶栏左端是 Logo 还是面包屑 |

::: tip 加第 8 种形态只在 `LAYOUT_BLUEPRINTS` 里加一条 + `LayoutMode` 联合类型里加一个字面量，布局组件不用动。这就是把形态差异做成数据而不是 `if/else` 的目的。历史值 `'mixed'` 已重命名为 `'mixed-vertical'`，旧缓存由 `normalizeLayoutMode()` 在读偏好时迁移，不入库。:::

## 内容区内边距归布局管

`@antdv/layout-ui` 的 `LayoutContent`（`packages/core/ui-kit/layout-ui/src/components/layout-content/index.vue:44`）在内容区外面套了一层 `<Scrollbar view-class="p-4">`，也就是说 **页面内容的所有者已经是布局**。路由页面**再**给自己的外层容器加一份 padding，表现是内容离边缘 40px、和别的页面对不齐、卡片阴影被顶出可视区。

口径：**所有路由页面的外层容器不写 padding**，页面内部的卡片、代码块、抽屉内容该有内边距随便有。这条由 `apps/web/src/views/__tests__/page-root-padding.spec.ts` 当源码契约钉住 ——它扫每个 `.vue` 页面文件的**根容器**，禁止 `p-*` / `px-*` / `pt-*` 这类工具类和行内 `padding:`，同时断言布局那份 `p-4` 还在（挪走了就得回来改口径）。

扫描范围要覆盖三种页面来源（文件约定式路由、`routes.ts` 静态路由、菜单接口动态注册的 `account/*`），所以按文件走而不是按路由表走，只排掉页面私有组件（`views/<页>/components/**`、`widgets/**` —— 它们不是页面，见下）。

## 二级路由：开发态热更新

页面按 `views/<模块>/<页面>/index.vue` 摆放，一级/二级页面共用同一套布局外壳。

开发态有个很具体的坑：编辑一个二级页面（例如 `views/system/user/index.vue`）保存后，顶栏、侧栏、标签栏、面包屑整套外壳**整个消失**，页面变成脱离布局的整屏，只能整页刷新找回来。生产构建不会发生，所以它只消耗开发时间 —— 但消耗的是每天几十次的那种。

根因是**两套路由机制在 HMR 路上没接上**：

- `vite-plugin-vue-layouts-next` 把布局**编译进路由表** —— `setupLayouts()` 给每个页面套一层 `{ component: LayoutWrapper, meta.isLayout }` 的父记录；
- 而 `vue-router/auto-routes` 自带的 HMR 是 `router.clearRoutes()` → 逐条 `addRoute(新生成的裸路由)`，裸路由里没有那层父记录，页面于是被挂回顶层；
- 布局壳的父记录**没有 `name`**，所以自愈不了：`stores/modules/route.ts` 的注册表对齐按 `router.hasRoute(name)` 判断缺席，无名记录永远判不到。

修法是走官方留的口子：`handleHotUpdate` 的第二个参数按声明在"替换路由之后、导航之前"被调用，在这里拿到刚重新生成的裸路由，用抽出来的 `buildAppRoutes()` 把整张路由表**重铺一遍**。不做"只补布局"的增量修补 —— 那次 `clearRoutes()` 连静态路由一起清了（`/login`、 `/redirect/**`、404 兜底），漏掉 404 兜底在 dev 下表现为乱敲地址直接白屏，比丢布局更难归因。

`apps/web/e2e/dev-route-hmr.spec.ts` 钉住三件事：外壳仍在且**没有重复套第二层** （`sidebar` / `header` 各数到 1）、二级页面仍渲染在布局里、静态路由与 404 兜底都还认得。两个口径值得抄：

- 用例先断言"确实观察到 `vue-router/auto-routes` 被热更新过"才往下走 —— 那次更新没发生的话，后面每条断言都只是在检查启动状态，坏掉也照样绿；
- 这条**只在 chromium 跑**：改一次页面文件会让 dev server 给所有连着的浏览器重发路由表更新，三个引擎同时既改又看就是互相制造噪音，而被保护的东西与引擎无关。

## 标签页

标签页状态从组件里抽到了 store，所以拖拽排序、右键菜单、最大化都能跨形态复用；渲染层拆成小组件（单个 tab、下拉新增按钮、右键菜单各自一个文件），外壳只负责装配。

- **风格**：`TabStyle = card | chrome | line | plain | rounded`。`chrome` 就是谷歌风格——按浏览器标签画：32px 高的胶囊坐在栏底，选中页用一对伪元素长出"反向圆角"与内容区无缝相接，标签之间是 1px × 16px 的发丝线，悬停到自己、选中的前一个、或整条的第一个时线自动让位（`TabsBar.vue` 的样式块）。
- **排序**：拖拽换顺序，状态写回 store，切换布局形态不丢。
- **右键菜单**：固定 / 最大化 / 重载 / 新窗口 / 关闭左侧 / 关闭右侧 / 关闭其他 / 关闭全部。
- **缓存**：接通 `keep-alive`，固定标签与"缓存"标记的页面切回去不重新请求。
- **外链**：`isExternal` 的菜单项不进标签页。

::: warning 巡检时要避开的一条陷阱外壳的多标签页本身渲染成 `a[href^="#/..."]`。写用例时凡是"数内容区里的链接"都必须先圈进 `<main>`，否则永远多算几枚 —— 总览页的卡片墙过滤到空时数出来 1 个以上，就是这么来的。:::

## 面包屑

面包屑从菜单树派生（`@antdv/layouts` 的 `breadcrumb.ts`），所以图标与层级天然和菜单一致：一级菜单没子级时不硬凑一层，"个人中心"这类被标 `hidden` 的节点不进面包屑。首次进入页面就要求立刻有面包屑 —— 曾经的 bug 是要点一次菜单才出来，因为派生是懒算的。

## 滚动条

全站内容滚动统一走 `@antdv/common-ui` 的自绘 `Scrollbar`，不用各页面自己写 `overflow: auto` + `::-webkit-scrollbar`：后者在 Firefox / Safari 上表现不一致，而 `Scrollbar` 是同一套 DOM 与样式，三引擎端到端才可能得到一样的结果。
