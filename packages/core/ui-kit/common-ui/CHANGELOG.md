# @antdv/common-ui

## 0.1.0

### Minor Changes

- 2f1a233: feat: `AuthPageLayout` 换成整屏左右分栏版式，背景改成从主色推导的四层画布

  现象（用户归纳）：「auth 组件的背景有点单调，登录页看起来不像后台系统的登录页」。原来那版是视口正中一张 `max-w` 卡片，左右两侧整片留白，只有一层 `bg-card`，跟"管理系统的门面"对不上。方向经用户选定：**全屏左右分栏** + **克制的缓慢动效**。

  - **版式**：`[data-auth="card"]` 从"居中卡片"变成"铺满视口宽度的分栏行"，`lg` 以上左栏品牌 52% / 右栏表单 48%（右栏 `bg-card/70` + `backdrop-blur`，落在玻璃面上而不是又开一个颜色命名空间），`lg` 以下品牌栏整块 `hidden` 收成单列。`data-auth` 钩子一个没删，只改了 `card` 的语义 —— 依赖它的 `register-page.spec.ts`（断言 `card` 可见）不用动就还成立，但**任何按"卡片宽度 ≤ max-w"写的几何断言都会失效**，`login-page.spec.ts` 里那条已改成量两栏是否铺满、宽度比是否 ≥ 0.5 / 0.45、两栏是否等高同顶。
  - **背景四层，全部只从 `--primary` 推导**：`[data-auth="canvas"]` 是 `aria-hidden` + `pointer-events: none` + `overflow: hidden` 的装饰层，含三枚 `radial-gradient` 光斑（34 / 28 / 40s 的 `alternate` 漂移）、一层 3.5rem 网格（120s 走完一格，`mask-image` 用偏心径向把网格压向左上、避免糊到表单栏）、两道蓝图圆弧与一条地平线。用 `radial-gradient` 而不是 `filter: blur()`，是因为大尺寸模糊在低端机和 Firefox 上是首屏开销；`--primary` 在 14 个预设 × 明暗两套里都不带 alpha，所以 `hsl(var(--primary) / α)` 恒可用。动效在 `prefers-reduced-motion: reduce` 下整组 `animation: none`。
  - **品牌栏内容**：铭牌 + `brandBadge`（新增可选 prop，大标题上方那行引导语；分栏版式左栏是整屏高的画布，光一句标题压不住空白）+ 大标题 + 描述 + 三枚特性胶囊 + 一台界面示意（`[data-auth="slogan-visual"]`：窗口栏 / 侧边栏 / 三张卡 / 12 根柱 / 表格行，柱高是组件内写死的装饰值 —— 认证外壳刻意不认识 store，真接数据就得引入数据源）。`#sloganVisual` 插槽整块可替换，传 `sloganImage` 则换成图。
  - **顺手的两处**：`AuthFormPanel` 去掉自己的 `mt-*`（垂直居中与上下留白归 `AuthPageLayout` 的栏容器管，两处都管就会在窄屏上顶出滚动条）；`AuthSocialLogin` 的三枚入口加了 hover 上浮与主色描边 —— 分栏之后表单栏是"贴屏"的，原来那圈没有反馈的灰边显得像没做完。装饰 CSS 写在组件 `<style>` 里（BEM `auth-*`），沿用 `BorderBeam` 的先例：这类规则用 Tailwind 任意值写会退化成一大串方括号，而玻璃栏的**底色**仍留在 `bg-card/70` 工具类上，自定义类不与工具类抢同一属性。
  - **宿主侧**：登录 / 注册页接 `brandBadge`（新增 `auth.brandBadge` 中英文案），两个登录方式按钮补 `carbon:user` / `carbon:mobile` 图标，demo 账号提示从一行裸字改成带边框的信息条。按钮文案仍是 `账号登录` / `手机号登录` 整串，`signIn()` 用的是 `{ exact: true, name: '登录' }`，加图标不影响可访问名。

  验证：`common-ui` 单测 `__tests__/auth.test.ts` 25 例（新增 3 例：canvas 是纯装饰层（`aria-hidden`、内部无 `img/a/button/input`）、`brandBadge` 有传才渲染 `[data-auth="brand-badge"]`、示意柱状条带内联高度），`pnpm exec vue-tsc --noEmit` 该包 0 错，oxlint 新增行 0 命中（该文件存量的 5 条 `no-non-null-assertion` 全在我没碰的行上）。端到端 `login-page.spec.ts` + `register-page.spec.ts` 三引擎：chromium 10/10、webkit 10/10、firefox 10/10。整跑三引擎时 firefox 的**第一条**用例撞过 90s 墙钟（`主色和深色偏好真的落到登录页上` 要登录 → 开偏好抽屉 → 改两档 → 清 storage → reload → 四轮 `expect.poll`，冷编译下就是慢），单跑该 spec 6/6 绿、第一条 41.4s，按仓库既有口径记为负载型假红而不是改 `signIn` 或放宽超时。浏览器侧另用 10 组截图核过 1440 / 1280×720 / 1024 / 390 四档与明暗、紫 / 橙预设、`prefers-reduced-motion`，全部 `scrollWidth === clientWidth`（无横向溢出），1280×720 不产生纵向滚动；光斑漂移用两次采样对比 `getComputedStyle().transform` 矩阵确认在动（这也是为什么静止态必须写 `translate3d(0, 0, 0) scale(1)` 而不是留 `none` —— webkit 内核不在 `none` 与函数列表之间插值）。文档 zh 正文与 en 镜像同步了分栏契约与 `brandBadge`。

