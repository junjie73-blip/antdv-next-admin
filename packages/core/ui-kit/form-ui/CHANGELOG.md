# @antdv/form-ui

## 0.1.0

### Minor Changes

- 54d880b: feat: `BasicForm` 的动作区改成栅格单元，贴着末行剩余空间排布；顺带修掉两个配置优先级缺陷

  现象（需求原话）：`showActionGroup` 打开时，只要 schema 的列宽没占满 24 栅格，按钮组就会被顶到**新的一行**去，行尾留一大片空白。折叠/展开也各自有一套定位规则，切换时能看到跳。

  - **行分组顺带记账，布局规则只有一条**：`allRows` 在按 `colProps.span` 切行时记录每行**已占用**的栅格数（`FormRow.span`，`form.vue:236-240`），`actionsSpan = 24 - 末行已占`（`form.vue:331-339`）。末行正好铺满 24、或末行是 `Divider` 时给满 24，靠 `margin-left: auto` 右对齐独占一行 —— 这仍然是「栅格单元」，不是特判出来的第二套定位。24 栅格的计算逻辑、`grid.cols` 与断点回落（`form.vue:163-170`）一个字没动，所以兼容原来的列宽配置。
  - **动作区本体换成一个格子**：`FormActions` 根节点吃 `span` / `gutter-px` / `action-col-style`，`width = span/24` 的百分比、左右内边距各吃 gutter 的一半，与 `FormField` 同一套口径（`form-actions.vue:48-57`）。`min-width: max-content` 加行容器的 `flex-wrap` 是兜底：剩余栅格放不下按钮时整块落到下一行，而不是把按钮压扁。`actionColOptions.style` 摊在最后，调用方可以覆盖 `width` / `margin-left`。
  - **折叠与展开共用同一个宿主行**：两者都读 `rowsWithActions` 的末行（`form.vue:300-305,331-339`），切换只改变可见行数（`displayRows`，`form.vue:288-294`），末行的剩余栅格随之变化，不存在「折叠一套、展开一套」的两条规则 —— 这是切换不抖的原因，也是实测里回到的折叠态与初始折叠态逐字节相同的原因。
  - **顺带修掉的两个真缺陷**（都是这次做折叠态验证时才暴露的）：
    1. `useForm(options)` / `setProps` 传进去的 Boolean 开关**全部静默失效**。Vue 把父级没传的 Boolean prop cast 成 `false`，`withDefaults` 的默认值又落在同一个对象里，而 `deepMerge` 的标量规则是「目标优先」，于是这些合成值盖掉了运行时配置 —— `showAdvancedButton: true` 永远打不开。现在先用 `vnode.props` 挑出父级**真的绑过**的键，其余键让给 `setProps`，优先级确定为「模板显式绑定 > `setProps` > 组件默认值」（`form.vue:139-160`）。
    2. `setProps` 合并方向反了，后一次补丁改不掉前一次（`disabled: true` 关不回 `false`）。改成把新补丁放在 target（`form.vue:572-582`）。
  - **原有配置项功能面不变**：`showActionButtonGroup` / `showSubmitButton` / `showResetButton` 三档开关、`submitButtonOptions` / `resetButtonOptions` 的 `text` / `preIcon` / `disabled`、三个动作区插槽（`#submitBefore` / `#resetBefore` / `#actionAfter`）与「提交 → 重置 → 展开/收起」的按钮次序都保持原样；`schema` 依然不参与 props 合并，数组不会被拼接。

  验证：`form-ui` 单测 90/90，其中新增 12 条 —— `__tests__/form-actions-layout.test.ts` 9 条覆盖不同 `colProps.span` 组合下动作区的行归属与 `width`（含末行满 24、末行 `Divider`、剩余空间不足、只有按钮组没有字段、`grid.cols` 变化），`__tests__/form-props-merge.test.ts` 3 条覆盖上面那条优先级链与 `setProps` 可回退。浏览器端到端新增 `apps/web/e2e/form-actions-layout.spec.ts`（4 条用例，chromium / firefox / webkit 三引擎各跑一遍），在 `#/components/form/basic`（14 字段、`alwaysShowLines: 2`）读真实包围盒：折叠态动作区 `width` 恰等于宿主行宽、独占第 2 行（共 2 行）并左贴行首、按钮文案「展开」；展开态 `width` 恰为行宽一半、与最后一个字段同一条基线且 `left` 等于该字段 `right`、文案「收起」；再点回折叠，与初始折叠态逐项相同。断点扫描 1440 / 1100 / 900 / 640 四个宽度，动作区要么行内（必有同行字段）要么满行（贴齐行首），且按钮宽度始终 ≥ 60px，没有被 `min-width: max-content` 之外的力量压扁。几何断言一律换算成**相对 `<form>` 左上角**的坐标：外壳内容区自带滚动，实测同一折叠态两次读取整个 `<form>` 的 `top` 相差 12px 而 `window.scrollY` 全程为 0，用视口坐标逐像素比会把容器位移读成布局抖动。`npx turbo run type-check --filter=@antdv/form-ui` 只剩仓库既有的两条 `vue-sonner/style.css` TS2882（`common-ui/Toaster.vue` 与 `popup-ui/message/index.ts` 的副作用导入，任何源码消费方都会命中，与本次改动无关，table-ui 同样报这两条）；`npx tsc --noEmit -p apps/web/e2e/tsconfig.json` 对新增用例干净，另有 3 处存量报错与本次无关：`e2e/app-loading-theme.spec.ts:85` TS2352、`e2e/ops-sweep.spec.ts:341,344` 用了 `locator.filter()` 并不存在的 `hasClass` 选项（那两条断言实际没有按层级过滤，是弱断言）、`e2e/screen-fit.spec.ts:64` TS2339。文档 zh 正文与 en 镜像同步：新增 `actionColOptions` 一行、改写动作区三条说明，并把全部代码行号引用（含 `:NN` 这种省略文件名的裸引用）对回当前源码。

