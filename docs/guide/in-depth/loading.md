# 全局 Loading

一句话：**加载态分四层 —— 首屏遮罩（构建插件注入 HTML）、路由切换（进度条 + `useRouteLoading`）、元素级（`v-loading` 指令 / `Loading` 组件 / `createLoading`）、组件内建（表格 fetch loading、骨架屏）。每一层有自己的开关和归属，不要混用。**

```
浏览器请求 index.html
  → [1] 首屏遮罩（body 上，独立于 #app）
  → JS 加载、Vue 挂载
  → main.ts nextTick 后 loadingFadeOut() 摘除 [1]
导航到某页面
  → [2] NProgress（守卫里 start/done） + RouteLoadingBar / PageLoading（useRouteLoading）
      → 组件内拉数据 → [3] BasicTable 自己的 useLoading / 业务块用 [4] v-loading
```

## 1. 首屏遮罩：`vite:app-loading`

自研插件 `internal/vite-config/src/plugins/app-loading`，把一段 HTML 注入到 `#app` **之外**（body prepend），所以 Vue 挂载碰不到它。四个必须知道的约定：

- 应用入口**常驻** `import { loadingFadeOut } from 'virtual:app-loading'`， `main.ts` 在 `app.mount('#app')` 后 `void nextTick(() => loadingFadeOut())`。插件刻意配 `autoRemove: false`：挂载动作顶不掉遮罩，没人调用它就永远盖住页面并吞掉所有点击。
- 虚拟模块**永远可解析**，与开关无关：`VITE_INJECT_APP_LOADING` 只决定注入不注入（见 `.env.development` / `.env.production` 均为 true），把整个插件包进 if 里会让构建期 resolve 失败直接 500。
- 遮罩主题自动跟随 CSS 变量（`autoTheme: true`，扫描 `src/**/*.css` 等，前缀 `--color-`，排除 `--ant-*` / `--tw-*` 等），淡出时长走 `VITE_APP_LOADING_DURATION`。
- **模板本体是一个 HTML 文件**，不是 TS 里的模板字符串：`internal/vite-config/src/plugins/app-loading/defaults/loading.html`，插件以 `?raw` 在构建期读成字符串（`src/index.ts:10`），靠 `internal/vite-config/tsdown.config.ts:26` 的 `loader: { '.html': 'text' }` 内联进 dist —— 所以产物旁边不存在也不该有 `defaults/` 目录，运行时用 `__dirname` 去读文件必然 ENOENT。两种替换语法：EJS 风格 `<%= VAR %>` / `<%= VAR || '兜底' %>`（`src/html-injector.ts:60-64`，变量来自 `config.env` 与 `htmlVariables`）和 Vite 原生 `%VAR%`（`:66-68`，未识别的原样保留）。换自己的模板：`loadingHtmlPath`（应用侧已接 `VITE_APP_LOADING_PATH`，`internal/vite-config/src/plugins/index.ts:207`；路径解析不到时 `console.warn` 一句再回落内置模板，`src/index.ts:104-119`），或直接传 `loadingHtml` 字符串（优先级更高）。模板里的圆角一律 rem，颜色一律"CSS 变量 + 兜底值"。

## 2. 路由切换层

两个并行的东西，职责不同：

| 件 | 来源 | 说明 |
| --- | --- | --- |
| NProgress | 装配在 `apps/web/src/router/guards/index.ts:15-19`（`minimum: 0.1`、`trickleSpeed: 200`、`showSpinner: false`），`start`/`done` 以回调形式注入给 `@antdv/router` 的 `applyRouterGuards`（`:32-45`），样式在 `packages/core/base/design/src/css/nprogress.css` | 顶栏那条细线，偏好 `showProgressBar`（默认 true，`packages/core/preferences/src/config.ts:76`）管它的可见性 |
| `RouteLoadingBar` + `PageLoading` | `packages/layouts/src/basic/content/`（`route-loading-bar.vue`、`page-loading.vue`，出口在 `packages/layouts/src/index.ts:39,41`），状态来自 `@antdv/hooks/use-route-loading`（`packages/core/hooks/src/use-route-loading.ts:24`） | 装配点 `packages/layouts/src/basic/layout.vue:206-229`：`useRouteLoading({ minDuration: 400, auto: true })`，进度条 `:duration="250"`、`:show-percentage`、`:cancellable`（`@cancel="cancelRouteLoading"`）、`:slow-threshold="3000"`；内容区 `PageLoading` 绑同一个 `isRouteLoading`，`isSlow` 转成错误态提示（`:275-278`） |