- 340f692: feat: common-ui 新增 `BorderBeam` 与 `Listy`；轻提示/通知去掉彩色底色，状态只留徽标

  两条线凑在一个 changeset 里，是因为它们共用同一批验证（示例页 + `preference-effects` 的实值断言）。

  - **`BorderBeam`（`common-ui/src/components/border-beam/BorderBeam.vue`，115 行）**：给卡片描一圈顺时针转的角度渐变光带。可配置项是 `border-width` / `color` / `tail-color` / `duration` / `delay` / `size` / `radius`（类型 `BorderBeamProps` 在 `types.ts`，全部 `number | string` 走 `toLength()`，默认主色 + 6s + 2px）；`size` 是光带在整圈里占的角度比例，不是像素。实现只有两层 DOM：外圈 `.border-beam__ring` 用 `padding` 撑出边框厚度、`mask-composite: exclude` 只留环，内圈 `.border-beam__spin` 是 `inset: -50%` 的 `conic-gradient` 靠 `rotate(360deg)` 转 —— 不用 `@property` 渐变角动画，因为那要求浏览器能插值 `<angle>`，而本包按源码被下游消费时没法假定构建链。`prefers-reduced-motion` 下直接 `animation: none`。
  - **`Listy`（`common-ui/src/components/listy/`，`Listy.vue` 156 行 + `types.ts` 48 行）**：通用列表。`items` 支持字段名自定义（`title-field` / `description-field` / `avatar-field`，默认回落到 `title` / `description` / `icon`），`size` 三档 `small | medium | large` 决定行高与字号，`selectable` / `striped` / `divider` / `empty` / `loading` 各自独立。九个插槽（`header` / `loading` / `empty` / `item` / `item-media` / `item-extra` / `footer`）里 `item` 是整行替换，其余是局部覆盖。**是否监听 `@select` 不能靠 `attrs` 嗅探** —— 声明过的 emit 会被从 `attrs` 里剥掉，`onSelect` 根本不会出现在 `attrs` 中，所以 `selectable` 是显式 prop（`Listy.vue:29-33` 的注释记录了这件事）。
  - **`EmptyState` 的深色可读性**：底色与文字原来是写死的 `bg-gray-50` / `text-gray-900`，深色模式下面是黑底黑字。换成 `bg-muted` / `text-muted-foreground` / `text-foreground` 三个语义 token（第一次尝试给图标加了 `/60` 透明度，结果深色下字形直接看不见，透明度撤掉）。
  - **轻提示与通知不再有彩色底色**：上一版把 `rich-colors` 打开，用 `--{success,info,warning,error}-bg` 给整块卡片染色，实测两种病：一是底色染成琥珀/红之后正文对比度掉下去（通知正文是给用户读的，不是状态徽章），二是 `rich-colors` 连带把 `[data-description]` 的颜色改成 `inherit`，描述跟着变彩。现在 `--normal-bg` 一律 `var(--app-popover)`，四种类型共用中性卡片，状态只体现在左侧那枚 20px 实色圆徽上（`bg-success` / `bg-info` / `bg-warning` / `bg-destructive` + 反白笔画；感叹号与信息符没有"只有笔画不带外框"的 lucide 图标，`CircleAlert` / `Info` 自带一圈，画进圆底成了框中框，所以这两枚手写 path）。部件微调走 `toastOptions.classes` 且**每条都带 `!`** —— sonner 的内置规则是 `[data-sonner-toast][data-styled='true'] [data-icon]` 这种三选择器特异度，不带 important 压不住。关闭按钮原来骑在卡片边框上（库默认 `translate(±35%)`），改成落在卡片内侧右上角，选择器按按钮自己的 `data-close-button-position` 分四种朝向（不是 toaster 的 `data-x/y-position`，两者互不跟随）。
  - **这套样式落在新增的 `common-ui/src/components/toast/Toaster.vue`（200 行），不在 `@antdv/shadcn-ui` 里**：shadcn 那只 `Sonner.vue` 把 `rich-colors` 写死在 `v-bind` 之后（外部传不进来），四枚状态图标也写死在自己的插槽里（外部传不出去，SFC 不转发插槽），要在不动它源码的前提下换掉这两样，只能用选择器去赌它内部选了哪几个 lucide 图标，子包一升级就失效。所以本包直接以 vue-sonner 为底座自建外壳：props 就是 `ToasterProps` 并 `v-bind` 原样透传（`index.ts` 把它转口出来），宿主的 `toast-options` 与默认样式**逐档合并、宿主优先**，六档徽标插槽写成"具名插槽 + 默认内容"可被同名插槽替换，覆写规则挂在 `.antdv-toaster` 这个本包自己的钩子上。结果：`@antdv/shadcn-ui` 一行未动（changeset 里也不再 bump 它），它新增/删除/迭代任何组件都波及不到这里；宿主侧只换 import 来源（`apps/web/src/App.vue:5`）。
  - **`message` / `notification` 的时长与开关（`popup-ui/src/message/index.ts`）**：轻提示默认 3s、通知默认 8s 固定在包里（`MESSAGE_DURATION` / `NOTIFICATION_DURATION`），不再把 `duration: undefined` 传给 sonner 吃它的 5s 默认值；`notification.*` 补上第三个 `duration` 参数。宿主侧 `apps/web/src/App.vue:87-94` 给通知那只 `<Toaster />` 加了 `close-button` 与 `close-button-position="top-right"`，轻提示那只不开 —— 3 秒自己走的东西挂关闭按钮反而多一块可点区域。
  - **示例页与菜单**：新增 `/components/border-beam`、`/components/listy`、`/components/feedback`（轻提示与通知的六种触发 + 通知位置偏好），菜单节点进 `apps/backend-mock/server/api/menus.get.ts:161-366` 与 `apps/web/src/mock/fixtures.json` 两份。顺手修掉两个不存在的图标名 —— 离线图标集里缺名字是**渲染空白方块且不报错**，`carbon:trash-bin` → `carbon:trash-can`、`carbon:border` → `carbon:border-full`，由 `apps/web/test/icon-names.test.ts` 兜住。

  **注意两条包内约定**（新组件的单元测试一开始全红，就是踩在这上面）：BEM 钩子类必须写静态 `class` 而不是塞进 `cn()` —— `border-beam` 会被 tailwind-merge 认成 `border-{color}` 那一档、`listy` 认成 `list-{type}` 而被合并掉；`<template>` 根元素**前面不能放注释**，dev 构建会保留注释节点使组件变成 Fragment，导致非 prop 的 `class` / `style` 透传失效、`wrapper.classes()` 返回空数组。

  验证：

  - `common-ui` 单测 27 个文件 / 288 条全绿（新增 `__tests__/border-beam.test.ts` 81 行、`__tests__/listy.test.ts` 147 行、`__tests__/toast.test.ts` 7 条：中性变量、宿主 `style` 覆写变量、props 透传、`toastOptions.classes` 逐档合并、四枚实色徽标、loading 是转圈而非圆底、宿主同名插槽可替换徽标），`vue-tsc --noEmit` 干净，eslint 干净；`popup-ui` 单测 6 个文件 / 56 条全绿。
  - 浏览器端到端（1440×900 与 768 宽、明暗两色）：`e2e/preference-effects.spec.ts` 7/7，其中四组实值断言钉住"卡片底色是 `--app-popover` 的中性值而不是类型色"「徽标背景等于 `--app-success` 等实色」「toaster 的 computed `z-index` 仍是 999999999」「通知落在偏好指定的角落且不与轻提示串位」。另用一份临时 spec 在 `/components/feedback` 上把**六种触发**逐个点过（默认 / 成功 / 信息 / 警告 / 错误 / Promise），断言的是计算值：`default` 不挂徽标、四种类型的卡片底色四份都等于 `--app-popover` 且 `data-rich-colors='false'`、徽标 `SPAN` 圆底等于状态色令牌而笔画为 `rgb(255,255,255)`、Promise 在 pending 阶段是 `animate-spin` 的 `svg`（没有圆底）落地后换成成功徽标、通知那只的关闭按钮矩形完全落在卡片矩形之内；深色主题下同一批断言重跑一遍，四张截图（浅色堆叠 / pending / 落地 / 深色通知）人工看过后连 spec 与截图目录一起清掉。
  - 迁移没有波及别的 shadcn-ui 消费方：`@antdv/shadcn-ui` 与 HEAD 零 diff，`e2e/icon-picker.spec.ts`（Popover + Select + Input + ScrollArea + `message` 播报）5/5 绿。顺带修掉该 spec 的一处 strict mode 违例 —— 根部有两只 `<Toaster />`，裸 `[data-sonner-toaster]` 命中 2 个元素，按 `data-x/y-position` 收窄到轻提示那只。
  - 文档：`docs/components/common-ui.md` 补 BorderBeam / Listy 两节与导出清单（34 → 54 个值导出，含 `Toaster`）与「Toaster（提示容器）」一节（说明为什么这层不在 `@antdv/shadcn-ui`）、`docs/components/modal-drawer.md` 新增「轻提示与通知」一节，中英两份同步；`docs/_linkcheck.mjs`（121 个文件）与 `_sidebarcheck.mjs`（94 条链接）零缺失，`vitepress build` 通过。

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