- f64fc3a: feat: MarkdownEditor 迁入 `@antdv/common-ui`，`FMarkdown` 字段从 textarea 换成 tiptap

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

### Patch Changes

- 54d880b: feat: `ConfigProvider` 按 reka-ui 的规范重做（内置文案 / 尺寸档位 / 子树主题三维补齐），并接上日期排版与档位下发两条断链

  "包一层插槽"不算实现：`@antdv/common-ui` 的 `ConfigProvider` 现在以 **reka-ui 的 `ConfigProvider` 为底座**（`common-ui/src/components/config-provider/ConfigProvider.vue:194-201`），reka 那六个参数 `dir` / `locale` / `scrollBody` / `nonce` / `teleportTo` / `useId` 全部接上并且都有真实读取点；外面套的 `display: contents` 容器（`:164-173`、`:202-213`）承载主题变量与档位。在这之上补的是 reka 不管的三件事：

  - **内置文案**：`okText` / `cancelText` / `emptyText` / `placeholder` 按 `locale` 从 `textsByLocale` 展开，读侧是 `useGlobalConfig()`（`Popconfirm`、`Empty` / `EmptyState` / `Transfer`、`Description`）。这些组件的 `size` / 文案 props 默认值一律改成 `undefined` —— 写死 `'default'` 就等于没有全局档位。
  - **尺寸档位**：`componentSize` 三档，`'middle'` 这个存量别名在解析时折成 `'medium'`（`normalizeComponentSize`），各家族按自己的词汇落地（`Loading` → `default`、`Segmented` → `middle`）。`types.ts` 把 `ComponentSizeOption` / `ResolvedComponentSize` / `Direction` / `LocaleKey` / `GlobalTheme` 一并导出，包装组件不必再自己抄一遍档位类型。
  - **子树主题**：`theme`（`mode` / `preset` / `primary` / `radius`）与 `cssVars` 只写成容器上的 CSS 变量与 `.dark` / `.light`，**不加第二个全局写侧** —— 全站主色仍然只有 `applyPreferencesToDom()` 往 `<html>` 写一次；`cssVars` 最后写入所以优先于 `theme` 派生的那两条。生效前提是 `@antdv/design` 用 `@theme inline` 声明 token，工具类编译成 `var(--app-primary)` 本身，于是 `display: contents` 这种"没有盒子"的容器也能把变量下发给子节点。留空 = 删掉声明 = 子树重新继承 `<html>`，不是"覆盖成默认值"。
  - **嵌套**：内层只覆盖自己显式给出的字段，其余继承外层的成品值（`:39-47`、`:53-96`）；注入的是 `reactive` 对象而不是 `computed` 快照，否则外层改了内层收不到。宿主自己的 `class` / `style` / 事件与容器合到同一个元素（`inheritAttrs: false` + `useAttrs()`）。

  两条链路上原来是断的，这次一并接上：

  - **日期排版（`@antdv/form-ui`）**：`FDatePicker` 在 `<Calendar>` / `<RangeCalendar>` 上写死 `locale="zh-CN"`，另外还存了一份硬编码中文月名数组，切语言时"按钮变了、日历还是中文"。现在字段壳不传 `locale`，12 个月名由 reka 的 `useLocale()` 喂给 `Intl.DateTimeFormat`（`fields/FDatePicker.vue:161-174`）。链路是 provider → reka 注入 → 各 Root 的 `useLocale(propLocale)`（显式 prop 优先，否则注入，再兜底 `en`）→ `useDateFormatter`，Root 还 watch 语言变化重设 formatter。**`useDateFormatter()` 自己不读注入**（参数是普通字符串），所以"自己 new formatter"的包装组件不在这条桥接里：`shadcn-ui/calendar/Calendar.vue:27` 的 `useDateFormatter(props.locale ?? "en")` 只服务 `layout` 的 `NativeSelect` 变体，默认分支的 `<CalendarHeading />` 与星期表头才走注入 —— 想让月/年下拉也跟语言必须显式传。
  - **档位下发（`@antdv/shadcn-ui`）**：`ToggleGroup` 往子项 `provide` 的是**普通对象**，等于 setup 那一刻的快照，切档时组自己身上的 `data-size` 变了、按钮高度不动，看起来就像"档位只写了个属性"。改成带 getter 的 `reactive()`（`toggle-group/ToggleGroup.vue:24-33`），子项每次渲染重新取。
  - **下游类型出口（`@antdv/popup-ui`）**：`message/index.ts:18` 的 CSS 副作用类型声明被 `eslint --fix` 的 `spaced-comment` 拆成了 `// / <reference …>`，指令失效，按源码消费的下游 `vue-tsc` 立刻报 TS2882。恢复成真正的三斜线指令，并给 `common-ui/components/toast/Toaster.vue` 补上同样一条（本包同样按源码发布，下游看不见包内的 tsconfig include）。

  验证：`@antdv/common-ui` 单测 308/308（27 个文件，其中 `__tests__/config-provider.test.ts` 22/22，覆盖注入合并、嵌套继承、`display: contents`、CSS 变量写入与"留空即删除声明"），`@antdv/form-ui` 90/90（6 个文件）；`turbo run type-check test:unit --filter=@antdv/shadcn-ui --filter=@antdv/form-ui` 14/14 任务通过，`turbo run type-check --filter=@antdv/common-ui --filter=@antdv/popup-ui` 11/11 任务通过。新增浏览器端到端 `apps/web/e2e/config-provider.spec.ts` 5 条 × chromium / firefox / webkit = 15/15，全程只用 `setPreference()` 这一个写侧（与用户操作偏好同一条形变）：偏好的语言与档位落到宿主 `data-config-*` 且容器 `display: contents`、宽高量到 0、根 provider 上不出现第二条 `--app-primary`；档位切档时 `Segmented` 实测行高跟着变；`Popconfirm` 的内置文案从"确定/取消"变 Cancel/OK；日历标题从 `2026年10月` 变 `Oct 2026`、星期表头从 `一 二 … 日` 变 `S M T W T F S`；子树换色量到 `.bg-primary` 探针变蓝而 body 级对照与 `<html>` 的主色不动。文档同步：`docs/components/common-ui.md` 与 en 镜像重写 ConfigProvider 小节（新增「日期排版走 reka 的注入」与档位 reactive 警告），`docs/guide/in-depth/internationalization.md`（含 `docs/zh` 副本）与 en 镜像新增「日期控件的排版另走一条链路」小节与排错行；`turbo run build --filter=@antdv/docs` 通过，`node docs/_linkcheck.mjs docs` 缺失目标 0（121 个文件），四个新增锚点在构建产物里都存在。`node scripts/check-uniform-build.mjs` 仍通过。已知噪声：`common-ui` 的 `cron-editor.test.ts` 会发起外网请求，在 turbo 并发下偶发超时（单跑 27/27 绿），与本次改动无关。

