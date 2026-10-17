---
'@antdv/common-ui': minor
'@antdv/form-ui': minor
'@antdv/web': patch
---

feat: MarkdownEditor 迁入 `@antdv/common-ui`，`FMarkdown` 字段从 textarea 换成 tiptap

`MarkdownEditor` 原先长在应用里（`apps/web/src/components/business/MarkdownEditor/`），表单字段 `FMarkdown` 却是另一套东西 —— 一个 `<textarea>` 加"自己按语法高亮"的补丁，两边都对不上"富文本编辑 Markdown"这句话。而 `docs/components/editor-upload.md` 里那条"`getMarkdown()` 返回的其实是 HTML"的债，根子也在 value 语义没定下来。

- **编辑器整体迁入 `@antdv/common-ui/components/markdown-editor/`**（目录、components、extensions、constants、types、utils 一并搬），依赖从应用侧收到包里：9 个 `@tiptap/*` + `marked` 走 catalog（`common-ui/package.json:29-41`），提示语用 `@antdv/popup-ui` 的 `message`，上传走 `@antdv/request`；`apps/web` 的 16 条 `@tiptap/*` 全部删除，catalog 里没被引用的 7 条一并撤掉。应用只留 `apps/web/src/components/business/index.ts` 的再导出，示例页与表单字段共用同一份实现。
- **value 语义由 `contentType` 说清楚**（`'html' | 'markdown'`，默认 `html` 保持旧调用不变）。新增 `markdown.ts`：`docToMarkdown(JSONContent)` 把 prosemirror 文档序列化成 Markdown 源码，`markdownToDoc()` 用 marked 的 lexer 反解回文档（`case 'html'` 分支保证喂 HTML 也解得开）。没有改用 `@tiptap/markdown` 是因为本编辑器有自定义 `todo` 节点和块级 `text-align`，官方 markdown 扩展会把这两样丢掉 —— 理由写进了模块注释。于是"导出 Markdown"按钮打出来的终于是 Markdown 而不是 HTML，那条文档债清掉。
- **`FMarkdown` 改为编辑器壳**：删掉 textarea 与它的事件处理，`defineOptions({ inheritAttrs: false })` + `v-bind="$attrs"` 把 attrs 落到编辑区，`data-field-control` 保留（表单的 focus/校验定位靠它）。旧字段的 `rows` 不再有意义，换算成编辑区最小高度（`rows * 24`，下限 60）；`content-type="markdown"` 让字段值就是 Markdown 源码。
- **`apps/web` 自定义组件示例同步改口径**：两处 `component: 'MarkdownEditor'` 的 `defaultValue` 由 HTML 片段换成 Markdown 源码，说明文字改成"tiptap 富文本，value 存 Markdown 源码"。
- **编辑器配色改为吃 design token**：迁入后它是库组件，不能再带着一套 Tailwind 灰阶。外框 / 工具栏分隔线 / 表格线 → `border-border`（`--app-border`），面板 `bg-card`、下拉弹层 `bg-popover`、代码与表头底 `bg-muted`、正文 `text-card-foreground`、选中态 `text-primary`；`MarkdownEditor.vue` 尾部那整段 `:global(.dark)` 覆盖随之删除（token 自己会切），组件里已无 `gray-*` / `blue-*` 硬编码。顺带修掉一个真实的错位：原来深色下外框是 `gray-700`，与其余组件的 token 边框不是同一个色，切 8 套预设主题时编辑器根本不跟着变。

**这是 `FMarkdown` 的破坏性变更**：字段值从 HTML 变成 Markdown 源码，把它直接塞进 `v-html` 的调用方需要自己过一遍 marked（或把 `content-type` 显式写回 `html`）。

验证：

- `common-ui/__tests__/markdown-editor.test.ts` + `markdown-roundtrip.test.ts`（文档→Markdown→文档的往返，含 todo、对齐、表格、代码块）；`form-ui/__tests__/fields.test.ts` 新增 `describe('FMarkdown')`，钉住"渲染出来没有 `textarea`、有 `contenteditable="true"`、`contentType === 'markdown'`、Markdown 源码里的 `# 标题` 解析成 `.tiptap h1`"。
- 两个包的 `vitest.setup.ts` 补了 jsdom 缺的 `Range.getClientRects` / `Element.getClientRects`：ProseMirror 的 `scrollToSelection` 在 jsdom 里会抛，不 stub 就是拿假绿的 unhandled error。
- 浏览器实测（1280×900）：富文本 Tab `{editable:"true", strong:1, table:1, heading:1}`，工具栏 24 个按键、图标 svg 正常出图，「导出 Markdown」打到控制台的是真 Markdown 源码（含 `#` 与 `**`）；表单页两个 tiptap 实例（字段 `document` / `preview`），表单里剩下的唯一 `textarea` 属于显式的 `note` 多行文本字段，默认值里的 `**加粗**` 已经是真的 `<strong>`，预览态 `contenteditable="false"`；token 化之后亮色外框 `rgb(240,240,240)` / 深色 `rgba(255,255,255,.12)`、弹层 `#fff` / `#1f1f1f`、表头底 `#f5f5f5` / `rgba(255,255,255,.08)`，全部跟着 `--app-*` 走；控制台除登录前的 `未登录` 小部件请求外无报错。