- 340f692: feat: `Listy` 加虚拟滚动模式，万级数据只渲染视口内那十几行

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

- abfe730: 架构升级：把可复用能力从应用层抽成独立子包，重排 monorepo。

  - 新增 `@antdv/shared`（通用方法、菜单树工具、请求封装）、`@antdv/preferences`（用户偏好设置与持久化）、`@antdv/composables`（自定义 hooks）、`@antdv/ui`（公共组件）、`@antdv/layouts`（多布局形态：vertical / two-column / horizontal / side-nav / mixed-vertical / mixed-two-column / full-content）、`@antdv/router`（鉴权与动态菜单守卫，依赖注入式，不绑定 store）、`@antdv/directives`（通用指令）、`@antdv/design`（设计令牌与基础样式）、`internal/vite-config`（可组合的 Vite 配置）、`internal/node-utils`（缺失的 Node 工具包）。
  - 子包统一用 tsdown 产出 dist，由 turborepo 编排 build / dev / type-check / test:unit；依赖版本走 pnpm `catalog`。
  - mock 服务迁移到 Nitro（`apps/backend-mock`）：业务接口走 `/api`，控制面走 `/api/mock-center/**`。
  - 菜单与标签页：混合布局下两级联动、精准单选高亮、横向导航溢出滚动 + 拖拽；标签页支持拖拽排序、四种风格、放大还原、关闭其他、固定与刷新。
  - 接通标签页页面缓存：`apps/web` 新增 `usePageCache`，用归一化 path 生成 KeepAlive 缓存名，`include` 只收"标签还开着且菜单允许缓存"的页面；刷新标签会推进缓存代号，退出登录清空缓存。
  - e2e：`apps/web/e2e` 从上游模板的失效用例改为可跑的真实链路（冒烟、页面缓存、XSS 安全基线），`playwright.config.ts` 对齐项目实际端口 6080 并支持 `E2E_BASE_URL` / `E2E_HEADED` / `E2E_WORKERS`，turbo 补上 `test:e2e` 任务；Chromium / Firefox / WebKit 三引擎 81 条用例全绿。
  - 跨浏览器兼容修掉两处真问题（都不是"调超时能糊过去"的那种）：
    - `@antdv/shared` 的 CSRF Double Submit Cookie 原来写 `HttpOnly=false`。Cookie 属性是"出现即为真"的标记，浏览器据此把 cookie 存成 HttpOnly，脚本第二次写同名 cookie 就被拒绝 —— Chromium 只在 DevTools 的 Security 面板提示，Firefox 直接往 console 打 error。现在按 `path=/; SameSite=Lax` 写入，`Secure` 只在 https 下追加。
    - `apps/web/index.html` 的 CSP 原来恒定带 `upgrade-insecure-requests`。WebKit 不豁免 `http://localhost`，会把每个模块请求升级成 https 并握手失败，页面只剩首屏 Loading 的白屏（Chromium / Firefox 无症状）。该指令改由 `@antdv/vite-config` 按构建模式注入：生产保留，开发留空。
  - e2e 基建收尾：`watchErrors` 忽略 `ResizeObserver loop …`（观察者规范里的正常收敛状态，WebKit 抛成 pageerror、Firefox 抛成 console error）；本地并发压到 `E2E_WORKERS`（默认 3，一个引擎一个 worker）并只给 WebKit 放宽计时，避免"纯超时"的假红；`.gitignore` 用不带路径的 `.mock-state.json`，覆盖 Nitro mock 落在 `apps/web/` 的运行时状态文件。
  - 退出登录的会话态收口：`useUserStore().logout()` 现在除了凭证与页面缓存，还会 `resetRoutes()`（把 `isLoaded` 打回 false，守卫下次导航重新拉菜单）并清空标签页；`forceLogout()` 改为复用这一个出口，并把回登录页从 `location.href = '/login'` 换成改 hash —— 本应用是 hash 路由，写 pathname 会触发整页重载，打断进行中的导航还把 `redirect` 参数弄丢了。修前：换个账号在同一次页面会话里登录，会沿用上一个账号的菜单与授权集合。
  - 发布链路改为 changesets（移除 `docs/` 与 standard-version），根脚本新增 `release`。