- 5194446: fix: 设计规范彻底脱离 antdv-next，并修掉迁移留下的三处样式缺陷（固定列重叠、表头比数据行矮一线、浮层被抽屉压住）

  现象（用户归纳）：`@antdv/design` 还在引 antd 的 Tailwind 兼容层，主题色事实上依赖组件库；换主题只换一颗主色，画布色温不动；固定右侧的操作列会跟横向滚动内容叠在一起；表头比数据行差一小截；抽屉里点开自定义主色的取色器，色块弹层出现在抽屉**底下**。

  - **`@antdv/design` 的包边界收成"只有变量与 CSS"**：删掉 `@import '@antdv-next/tailwind/compat.css'` 与 `@antdv-next/tailwind` 依赖，`package.json` 不再声明任何组件库。这不是"换个变量名"——compat 层一走，`*-ant-primary` 那组工具类**整条不生成**（Tailwind v4 只为 `@theme` 里声明过的 token 出类），所以页面侧必须一起迁到本包令牌。`__tests__/design.test.ts` 里加了两条钉死边界的用例：全包不出现 `--ant-*` 读取、`package.json` 不含组件库依赖。
  - **每个主题改成"一份完整色板"**：`token/default.css` 与 `token/dark.css` 各写 13 套 `[data-theme]` 预设（`violet / pink / rose / sky-blue / deep-blue / green / deep-green / orange / yellow / zinc / neutral / slate / gray`），每套 27 条语义色一条不少、各套签名互不相同、明暗两版真的换值（三条都由用例反查名单，不是抽查）。缺一条的后果不是"退回默认色"而是它继续吃 `:root` 的亮色值 —— 暗色预设上浮出一块白底。
  - **档位由 DOM 说话，主色只留一条链**：`@antdv/shared/constants` 新增 `THEME_PRESETS` / `themeKeyByColor` / `CUSTOM_THEME_KEY`；`applyPreferencesToDom()` 把选中的色反查成 `<html data-theme="…">`，**只有取色器选的颜色**才额外内联 `--app-primary`（预设档内联反而会把暗色档辛苦提亮的主色压回亮色值）。给 antdv-next 的桥 `--ant-color-primary` + `--ant-primary-color` 两个名字继续都写，因为页面里还有 antd 的 DOM 在读旧名。
  - **固定列不再与滚动内容重叠**（`table-ui`）：粘性单元格的 `z-index` 与底色一起给（`bg-inherit` 而不是透明底），横向滚动时内容从固定格下面穿过去而不再是盖在上面。用几何断言核对（`boundingBox()` 与滚动容器右边缘），只看 `toBeVisible()` 会放过这个缺陷。
  - **表头与数据行同高**（`table-ui`）：表头与单元格共用一套盒模型 `px-3 py-2 text-sm leading-6 align-middle`。行高用 `leading-6`（24px 行盒）而不是 `h-6` —— Tailwind 预置的 `box-sizing: border-box` 会把内边距一起算进 24px，小于"内边距 16 + 内容 20"，等于没设；实测 41/41 行等高。
  - **浮层回到 shadcn 的同一档刻度**（`popup-ui`）：抽屉/弹窗的内联 `zIndex: 1000` 是 antd 时代的遗产，而 reka-ui 的 Popover / Select / Tooltip 全在 `z-50` 且 portal 到 `body` 末尾，于是"抽屉里打开的取色器被抽屉本身盖住"。现在默认不覆盖层级，靠挂载顺序叠放；只有要钉死先后关系时才显式传 `zIndex`。这条缺陷 Playwright 只会报 hit-test 重试（"subtree intercepts pointer events"），`toBeVisible()` 一路放行 —— 加了两条单测断言"默认内联 zIndex 为空、显式传入才写"。
  - **`BasicDrawer` 标题区补齐内边距**（`popup-ui`）：内置 header 与 `#header` 插槽两条分支都走 `px-6 py-4`，标题文字不再贴着头部边缘与分割线。
  - **表单与组件的默认色/间距规范**（`form-ui`）：label 与行距统一走 token 化刻度，校验只在提交时触发（去掉初始校验导致的"一进页面满屏红"），组件默认边框由黑色改成 `border` 令牌色。
  - **包源码不再读 `import.meta.env`**（`common-ui`）：`ErrorBoundary` 的开发态判定原先写死 `import.meta.env.DEV`，而包里 tsconfig 有意不带 `vite/client`（免得 vite 变成隐式依赖）。包自己的 type-check 靠一份手写 `vite-env.d.ts` 兜住，但 `tabs-ui` 按源码消费本包时那份环境声明不在它的 program 里，直接报 TS2339。现在改用 `@antdv/shared` 注入的 `isProduction()` —— 这也是 `shared/utils/env.ts` 一开始立这条规矩的理由：包读 env 既拿不到静态替换，也没法在单测里切分支。新增两条用例把"开发态给调用栈详情、生产态收起"钉住，收尾复位共享状态。
  - **CSS 副作用导入的类型声明要跟着模块图走**（`popup-ui`）：`message/index.ts` 的 `import 'vue-sonner/style.css'` 只有本包的 `src/types/css.d.ts` 声明，下游包（`table-ui`）一视同仁报 TS2882。改成在导入处补一行 `/// <reference path="../types/css.d.ts" />`，声明随模块被一起纳入，不用每个消费方复制一份 shim。

  验证：`npx turbo run test:unit` 全绿 —— 22 个套件共 1861 条（`design` 29、`table-ui` 214、`popup-ui` 46、`common-ui` 192、`apps/web` 282）；`common-ui` 在并发整跑里出现过一条 5s 超时假红，单独复跑 192/192 绿。`npx turbo run type-check` 里 **31 个包全绿**，只剩 `@antdv/web` 一条红：109 条报错分布在 38 个本轮没碰过的文件上（`~/api/notice` 等指向不存在模块的死引用、`@vue/tsconfig/tsconfig.dom.json` 的 `lib` 没有 ES2021/ES2023 导致 `replaceAll` 与包源码里的 `.toSorted()` 报 TS2550、以及一批响应体类型对不上的 `res.data`），报错行号均不在本轮 diff 的 hunk 内 —— CI 只跑 docs，这条链从未被门禁挡住过，属于迁移期存量债，另开一轮清理（见待办 P7）。它此前被 `tabs-ui` 的失败掩盖（依赖任务失败会让它不执行），所以第一次露脸。chromium 端到端全量跑 151 条，4 条红 —— 逐条缩小复跑后，3 条（登录框 `fill` 超时、拖拽用例 execution context destroyed、IconPicker 点击超时）是 Vite 依赖重优化把正在跑的页面重载了一次造成的假红（`gallery-examples` 单跑 26/26 绿、`icon-picker` 单跑 7/7 绿），1 条是用例自身的缺陷：`theme-primary` 把主色断言写成大写字面量 `#FA541C`，而色板实际拼作 `#fa541c`，大小写不该是契约，已在读取处归一化并复跑绿。主题侧另有浏览器实测：14 档 × 明暗画布逐档不同、`data-theme` 正确、预设不写内联、刷新后偏好仍在、0 条 console error，且全仓不再有 `*-ant-*` 工具类的使用点；固定列/表头同高/抽屉内取色器都用几何断言（`boundingBox()` / `elementFromPoint()`）而不是 `toBeVisible()`；`ErrorBoundary` 的调用栈详情在真实页面（`/components/loading` → 模拟一次崩溃）实测仍会出现。顺带修掉一处只在 CI 全量跑才暴露的既有问题：`backend-mock` 在 `noUncheckedIndexedAccess` 下的 `accounts[0]` 类型。文档侧 `npx turbo run build --filter=@antdv/docs` 通过，zh 正文 / `docs/zh` 副本 / en 镜像三份口径一致，代码引用逐条对回当前行号。

