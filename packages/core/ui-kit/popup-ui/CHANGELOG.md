# @antdv/popup-ui

## 0.1.0

### Minor Changes

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

- d8fa761: refactor: 轻提示与通知的关闭按钮改成单条可选项，默认不展示

  诉求（用户归纳）：`message` 不再默认渲染关闭按钮；`notification` 增加可配置项控制显隐；两者的默认状态统一为「不展示」，没配置传入就没有按钮；其余功能不动，配置读写与不同取值下的展示状态都要验。

  **开关落在单条，而不是 toaster**：`vue-sonner@2.0.9` 的解析顺序是 `Toast.vue:233` 的 `props.toast.closeButton ?? props.closeButton`，而 `Toaster.vue:170` 的 `closeButton` 默认 `false`。所以把开关做成 `ToastInit` 上的 `closeButton?: boolean`（`popup-ui/src/message/index.ts:67`）就能同时表达两件事——「默认没有」和「这一条要/不要」；只开在宿主那侧反而做不到后者（整体开一次，就没法让某一条不带按钮）。两条通道共用这一个键、同一条判断，`toToastOptions` 只在 `closeButton !== undefined` 时写进载荷（`:98`），所以不传时连键都不出现，载荷形状与改动前完全一致，`message` / `notification` 的方法清单仍然逐档相同。

  - **`message`（`:95-98`）**：`ToastInit` 新增 `closeButton`，`closeButton: true` 才有 ✕。原来的"轻提示一律带按钮"来自宿主的整体开关，现在宿主不开了，所以默认无按钮就是默认无按钮，不是靠这层特判。
  - **`notification`**：同一个键，同一个口径，走对象写法（`notification.info('标题', { closeButton: true, description: '描述' })`）。数字/字符串两档简写不带开关——那两个位置已经有含义，再往里塞布尔只会让人猜（`normalizeInit` 的注释记了这条）。
  - **宿主（`apps/web/src/App.vue:60-70`）**：两只 `<Toaster>` 都去掉 `close-button`，`close-button-position="top-right"` 留着，它只给"显式开了 ✕ 的那条"定朝向。
  - **示例页（`apps/web/src/views/components/feedback/index.vue`）**：通知那组改成 `{ closeButton: true, description }`，另加一张「关闭按钮开关」卡把四档都点出来（轻提示开 ✕ / 轻提示不开 / 通知开 ✕ / 通知不传），页面文案跟着改掉「点右上角 ✕ 或等 3 秒」那句已经不再适用于所有条目的说明。
  - **单测**：`popup-ui/__tests__/message.test.ts` 新增一组 5 条（默认不写键 × 两条通道、简写不带开关、`true` 原样透传、轻提示侧同样生效且仍不带 `toasterId`、显式 `false` 要写进载荷），整包 18/18；`common-ui/__tests__/toast.test.ts` 补一条外壳层的默认口径（不传 props 就不该有 `[data-close-button]`）。
  - **e2e**：`apps/web/e2e/preference-effects.spec.ts` 里原来那条「两条通道都能点 ✕」改成按单条口径断言（轻提示默认无按钮、通知那条有并点了立刻收），另加一条专测开关本身；卡片样式对照表里去掉了 ✕ 数量这一维，因为它已经不再是两条通道的公共属性。同一轮补了一处**早就缺的等帧**：`/account/settings` 那条 warning 在量 `elementFromPoint` 之前没调 `settleToast`，slide-in 头几帧整张卡片还在视口上沿之外、命中测试拿到 `null`，于是 WebKit 稳定假红（Chromium / Firefox 恰好读得晚所以看不出来；缩小到单条复跑仍红 → 补 `settleToast` 后通过）。
  - **文档**：`docs/components/modal-drawer.md` 与 en 镜像的「为什么根部要挂两只 `<Toaster />`」一节重写（原话「两只都开 `close-button`」已过期），签名表与行号引用同步（`message/index.ts` 从 128 行变 141 行，`NOTIFICATION_TOASTER_ID` 从 `:33` 移到 `:34` 等）；`docs/zh/**` 那份副本按 `docs/.vitepress/config.mts:14-15` 的口径不写入。

  顺带两处类型口径修复：`apps/web/tsconfig.vitest.json` 的 `types` 是**覆盖**不是追加，原来漏了 `vite/client`，于是 `ImportMetaEnv` 没有索引签名、被测源码里的 `import.meta.env.VITE_APP_BASE_API` 报 TS2339；补上之后该项目的报错从 74 降到 66，`src/plugins/**` 与其新增用例全部干净。`types/env.d.ts:1-4` 顶部那几行 `<reference>` 也被 `spaced-comment` 拆成了 `// /`（本仓库文档里记过这个失效形式），所以它指望不上，`types` 里必须显式列。

  验证：`popup-ui` 单测 18/18、`vue-tsc --noEmit` 该包 0 错、`common-ui/__tests__/toast.test.ts` 8/8；`apps/web` 的 `src/plugins/__tests__` 18/18、`vue-tsc -p tsconfig.app.json` 90 条存量错且无一条落在本轮改动文件、`-p tsconfig.vitest.json` 66 条同样不含 `src/plugins/**`。清掉 `apps/web/node_modules/.vite` 后重启 :6080（Nitro mock 5320 一起起），确认 dev 侧拿到的 `App.vue` / `feedback/index.vue` transform 已不含 `close-button`；`preference-effects.spec.ts` 三引擎各 `--workers=1` 整跑：chromium 10/10（1.7m）、firefox 10/10（2.8m）、webkit 10/10（补上等帧后那条单跑 57.4s 通过）。用例全程挂 `watchErrors`，四种配置组合（轻提示开/关、通知开/关）的按钮显隐与"点了立刻收"都在浏览器里读实值断言，控制台无新增报错。