- 54d880b: feat: 圆角基准固定 16px 并由它单点派生全站刻度；自绘滚动条默认改成"只在滚动时亮"

  两条 UI 适配口径：

  - **圆角只剩一个基准**。`BORDER_RADIUS_BASE` 从 8 固定成 **16**（`packages/core/base/shared/src/constants/theme.ts:12-13`），`--app-border-radius` 在 `design/src/token/default.css` 与 `dark.css` 两处同步写成 `16px`。`--radius-*` 那套乘法刻度（`design/src/token/index.css`，xs/sm/md/lg/xl/2xl/3xl = 基准的 0.25/0.5/0.75/1/1.5/2/3）一个字没动，所以基准一动整条刻度按比例一起放大：默认偏好（倍率 1）下 `rounded-sm..3xl` 是 8/12/16/24/32/48px。偏好里存的仍是 0~1 的倍率，`writeThemeCssVars()` 那条换算链与 antd 侧的 `borderRadius` 都从同一个基准取数，因此不会出现"卡片圆角变了、按钮没变"那种两套尺度；`typings/src/app.ts` 的注释、`preferences/src/config.ts`、`update-css-variables.ts:96` 的口径说明一起改到 16。
  - **侧边栏没有手写滚动条样式**（审计结论，无需改动）：菜单区从一开始就包在 `@antdv/common-ui` 的 `<Scrollbar>` 里（`layout-ui/src/components/layout-sidebar/index.vue:155-157`），全仓库再无侧边栏专属的滚动条皮肤；`tabs-ui/TabsBar.vue` 那串历史 `::-webkit-scrollbar` 工具类也早已删除。唯一还在写原生条的是 `design/src/css/scrollbar.css`，它在 `@layer base` 里只兜第三方组件内部的原生滚动元素（textarea、pre、虚拟列表），放在 base 层正是为了让 reka 注入的隐藏规则能盖过它 —— 端到端用例把"reka 滚动盒上 `scrollbar-width: none`"与"页面里没有自绘条之外的可滚元素"钉成了断言。
  - **默认显示行为改掉**：`Scrollbar.vue:133` 把 `ScrollArea` 的 `type` 从 `hover` 换成 `scroll`。`hover` 的显隐只看指针，鼠标停在侧栏上轨道就一直亮，`hideDelay` 形同虚设；`scroll` 只在真正产生滚动位移时出现，停止后（reka 先 100ms 防抖判定滚动结束）按 `hideDelay`（默认 800ms）收起，指针留在原地也一样。`always` 保持为唯一的常驻开关，`native` 分支不受影响；`scroll` 态机在 idle 仍响应 POINTER_ENTER，所以条亮着时滑块照样可拖。

  验证：单测 `common-ui` 290/290（其中 `scrollbar.test.ts` 12/12，新增"滚动时轨道出现、停止后按 hideDelay 自动收起"一条用假定时器覆盖 100ms 防抖 + 500ms 收起两段）、`shared` 182/182（`constants.test.ts` 把基准钉成 16）、`preferences` 64/64（倍率 0.5 → `8px`、倍率 1 → `16px`）、`design` 30/30。浏览器端到端新增 `apps/web/e2e/ui-adapt-radius-scrollbar.spec.ts`（3 条，chromium / firefox / webkit 各跑一遍，9/9 绿）：七档圆角的计算样式逐项等于 16px 基准的对应倍率、`[data-slot="card"]`（`rounded-xl`）量到 24px；侧边栏在 1280×300 视口下必然溢出（滚动盒 180px / 内容 308px），空闲时轨道不在 DOM 里、滚轮滚动时 `data-state="visible"`、指针不挪动 1.5s 后自动收起且滚动位置不回弹、反向再滚又亮；页面里没有自绘条之外的可滚元素。`preference-effects.spec.ts`（7/7）复跑覆盖倍率换算那半程。`npx tsc --noEmit -p apps/web/e2e/tsconfig.json` 对新增用例干净，另有 3 处存量报错（`app-loading-theme.spec.ts:85`、`ops-sweep.spec.ts:341,344`、`screen-fit.spec.ts:64`）与本次无关。文档同步：`docs/guide/in-depth/theme.md`、`docs/en/guide/in-depth/theme.md`、`docs/zh/guide/in-depth/theme.md` 改成 16px 基准；`docs/components/display.md` 与 en 镜像补写默认显隐并重对全部裸行号引用；`docs/guide/in-depth/layout.md`（含 `docs/zh` 副本）与 en 镜像的「滚动条」小节新增侧边栏落点、`scrollbar-width: none` 判据与端到端锚点。