- c1e9020: refactor: `BasicForm` 的 `setup` 从 696 行压到 254 行，逻辑按职责拆进 `form-render/hooks/` 与 `form-render/helpers/`，对外 API 不变

  现象（用户归纳）：`form.vue` 的 `setup` 里同时管着 TanStack 实例、props 合并、响应式栅格、行分组与折叠、校验与滚动定位、提交与重置、按钮文案、注入契约与对外 API，读一遍要跳七八处；要求是**梳理分层、可维护性优先，且不影响任何现有调用方**。

  - **分层口径**：`hooks/` 放有状态的行为（要 `ref`/`computed`/生命周期/`provide`），`helpers/` 放纯函数（同样输入必得同样输出，可单测）。`form.vue` 只做三件事 —— 声明契约（props/emits）、按依赖顺序装配 hook、排版；文件顶部留了一张依赖图，装配顺序就是它的书写顺序：`schemaRef ─┬─ useFormModel ─┬─ useFormValidate ─┐ ├─ useFormConfig → useFormGrid ┴─ useFormRows ────┼─ useFormButtons └─ useFormSchema ┘ └─ useFormSubmit → useFormExpose`。
  - **9 个 hook**：`useFormModel`（TanStack 实例 + 默认值 + `formModel` 那个可写 Proxy + 取值/设值/重置/清除校验）、`useFormConfig`（`props` 与 `setProps` 的合并优先级：运行时 props 输给模板显式绑定的属性，`schemas` 永远取当前实际 schema）、`useFormSchema`（声明式来源 + `updateSchema`/`appendSchemaByField`/`removeSchemaByField` 三个命令式入口）、`useFormGrid`（断点列数、`gutter`、行容器样式、标签列/内容列）、`useFormRows`（行分组、折叠态、动作区占位）、`useFormValidate`（`validate`/`validateFields`/`scrollToField`，失败时按 `scrollToFirstError` 滚到第一个错误字段）、`useFormSubmit`（`attrs.onFinish` > `props.submitFunc` > `emit('submit')` 三档出口，以及重置的快照-回填与 `submitOnReset`）、`useFormButtons`（提交/重置/展开三个按钮文案与图标）、`useFormExpose`（对外 `FormActionType` 的装配处，兼管 `isMounted` 这件事 —— `useForm()` 靠它把"写进已卸载实例"转成待写入队列）。
  - **4 个 helper**：`helpers/grid.ts`（24 格总量、断点取列数、`gutter` 单值/数组取水平与垂直分量、行容器样式、标签列/内容列缺省）、`helpers/rows.ts`（按 `colProps.span` 把 schema 切成行、动作区宽度）、`helpers/validate.ts`（错误项与 TanStack fieldMeta 的读法，以及 `throw` 出去的那份 `FormValidateError` 形状）、`helpers/buttons.ts`（三枚按钮的文案缺省）。
  - **口径没有改变的几处**：`schemaRef` 是实际参与渲染的那份，命令式增删不回写 `props.schemas`；`watch(sourceSchemas)` 不加 `deep`（原来就不加，加了会在整表重算时抖一次）；`initFormModel` 仍只由"schema 被替换"这一条路径触发，**没有**顺手补 `onMounted` 里再初始化一次；`formModel` Proxy 的 `set` 仍旧转发到 `form.setFieldValue`，插槽里直接写值仍然有效；`validate()` 不带参数时作用范围仍是 schema 里所有字段名。
  - **顺手把三处 `any` 收成声明类型**（不影响运行时）：`resolveLabelCol` / `resolveWrapperCol` 的入参与返回改成 `Partial<ColEx>`（`labelWidth` 走 `{ style: { width } }`，否则 `{ span }`，缺省 4 / 18），注入契约 `FormContext.labelCol` / `wrapperCol` 跟着这条类型走，`useFormExpose` 的 `formActionTypeRef` 改成 `Ref<FormActionType | null>`。字段名往 TanStack 的 path 位上塞的那几个 `as any` 保留 —— `TData` 还是 `Recordable` 时路径类型推不出具体键，这层转换是实例泛型决定的，不是偷懒。
  - **对外接口零变化**：`FormProps`、`FormActionType`、`FormSchema`、`emits`（`register`/`submit`/`reset`）、插槽（`schema.slot` 指定的字段插槽由 `form.vue` 整组转发给 `FormField`，外加 `submitBefore` / `resetBefore` / `actionAfter`）一个没动；本包 `src/index.ts` 一贯不导出内部件，所以这次也没有新增导出。`apps/web` 里 15 个页面用 `BasicForm`（14 个走 `useForm()`），一行没改；`table-ui` 的搜索表单走的还是 `getFormProps` + `@register`。

  验证：（收尾时补全）

