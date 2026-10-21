---
'@antdv/table-ui': patch
'@antdv/web': patch
---

fix: `dragSortConfig.disabled` 与 `canDrop` 真的生效（整表冻结、按行禁用、落点约束三种形态都钉）

诉求（用户原话）：定位并修复 `useDragSort` 的 `disabled` 参数与 `canDrop` 回调不生效的问题，确保参数传入后能正确控制拖拽排序的启用状态与元素拖拽放置规则。

- **`disabled` 不生效的根因是"拦错地方"**：Sortable 的构造参数 `disabled` 只在 `new Sortable()` 那一拍读一次，之后 `dragSortConfig.disabled` 换值不会回头；而 `onStart` 里 `preventDefault()` / `return false` 也是无效的 —— `EventDispatcher.js` 派发用户回调时写的是 `options[onName].call(sortable, evt)`，返回值直接丢掉。**唯一每次按下都现读、且返回值真的被认的门是 `filter`**，所以禁用判定搬到 `filter`，构造参数恒写 `false`（注释里留了这句原因，别被"disabled 怎么是 false"骗回去）。
- **`filter` 拦住时不能再吞 `mousedown`**：默认 `preventOnFilter: true` 会连 `preventDefault()` 一起做，结果禁用行里的按钮、链接、文本选中全废（用户下一条反馈就会是"禁用行连复制都做不到"）。写 `preventOnFilter: false`，与"点在非手柄区域压根不 preventDefault"那条路径保持同一口径。
- **两种 `disabled` 形态都支持**：布尔 `true` 整表冻结，函数形态按行判。函数拿到的必须是**数据记录**而不是 DOM 元素，所以行身份先认 `BasicTable` 写在 `<tr>` 上的 `data-row-key`，没写这个属性才退回下标换算。
- **`canDrop` 原来读的字段根本不存在**：Sortable 给 `onMove` 的事件对象上只有 `dragged` / `related` / `to` / `from` 和几个 `*Rect`，**没有** `oldIndex` / `newIndex` / `draggedRowIndex` / `relatedRowIndex`。照这些字段取下标，永远比的是"数据源第 0 条 vs 自己"，于是任何 `canDrop` 都看起来"没拦住也没放行"。`onMove` 的返回值本身是被认的（`!== false` 才换位），所以修法是把取索引改成从 `dragged` / `related` 反查记录。
- **快照必须在 `filter` / `onStart` 这一拍量**：拖拽中途 Sortable 会真的把 `<tr>` 挪位，此时再数"首行前有几个非数据行"就漂了。所以 `leadingRowCount`（测量行 / 占位行数量，用来把 DOM 下标换算成数据下标）和 `rowByKey` 都在 `filter` 里、DOM 还没动的时候量一次，`onStart` 再补一次。
- **落点约束要管"跨过的那几行"，不只是落点那一行**：一步拖得远时中间会掠过多行，只校验 `related` 的话"不能越过锁定行"形同虚设。所以 `onMove` 里对 `dragged` 与 `related` 之间的每个位置都调一次 `canDrop`；悬在自己原位（`dragRecord === dropRecord`）放行，不构成"越过"。

测试口径：

- 单测（`packages/core/ui-kit/table-ui/__tests__/drag-sort.test.ts`，19 条）钉的是**契约而不是 Sortable 内部**：布尔与函数两种 `disabled` 形态、前导偏移下的行对齐、`canDrop` 拿到的是哪两条记录、跨越路径逐行校验、"拖过之后 DOM 已换位仍按 `data-row-key` 认人"，以及"落点没有对应数据行时不许落"。
- 端到端（`apps/web/e2e/gallery-examples.spec.ts` 的拖拽一段，chromium / firefox / webkit 三引擎）只能走 Playwright 的 `dragTo`：sortablejs 1.15.7 走原生 HTML5 DnD，`mouse.down()` + 分步 `move()` + `up()` 这种手搓序列在这台机器上 3/3 召不出 `dragstart`。禁用行那条断的是"数据顺序不变"而不是"没动画"，因为 `filter` 命中时 Sortable 只是不起拖，DOM 没有任何可观察的中间态。
