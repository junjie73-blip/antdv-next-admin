---
'@antdv/common-ui': minor
'@antdv/web': patch
---

feat: `Listy` 加虚拟滚动模式，万级数据只渲染视口内那十几行

`Listy` 原来只有直排一条路：`items` 有多少就挂多少个 `<li>`，两千条就够卡。这次加 `virtual` 开关，**同一套行模板、同一个 `<li>` 形状**，打开后只渲染窗口内的行；滚动算术一律压在 `@vueuse/core` 的 `useVirtualList` / `useScroll` / `useResizeObserver` 上，没有自研第二套虚拟化实现。

- **新增 props（`types.ts` 48 → 134 行，`Listy.vue` 156 → 434 行）**：`virtual`（默认 `false`，关掉时行为与之前完全一致）、`container-height`（默认 320，数字加 px、字符串原样）、`item-height`（`number | (index, item) => number`，默认 40）、`measure-heights`（默认 `false`）、`overscan`（默认 5）。事件两条：`scroll` 带整个 `ListyScrollState`，`item-click` 沿用原来的 `(item, index)`。暴露的状态与方法：`scrollState` / `visibleItems` / `visibleRange` / `totalHeight` / `arrivedState` / `directions` / `isScrolling` / `containerElement`，方法 `scrollToIndex` / `scrollTo` / `scrollToTop` / `scrollToBottom` / `recalc`。
- **`<ul>` 自己就是占位块**：`wrapperProps.style` 给 `<ul>` 同时上 `marginTop`（窗口之前所有行的总高）与 `height`（剩下的），不变量是 `marginTop + height === 内容总高`，所以滚动条长度与实际排布永远拼得上，不需要"外层撑高 + 内层绝对定位"那套脚手架。**代价是这一层不能再有 padding / border**，行的间距全部留在 `<li>` 自己身上。
- **`item-height` 一律以函数交给 VueUse**：`useVirtualList` 在建立时把选项解构掉了（`const { itemHeight, overscan } = options`），传数字等于把值冻在那一刻，之后改属性不会重算；给函数则每次求值都读最新 props，`item-height` / `measure-heights` / 换数据都自动跟上。代价是它内部的定位扫描从 O(1) 变 O(n)，20 000 行 uniform 高度实测在几十微秒量级，滚动时看不见。`overscan` 是真的只读一次，类型注释里写明了改它要重挂。
- **动态高度的自愈观察**：`measure-heights` 关掉行内高度、由内容撑开，再对一个**只包含当前窗口行**的 computed 目标数组挂 `ResizeObserver`，量到的 `offsetHeight` 回灌 `measuredHeights`；读的是 `virtualRows`，所以窗口一移动新进视口的行就自动补上测量（`observe()` 对新元素必定回调一次，头部插数据导致的下标错位会被下一轮实测覆盖，不需要手动清缓存）。回调里**只写高度不手动重算**：`measuredHeights` 一变 `totalHeight` 就变，VueUse 自己 watch 着总高，在这里同步滚反而容易撞 `ResizeObserver loop` 警告。
- **首帧必须自己算一次窗口**：视口用**函数式 ref**（`setViewportRef`）而不是 `:ref="containerProps.ref"`，因为绑 Ref 对象要等 watcher flush 才写入，`onMounted` 里那次 `recalc()` 会量到 `null` —— 万级列表在第一次滚动之前是空的。`containerSize` 同样在 `onMounted` 先同步读一次 `clientHeight`，剩下的交给 `useResizeObserver`（无 ResizeObserver 的环境不至于永远等不到回调）。
- **`scroll` 事件由 `watch(scrollY)` 发**：`useScroll` 的 `y` 是 computed，位置真的变了才回调，所以程序化滚动、就地换数据都走同一条路，不需要补发；反过来在同一个 `scrollTop` 上 dispatch `scroll` 是不会产生事件的（单测里踩过）。

验证：

- `common-ui` 单测 26 个文件 / 280 条全绿（新增 `__tests__/listy-virtual.test.ts` 300 行 / 17 条：窗口长度、`visibleRange` 与 DOM 行一致、`marginTop + height` 拼总高、`scrollToIndex` 落点、动态模式实测回灌后总高变化、直排路径未回归）。两条 jsdom 坑值得记：首帧窗口在 `onMounted` 里算，挂载后必须 `await nextTick()` 才查得到 `<li>`；jsdom 永不应用 `<style>`，`offsetTop/offsetHeight` 恒为 0，所以占位高度断言改成解析 `<ul>` 的行内 style（在 jsdom 里断言几何只会得到恒等式）。`vue-tsc --noEmit` 与 eslint 干净。
- 浏览器端到端：`apps/web/e2e/listy-virtual.spec.ts`（289 行 / 8 条）在 chromium + firefox + webkit 三个引擎各 8/8。钉的都是 jsdom 量不到的东西：20 000 条只挂 12–16 行且**每行 computed 高度恰为 48px**、`data-rendered` 等于 DOM 行数、滚到中段 `data-start` 与渲染行的绝对下标连续、`scrollToIndex(10_000)` 之后目标行真的在视口里、跳到底 `data-end === '19999'` 且 `progress ≈ 1`、`measure-heights` 下行内不再写高度且至少两种实测高度、`overflow-y: visible` 的直排对照 30 行全量渲染、30 步 rAF 连续滚动没有单帧超过 250ms 且窗口零报错。两个环境坑：`toBeInViewport` 量的是与**页面**视口的相交，点卡片右上角按钮会把 320px 的列表顶出折叠线，断言前要先 `scrollIntoViewIfNeeded()`；本机 WebKit 时序比 Chromium 慢 2–4 倍，100ms 阈值是假红，按实测放宽到 250ms 并把数值写在注释里。
- 示例页：`apps/web/src/views/components/listy/index.vue`（336 行）新增「虚拟滚动」四张卡 —— 固定行高（顶部/底部/跳到 #10000/跳到末行/切换视口高度五个按钮 + 一行 machine-readable 的 `data-testid="listy-stats"`）、函数行高（每 10 行一组首行 72px，20 000 行合计 936 000px）、动态行高（`#item` 换成可换行段落，说明长度随行号变化）、直排对照（同一份数据不开虚拟）。临时截图脚本与截图目录已清理。
- 文档：`docs/components/common-ui.md` 与 `docs/en/components/common-ui.md` 的 Listy 一节补齐五个新 prop、两条事件、暴露的状态与方法、最小可用示例与「虚拟模式怎么跑起来的」五条实现说明，并新增 `::: warning 虚拟模式需要一个能滚的盒子`；导出清单补 `ListyRow` / `ListyScrollState` / `ListyScrollToOptions` 等七项，行号引用按 434 行的新版重新对齐。`_linkcheck.mjs` 与 `_sidebarcheck.mjs` 零缺失，`vitepress build` 通过。