- 340f692: refactor: `apps/web` 的通用 composables 与无业务耦合组件迁进对应子包（hooks / common-ui / table-ui），web 侧只留业务件

  诉求（用户归纳）：把 web 子包 `composables/` 与 `components/` 里"可复用公共内容"统一迁到对应子包，保留类型、响应式逻辑与功能兼容，更新全部引用路径，迁完清理冗余并同步文档。判据沿用仓库既有一条：**换一个项目还能不能用**——能就进包，需要应用配置/store 单例/应用内组件类型的留在 `apps/web`。

  - **`usePermission` → `packages/core/hooks/src/use-permission.ts`（184 行，`@antdv/hooks`）**：原 `apps/web/src/composables/web/permission/`（`usePermission.ts` + `types.ts` + `index.ts`）整目录搬走，七个判定函数、四个枚举（`PermissionAction` / `PermissionMode` / `PermissionResource` / `PermissionRole`，枚举在 `:27-32`）与 `UsePermissionOptions` 全部原样保留。它能进 hooks 的理由写在包入口注释里：这是唯一读会话状态的 hook，但只认 `@antdv/stores` 的 user store，不读路由实例、不发请求，因此子包可直接复用。消费点三处改为从包里引：`apps/web/src/directives/index.ts:13`、`apps/web/src/plugins/table-runtime.ts:1`、`views/components/table/crud/index.vue:34`。单测跟着搬（`packages/core/hooks/__tests__/use-permission.test.ts`，6 条）。**顺带纠正一条写错的文档**：`docs/components/directive-drag.md` 原来断言 `permissions: ['*']` 在元素层"什么都不授予"，实际上 `checkArrayMatch()` 第一件事就是 `userList.includes('*')` 直接返回 true（`use-permission.ts:91-93`），而 `v-permission` 的 `resolveAccess()` / `matchGroup()`（`packages/directives/src/permission/utils.ts:82-108`、`:53-68`）整条链都委托给注入的 checkers——所以 mock 给 admin 发的 `['*']`（`apps/backend-mock/server/utils/accounts.ts:48`）是全量放行。这条通配在迁移前的 `git show HEAD` 里就存在，迁移没有改变行为，是文档口径错。
  - **`useCRUD` → `packages/core/hooks/src/use-crud.ts`（393 行）**：入参/返回、`containerType`、批量删除内置那一次确认框（现在显式走 `@antdv/popup-ui` 的 `confirm()`，`use-crud.ts:277`）都没动。**依赖方向是要设计过的**：它对 `@antdv/form-ui` / `@antdv/table-ui` 只取 `*ActionType` 这几个**类型**（`use-crud.ts:1-3`），运行时只碰 popup-ui 的 `confirm` / `message`（`:8`），所以 `ui-kit → hooks` 这条边不成环。测试 28 条一并迁入，`apps/web/src/composables/__tests__/use-crud.spec.ts` 删除。
  - **`MicroAppContainer` → `common-ui/src/components/micro-app-container/`（162 行 + `types.ts` 18 行）**：micro-app SDK 派发的四个 window 事件（`beforeload-` / `mounted-` / `unmount-` / `error-${name}`）用 `useEventListener` 收敛成 props/emits（`:76-79`），加载遮罩、失败重试与"未配置地址"占位都在组件内。`<micro-app>` 标签由 `internal/vite-config` 的 `isCustomElement` 认下（`plugins/custom-elements.ts`、`plugins/vue.ts:43`），组件不声明局部组件，否则会有 `Failed to resolve component` 警告。
  - **`ECharts` → `common-ui/src/components/charts/`（65 行），只走子路径 `@antdv/common-ui/charts`**：`import * as echarts from 'echarts'` 会把全量注册表拖进来，所以它和 `@antdv/hooks/echarts` 同口径**故意不进根 barrel**（豁免注释在 `charts/index.ts:1-5`）。`EChartsProps` 也只从子路径导出。
  - **`TreeTable` → `table-ui/src/components/TreeTable.vue`（301 行），而不是 common-ui**：组件内部渲染的就是 `BasicTable`，而 `table-ui → common-ui` 这条依赖已经存在，反向引用会让两个包成环。类型进 `table-ui/src/types.ts:1071-1108`（`TreeDataNode` / `TreeTableFetchParams` / `TreeTableProps` / `TreeTableEmits`），从包根导出（`table-ui/src/index.ts:9`）。对外分页字段仍是 `page`，由内部 `pageNum` 换算（`TreeTable.vue:136-142`）——这是 `FetchParams` 与组件契约之间唯一的翻译点，别改成直接透传。搬迁后端到端验证顺带修掉一个从原 `apps/web` 版本就带着的缺陷：右侧表格由 `selectedKey` 才挂载，第一次点树节点时 `reload()` 跑在组件注册之前，选中了却取不到数（表现为空表格）。现在在 `handleTreeSelect` 里 `await nextTick()` 再 `reload()`，回归用例见 `apps/web/e2e/tree-table.spec.ts`。
  - **导出规范与样式管理**：`common-ui` 三个出口保持 `.` / `./charts` / `./package.json`；迁移后根 barrel 实测 55 个值导出 + 66 个类型导出（`UploadProps` 仍未转口，`EChartsProps` 只在 `./charts`）。组件一律 `components/<kebab>/<Pascal>.vue` + `types.ts` + `index.ts`，样式走 shadcn 语义 token（`bg-background` / `text-muted-foreground` 一类），不新增裸色值。
  - **web 侧清理（收尾一轮做完）**：`apps/web/src/components/` **整目录删除** —— `business/ImportExport.vue` → `@antdv/common-ui/import-export`，`common/AvatarUploader.vue` → `@antdv/common-ui/avatar-uploader`，`common/Upload/**` → `@antdv/common-ui/chunk-upload`，`layout/ReloadPrompt.vue` → `components/reload-prompt/` 并进根 barrel；`business/TenantSelect.vue` 直接删掉，`grep -rn TenantSelect apps packages` 为空。`Upload.vue` 在包内改名 `FileUpload.vue`：`components/upload/` 早就占着 `Upload` 这个名字（`upload/index.ts` 同时导出 `Upload` 与 `UploadDragger`/`UploadList`），两个入口共用一个名字会让人分不清拖拽壳和基础件。`apps/web/src/composables/useLocale.ts` → `packages/core/hooks/src/use-locale.ts`，按 `@antdv/hooks/use-locale` 深路径暴露（唯一牵 vue-i18n 的组合式函数，进根 barrel 等于让每个 `@antdv/hooks` 消费者都付一份 i18n 运行时），消费点 `App.vue`、`plugins/layouts-host.ts`、`views/{login,register}/index.vue`、`locales/__tests__/locale.spec.ts` 全部改成从包里引。
  - **自动导入声明跟着收**：`unplugin-vue-components` 的注册范围就是那个被删掉的目录，所以 `apps/web/types/components.d.ts` 里的 6 条（`AvatarUploader` / `ChunkUpload` / `ImportExport` / `ReloadPrompt` / `TenantSelect` / `Upload`）必须清掉 —— 留着不会报错，但会把"裸标签能用"这个假象留在类型层，实际运行时解析不到组件。现在只剩 `RouterLink` / `RouterView`。
  - **文档同步**：`docs/components/{index,common-ui,chart-cron,table,directive-drag}.md` 与 en 镜像、`docs/{guide,zh/guide,en/guide}/in-depth/{common,composables}.md`、`docs/{guide,zh/guide,en/guide}/essentials/utils.md` 逐条把路径与行号对回当前实现；三副本一致性用"`docs/zh` 去掉 `/zh` 前缀后与 canonical 逐字节相同"校验。`~/components/business/{Table,Form}` 一类的旧 import 全量替换为 `@antdv/{table-ui,form-ui}`。

  验证：`@antdv/hooks` 构建 + `vue-tsc` 绿、包内 10 个测试文件 102 条用例全绿；`@antdv/common-ui` `vue-tsc` 绿；这一轮迁进来的四件按包内既有口径补了单测（`__tests__/chunk-upload-hash.test.ts` 8 条、`import-export.test.ts` 7 条、`reload-prompt.test.ts` 9 条，`upload.test.ts` 覆盖基础件），`useLocale` / `useLocaleSync` 的行为断言留在 `apps/web/src/locales/__tests__/locale.spec.ts`（它要 vue-i18n 实例与语言包，那两样都住在应用侧）；`pnpm turbo run test:unit --concurrency=2` 32/32；`vue-tsc -p tsconfig.app.json` 剩 98 条且**没有一条能归到这次迁移**（迁移前 109）；`node _linkcheck.mjs .` 与 `node _sidebarcheck.mjs .`（在 `docs/` 下跑）均为 0 missing。浏览器侧需要重启 :6080 dev server 再看 `/components/chart`、`/components/table/tree-table`、`/components/table/crud`、`/components/directive`、`/micro-app` 五个页面——hooks 走 dist 产物，不重启会读到旧 chunk。Playwright（chromium）在这台 dev server 上跑过：新增的 `apps/web/e2e/tree-table.spec.ts` 2 条（选部门驱动取数 + 搜索过滤树，首次点击就取到数正是上面那个 nextTick 修复的验收点）、`e2e/table-crud.spec.ts` 4 条（`useCRUD` 全链路 + custom 账号的按钮级权限）、`e2e/permission-accounts.spec.ts` 7 条、`e2e/site-sweep.spec.ts` 2 条（全站菜单叶子逐页打开，本站错误为零），合计 15 条全绿。

