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

自研插件 `internal/vite-config/src/plugins/app-loading`，把一段 HTML 注入到 `#app` **之外**（body prepend），所以 Vue 挂载碰不到它。三个必须知道的约定：

- 应用入口**常驻** `import { loadingFadeOut } from 'virtual:app-loading'`， `main.ts` 在 `app.mount('#app')` 后 `void nextTick(() => loadingFadeOut())`。插件刻意配 `autoRemove: false`：挂载动作顶不掉遮罩，没人调用它就永远盖住页面并吞掉所有点击。
- 虚拟模块**永远可解析**，与开关无关：`VITE_INJECT_APP_LOADING` 只决定注入不注入（见 `.env.development` / `.env.production` 均为 true），把整个插件包进 if 里会让构建期 resolve 失败直接 500。
- 遮罩主题自动跟随 CSS 变量（`autoTheme: true`，扫描 `src/**/*.css` 等，前缀 `--color-`，排除 `--ant-*` / `--tw-*` 等），淡出时长走 `VITE_APP_LOADING_DURATION`。

## 2. 路由切换层

两个并行的东西，职责不同：

| 件 | 来源 | 说明 |
| --- | --- | --- |
| NProgress | 守卫装配 `router/guards/index.ts`（`minimum: 0.1`，`trickleSpeed: 200`），样式在 `@antdv/design` 的 `css/nprogress.css` | 顶栏那条细线，偏好 `showProgressBar`（默认 true）管它的可见性 |
| `RouteLoadingBar` + `PageLoading` | `apps/web/src/components/common/Loading/`，状态来自 `@antdv/composables/useRouteLoading` | 布局 `layouts/index.vue` 里 `useRouteLoading({ minDuration: 400, auto: true })`：进度条 `:duration="250"`、开百分比、可取消（`@cancel="cancelRouteLoading"`）、慢加载阈值 3000ms；内容区 `PageLoading` 绑同一个 `isLoading`，`isSlow` 转成错误态提示 |

`useRouteLoading` 的 `minDuration` 是**防闪烁**用的：路由秒开时 loading 也至少显示满这个时长再收尾，否则进度条一闪反而更焦虑。它还提供 `withLoading(fn)` 包一段异步操作（状态同步置位，不等 rAF —— 源码注释里有"快结束调用走进未开始分支、进度条永远挂着" 的修复记录）。

页面进场动画在 `components/layout/PageTransition.vue`：`@vueuse/motion` 按偏好 `transitionEffect`（默认 `fade-slide`，variants 在同目录 `transitions.ts`）播放 enter， `usePreferredReducedMotion` 为 `reduce` 时直接跳到终态 —— 尊重系统设置不是可选项。

## 3. 元素级遮罩

`@antdv/loading-ui` 三件套（指令在 `main.ts:8` 取 `vLoading`、`:113` 注册：`app.directive('loading', vLoading)`）：

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

- 属性映射表在 `packages/ui-kit/loading-ui/src/directive.ts:34-39`：`loading-tip / loading-theme(light|dark) / loading-size(default|small|large) / loading-background`， `binding.arg` 优先级高于 `loading-tip`。
- 函数式：`createLoading` / `createFullscreenLoading` / `createContainerLoading`，返回 `LoadingInstance`（`open` / `close` / `setTip` / `destroy`）。 `close` 等淡出动画后自清理，`destroy` 强制立刻移除 —— 路由守卫中断、组件卸载这类 "确定不再显示"的场景必须用后者，示例页 `views/components/loading/index.vue` 里有完整的定时器清理示范。
- 声明式 `Loading` 组件与 `useLoading` 组合式也在同一包，props 见 `packages/ui-kit/loading-ui/src/types.ts`（`absolute` 区分容器内/全屏）。转圈的东西是 `@antdv/shadcn-ui` 的 `Spinner`，不再依赖 antdv-next 的 `Spin`。

## 4. 组件内建与骨架屏

- `BasicTable` 内部有 `hooks/useLoading`，`api` 拉取期间自动转圈，实例方法 `setLoading(value)` 可手动干预 —— 表格不要再自己盖 `v-loading`。
- 骨架屏在 `apps/web/src/components/common/Skeleton/`：`PageSkeleton`、 `TableSkeleton`，用于首屏占位；空态/错误态另有 `EmptyState`、`ErrorBoundary`。
- 请求层（`packages/request/`）**不提供全局 loading**，它管缓存、去重、重试、401 重放；loading 归调用方。别给 fetcher 加隐式遮罩，会和上面四层打架。

## 开关一览

| 开关 | 位置 | 关掉的表现 |
| --- | --- | --- |
| `VITE_INJECT_APP_LOADING` | `.env.*` | 首屏无遮罩（虚拟模块仍在，`loadingFadeOut` 空转） |
| `showProgressBar` | 偏好（设置抽屉「通用」面板） | 顶栏进度条隐藏 |
| `showLoading` | 偏好，默认 `true` | 路由级内容 loading 隐藏 |
| `transitionEffect` | 偏好 | 页面进场动画样式 |

判断这些开关是否生效请走 `isEnvEnabled` 的口径，见 [Vite Config](/zh/guide/project/vite) 里的环境变量类型转换陷阱。

## 相关页面

- 布局与标签页：[布局与标签页](/zh/guide/in-depth/layout)
- 主题与 CSS 变量：[主题与偏好设置](/zh/guide/in-depth/theme)