- 2f1a233: fix: 补回被重排时删掉的 `@source` 名单，IconPicker 面板接住可用高度，FDatePicker 的区间占位允许数组

  三条都是"构建绿、页面也渲染，只是某样东西静默不见了 / 不定位"的同一类失效，共用这一批三引擎验证，所以并成一个 changeset。

  - **`@source` 整块没了（`packages/core/base/design/src/index.css:46-55`）**：071dad02 重排这个文件时把十行 `@source` 一起删掉了。构建根的自动内容检测只扫得到 `apps/web`，`@antdv/*` 全在软链后面，所以少登记不等于报错 —— 消费方读的还是上一轮 `dist` 里的 CSS，构建、类型检查、页面渲染全部照常，只有那个包模板里的工具类一条不生成（浮层不定位、圆角间距消失）。这次按 `git show f64fc3ac` 原样补回十行，并在名单上方写清"必须与 `packages/core/ui-kit/*` 目录一一对上"。守门测试本来就在（`design/__tests__/design.test.ts` 的「每个子包的源码目录都登记了 @source，且登记路径解析得到真实目录」、`hooks/__tests__/boundary.test.ts` 的「@source 名单只属于 design」），漏网的原因是那一轮没有按仓库口径单文件复跑守卫测试。
  - **IconPicker 面板高度（`packages/core/base/icons/src/icon/IconPicker.vue:281-289`）**：面板原本是"净高 360 + 工具栏 + 分页"的固定高度，`PopoverContent` 没有接 reka 挂在 `--reka-popover-content-available-height` 上的可用高度，从别的页面跳进来时（触发器到视口底只剩 400 出头）底边顶出视口，多出来那截看不见也点不到，常规视口下的用例碰不到它。改成 `max-h-(--reka-popover-content-available-height)` 并把面板排成 `flex-col`：工具栏与分页 `shrink-0`、网格 `min-h-0 shrink`。
  - **FDatePicker 的 `placeholder`（`packages/core/ui-kit/form-ui/src/fields/FDatePicker.vue`）**：prop 声明的是 `string`，而全站四处区间用法（表单示例页、操作日志、登录日志）实际都传 `['开始时间', '结束时间']`。运行时只有一条 `Invalid prop: type check failed` 告警，文字照旧显示，所以构建与类型检查都不拦。放开成 `placeholder?: string | string[]`，数组按两端用 `-` 合成，空串与空数组才回落到内置文案（区间是 `开始日期 - 结束日期`）。合成串与两侧默认串互不相同，判据本身就是反证：传入被忽略会掉回默认串，拼接写错也不会等于任何一侧。

  验证：

  - 守卫测试：`design.test.ts` 32 条、`boundary.test.ts` 8 条全绿（含上面两条 `@source` 判据）；`npx turbo run test:unit --filter=@antdv/{icons,form-ui,design,hooks} --concurrency=1` 20/20 任务绿，其中 `hooks` 10 文件 / 106 条、`form-ui/__tests__/fields.test.ts` 31 条（新增 `fDatePicker` 5 条：数组合成、空数组回落、空串回落、单值字符串原样、传数组不再打 prop 告警）、`icons/__tests__/icons.test.ts` 6 条。
  - 端到端三引擎各 10/10：`icon-picker` 6 条（新增「矮视口下面板完整落在视口内」：560 高视口下量面板盒子，上下都必须在视口内且高度 > 120、网格仍是整页 108 格）、`popup-anchor` 2 条、`f-date-picker` 2 条（新增 spec，钉住数组占位的合成文案与"控制台没有 `Invalid prop` 告警"）。chromium 是四次定向跑合起来的 10/10，firefox 与 webkit 各一次整跑。
  - 新用例都过了反证。矮视口那条：临时把面板的 `max-height` 剥成 `none`，实测 `y=136 h=479 bottom=615` —— 判据在没修复的版本上会真的报溢出，不是一条永远绿的空检查（探针 spec 跑完即删）。`popup-anchor` 的浮层判据自带反向对照（剥掉 `z-50` / `bg-popover` / `shadow-md` 必须三条都报）。
  - e2e 侧顺手修掉一条假红：菜单是模态层，打开后 reka 会给层外的一切（含触发器本体）挂 `aria-hidden`，可访问名字随之消失，`getByRole('button', { name: '标签页操作' })` 在"点得到"之后到了"量不到"。测量改锚在组件自己的钩子类 `button.tab-actions-trigger` 上，名字对不对仍由 `tabs.spec.ts` 那条负责；同文件 `CHECK` 的参数类型改成 `page.evaluate` 真正传进去的 `(HTMLElement | SVGElement)[]`。`pnpm exec tsc -p e2e/tsconfig.json --noEmit` 本轮三个 spec 零错（`layout.spec.ts:628` 的 `row.dataset` 是存量类型错，不在本轮改动面上，未动）。

