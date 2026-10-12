---
'@antdv/web': patch
---

fix: 实时监控大屏的图表跟随**容器**自动 resize

诉求：**实时监控大屏的 echart 需要自动 resize**。

页面原本只有 `useEventListener(window, 'resize', ...)` 一条 resizing 通路，而大屏里真正频繁改尺寸的动作都**不动视口**：

- `useScreenAdapter` 重算 `scale`（只改 `#screen-content` 的 width/height/margin）；
- 侧栏折叠、标签页最大化、窗口半屏；
- 大屏在 `layouts/index.vue` 里被禁掉了 transition + keepAlive，回到该页时容器是重新 layout 出来的。

这些情况下 echarts 画布停在旧宽上：轴标签被截断、右侧一大块留白、整张图糊在一起。另外确认过 **echarts 6.1.0 没有 `autoResize`**（全量 d.ts 里搜不到这个字段），所以不能靠 option 打开，只能自己挂观察器。

## 改动

`apps/web/src/views/screen/monitor/index.vue`：

- 新增常驻的 `observeChartSize(name, el)` —— 每张图建起来之后给它的容器挂一个 `ResizeObserver`，回调里 `charts.get(name).resize()`。注意 `charts` 这张 map 是按**图表名**（`'pv'` / `'uv'` …）索引的，不是按 DOM 节点，第一版按 element 取实例导致回调永远拿不到图，白跑一轮；
- 回调里带 `clientWidth > 0 && clientHeight > 0` 的门槛：容器被 `display: none` 藏起来时尺寸是 0，此时 resize 会把画布压成 0×0，再显示出来就是一片空白；
- `initChartImmediately` 的**两条**分支都要挂（容器立刻有尺寸的同步路径 + `whenReady` 等尺寸的异步路径），漏一条就等于"首屏没尺寸的图永远不自适应"；
- 和 `whenReady` 那个一次性观察器分开登记进 `sizeObservers`， `onBeforeUnmount` 里 `stopObservingChartSize()` 先断观察器再 `disposeAll()` ——延续 `monitor-cleanup.spec.ts` 立下的"离开大屏不留尾巴"契约，观察器不能悬挂在已卸载节点上。

## 验证

- 单测：`apps/web/src/views/screen/__tests__/monitor-cleanup.spec.ts` 新增「容器变宽变高时图表跟着 resize」—— 给观察器回调整寸，断言 `resize` 调用次数增加，卸载后所有观察器 `disconnected`。断言只统计 `resize` 次数，**不去数观察器个数**：页面里 Scrollbar、适配钩子也在挂 `ResizeObserver`，按个数断言必假红。jsdom 下所有盒子都是 0×0，所以这条用例在 `try/finally` 里把 `HTMLElement.prototype` 的 `clientWidth/clientHeight/offsetWidth/offsetHeight` 临时打成 320，用完还原。
- 端到端：`apps/web/e2e/screen-resize.spec.ts`（chromium / firefox / webkit 各 1 条）把主图容器改成 `width: 55%` —— **全程不改视口**，再断言画布跟上。踩到过三个坑，都写进文件头注释了：
  1. `querySelector('canvas')` 的"第一张画布"会随渲染时机命中不同小图，必须认死PV 主图的容器（`[class*="min-h-[200px]"]`，全页唯一）；
  2. 量尺寸和缩容器要用**同一个 locator 句柄**，各查一次 DOM 会让用例在没修复的代码上绿掉；
  3. 容器宽度取 `clientWidth` 而不是 `getBoundingClientRect().width`（根节点被打了 `scale`，后者读到的是缩放后的视觉宽，实测 908 的容器读成 605），画布宽度取 `canvas.style.width` 而不是 `canvas.width`（webkit 上下文 dpr=2，CSS 499 对应 buffer 998）。最终判据是两条同时成立：画布比初始值**真的变小了**（`canvas < initial.canvas - 100`）且贴住新容器宽（`|canvas - host| <= 3`）。只留后者会假绿 —— 实测有过一次首帧读到尚未缩小的容器宽，8.4s 就"通过"了。反向验证：把两处 `observeChartSize` 注释掉，同一条用例稳定失败（`908 / 499`），恢复后三引擎复绿。