### Patch Changes

- f64fc3a: feat: `BasicDrawer` 改用 shadcn 的 **Drawer 原语**（不再走 Sheet），抽屉多出「甩动关闭」并补掉原语的两个无障碍缺口

  现象（用户归纳）：`basic-drawer 使用 drawer 而不是 sheet`。此前 `BasicDrawer` 建在 Sheet（Dialog 语义 + `side`）上，能力面比 Drawer 窄，抽屉在触屏上缺少"往开口方向一甩就关"这条默认预期。

  - **换原语而不换依赖**：`DrawerRoot` / `DrawerContent` / `DrawerTitle` / `DrawerDescription` 都在仓库内 vendor 的 `@antdv/shadcn-ui` 里，底层同为 reka-ui 2.11.0，不需要引入 vaul。`placement` 与原语的 `swipe-direction` 是一对一映射，只有 `top/bottom` 两档要换成原语的 `up/down` 词汇（`SWIPE_DIRECTIONS`）。对外 API 面零变化 —— `DrawerProps`、`useDrawer()` 的 `[register, methods]` 与四个方法名原样保留，`apps/web` 里 10 个消费点（系统页的编辑抽屉、布局的个人中心与偏好设置）一行没改。
  - **`modal` 取 `'trap-focus'` 这一档，而且永远不翻**：Dialog/Sheet 的 `modal` 只有布尔，Drawer 多一个中间档（收焦但不改别人的 `aria-hidden`）。不能沿用 `true`：`DrawerContent` 在 `modal === true` 时会跑 `useHideOthers`，又少了 Dialog 那层的 `present` 闸门，`destroyOnHidden: false` 的关闭态面板会把整个应用置成 `aria-hidden="true"`（键盘 Tab 出得去面板，屏幕阅读器读不到页面）。也不能开合时切成 `true`：full-modal 与非 modal 是两棵 keyed 子树，翻 `modal` 会整棵重挂载，调用方插槽里的状态全丢。
  - **代价是 pointer-events 要自己认领**：抽屉的蒙层靠 `useBodyScrollLock` 的 owner 记账把 `document.body` 置成 `pointer-events: none`，这条路不会填 `DismissableLayer` 的 `layersWithOutsidePointerEventsDisabled`，于是原语只把面板在 full-modal 分支里认领回来。我们走 `'trap-focus'`，所以面板与 9 个 vendor 的弹层内容组件（Popover / Select / DropdownMenu×2 / ContextMenu×2 / Menubar×2 / HoverCard）统一补 `data-[state=open]:pointer-events-auto`，否则抽屉里点不开的正是这些浮层。判据用 `elementFromPoint` 命中自己，`toBeVisible()` 在这条上是放行的。
  - **第五条关闭路径没有绕开拦截**：`useSwipeDismiss` 的阈值是位移过 `40px` 或释放速度高于 `0.3px/ms`，手势起点落在 `button/a/input/select/textarea/label/[role=button]` 时原语主动放弃（所以拖动区是头部空白而不是按钮）。它同样只从 `update:open(false, { reason: 'swipe' })` 出去，组件在同步过程里先 `details.cancel()` 把已经拖出屏外的面板弹回原位，关不关交给 `closeDrawer()` 里那道 `await closeFunc()` 决定 —— `cancel()` 只能同步生效，等 `await` 完再调已经来不及。`maskClosable` 同时管蒙层与甩动；与弹窗侧不同，抽屉的 `closable` 只管 X 按钮。
  - **`bodyScroll` 新增**：内容区默认由抽屉自带的 `ScrollArea class="h-full"` 负责滚动；调用方自己管滚动时关掉（偏好抽屉要"顶部切换条固定 + 面板单独滚"，两层滚动容器会让内层撑到内容高度、外层反过来把切换条一起滚走）。

  验证：`popup-ui` 单测 49/49（drawer 20 条，含"未绑 open/visible 时父组件改其他 props 不会把抽屉顶关""默认不写内联 zIndex""甩动仍过 closeFunc"）；`npx turbo run type-check --filter=@antdv/popup-ui --force` 3/3 绿；`e2e/gallery-examples.spec.ts:984` 的「弹窗与抽屉页」7 条用例 × chromium/firefox/webkit 共 21/21 绿（含三方位抽屉、footer 插槽回写、抽屉内滚动到底才能同意、closeFunc 三条拦截路径）；偏好抽屉与图标选择器那 8 条用例同样 × 三引擎 24/24 绿，抽屉内浮层用 `elementFromPoint` 与几何断言核对。文档 `npx turbo run build --filter=@antdv/docs` 通过，zh 正文与 en 镜像口径一致，逐条代码引用对回当前行号，并新增「Drawer 选型说明」一节按功能适配性 / 交互体验 / 版本兼容性三个维度记录这次换向。

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

- Updated dependencies [f64fc3a]
- Updated dependencies [54d880b]
- Updated dependencies [5194446]
- Updated dependencies [f740d13]
- Updated dependencies [abfe730]
- Updated dependencies [abfe730]
- Updated dependencies [54d880b]
- Updated dependencies [d8fa761]
- Updated dependencies [2f1a233]
- Updated dependencies [54d880b]
- Updated dependencies [f64fc3a]
  - @antdv/shadcn-ui@0.1.0
  - @antdv/shared@0.1.0
  - @antdv/icons@0.1.0
