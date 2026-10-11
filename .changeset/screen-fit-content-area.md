---
'@antdv/web': patch
---

大屏缩放改为按**内容区**计算，不再按视口。

`useScreenAdapter` 原来用 `window.innerWidth/innerHeight` 求 scale。大屏并不是独立打开的页面，它是管理后台内容区里的一页，外面还有侧栏、标签页、面包屑和布局内边距：1440 视口下 scale=0.75、缩完正好 1440 宽，而内容区实际只有约 1198 宽 —— 右侧「资源使用率 / 地区用户分布 / 服务与告警」整列被裁到视口之外，内容区还多出一条横向滚动条。另一半问题更隐蔽：折叠侧栏、标签页放大、切「内容全屏」都只改内容区尺寸、不动视口，只听 `window.resize` 就永远停在旧比例。

- **量谁**：宽度问容器自己（页面根节点从 `h-screen w-screen` 改成 `w-full`，块级布局给的是确定值），高度问外层滚动盒 `.scrollbar__wrap` 的 `clientHeight` 再减掉布局挂在 view 上的内边距 —— 容器自己的父级链是 `height: auto` 的滚动内容容器，量不到"可见高度"。
- **容器高度写死**：`transform: scale()` 不改变布局占位，`#screen-content` 的布局盒子始终是 1920x1080。原来靠页面根上那句 `h-screen w-screen` 硬撑，代价就是溢出外壳；现在由适配器量出来再写死，`#screen-container` 作为 `<Scrollbar>` 自带 `overflow-hidden` 裁掉未缩放的溢出盒子。
- **监听谁**：`ResizeObserver` 观察外层滚动盒（侧栏折叠 / 标签页放大 / 内容全屏都会碰到它），`window.resize` 只作兜底。顺带删掉一句从没被赋值的死代码 `const resizeObserver: null | ResizeObserver = null`。
- **配套**：`layouts/index.vue` 的内容内边距改成 `shellHidden ? '' : 'p-4'`。「内容全屏 / 标签页放大」是沉浸视角，四周留 16px 会把深色大屏围出一圈白边，等于全屏没全成。

验证：

- 单测 `src/views/screen/__tests__/screen-adapter.spec.ts`（8 条）。jsdom 里所有盒子都是 0×0，尺寸只能逐个元素挂 getter 伪造；用例把 `window.innerWidth` 故意设成 3840，任何还在按视口算的实现都会立刻对不上。踩到的坑：`scale` 的短板可能是高度，1280x720 下 540/1080=0.5 会把折叠前后的读数钉成一样，测不出"重算"，得给一个高视口或高容器让短板落到宽度上。
- e2e `e2e/screen-fit.spec.ts`（3 条 × 三引擎）：右侧整列不越界 + 无横向溢出、折叠侧栏后 scale 重算、内容全屏时内边距为 0 且铺满视口。判据一律用 `clientWidth` 与 `scrollWidth - clientWidth`，不碰 `getBoundingClientRect` 的缩放坐标系。
- 反向验证：把 `measure()` 换回 `window.innerWidth/innerHeight` 并去掉 `ResizeObserver`，前两条立刻红（`scale*1920 = 1599.99 > 容器 1359`、右侧列被裁）；第三条在「内容全屏」下容器恰好等于视口，按视口算也能过 —— 这条只用来钉内边距，不冒充缩放证据。