`useRouteLoading` 的 `minDuration` 是**防闪烁**用的：路由秒开时 loading 也至少显示满这个时长再收尾，否则进度条一闪反而更焦虑。它还提供 `withLoading(fn)` 包一段异步操作（状态同步置位，不等 rAF —— 源码注释里有"快结束调用走进未开始分支、进度条永远挂着" 的修复记录）。

页面进场动画在 `packages/layouts/src/basic/content/page-transition.vue`：`@vueuse/motion` 的 `useMotion`（`:5-18`）按偏好 `transitionEffect`（`:30`、`:45`，默认 `fade-slide`，variants 在同目录 `transitions.ts`）播放 enter，`usePreferredReducedMotion`（`:24`）为 `reduce` 时直接跳到终态 —— 尊重系统设置不是可选项。

## 3. 元素级遮罩

`@antdv/common-ui` 三件套（指令在 `main.ts:8` 取 `vLoading`、`:118` 注册：`app.directive('loading', vLoading)`）：

```vue
<!-- 指令：配置从属性读，arg 是提示文本 -->
<div
  v-loading="isLoading"
  loading-tip="加载中..."
  loading-theme="dark"
  loading-size="large"
  loading-background="rgba(0,0,0,0.5)"
>…</div>
<!-- 修饰符 .body / .fullscreen：挂全屏而不是容器内 -->
<div v-loading.fullscreen="busy">…</div>
```

- 属性映射表在 `packages/core/ui-kit/common-ui/src/components/loading/directive.ts:34-39`：`loading-tip / loading-theme(light|dark) / loading-size(default|small|large) / loading-background`， `binding.arg` 优先级高于 `loading-tip`。
- 函数式：`createLoading` / `createFullscreenLoading` / `createContainerLoading`，返回 `LoadingInstance`（`open` / `close` / `setTip` / `destroy`）。 `close` 等淡出动画后自清理，`destroy` 强制立刻移除 —— 路由守卫中断、组件卸载这类 "确定不再显示"的场景必须用后者，示例页 `views/components/loading/index.vue` 里有完整的定时器清理示范。
- 声明式 `Loading` 组件与 `useLoading` 组合式也在同一包，props 见 `packages/core/ui-kit/common-ui/src/components/loading/types.ts`（`absolute` 区分容器内/全屏）。转圈的东西是 `@antdv/shadcn-ui` 的 `Spinner`，不再依赖 antdv-next 的 `Spin`。

## 4. 组件内建与骨架屏

- `BasicTable` 内部有 `hooks/useLoading`，`api` 拉取期间自动转圈，实例方法 `setLoading(value)` 可手动干预 —— 表格不要再自己盖 `v-loading`。
- 骨架屏在 `packages/core/ui-kit/common-ui/src/components/skeleton/`：`PageSkeleton`、 `TableSkeleton`，用于首屏占位；空态/错误态另有 `EmptyState`、`ErrorBoundary`。
- 请求层（`packages/request/`）**不提供全局 loading**，它管缓存、去重、重试、401 重放；loading 归调用方。别给 fetcher 加隐式遮罩，会和上面四层打架。

## 开关一览

| 开关 | 位置 | 关掉的表现 |
| --- | --- | --- |
| `VITE_INJECT_APP_LOADING` | `.env.*` | 首屏无遮罩（虚拟模块仍在，`loadingFadeOut` 空转） |
| `showProgressBar` | 偏好（设置抽屉「通用」面板） | 顶栏进度条隐藏 |
| `showLoading` | 偏好，默认 `true` | 路由级内容 loading 隐藏 |
| `transitionEffect` | 偏好 | 页面进场动画样式 |

判断这些开关是否生效请走 `isEnvEnabled` 的口径，见 [Vite Config](/guide/project/vite) 里的环境变量类型转换陷阱。

## 相关页面

- 布局与标签页：[布局与标签页](/guide/in-depth/layout)
- 主题与 CSS 变量：[主题与偏好设置](/guide/in-depth/theme)