### Patch Changes

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

- 340f692: refactor: 把"跨包只走包名导入"写成测试守住；`ErrorBoundary` 不再从自己的 barrel 绕，堆栈区改成定高

  诉求（用户归纳）：审一遍 `packages/**` 的跨包引用——不许用相对路径伸进别的包、每个 `@antdv/*` 都要在清单里声明、并且必须走目标的 `exports`；找出来的违规要修掉并用测试固化。

  - **盘点结果：仓库其实已经基本合规**。全仓 `packages/**` 的 JS/TS/Vue 里跨包相对路径 0 条、绝对路径/盘符 0 条、未声明的 `@antdv/*` 0 条（早期一轮报出 1194 条"未声明"是我扫描脚本把 `spec.slice(8)` 写错成包名截断，正确是 ` '@antdv/'.length === 7`）。真正的违规只有三处，两处是**该留的**：
    - `packages/core/base/design/src/index.css:39-48` 的 10 条 `@source` 指向别的包 —— Tailwind v4 的 `@source` 只认文件系统路径（在 `tailwindcss@4.3.3/dist/lib.js` 里确认它编译成 `{base, pattern}`，没有包名解析），而构建根在 `apps/web`，`packages/` 全在自动检测之外。试图改成包名是错的方向，改为**白名单 + 存在性 + 完整性**校验。
    - `packages/core/ui-kit/shadcn-ui/src/assets/index.css:1` 的 `@reference "@antdv/design"`，`@antdv/design` 只在 devDependencies —— 这个文件唯一的消费者是 `shadcn-ui/components.json` 的 `"css"` 字段，即 shadcn CLI 的构建期入口，分类正确。
  - **唯一真违规并修掉的**：`common-ui/src/components/error-boundary/ErrorBoundary.vue:6` 原来写 `import { Scrollbar } from '@antdv/common-ui'`，即组件经自己的 barrel（`src/index.ts:111`）反向引回同包的另一个组件，是条环。打包产物里侥幸能跑，按源码消费本包的兄弟包（`tabs-ui` 引 barrel）会拿到 undefined。改成 `import Scrollbar from '../scrollbar/Scrollbar.vue'`，与包内"互引走相对路径、对外只认 barrel"的既有口径一致。
  - **顺带修掉一个从迁移前就带着的显示缺陷**：默认兜底里那层堆栈区写的是 `Scrollbar root-class="max-h-32"`。`max-*` 只裁掉可视高度，`.scrollbar` 根元素本身仍是 auto 高度，内部 `.scrollbar__wrap{height:100%}` 量不到确定高度，浏览器上实测根 128px / 滚动区 400px、`scrollTop` 赋 999 仍是 0 —— 一屏 1316 字符的调用栈只显示上 128px 且滚不动。改成 `h-32` 后 clientHeight 128 / scrollHeight 400 / `scrollTop` 272，能滚了。单测钉的是类名（jsdom 不应用 SFC 的 `<style>`），几何在浏览器里量。
  - **守卫落在 `packages/core/hooks/__tests__/boundary.test.ts`**（就是守"子包不许依赖 antdv-next"的那个文件，同一份 `packages/` 全体不变量放一处），新增 `describe('跨包只走包名导入')` 四条：① 相对说明符解析后必须落在自己包根内，且不许出现盘符/根路径/UNC/`file:`；② 指向本仓其他包的 `@antdv/*` 必须写在 `dependencies`/`peerDependencies`（devDependencies 只放行 CSS 工具链入口那条，见上）；③ `src` 下的文件不许通过自己的包名引自己（就是 ErrorBoundary 那条环）；④ 只有 `design/src/index.css` 允许带跨包相对路径，其中每条目标都要在磁盘上存在，且名单必须**覆盖所有 `src` 下有 `.vue` 的包**——实测这 10 个包正好是 `shadcn-ui`(373) / `common-ui`(55) / `layouts`(29) / `form-ui`(20) / `layout-ui`(9) / `table-ui`(7) / `menu-ui`(6) / `tabs-ui`(5) / `popup-ui`(3) / `icons`(3)，以后新增组件包忘记登记会直接红，不再靠肉眼发现"组件渲染出来了但没样式"。四条都用临时探针文件验过能红（跨包相对路径、`J:/…` 绝对路径、未声明依赖、自引包名、给未登记包塞一个 `.vue`），探针已删。
  - **两条扫描口径**：说明符提取会命中测试里的正则字面量（`icons.test.ts:62` 的 `/from '\.\/(loading|scrollbar)'/` 被当成 `'\.\/(loading|scrollbar)'`），所以"绝对路径"判定只认盘符、`/` 开头、双反斜杠与 `file:`，单反斜杠开头不是路径；注释（`//`、`/* */`、`*` 续行、`<!-- -->`）先剥掉再扫。`toSorted` 只出现在测试文件里，包源码不许用（`tsconfig.app.json` 的 lib 没有 ES2023）。

  验证：`boundary.test.ts` 8 条、`error-boundary.test.ts` 8 条全绿；`@antdv/hooks` 与 `@antdv/common-ui` 的 `vue-tsc --noEmit` 均零错；`pnpm turbo run test:unit --concurrency=2` 32/32；`pnpm turbo run build --filter=@antdv/web` 9/9；`vue-tsc -p tsconfig.app.json` 仍是 98 条（与本次无关，见 P7a）；oxlint 对两份改动文件零新增错（`ErrorBoundary.vue` 那 3 条 `no-console` 是 DEV 分支的既有报错，属存量）。浏览器侧在 :6080 的 `/components/loading` 上实测：点「模拟一次崩溃」出兜底（`⚠️ 出错了` + 消息 + `🔄 重试`），展开调用栈详情能量到 `h-32` 定高且可滚（`scrollTop` 272/400），点重试真的恢复内容（`fallbackGoneAfterRetry: true`）。**改 `packages/core/hooks` 这类走 dist 的包之后必须重启 dev server**，否则页面读的是旧 chunk；本轮还遇到重建 `hooks/dist` 期间 dev server 报 404 导致应用挂不起来，重新加载即恢复。文档同步：`docs/{guide,zh/guide,en/guide}/other/project-update.md` 里那条测试路径已从 `packages/core/composables/...` 更正为 `packages/core/hooks/...`，并把新第二节写进去；`docs/{components,en/components}/common-ui.md` 的 `max-h-32` 描述改成 `h-32` 并记着为什么不能用 `max-*`。

