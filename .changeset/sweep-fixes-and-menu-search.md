---
"@antdv/web": minor
---

fix: 全站交互巡检收尾，并把 Ctrl+K 搜索从假功能做成真功能

巡检口径从"页面有没有坏"推进到"控制台、组件解析、快捷键这些看不见的地方干不干净"。
`e2e/site-sweep.spec.ts` 判负的四个页面全部修好，并新增三条搜索链路用例。

- **虚拟滚动告警**：全局 ConfigProvider 开了 `virtual`，antd 因此要求每张表都有数值 `scroll.y`。
  订单详情与上传队列这类只有几行的表显式 `:virtual="false"`，不再刷 `scroll.y in virtual table must be number`。
- **CSP 与样例源**：`index.html` 补 `media-src`（缺省回落到 `default-src 'self'`，视频示例全灭在 `MEDIA_ERR_SRC_NOT_SUPPORTED`），
  并把 w3schools 那个对非浏览器请求返回 403 的循环视频换成 `media.w3.org`。指令里刻意不写 `https:` 通配，新增样例源必须显式登记。
- **组件解析归零**：17 类 `Failed to resolve component` 分三种根因处理 ——
  不存在的 antd 子组件（`Checkbox.Button` / `Slider.Input` / `RangeSlider` / `Skeleton.Table`）改写成真实组件；
  历史遗留的 antd 图标裸标签统一换成 `<Icon icon="ant-design:..." />`；
  `@form-create/antd-designer` 是**预编译**模板，运行期 `resolveComponent('a-xxx')` 拿不到编译期注入的自动导入，
  新增 `src/plugins/vendor-antd-components.ts` 按静态扫描出的 35 个 `a-*` 精确注册子集（不是 `app.use(antd)`，保住 tree-shaking）。
- **死代码**：`components/business/Modal/props.ts`（无人引用且 `Pick` 了三个 `ModalProps` 上不存在的键，TS2344）
  与 `components/common/PreviewDialog.vue`（全站零引用，且 import 了不存在的 `previewFile` / `downloadFile`）删除。
  `pnpm run type-check` 由 273 降到 267，新增文件零错误。

- **Ctrl+K 菜单搜索**：以前顶栏搜索按钮和快捷键把一个从未渲染的 ref 置真，按下去毫无反应。现在
  `layouts/composables/useMenuSearch.ts` 放纯逻辑（拍平菜单 + 空格分词取交集 + 标题前缀 > 标题包含 > 路径/层级），
  `MenuSearchModal.vue` 读 `useRouteStore().menus`（搜到的永远是权限裁剪后真能去的页），
  候选区用封装的 `<Scrollbar>`、↑↓/Enter/Esc 键盘操作、`hidden` 项标注"不在导航"、外链走新标签。
  快捷键监听挪到 `LayoutHeader`：小部件是异步分包的，chunk 落地前 `useMagicKeys` 还不存在，
  表现为"刚进系统时快捷键时灵时不灵"（e2e 稳定复现）。
- **顶栏小部件不再反复卸载重挂**：`<component :is="defineAsyncComponent(meta.component)">` 每次顶栏重渲染都产生一个新的组件类型，
  Vue 只能卸了再挂；`defineAsyncComponent` 改在 `widgets/index.ts` 的模块作用域包一次，`WidgetMeta.component` 存稳定引用。

e2e 与单测同步：`ops-sweep` 从 8 条增至 11 条（呼出+过滤+跳转、跳转隐藏页、↑↓/Esc/空态），
`useMenuSearch` 13 条单测，Chromium 全量 71 条绿、Firefox / WebKit 各 11 条绿；
`expectTabBar` 的等待从默认 10s 提到 25s —— 每个引擎第一条用例要付浏览器冷启动 + dev server 首次 transform 的代价
（WebKit 实测 40s+），10s 会把"引擎刚起来"误判成"登录没进去"。
