---
'@antdv/table-ui': patch
---

refactor: `BasicTable` 的表格骨架换成 `@antdv/shadcn-ui` 的 Table 原语，setup 里的逻辑按职责拆进 `hooks/` 与 `helpers/`

现象（用户归纳）：`basicTable` 还在用原生 `<table>/<thead>/<tr>/<td>` 手写结构，与其余组件（都建在 shadcn 原语上）不是同一套规范；同时 `setup` 里塞了取数、排版、吸边、光标、事件等上千行逻辑，改一处要通读全文。要求是**换原语 + 拆逻辑，但对外 API 与行为一律不变**。

- **骨架换原语**：`<table>` → `Table`，表头/表体/行/单元/页脚/说明依次换成 `TableHeader`、`TableBody`、`TableRow`、`TableHead`、`TableCell`、`TableFooter`、`TableCaption`，空态用原语的 `TableEmpty`（它自己生成 `<tr>`，把 `class` 与 `colspan` 落在 `<td>` 上）。原语来自仓库内 vendor 的 `@antdv/shadcn-ui`，不新增依赖，也不改它的源文件（外观一律在本包用类名表达）。
- **滚动容器只有一个**：`Table` 自带一层 `div[data-slot="table-container"] class="relative w-full overflow-auto"`，它就是唯一负责滚动的层；`.basic-table-body` 退成"定位祖先 + `bordered` 外框 + 稳定钩子"，**不能再写 `overflow-auto`** —— 两层都能滚时 `sticky top-0` 的表头会跟着外层一起走。`scroll.y` 的 `max-height` 与 `scroll.x` 的最小宽因此都落在那层容器上（`Table.vue` 只声明 `class` prop，`style` 透传正好落在容器）。
- **`scroll.x` 走 CSS 变量而不是 `:style`**：`<table>` 上的 `min-width` 必须是静态工具类才能被 Tailwind 扫到，所以写成 `min-w-[var(--basic-table-min-width)]`，变量值由容器 `--basic-table-min-width: ${scroll.x}px` 提供。同理表头/单元格共用一套盒模型类（`cellBoxClass`），否则同一列上下错位。
- **固定列与吸顶表头的配色改成实色**：`position: sticky` 只改绘制位置不给背景，透明底的固定单元格会被横向滚过去的普通单元格穿透（实测出现过"2026-10-1新增35-24编辑删除"叠字）。固定格取 `bg-inherit`，于是**行底一律要实色**：`TableRow` 默认的 `hover:bg-muted/50` 与 `data-[state=selected]:bg-muted` 里的半透明档在表头行必须压掉，`headRowClass` 显式给了 `bg-muted hover:bg-muted`；数据行的 hover/选中同样换成实色档（`bg-muted` / 主色混色），固定列才不会穿透。这也让 `cn()` 合成后的 `<tr>` 类名变成 4 种快照，`e2e/cursor.spec.ts` 的装饰性 hover 白名单按这 4 条逐一登记。
- **拆出去的 10 个 hook + 2 个 helper**：`useMergedProps`（props 缺省与 `setProps` 合并）、`useTableClasses`（容器/表头/行/单元格/选择列的样式族，原先在 setup 里连写 170 行、模板还内联一份）、`useStickyColumns`（列宽与左右吸边偏移，含操作列默认靠右）、`useTableRows`（树形摊平 + 分页切片 + 展开行）、`useTableApi`（对外 `TableActionType` 的装配处，兼容承诺集中在这一个文件）、`useTableChange`/`useTableSorting`/`useTableFilters`/`usePaginationModel`/`useSelectionColumn`，以及 `helpers/cellContent.ts`（单元格内容优先级：`customRender` > `editComponent` > `format` > 原文）与 `helpers/renderVNode.ts`。本包 `src/index.ts` 把这些与两个 helper 一并导出（新增，不删旧）。
- **三条历史约束按原样保留**：`expandAll` 仍走"在当前数据源上重算可展开 key"（静态 `dataSource` 的树表也要能一键全展开）；`scrollTo` 先找 `data-slot="table-container"`、找不到退回 `.basic-table-body`（兼容旧模板与调用方自带钩子）；`updateFormSchema` / `appendFormSchema` / `removeFormSchema` 仍是空实现 —— 接上就是新增行为，本轮口径是"对外一致"，补这个洞该单独开一条改动。
- **对外接口零变化**：`BasicTableProps`、`TableActionType` 的 30 多个方法名与签名、`register`/`submit`/`reset` 等事件、`toolbar` / `toolbar-actions` / `bodyCell` / `header-<key>` 等插槽名全部原样；`apps/web` 里 19 个页面用到 `BasicTable`（其中 17 个走 `useTable()`），一行没改。`index.html` 首屏、`@source` 名单、token 命名空间都没动。

验证：（收尾时补全）