- 54d880b: build: 全部子包统一走完整 `build`（编译 + 打包 + 产物校验），消灭 stub-only 与热更新混配

  要求（用户原话）："所有子包必须统一采用完整构建（build）的编译打包方式，严格禁止出现部分子包使用 build 构建、部分子包使用热更新（hot reload/hmr）的混合配置情况"。落地口径按已确认的方案 —— **统一构建标准，保留源码消费**：每个包都有一份真 build 并纳入全量构建与检查，dev 期间仍由宿主应用的 dev server 直接吃源码，子包级热更新不退化。

  - **15 个按源码发布的包补上真 build**：`packages/**` 的组件与工具包（含 `@antdv/icons`）一律 `vite build`，各自的 `vite.config.mts` 只有一行 `defineLibraryConfig()`。此前它们的 `build` 是一句 `echo`，产物从没被真编译过 —— 包里的 SFC 编译错误、缺失依赖、`exports` 漏配都要等别人 import 时才现形。
  - **入口从 `exports` 推导，不再写死 `src/index.ts`**：`resolveLibraryEntries()` 读包自己的 `exports` 映射（`./*` 通配按同一模式去 glob 展开），加一个子路径导出，构建自动覆盖到它。只认 `src/` 下的源文件，指向 `dist` 的子路径（按产物发布的那批包）不进这条链路。
  - **`antdv:validate-dist` 兜住"构建绿了但产物残缺"**：`writeBundle` 逐条核对每个入口的 `dist/<name>.js`（样式入口查 `.css`，开了 `dts` 再查同名 `.d.ts`）既在产物表里也真落盘，缺一条就 `this.error` 并点名是哪个公共子路径。子包平时按源码被消费、`dist` 没人读，这层校验是标准里唯一能自动兜住的部分。
  - **库形态的插件链裁到最小编译链**：`createPlugins(mode, { kind: 'library' })` 不再挂自动导入 / iconify / svg-icons / imagemin / 文件路由 / Layouts / i18n / Inspect。这些插件都按"宿主是一个应用"的前提工作 —— 扫 `src/views`、往 `cwd/types/*.d.ts` 回写声明、要求 `@iconify-json/*` 与 `src/assets/icons` 存在；子包按自己的目录构建时前提全不成立，实测 `@antdv/enums` 在配置加载期就抛 `Please install "@iconify/json" or "@iconify-json/*" package`。两种形态现在共用 SFC / TSX / Tailwind 这一段，其余按形态分家。
  - **`dts` 默认跟随 `types` 指向**：只有 `types` 指进 `dist` 才生成声明文件。按源码发布的包（`types: ./src/index.ts`）生成那份 `.d.ts` 没有读者，类型面归各自的 `type-check`，重复出一份只把构建时间翻倍 —— 实测 `@antdv/menu-ui` 27 s → 7.5 s。
  - **`@antdv/design` 从"没有 build"变成真出产物**：纯样式包走 `entry: 'src/index.css'` 并显式 `cssCodeSplit: true`（lib 模式默认 `false`，而那个模式下 Vite 直接拒绝 CSS 入口），产出 `dist/index.css` 277 kB，顺带证明 `src/css/*.css` 里的 `@apply` 级联编译得动。
  - **5 个只有 `stub` 的包换成真 build**：`@antdv/eslint-config`、`@antdv/oxfmt-config`、`@antdv/oxlint-config`、`@antdv/vsh`、`@antdv/turbo-run` 删掉 `stub`，`build` 改为 `pnpm exec tsdown`（各自 `tsdown.config.ts` 已带 `clean: true, dts: true`）。`@antdv/node-utils` 的 `stub` 作为加速手段与真 `build` 并存。根 `postinstall` 随之从 `run stub` 改成 `--filter ./internal/** --filter ./scripts/** run --if-present build`。
  - **标准变成可跑的守卫**：`scripts/check-uniform-build.mjs`（零依赖）查四件事 —— 每个包都有 `build`（没有可编译内容的 3 个预设包写进例外清单并附理由）、`stub` 不能是唯一构建方式、`exports` 指 `dist` 的包必须把 `dist` 列进 `files`、按源码发布的包不许挂自己的 `dev` / `watch`（热更新归宿主应用）。已排进 `pnpm check`，不过那条链现在会在 `check:type` 处短路，所以日常按 `pnpm check:builds` 单跑。

  验证：`pnpm build` 全量 31/31 成功（3 m 57 s；此前只有按产物发布的包与应用参与）；`pnpm turbo run test:unit --concurrency=1` 只有 `common-ui/cron-editor` 一条红，是仓库里已记录的机器负载超时假红（整跑 5621 ms 撞 5 s 上限，空闲单跑同一用例 2054 ms 通过，同批 290 条其余全绿）；`@antdv/vite-config` 单测 70 条全绿，其中新增 `__tests__/library.test.ts` 12 条覆盖入口推导 / 产物推导 / 校验器，`__tests__/plugins.test.ts` 由"两种形态共用同一条链"改成钉住"应用形态带宿主插件、库形态只留编译链"；`node scripts/check-uniform-build.mjs` 通过；dev server 与 `apps/web` 生产构建两侧都跑通（登录 → 工作台 → 组件示例）。文档在 `docs/guide/essentials/development.md` 新增「子包统一构建标准」一节，en 镜像与 `docs/zh` 副本同步。

