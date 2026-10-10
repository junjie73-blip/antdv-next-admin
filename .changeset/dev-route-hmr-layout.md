---
"@antdv/web": patch
---

fix: 开发态改页面文件不再把一级布局改没

现象很具体：本地 dev 下编辑一个二级页面（例如 `views/system/user/index.vue`），保存之后
顶栏、侧栏、标签栏、面包屑这一整套外壳整个消失，页面变成脱离布局的整屏，只能靠整页刷新找回来。
生产构建里不会发生，所以它只消耗开发时间 —— 但消耗的是每天几十次的那种。

- **根因是两套路由机制在 HMR 路上没接上**：本项目用 `vite-plugin-vue-layouts-next`
  把布局**编译进路由表** —— `setupLayouts()` 给每个页面套一层
  `{ component: LayoutWrapper, meta.isLayout }` 的父记录。而 `vue-router/auto-routes`
  自带的 HMR 逻辑是"`router.clearRoutes()` → 逐条 `addRoute(新生成的裸路由)`"：
  裸路由里没有那层父记录，页面于是被挂回顶层。布局壳的父记录**没有 `name`**，
  这正是它自愈不了的原因 —— `stores/modules/route.ts` 的注册表对齐按
  `router.hasRoute(name)` 判断缺席，无名记录永远判不到。
- **修法用官方留的口子**：`handleHotUpdate` 的第二个参数按声明"在替换路由之后、导航之前"
  被调用，拿到刚重新生成的那份裸路由。把路由表拼装的启动逻辑抽成 `buildAppRoutes()`，
  在这个回调里用同一个函数重铺一遍。
- **不采用"只补布局"的增量修补**：那次 `clearRoutes()` 连静态路由一起清了
  （`/login`、`/redirect/**`、404 兜底），增量补会漏掉它们；"漏掉 404 兜底"在 dev 下
  表现为乱敲地址直接白屏，比丢布局更难归因。重铺之后由它自己发起的
  `router.replace(..., force)` 会走到导航守卫里的注册表自愈，按菜单做的裁剪仍会重新对齐。
- `e2e/utils/app.ts` 的 `region()` 联合类型补上 `'header'`：代码里一直有这个区域
  （`data-layout-region="header"`），类型里少一项，探针就没法断言顶栏。

测试口径（新增 `apps/web/e2e/dev-route-hmr.spec.ts`）：

- 这条只能跑在 dev server 上（`playwright.config.ts` 本来就统一用 `pnpm dev`，
  不存在 preview 分支），并且**只在 chromium 保留一份**：改一次页面文件会让 dev server
  给所有连着的浏览器重发路由表更新，三个引擎同时既改又看就是互相制造噪音，
  而被保护的东西与引擎无关。
- 用例先断言"确实观察到 `vue-router/auto-routes` 被热更新过"才往下走 ——
  如果那次更新没发生，后面每条断言都只是在检查启动状态，坏掉也照样绿，空跑比没有用例更坏。
- 覆盖三件事：外壳仍在且**没有重复套第二层**（`sidebar`/`header` 各数到 1）、
  二级页面仍渲染在布局里、静态路由与 404 兜底都还认得。
- 检查静态路由用改 hash 而不是 `page.goto()`：goto 若触发整页加载就等于重新启动一遍，
  "热更新后静态路由还在吗"这条会永远为真。`/login` 的判据也不是"登录页渲染出来"
  （已登录会被守卫请回首页），而是"它被匹配到了"——这条常量路由缺席时 hash 会落到兜底去
  `/error/404`。
- 红绿都验过：临时把回调去掉后该用例立刻红（`sidebar` 数到 0），装回即绿。
