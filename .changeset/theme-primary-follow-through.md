---
"@antdv/preferences": patch
"@antdv/web": patch
---

fix: 换主题色真的换色，不再只有 CSS 变量在动

现象：设置面板 → 外观里点橙黄色，`--ant-color-primary` 变了（所以 Tailwind 的
`*-ant-primary` 那批类跟着变，标签页选中态、欢迎页文字是新的），但侧栏**选中的父级菜单**、
表格里 `type="link"` 的操作按钮、输入框聚焦光晕**全还是蓝的**。用户看到的就是"主题色只生效一半"。

- **根因不在设置面板，在主题常量**：`packages/preferences/src/theme/` 里
  约 78 处按 Tailwind 蓝写死的颜色，钉住的恰好是**本该由算法从种子色派生**的那些键 ——
  `colorPrimaryHover/Active/Bg/Border/Text*`、`colorLink*`、`controlItemBgActive(+Hover)`、
  `controlOutline`，以及组件层的 `Menu.itemSelectedColor/itemSelectedBg/subMenuItemSelectedColor`、
  `Tabs.inkBarColor`、`Button.defaultHoverColor`、`Select/Cascader.optionSelectedBg`、
  `Pagination.itemActiveColor`。alias token 一旦被显式赋值，`defaultAlgorithm` 就不再生成，
  用户选的颜色被覆盖在下面 —— 换多少个主题色都是徒劳。
- **修法是把派生权交还 antd，而不是再算一套色阶**：这些键从 token/组件常量里删掉，
  由 `defaultAlgorithm` 按种子生成十档色板再取用。比"写个 primaryRamp 自己派生"好在三点：
  零颜色数学、hover/active/outline 等十来个状态自动齐、以后换 antd 版本不会跟我算的不一样。
  改动只留 `colorPrimary` 与 `colorLink` 两个种子键（暗色同理，`darkAlgorithm`
  会替深底另挑一档，不需要我手工调色）。
- **`colorLink` 是唯一必须自己接上的**：antd 把它绑在自己的 `#1677ff` 上而不是
  `colorPrimary`，所以 `getAntdTheme()` 收到 `primaryColor` 覆盖时同时写
  `colorPrimary + colorLink`，否则 `type="link"` 按钮、超链接、Typography 可点文字永远不跟主题
  —— 正是用户点名的第二个失效点。

测试口径：

- 单测（`packages/preferences/__tests__/theme.test.ts`）不只是断言"传进去的值等于返回的值"，
  而是用 `theme.getDesignToken()` 把返回配置喂给算法，断言**解析后的派生色真的变了**，
  并且与"只给种子、不写任何覆盖"的算法答案一致；再加两条回归网：token 常量与组件常量里
  都不许再出现这批主色键（列出 14 + 16 项），防止以后有人图省事又钉回去。
- 端到端（新增 `apps/web/e2e/theme-primary.spec.ts`，三引擎各跑一遍）只认**浏览器算出来的颜色**：
  计算样式是唯一能同时穿过 token、CSS 变量、组件样式三层说话的判据。选中父级取
  `.ant-menu-submenu-selected > .ant-menu-submenu-title`，link 按钮显式点名「详情」而不用
  `.ant-btn-link.first()` —— 同一操作列里的「删除」是 danger，走 colorError 派生链，
  拿它当主色判据会假红。第二条用例选完颜色刷新，验证"持久化"不止是存进 store。
- 顺带补了 `utils/app.ts` 的跨引擎噪音分类（详见上一条 changeset 语境）：
  firefox/webkit 的"请求被中止"措辞与 Chromium 不同，`page.reload()` 掐断在飞的懒加载
  chunk 会被当成页面错误。新增 `requestCancelled()` 按各家措辞丢弃，并把"外站资源加载失败"
  与"本站请求中止"分开判，不再靠猜。