- f64fc3a: refactor: 清掉仓库里残留的 vben 命名，上游归属统一写成 `vue-vben-admin`

  用户提的"全面清理 vben 相关的关键字、引用和依赖"。口径是**代码 + 文件名 + 文档措辞都改，外部事实保留**：仓库现在 34 个包全在 `@antdv/*` 下，`vben` 这个词既不是包名也不是标识符，留着只会让人以为还有一套 `@vben/*` 依赖。

  - **标识符与文件名**：`form-ui` 的 `use-vben-form.ts` → `use-antdv-form.ts`（`src/index.ts`、`types.ts`、`useForm.test.ts` 三处引用一起改）；`@antdv/oxlint-config` 的类型 `VbenOxlintConfig` → `AntdvOxlintConfig`；`@antdv/vite-config` 注入的应用元数据键 `__VBEN_APP_METADATA__` → `__ANTDV_APP_METADATA__`；`vsh` 的 `code-workspace` 产物名、`check-dep` 的忽略名单（原来按 `@vben/*`、`@vben-core/*` 匹配，本仓库根本不存在这两个 scope，等于空转）、pnpm catalog 用例的临时目录前缀、`build-local-docker-image.sh` 的镜像名全部换成 antdv。
  - **eslint 的包边界规则**：三条按 `@vben/*` / `@vben-core/*` 写的 `no-restricted-imports` 从来匹配不到本仓库的任何 import，替换成一条真正生效的规则 —— `files` 是 base 层（`packages/core/base/**`、`packages/enums/**`、`packages/utils/**`），forbidden 分组逐个点名 ui-kit / effects / app 的包（因为只有一个 scope，没法用 scope glob 划边界），并显式放行 `@antdv/shadcn-ui`。`sort-interfaces` 的豁免 glob 也顺手收窄到实际需要的三个目录。
  - **`perfectionist.ts` 只做删除**：把两组从来没用上的 `antdv` / `antdv-type` 自定义分组去掉。留着的代价是 `newlinesBetween: 1` 会要求每个新分组两侧都空一行，一改就牵动全站 570 个文件的 import 排版；核对方式是把 config 改动前后的 `eslint .` 结果对拉 —— 1627 = 1627，逐条规则计数差 0，证明这次删除是行为等价的。
  - **`turbo-run`**：删掉两段死代码（`findApps` 和写死 `@vben/website` 的分支）。
  - **文档与注释**：README（中英）、`docs/components/form.md`、`docs/*/guide/in-depth/{composables,common,check-update}.md` 里的 `vben` 措辞改成 `vue-vben-admin`，源码里作为上游归属的注释同理（`vite-config`、`tabs-ui/constants`、`useDataSource`、`permission/utils`、`LayoutSider`）。**保留不动的外部事实**：`doc.vben.pro` 链接、`.sync-state.json` 里的 `vbenjs/vue-vben-admin` 同步配置、历史 changeset 里引述用户原话的那两处。
  - **`shared`/`utils` 的注释纠偏**：`--ant-color-primary` 那句"组件里 39 处在用"已经不成立（全站 `var(--ant-*)` 读取点为 0，仅剩写侧兼容），改成如实描述。

  顺带一个类型层修复：`apps/web/tsconfig.app.json` 显式抬高 `lib` 到 `ESNext`。`@vue/tsconfig/tsconfig.dom.json` 的 lib 停在 ES2020，比本仓库 `@antdv/tsconfig`（ES2022）低，`replaceAll` / `Array.prototype.at` 会被判成不存在 —— 而这些 API 正是子包源码在用的。应用 type-check 从 109 条降到 98 条，且没有新增错误类别（剩余是存量，见 #61）。

  验证：`grep -rI vben`（排除 node_modules/dist）剩 34 处，逐条确认都是 `vue-vben-admin` 归属或外部事实；重跑 `@antdv/{eslint-config,oxlint-config,vite-config,shared,utils}` 的 tsdown 产物并确认 dist 内无 `vben`；`turbo run type-check` 与相关包单测绿。

- Updated dependencies [2f1a233]
- Updated dependencies [f64fc3a]
- Updated dependencies [340f692]
- Updated dependencies [54d880b]
- Updated dependencies [5194446]
- Updated dependencies [f740d13]
- Updated dependencies [340f692]
- Updated dependencies [f64fc3a]
- Updated dependencies [abfe730]
- Updated dependencies [abfe730]
- Updated dependencies [340f692]
- Updated dependencies [54d880b]
- Updated dependencies [d8fa761]
- Updated dependencies [2f1a233]
- Updated dependencies [54d880b]
- Updated dependencies [f64fc3a]
- Updated dependencies [340f692]
  - @antdv/common-ui@0.1.0
  - @antdv/shadcn-ui@0.1.0
  - @antdv/shared@0.1.0
  - @antdv/icons@0.1.0