- d8fa761: fix: 设计变量对齐 shadcn-vue 的格式契约 —— 裸规范名 + HSL 三段，别名层与 `--app-*` 整套撤掉

  诉求（用户原话）：`index.css` 的变量格式对齐 shadcn-vue。给的选项是「加规范名别名层（推荐）」，实施到一半发现这条路走不通，**最终落成了"裸规范名就是唯一事实来源"**，比别名层少一层。偏离的缘由记在下面，不是偷偷改口径。

  - **别名层和通道格式互斥**：shadcn-vue 的读侧是 `hsl(var(--primary))`，要求变量里存的是 `215.02 100% 54.31%` 这种**三段通道**；而 `--app-*` 那套历史命名存的是整色（`#1677ff` / `rgb(22 119 255)`）。加一层 `--primary: var(--app-primary)` 只是把整色换个名字，`hsl()` 一拼还是非法值。要让规范名能用，值必须先变成通道 —— 那时候别名和来源就是同一个形状、同一个语义，剩下两个名字反而成了"两份事实"，一条链路要同时维护前缀名与裸名，任何一处写错都是静默丢样式。
  - **撤掉别名层的代价验证过，不是靠推理**：子树覆盖（`ConfigProvider` 的 `theme.primary`）之所以还能生效，靠的是 `@theme inline { --color-primary: hsl(var(--primary)) }` 把工具类编译成 `hsl(var(--primary))` **表达式本身**，在使用点而非 `:root` 求值。所以 `<html>` 上的一份裸名声明 + 容器上的内联覆盖，各自都在最近元素上解析 —— 原来那个专门为此存在的 `THEME_SCOPE_CLASS = 'app-theme-scope'` 已经没有作用，删（`shared/src/constants/dom-classes.ts`）。同理 `CSS_VAR_*` 全部改成裸名（`--primary` / `--radius` / `--font-size` / `--filter`），写侧统一走 `convertToHslCssVar()`，读侧统一 `hsl(var(--x))`。
  - **`--radius` 只留 rem 一档口径**：`--app-border-radius` 时代 px 与 rem 混写过，根字号一缩放就出现"文字变了圆角没变"，默认字号下量不出来。现在 `--radius: 1rem`，`--radius-*` 全部按倍率派生（`--radius-lg: var(--radius)`），单位口径由 `design.test.ts` 钉住而不是靠人记。
  - **顺带修掉一条静默回归**：`@antdv/design` 入口的 10 行 `@source`（登记 `packages/**` 里的组件包源码）在 `071dad02` 被删了。Tailwind v4 的自动内容检测从**构建根** `apps/web` 起扫，`@antdv/*` 全在仓库根的 `packages/` 下（软链进 node_modules 也在检测范围外），少登记一个包 = 那个包模板里的工具类一条都不生成。症状不是"样式丑"而是"弹窗/抽屉不定位"：`fixed top-[50%] left-[50%] translate-y-[-50%]` 这些任意值类不存在，元素退回静态位置（top:auto 落到文档流里），6 条 e2e 报 `element is outside of the viewport`，构建全程零报错。恢复登记 + 浏览器复核（modal 包围盒回到 top≈43/left≈380，提交按钮 hit-test 命中自己）。

  测试口径：

  - `design/__tests__/design.test.ts` 32 条整页重写口径：不比"看着有这条变量"，而是逐条断言**值必须是通道形状**（`/^[\d.]+ [\d.]+% [\d.]+%(?: \/ [\d.]+)?$/`）、明暗两套不许同值、`--color-*` 一律导出成 `hsl(var(--x))`、全站源码不再出现 `--app-`。别名层那条用例换成这条更强的一致不变式。
  - `apps/web/e2e/preference-effects.spec.ts` 里原来那条"规范名与别名同源"的用例，在改名后会退化成 `--primary` 和 `--primary` 自己比（恒真）。改成钉两件事：`<html>` 上的计算值是通道串，而 `bg-primary` 这类工具类**画出来的颜色**等于当场用 `hsl(var(--primary))` 算出来的颜色 —— 后者只有在工具类生成的是表达式而非常量时才成立，所以换预设、切深色之后各比一次才有效。浅色→橙黄→深色三段分别钉 `rgb(250, 84, 28)` 与 `rgb(251, 146, 60)`，正是"`.dark` 里抄了字面量"这种回归的探测器。

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

- Updated dependencies [f64fc3a]
- Updated dependencies [340f692]
- Updated dependencies [54d880b]
- Updated dependencies [5194446]
- Updated dependencies [f740d13]
- Updated dependencies [abfe730]
- Updated dependencies [abfe730]
- Updated dependencies [54d880b]
- Updated dependencies [d8fa761]
- Updated dependencies [2f1a233]
- Updated dependencies [d8fa761]
- Updated dependencies [54d880b]
- Updated dependencies [f64fc3a]
- Updated dependencies [d8fa761]
  - @antdv/popup-ui@0.1.0
  - @antdv/shadcn-ui@0.1.0
  - @antdv/shared@0.1.0
  - @antdv/icons@0.1.0
  - @antdv/request@0.1.0
