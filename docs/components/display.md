# 数据与展示

这一页覆盖六个示例路由 —— `/components/description`、`/components/count-to`、`/components/relative-time`、`/components/icon-picker`、`/components/loading`、`/components/scroll/basic`。它们各自独立，但有一根共同的线：**前两个是 `apps/web` 里的业务包装器，后四个的实现已经在共享包里 —— 图标在 `packages/core/base/icons`，加载遮罩在 `packages/core/ui-kit/common-ui/src/components/loading`，滚动条在 `packages/core/ui-kit/common-ui/src/components/scrollbar`（三者的实现都不再用 antdv-next，而是 shadcn-vue 那一层，见 `@antdv/shadcn-ui`）**。所以读这页顺手能把「什么该进共享包、什么该留在应用里」这条边界看清。

::: warning 三条要先说的

1. **`RelativeTime` 组件不存在**：全仓库没有 `RelativeTime` 这个组件（应用侧 `apps/web/src/components/` 已整目录迁空，更不会有它），也没有它的 import。`/components/relative-time` 只是一个用了 `a-timeline` + **绝对时间**的页面（详见[相对时间](#相对时间-pages-components-relative-time)）。
2. **`Description` 的 `setData()` 是空壳**，只 `console.warn`（`packages/core/ui-kit/common-ui/src/components/description/Description.vue:175-177`）。
3. **`Loading` 的文案属性是 `tip`，不是 `description`**；`useLoading` 的 `target` 必须显式给（选择器 / 元素 / ref / getter），否则覆盖层静默不挂载，只留一句 `console.warn`（`packages/core/ui-kit/common-ui/src/components/loading/overlay.ts:101-105`）。:::

## 这六页现在为什么都是二级菜单

`apps/backend-mock/server/api/menus.get.ts:166-181` 是一段解释层级规则的注释，配下面的表用：

| 规则 | 出处 |
| --- | --- |
| 「只有表单、表格用三级，其余一律二级叶子」 | `menus.get.ts:166` |
| 原先的结构是「组件画廊 → 分类 → 页面」，侧栏要点两层，因此摊平 | `menus.get.ts:168-169` |
| **数字滚动、图片裁剪、相对时间原先挂在「表格」分类下**，现在各自升成二级（它们演示的是 `CountTo`、裁剪器、时间展示，跟表格没关系） | `menus.get.ts:178-179` |
| 弹窗内滚动 / 抽屉内滚动合并进「弹窗与抽屉」 | `menus.get.ts:180-181` |
| 这一节只放**本仓库自己写的组件**，纯 antd 的展示页已删除 | `menus.get.ts:172-175` |

六个入口的菜单项与 `name`（keep-alive 靠它对上）：

| 菜单名 | 路由 | `name` | 位置 |
| --- | --- | --- | --- |
| 描述列表 | `/components/description` | `DemoDescription` | `menus.get.ts:264-269` |
| 数字滚动 | `/components/count-to` | `DemoTableCountTo` | `menus.get.ts:270-275` |
| 相对时间 | `/components/relative-time` | `DemoTableRelativeTime` | `menus.get.ts:276-281` |
| 加载与骨架 | `/components/loading` | `DemoLoading` | `menus.get.ts:312-317` |
| 图标选择器 | `/components/icon-picker` | `DemoIconPicker` | `menus.get.ts:318-323` |
| 滚动区域 | `/components/scroll/basic` | `DemoScrollBasic` | `menus.get.ts:324-329` |

`count-to`、`relative-time` 的 `name` 还留着 `DemoTable` 前缀 —— 那是它们搬家前的户籍名，改名字会连带影响 keep-alive 与国际化键（`apps/web/src/locales/lang/zh-CN.ts:101`），所以没动。

## Description（描述列表）

### 它解决什么问题

详情页的「标签 + 值」网格。裸用 antdv-next 的 `Descriptions` 要自己拼 `items`，而 `Description` 把它拆成两份配置：`schema`（`DescriptionItem[]`，定义标签、取值方式、占几列）和 `data`（字段值），再补上内置的日期格式化、图片预览、字典翻译（`packages/core/ui-kit/common-ui/src/components/description/types.ts:93-160`）。

### 真实 API

组件默认值在 `description/Description.vue:22-29`，取值链路在 `:63-171`。

| prop | 默认 | 行为 / 位置 |
| --- | --- | --- |
| `title` | 无 | 透传给 common-ui 自己的 `Descriptions`（`:18`、`:195`） |
| `data` | 无 | 字段值来源；内部 `computed` 兜底成 `{}`（`:50`） |
| `schema` | 无 | 配置数组；`show === false` 的项被过滤掉（`:51-53`） |
| `column` | `3` | **类型只有 `number`**，没有断点对象（`:196`，类型声明 `types.ts:120`） |
| `size` | 无 | 只映射两档，见下方 warning（`:59-61`、`:197`） |
| `layout` | `'horizontal'` | 透传（`:198`） |
| `bordered` | `false` | 透传（`:199`） |
| `colon` | `true` | 为真时在标签文本后补一个 `:`（`:209`） |
| `loading` | `false` | 为真时渲染组件自己的转圈占位（`:184-191`），`Descriptions` 整个 `v-else` 掉（`:193-194`） |
| `emptyText` | `'-'` | `null` / `undefined` / `''` 都替换成它（默认值 `:28`、替换点 `:66`） |
| `className` / `style` | 无 | 绑在最外层 `div.description-wrapper`（`:183`） |

`DescriptionItem` 的字段（`types.ts:37-96`）与它们的**取值优先级**：

| 顺序 | 机制 | 位置 |
| --- | --- | --- |
| 1 | 具名插槽 `#<field>` | `:120-121` |
| 2 | `render(value, data)`，返回字符串/数字会被包一层 `span` | `:123-128` |
| 3 | `type` 内置渲染（`date` / `datetime` / `image` / `images` / `dict` / `text`） | `:130-169` |
| 4 | 纯文本 | `:163-169` |

标签同理：`#<field>-label` 插槽 → `renderLabel` → `label` → `field`（`:70-76`）。其余字段：`value` 直接给定值（`:63-68`，优先于 `data[field]`，见 `:64-65`）、`span` 缺省 1（`:204`）、`labelStyle` / `contentStyle` 逐项透传（`:207`、`:212`）、`dateFormat` 缺省 `YYYY-MM-DD` 与 `YYYY-MM-DD HH:mm:ss`（`:150`、`:159`）、`imageSize` 缺省 60（`:140`、`:143`）。

::: warning 四个照实的限制

- **`size="large"` 与不传渲染完全一致**：`descriptionsSize` 只把 `small` / `middle` 原样透传，其余一律落到 `'default'`（`Description.vue:59-61`、`:197`），而 `DescriptionSize` 声明了三档 `'large' | 'middle' | 'small'`（`types.ts:15`）。示例页的切换器因此给的是 `large` / `middle` / `small` 三个按钮（`views/components/description/index.vue:448-455`），并把「`default` 已废弃、等价写法是 `large`」写在正文里（`:431-435`）。
- **`type: 'tag'` 不会渲染 Tag**：`case 'tag'` 与 `case 'text'`、`default` 落到同一个分支（`Description.vue:163-169`）。想要标签得用 `render` 自己 `h(Tag, ...)` —— 示例页就是这么做的（`index.vue:118`）。
- **`type: 'dict'` 不再直接读字典 store**：公共组件包不允许引入 pinia 与 `~/...` 别名，所以这一分支改成了注入式 —— 宿主 `provide(DESCRIPTION_DICT_RESOLVER, fn)`（`description/context.ts:8-18`，组件侧 `Description.vue:20`、`:37`）；没注入时命中不了就显示原值（`:41`）、空值给 `-`（`:45`）。`dictType` 缺失时直接退回原文（`:132`），多值判定是「数组 或 字符串含逗号」（`:133`、`:46`）。示例页**没有一项用到 `dict`**，只在注释里提了一句（`index.vue:63`），没有可点的演示。
- **`setData()` 是空的**：类型里声明了（`types.ts:172-182`），实现只 `console.warn('[Description] setData 不支持在只读模式下使用')`（`Description.vue:175-177`）。组件是只读的：改数据就换 `data`（示例页用一个 `computed` 数据源做脱敏开关，`index.vue:148-159`）。可用的实例方法只有 `getData()`（`:174`，`defineExpose` 在 `:179`）。

另外 `types.ts:25` 定义的 `DescriptionBordered = 'bordered' | 'none' | boolean` 没有任何地方使用（全仓只有这一处声明；`DescriptionProps.bordered` 是 `boolean`，`types.ts:138`）—— 一个遗留类型，照此记录以免误用。:::

### 在线示例：`/components/description`

`http://localhost:6080/#/components/description`，源码 `apps/web/src/views/components/description/index.vue`（496 行，4 张小节）。本页数据全是页面内 `ref` / `computed`，「模拟刷新详情」只是一个 700ms 的 `setTimeout`（`:158-166`），没有任何后端请求。

| 小节 | 点什么 | 看到什么 |
| --- | --- | --- |
| 基础描述列表（`:270-284`） | 直接看 | 三列网格；`type: 'date'` / `'datetime'` 自动格式化，`span: 3` 的「通信地址」独占一行并带 `labelStyle`（schema 在 `:60-75`） |
| 值渲染与插槽（`:286-330`） | 点头像 | `type: 'image'` + `imageSize: 64` 出可预览的 `Image`（`:99`）；「在职状态」走 `render` 返回 `Tag`（`:100-107`）；「资质证书」走 `type: 'images'`（`:108`）；邮箱与技能栈走 `#<field>` 插槽 |
| 动态切换（`:332-373`） | 「显示敏感字段」开关 | `show: false` 的项整条消失（schema `:152-153`） |
|  | 「手机号 / 身份证脱敏」开关 | 值本身变了 —— 数据源是 `computed`，脱敏在页面层做（`:133-145`） |
|  | `layout` 分段器 | 水平 / 垂直切换 |
|  | 「模拟刷新详情」 | 组件先转圈（`:364-371` 的 `:loading`），700ms 后换成新值并弹 message |
|  | 「调用 getData()」 | message 里报出读到的字段数与字段名（`:168-176`）—— 这是**唯一**能用的实例方法 |
| 响应式列数与分组（`:375-435`） | `columnMode` 分段器 + 拖窄窗口 | `column` 由 `useBreakpoints` 算出来再传数字（`:249-261`）；`md` 以下 1 列、`xl` 以下 2 列。当前值显示在蓝色 `a-tag` 上（`:411`） |
|  | `size` / `bordered` / `colon` | 实时切换；`size` 给的是 `large` / `middle` / `small` 三档，其中 `large` 与不传渲染一致，原因见上 |

## CountTo（数字滚动）

### 它解决什么问题

KPI 卡、看板上的数字滚动。核心是**用 `requestAnimationFrame` 驱动**，不是 `setInterval`：`useRafFn`（`@vueuse/core`）拿到帧时间戳，按 `(timestamp - start) / duration` 算进度再套缓动函数（`packages/core/ui-kit/common-ui/src/components/count-to/CountTo.vue:57-79`）。带来的实际差别是：帧率跟着浏览器走、标签页隐藏时 rAF 自然停、卸载时 `useRafFn` 自己 `pause`（组件注释在 `:114`）。

### 真实 API

默认值在 `count-to/CountTo.vue:9-21`，类型在 `count-to/types.ts:4-78`。

| prop | 默认 | 行为 / 位置 |
| --- | --- | --- |
| `startVal` / `endVal` | `0` / `0` | 起止值；进度按 `startVal + (endVal - startVal) * eased` 计算（`:68-69`） |
| `duration` | `2000` | 毫秒，直接当分母（`:60-63`） |
| `autoplay` | `true` | 挂载即播（`:110-112`），且 `endVal` 变化时重播（`:100-108`） |
| `decimals` | `0` | `toFixed` 位数（`:43-45`） |
| `decimal` | `'.'` | 小数点字符（`:50`） |
| `separator` | `','` | 千分位，正则替换（`:46-49`） |
| `prefix` / `suffix` | `''` | 拼在格式化结果两侧（`:51`） |
| `useEasing` | `true` | `false` 时进度线性（`:64-66`） |
| `easingFn` | `'easeOutExpo'` | **只有三个可选值**：`easeOutExpo` / `linear` / `easeInOutCubic`（`:29-35`） |
| `className` / `style` | 无 | 绑在输出用的 `<span class="count-to">`（`:125`） |

事件（`:23-26`）：

| 事件 | 载荷 | 触发 |
| --- | --- | --- |
| `change` | 当前数值 | **每一帧一次**（`:70`）—— 别在监听里做重活 |
| `finished` | 无 | 进度到 1，同时把值钉到 `endVal` 并 `pause()`（`:72-76`） |

实例方法（`defineExpose`，`:116-121`）：`start()` / `pause()` / `reset()` / `getCurrentValue()`。

::: warning 可中断性：能暂停，不能续播

- `start()` 第一件事是 `if (isActive.value) return`（`:83`）：动画进行中再调它**什么都不做**。
- 紧接着 `start()` 会把 `currentValue` 写回 `startVal` 并重置时间戳（`:84-85`）。
- `useRafFn` 的 `resume()` **没有被暴露**（`:57` 解构出来的三个东西里，只有 `pause`/`resume`/`isActive`，对外只有 `:116-121` 那四个）。所以「暂停 → 从暂停处继续」这个能力不存在：`pause()` 之后能做的只有 `reset()` + `start()`（从头再来）。示例页的「🔄 重播动画」就是这个两步（`views/components/count-to/index.vue:151-157`）。:::

::: tip

只有 endVal 会自动重播 `watch` 盯的是 `props.endVal`（`:100-108`），改 `startVal` 或 `duration` 不会重启动画 —— 「🎲 随机生成新数值」之所以能自动重播，是因为它只改 `dynamicEndVal`（`index.vue:143-146`、`:540-547`）。:::

### 在线示例：`/components/count-to`

`http://localhost:6080/#/components/count-to`，源码 `apps/web/src/views/components/count-to/index.vue`（572 行，8 个小节，全部是静态数据，没有请求）。

| 小节 | 看什么 |
| --- | --- |
| 基础用法（`:170-184`） | 一个整数从 0 滚到目标值，2.5s |
| 小数精度（`:186-230`） | `decimals` 0/1/2 位与 `decimal` 换成 `,` 的四块对比 |
| 前缀后缀（`:232-302`） | `prefix="¥"` / `suffix="%"` 等组合，验证格式化顺序 |
| 千分位分隔符（`:304-338`） | `separator` 为 `,` / 空格 / `.` 的效果 |
| 正负数展示（`:340-406`） | 负数 `endVal` 与正负切换 |
| 缓动函数对比（`:409-485`） | `linear` / `easeInOutCubic` / `easeOutExpo` 各一块，第四块是 `useEasing=false`（`:468-483`）—— 只有这三种缓动，别的名字传进去是 `undefined` |
| 数据看板面板（`:487-531`） | 多个 `CountTo` 拼成的 KPI 卡，接近真实用法 |
| 动态更新目标值（`:533-562`） | 「随机生成」→ `endVal` 变化自动重播；「重播动画」→ 通过模板 ref 调 `reset()` + 100ms 后 `start()`（`:151-157`） |

## 相对时间页：`/components/relative-time` {#相对时间-pages-components-relative-time}

::: warning

这一节没有组件可写 全仓库**没有 `RelativeTime` 这个组件**（应用侧 `apps/web/src/components/` 已整目录迁空），也搜不到它的导入或使用。菜单名叫「相对时间」（`apps/backend-mock/server/api/menus.get.ts:276-281`），但示例页做的是**时间轴 + 绝对时间**：

- 第一张卡「基础用法」把 `item.time` 这些 **ISO 字符串原样打印**（`apps/web/src/views/components/relative-time/index.vue:96-108`，数据 `:11-57`）。
- 第二张卡「自定义颜色和位置」是硬编码日期文本（`:111-135`）。
- 第三张卡「表格中的相对时间」用 `new Date(record.time).toLocaleString('zh-CN')`（`:144-148`）—— 这是**本地化绝对时间**，不是相对时间。

页面里没有 `dayjs` 的 `fromNow()`、没有 `relativeTime` 插件、也没有任何定时器。所以「谁驱动刷新」这个问题在这页没有答案：没有需要刷新的东西。想抄相对时间，请去用真正实现了它的地方（下表）。:::

仓库里相对时间的真实出处：

| 位置 | 做什么 |
| --- | --- |
| `packages/core/base/shared/src/utils/dayjs.ts:10`、`:23` | 统一 `dayjs.extend(relativeTime)`，插件在共享包里就装好了 |
| `packages/layouts/src/widgets/notification/notice-item.vue:21-25`、`:77-79` | `dayjs(sendTime).fromNow()`，外面套了一个窄接口助手 `fromNow()`（补 `relativeTime` 的类型），渲染在通知项上（`:171`） |
| `apps/web/src/views/system/notice/index.vue:36`、`:384` | 页面自己又 `extend` 了一次，表格里用 `fromNow(true)`（去掉「前/后」的纯时长） |
| `apps/web/src/views/system/online/index.vue:30`、`:103` | 同上，在线时长列 |

刷新由谁驱动：**没有任何定时器**。`fromNow()` 在 `computed` 里，只有依赖的数据变化时才会重算，页面停留期间文字不会自己跳。要「每分钟自己变」得自己挂 interval。

## IconPicker（图标选择器）

### 它解决什么问题

让用户（而不是开发者）挑一个图标名，最常见的用途是菜单管理里给菜单配图（真实用例：`apps/web/src/views/system/menu/index.vue`）。它在 `packages/core/base/icons`（包名 `@antdv/icons`）—— **图标集合来自离线打包的 `@iconify-json/*`**，构建期就进了产物，不需要联网查 API；机制与新增集合的步骤见[图标指南](/guide/essentials/icons)。

### 真实 API

源码 `packages/core/base/icons/src/icon/IconPicker.vue`（404 行），默认值在 `:34-40`。

| prop | 默认 | 行为 / 位置 |
| --- | --- | --- |
| `v-model`（`defineModel<string>`） | `''` | 选中值就是 `prefix:name` 形式的图标名（`:48`、`:195`） |
| `currentIcon` | `''` | 兼容写法：`modelValue \|\| currentIcon` 才算当前值（`:96`），所以两者同时给时 `v-model` 优先 |
| `placeholder` | `'选择图标'` | 触发按钮里那段灰色占位（`:263`） |
| `disabled` | `false` | 落在触发按钮的 `:disabled` 上（`:241`），浏览器顺带把 popover 也拦下 |
| `size` | `'middle'` | 只换触发按钮的高度类名（`triggerSizeClass`，`:217-223`），弹窗内部不受影响 |
| `allowClear` | `true` | 有值时 suffix 显示 `lucide:x`，点击清空（`:267-273`、`:200-204`） |

事件（`:42-45`）：

| 事件 | 载荷 | 触发 |
| --- | --- | --- |
| `change` | 图标名，清空时为 `''` | 选中（`:195`）与清空（`:203`）都发 |
| `select` | 图标名 | **只有选中才发**（`:196`），清空不发 —— 想用 `@select` 监听"值变了"会漏掉清空 |

内部机制：

| 事项 | 说明 | 位置 |
| --- | --- | --- |
| 集合清单 | 五个 prefix：`lucide` / `mdi` / `ant-design` / `fa6-regular` / `carbon` | `:55`（`Prefix` 联合类型）、`:62-73`（`COLLECTIONS`） |
| 懒加载 | 每个集合一个 `() => import('@iconify-json/<name>/icons.json')`，Vite 切成独立 chunk，不切到该分类就不下载 | `:75-84` |
| 去重 | 已加载或正在加载的 prefix 直接跳过 | `:94`、`:103-121` |
| 加载失败 | `console.error` + 该分类置空数组，界面显示 `Empty` 空态 | `:112-114`、`:328-336` |
| 搜索 | **只在当前分类内**，切换分类会清空搜索词并回到第 1 页 | `:123-134`、`:174-177` |
| 分页 | 每页 108 个（`PAGE_SIZE`），网格 12 列；超过一页才显示底部翻页条 | `:50`、`:136-138`、`:206-209`、`:365-393` |
| 预加载 | 翻页时把当前页图标喂给 `loadIcons`，50ms 防抖 | `:151-160` |
| 弹出层 | shadcn `Popover` click 触发，`PopoverContent` 宽 560px（`w-[560px] max-w-[92vw]`），网格区固定高 360px（`SCROLLER_HEIGHT`）滚动交给 `Scrollbar` | `:232`、`:278`、`:314-320`、`:51` |

::: tip

包内为什么能只用 shadcn 的标签 `IconPicker.vue` 一个 antdv-next 组件都没用：`Popover` / `Select` / `Input` / `Spinner` / `Empty` / `Tooltip` 全部从 `@antdv/shadcn-ui` **显式 import**（`:5-22`），滚动区从 `@antdv/common-ui` 显式 import（`:4`），图标本身用 `@iconify/vue` 的 `<Icon>`（`:24`）。组件解析器已经从 `internal/vite-config` 撤掉，所以包内不存在"靠宿主插件注入"的隐性依赖 —— 换宿主工程只要装上这几个 workspace 包就能跑。机制见[外部模块](/guide/essentials/external)。:::

### 在线示例：`/components/icon-picker`

`http://localhost:6080/#/components/icon-picker`，源码 `apps/web/src/views/components/icon-picker/index.vue`（136 行，5 张小节，无请求）。

| 小节 | 点什么 | 看到什么 |
| --- | --- | --- |
| 基础用法（`:42-59`） | 点输入框 | popover 打开，默认分类 `lucide`；选中后输入框前缀显示该图标，蓝色信息条同步显示 `已选：xxx`（`:52-57`），并弹 `已选择图标：…` 的 message（`:27-29`） |
| 默认值（`:61-73`） | 直接看 | `v-model` 预置 `carbon:star-filled`（`:21`）—— 默认值不需要额外 prop |
| 禁用状态（`:75-86`） | 点输入框 | 打不开，`:disabled`（`:80-84`） |
| 多实例（`:88-118`） | 两个选择器各选一个 | 状态互不干扰（`leftIcon` / `rightIcon`，`:24-25`） |
| 变更事件（`:120-132`） | 选一个再点 suffix 的 `x` | 选中有 message，清空只有 `change`（值变 `(已清除)`）而没有 `select` —— 见上面的事件表 |

## Loading 家族与滚动区域

### `Loading` 组件（`@antdv/common-ui`）

全屏 / 容器内两用的遮罩，内部就是一枚 shadcn `Spinner`（`packages/core/ui-kit/common-ui/src/components/loading/Loading.vue:6`、`:90`）。props 见 `components/loading/types.ts:16-51`，默认值见 `Loading.vue:14-19`：`loading` `false`、`tip` 无、`size` `'default'`、`absolute` `false`、`theme` `'light'`、`background` 无。

| 事项 | 真实行为 | 位置 |
| --- | --- | --- |
| 模式切换 | `absolute: false` → `fixed inset-0 h-screen w-screen`（全屏）；`true` → `absolute inset-0 size-full`（容器内，**父元素必须是定位元素**） | `:44`、`:46` |
| 背景 | 给了 `background` 就以它为准（内联 style），主题类名不再加 | `:25-31`、`:51-66` |
| 尺寸 | `small` / `default` / `large` = `size-4` / `size-6` / `size-9` —— 换的是工具类，不是 `transform: scale()` | `:76-83` |
| 主题 | 四组半透明背景（明/暗 × 全屏/容器内）写在 `cn()` 里，暗色附赠 `text-white` | `:51-66` |
| 文案 | **`tip`**；`LoadingProps` 里没有 `description` 这个字段 | `types.ts:20` |
| 显隐 | `v-show` + `loading-fade` 过渡 300ms | `:87-96`、`:101-109` |

::: tip

档位钩子 `.loading-small` / `.loading-large` 尺寸类名之外还挂了两个无语义的作用域类（`:48-49`）：宿主样式和 e2e 用它们认档位，因为 `size-*` 工具类会被 `cn()` 的 tailwind-merge 合并掉，直接断言类名不可靠。:::

### `useLoading` / `createLoading` / `v-loading`

三者共用同一个覆盖层实现 `createOverlay`（`packages/core/ui-kit/common-ui/src/components/loading/overlay.ts:60-187`），要点是**懒挂载**：`loading` 从 `false` 变 `true` 才 `createApp` 插 DOM，变回 `false` 等 `LEAVE_DURATION`（300ms，`:14`）再摘掉（`:160-167`）。

| 入口 | 签名与默认 | 位置 |
| --- | --- | --- |
| `useLoading(options?)` | 组合式函数；`body` 默认 `true`（全屏挂 body）；容器模式**必须** `body: false` + `target`；返回 `open / close / setLoading / setTip / destroy`；在组件里调用会自动 `tryOnUnmounted(destroy)` | `components/loading/useLoading.ts:30-51` |
| `createLoading(options?)` | 任意位置可用（路由守卫、拦截器）；`{ body: true, ...rest }` —— 注意是 rest 在后，所以能显式传 `body: false`；额外支持 `onClose`，且**只有 `close()` 会触发它** | `components/loading/createLoading.ts:44-61`、`:49-52` 的注释记录了早期版本 `{...rest, body: true}` 把容器模式覆盖掉的 bug |
| `createFullscreenLoading(tip?, options?)` / `createContainerLoading(target, tip?, options?)` | 两个快捷方法，后者固定 `body: false` | `:66-74`、`:76-82` |
| `v-loading` 指令 | 默认覆盖元素本身（`target: el`、`body: false`）；`.body` / `.fullscreen` 修饰符改成挂 body 全屏；配置走 `loading-tip` / `loading-size` / `loading-theme` / `loading-background` 属性 | `components/loading/directive.ts:34-40`、`:59-67`、`:69-86` |

实例方法语义：`close()` 等淡出后自动清理 DOM，`destroy()` 强制立即清理且**不触发 `onClose`**（`components/loading/types.ts:59-84` 的注释）。`setVisible(true)` 与直接写 `loading.value = true` 的差别是：状态本来就是 `true` 时，`setVisible` 仍会**重试挂载**（`overlay.ts:43-47`、`:179-184`）—— 容器模式的 `target` 晚于 `open()` 出现就靠它补救。

::: warning

容器模式的 target 怎么才拿得到 `resolveContainer` 支持 CSS 选择器字符串 / 元素 / ref / getter，解析不出就 `console.warn('[@antdv/common-ui] loading: target 容器不存在，覆盖层未挂载')` 然后**什么都不发生**（`overlay.ts:78-87`、`:101-105`）。示例页第 5 节把这条写成了页内注释：

```ts
// views/components/loading/index.vue:344-352
/**
 * key 必须显式传给 `useTemplateRef`：无参写法在这个 Vue 版本里解析不出变量名，
 * `target` 拿到 undefined，`open()` 静默什么都不做（这条就是本页最早"点了没反应"的坑）。
 */
const hookContainerRef = useTemplateRef<HTMLElement>('hookContainerRef');
const hookLoading = useLoading({
  target: () => hookContainerRef.value!,
  body: false,
  tip: 'Hook 控制加载...',
});
```

`target` 传 getter 是安全的：解析被推迟到真正要显示的那一刻（`components/loading/types.ts:89-108` 的注释），所以 setup 期引用还没挂载的模板 ref 不会抛错。:::

::: warning 这个家族历史上修过的三个真 bug（现在都是修好的样子）

1. **文案属性写成 `description`** —— `Loading` 只有 `tip`，示例页把这句话留在代码注释里：`<!-- tip 才是 Loading 组件的文案属性（没有 description 这个 prop） -->`（`views/components/loading/index.vue:1147`）。
2. **`useLoading()` 拿不到目标** —— 见上一个 warning，`useTemplateRef` 必须显式传 key（`index.vue:344-348`）。
3. **实例创建时传快照导致 `open()` 无效** —— `createApp(Loading, { loading: loading.value })` 交出去的是当刻的值，之后写 ref 不会有视觉变化；现在改成在 `render()` 里读 ref，Vue 才能建立依赖（`overlay.ts:120-133`，注释明确写着"这是本包抽离时修掉的原始 bug"）。同类的一次：`v-loading` 的实例挂在 `WeakMap` 上并复用（`directive.ts:45`、`:70-73`），所以**元素挂上之后再改 `loading-size` / `loading-theme` / `loading-background` 属性不会被重读**，只有 `binding.arg`（`v-loading:文本=`）在 `updated` 里会被同步进 tip（`:93-99`）。顺带一句：`directive.ts:17` 的注释写「优先级 属性 > 指令参数」，与代码相反 —— `:81` 是 `tip: binding.arg ?? attributeProps.tip`，**指令参数优先**。:::

::: tip

没有的东西 `@antdv/common-ui` **没有 `delay` 属性**，也没有节流/防抖。示例页「PageLoading 与延迟遮罩」那张卡用两个真实定时器手写这个逻辑（请求快于 300ms 就取消尚未亮起的遮罩），正文里也写明了"遮罩延迟这层由调用方决定"（`index.vue:371-402`、`:1163-1170`）。:::

### Scrollbar（滚动区域）

自绘滚动条，替掉系统滚动条。但这条约定**不**覆盖弹窗与抽屉内置的那层 body 滚动 —— 那一层直接用 shadcn 的 `ScrollArea`（`packages/core/ui-kit/popup-ui/src/drawer/BasicDrawer.vue:371`、`packages/core/ui-kit/popup-ui/src/modal/ModalWrapper.vue:60`）；`Scrollbar` 用在菜单、标签栏、树表、布局内容区，以及「调用方自己接管滚动」的抽屉内容里。源码 `packages/core/ui-kit/common-ui/src/components/scrollbar/Scrollbar.vue`（186 行），props 类型在 `components/scrollbar/types.ts:8-22`，默认值在 `Scrollbar.vue:15-27`，对外实例形状在 `types.ts:24-30`。

| prop | 默认 | 行为 / 位置 |
| --- | --- | --- |
| `native` | `false` | `true` 交回浏览器默认滚动条：改渲染自己那层 `div.scrollbar__wrap`（`:107-122`），`ScrollArea` 整块走 `v-else` 不出现（`:130-148`）；真正的滚动盒 `wrap` 也随之指向这个 div（`:56-58`），`native` 变化后重新解析（`:62`） |
| `rootClass` | 无 → `'h-full'` | 根节点类名；没传就是 `h-full`（`:103`） |
| `wrapClass` / `wrapStyle` / `viewClass` / `viewStyle` | `''` | 分别作用于滚动层与内容层：原生分支绑在 wrap 与 view 上（`:111-112`、`:117-118`）；`ScrollArea` 分支的 `wrapClass` 用 `cn` 合并进 viewport（`:135-136`），view 仍是 `:143-144` |
| `maxHeight` | 无 | **只有传了才会写 `max-height` 内联样式**（`:46-48`），值是响应式算出来的，见下方 warning |
| `always` | `false` | 默认只在**真正滚动的过程中**亮条（`ScrollArea` 的 `type` 取 `scroll`，`:133`）：空闲与指针停留都不出现，停止滚动 `hideDelay` 后收起；`true` 切成 `always`，两条轨道常驻不淡出 |
| `hideDelay` | `800` | 停止滚动后隐藏自绘条的延迟，透传成 `scroll-hide-delay`（`:134`，默认值 `:26`） |
| `tag` | `'div'` | 内容层标签，两个分支都用 `<component :is="tag">`（`:114-121`、`:140-147`） |

事件只有一个：`@scroll`，载荷 `{ scrollTop, scrollLeft }`（`:29-31` 声明、`:64-68` 发出、`:70` 用 `useEventListener` 以 `passive` 挂在 `wrap` 上）。实例方法只有四个：`wrap`（滚动容器元素 ref）、`setScrollTop`、`setScrollLeft`、`scrollTo`（`defineExpose` 在 `:91-96`，对应 `types.ts:24-30`）—— 没有 `update`，也没有把 `handleScroll` 暴露出去。`setScrollTop/Left` 会挡掉 `NaN` 与非有限值 —— 注释解释了原因：把 `NaN` 写进 `scrollTop` 会被浏览器静默当成 `0`（`:72-77` 判定、`:79-85` 两个 setter）。

::: warning

`max-height` 别随便传：`props.maxHeight` 是当作**基准值**喂给 `useResponsiveMaxHeight` 的，缺省基准 495（`Scrollbar.vue:39-41`）；该 hook 的下限 `min` 默认 **712px**，指数 1.938，基准分辨率 1080（`packages/core/ui-kit/common-ui/src/components/scrollbar/useResponsiveMaxHeight.ts:44-48`），最后一行 `clamp` 在 `:52`。所以在 1080 高的窗口里传 `:max-height="400"`，`400` 经过 `clamp(400, 712, ∞)` 会变成 **712px** —— 比 712 更矮的效果是拿不到的。另外基准那行判的是 `isNumber`（`:40`），所以类型上允许的字符串写法（`types.ts:18`）会回落到 495 基准，写进内联样式的仍是 hook 算出来的 px。想要一个更小的固定高度，就像抽屉示例那样用类名：`root-class="h-60"`（`apps/web/src/views/components/modal-drawer/index.vue:655-668`，页面自己在 `:617-620` 写了这个原因）。:::

::: warning

样式不依赖宿主 Tailwind。`Scrollbar.vue` 的 `<style>` 块刻意没用 `@apply`，而是把工具类展开成等价原生 CSS 并写进 `@layer components`（`:158`）；`:152-156` 的注释说明了原因：独立 SFC 的 style block 里没有 Tailwind 主题入口，构建期会报 `Cannot apply unknown utility class`，写进 components 层是为了让模板上的 `flex-1 / min-h-0` 这些 utilities 仍能覆盖。同一段样式里还有一条不变量注释在 `:170-180`：reka 会在 viewport 与 slot 之间插一层没有高度的 content div，还带上内联 `min-width: fit-content`，于是 `:181-184` 把高度与最小宽度钉回容器宽度（内联样式只能以 important 顶掉）。这也是它敢作为独立包被消费的前提。:::

组件注册上，`Scrollbar` 一律**显式 import**：`apps/web/src/views/components/scroll/basic/index.vue:4`、`packages/core/ui-kit/menu-ui/src/BasicMenu.vue:8`、`packages/core/ui-kit/tabs-ui/src/TabsBar.vue:14`、`packages/core/ui-kit/table-ui/src/components/TreeTable.vue:15`、`packages/core/ui-kit/layout-ui/src/components/layout-content/index.vue:8` 等都是 `import { Scrollbar } from '@antdv/common-ui'`。`internal/vite-config/src/plugins/auto-import.ts:27-29` 的 `Components()` 没有配任何 `resolvers`，所以共享包组件进不了 `apps/web/types/components.d.ts`（那份声明 `:15-22` 只有应用自己 `src/components` 目录下的项），裸写 `<Scrollbar>` 是解析不出来的（见[外部模块](/guide/essentials/external)）。

### 在线示例：`/components/loading` 与 `/components/scroll/basic`

`http://localhost:6080/#/components/loading` —— 源码 `apps/web/src/views/components/loading/index.vue`（1432 行，**12 张小节**；页面自己不带私有壳，示例件全在共享包里：骨架屏 / 空状态 / 错误边界 / 状态标签 / `createLoading` / `Loading` / `useLoading` 取自 `@antdv/common-ui`（`:6-18`），`Spinner`、`Skeleton`、`Button` 等原子件取自 `@antdv/shadcn-ui`（`:20-41`），`PageLoading` 取自 `@antdv/layouts`（`:43`），三个"样式"档位用的旋转图形来自 `@iconify/vue`（`:44`））。本页所有"加载耗时"都是页面里的 `setTimeout`，无后端；脚本开头有一整套计时器登记与卸载清理（`:70-97`），离开页面时连全屏遮罩都会显式 `destroy()`（`:96`）。

| 小节 | 点什么 / 看什么 |
| --- | --- |
| 骨架屏（PageSkeleton / TableSkeleton）`:474-615` | 开关切换骨架与真实内容；`variant`（card/detail/form/page）、行数、侧栏开关；中途关掉会**取消上一次计时**（`cancelScheduled` 在 `:126`、`:141`、`:151`），否则延时会在重新打开后提前掐掉 |
| 空状态（EmptyState）`:616-695` | 应用侧通用空状态壳 |
| 错误边界（ErrorBoundary）`:696-769` | 点按钮让子内容抛错，看边界如何兜住 |
| 状态标签（StatusTag）`:770-863` | 状态 → 颜色的映射 |
| Spin 加载器 `:864-990` | 基础用法是 `Spinner`（`@antdv/shadcn-ui`）+ 项目 `Loading` 的容器遮罩；「三种样式」不是 antdv-next 的 `Spin` 档位，而是三个不同的旋转图形 —— `circle` 用 `Spinner class="size-8"`、`dot` 用 Iconify `svg-spinners:pulse-multiple`、`grid` 用 `svg-spinners:bars-scale-fade`（`:974-984`），选中态由 `spinStyle`（`:336`）配 `toggleSpinStyle()`（`:429`）驱动 |
| Skeleton 骨架屏 `:991-1069` | `Skeleton` 同样取自 `@antdv/shadcn-ui`，形状完全靠 class 拼（`size-12 shrink-0 rounded-full` 做头像、`h-4 w-full` 做文本行），组件本身只有一个 `variant` / 无动画配置 |
| Loading 组件（项目封装）`:1070-1158` | 尺寸 `small/default/large` × 主题 `light/dark`，点「触发 Loading」看容器内遮罩；`tip="组件式加载中..."` 在 `:1153`，它上面 `:1147` 那句注释就是纠错用的 —— **「`tip` 才是 Loading 组件的文案属性，没有 `description` 这个 prop」**（`description` 属于隔壁 `EmptyState`，`:624`） |
| PageLoading 与延迟遮罩 `:1159-1222` | 左：`PageLoading` 覆盖容器 —— 它已经不算"应用侧薄壳"了，外壳搬进 `@antdv/layouts`（示例页 `:43` 就是 `import { PageLoading } from '@antdv/layouts'`），组件体读 `@antdv/stores` 的 `resolvedTheme` 来定明暗（`packages/layouts/src/basic/content/page-loading.vue`）；右：「快请求 150ms」不闪遮罩，「慢请求 1800ms」闪，延迟逻辑是 `:382-396` 的两个计时器 |
| v-loading 指令 `:1223-1283` | 三块：默认浅色（`v-loading="directiveLoading"`）、深色 + 大尺寸 + `loading-tip` 属性（`:1244`）、`v-loading.fullscreen` 整页遮罩；指令在 `apps/web/src/main.ts:118` 注册（实现在 `packages/core/ui-kit/common-ui/src/components/loading/directive.ts`） |
| useLoading Hook `:1284-1327` | 「触发 useLoading」→ 容器内遮罩 2.5s；下面还贴了 `target / body / tip` 的用法片段 |
| 按钮加载态 `:1328-1399` | **`Button` 没有内置 `loading` prop**（`:1331-1336` 的说明文字就是这么写的）：加载态用 `disabled` + 一个 `animate-spin` 的 Iconify `svg-spinners:bouncing-ball` 表达（`:1340-1346`），三档延时 2000 / 2500 / 3000ms 由 `triggerBtnLoading()`（`:448-451`）算出来 |
| 全局加载遮罩 `:1400-1432` | 「模拟 API 请求 (全屏遮罩)」→ `createLoading({ tip, theme: 'dark', background })` 起全屏，1.5s 时 `setTip('即将完成...')`，3s 时 `close()`，实现是 `triggerGlobalLoading()`（`:453-469`） |

`http://localhost:6080/#/components/scroll/basic` —— 源码 `apps/web/src/views/components/scroll/basic/index.vue`（205 行，3 张小节，外层都套了一个固定高度的 `overflow-hidden` 容器，滚动完全交给 `Scrollbar`）：

| 小节 | 点什么 | 看到什么 |
| --- | --- | --- |
| Basic Scroll（`:96-137`） | 拖动列表 | 30 条数据在 `h-80` 容器里由自绘条滚动；停止 800ms 后滚动条淡出 |
|  | **点「Add Item」** | **什么都不会发生** —— 见下面的 warning |
| Horizontal Scroll（`:139-159`） | 横向拖 | 10 个框架卡片，`flex min-w-max` 撑出横向溢出（`:144`），`ScrollArea` 自己发现横向溢出后给出横向条 —— `Scrollbar` 里没有横向开关，只有 `data-[orientation=horizontal]:h-1.5` 决定它的粗细（`Scrollbar.vue:131`），上面那条 `min-width: 100% !important` 保证横向溢出不会顶宽内容盒（`Scrollbar.vue:175-178`） |
| Chat Scroll（`:161-203`） | 输入框回车或点 Send | 消息追加进 `chatMessages`（一个 `ref`，`:31-75`，`sendMessage` 在 `:79-91`），气泡左右分侧；`Scrollbar class="flex-1 p-4"`（`:166`）在 flex 列里占满剩余高度 |

::: warning

「Add Item」是这页目前唯一坏掉的按钮 `basicItems` 声明成了**普通数组常量**，不是 `ref` 也不是 `reactive`：

```ts
// apps/web/src/views/components/scroll/basic/index.vue:12-16
const basicItems = Array.from({ length: 30 }, (_, i) => ({/* ... */}));
```

按钮里执行的是 `basicItems.push(...)`（`:101-105`）。因为没有任何响应式代理，`v-for="item in basicItems"`（`:116`）不会重新渲染，所以点了之后**列表长度不变、也没有报错**。对照着看：同页的 Chat 小节把消息放在 `ref(...)` 里（`:31`），它的 Send 就正常。要修的话把 `basicItems` 包成 `ref` 即可，本文只记录现状。:::

## 这几个原子分别住在哪个包

原先的 `@antdv/ui` 已经拆散，这一页出现的三个原子各归各的包；本页 Spin / Skeleton 那两节演示的是 `@antdv/shadcn-ui` 原语，不属于下面这三个包：

| 包 | 内容 | 边界（写在 description 里） | 导出 |
| --- | --- | --- | --- |
| `@antdv/icons`（`packages/core/base/icons`） | `IconPicker` / `IconifyIcon` / `SvgIcon` | 只管图标：加载遮罩归 `@antdv/common-ui`，滚动条归 `@antdv/common-ui` | `.:src/index.ts` + `./icon` 子路径 + `./*` 通配（`package.json:20-25`）+ `createIconInstaller()`（`src/index.ts:19-31`） |
| `@antdv/common-ui`（`packages/core/ui-kit/common-ui/src/components/loading`） | `Loading` + `useLoading` + `createLoading` / `createContainerLoading` / `createFullscreenLoading` + `vLoading` | 不依赖 pinia、vue-router、业务 store 或应用配置 | 单入口 barrel（根入口 `src/index.ts:81-87` 给值、`:88-96` 给类型） |
| `@antdv/common-ui`（`packages/core/ui-kit/common-ui/src/components/scrollbar`） | 只有 `Scrollbar` 一个组件（没有单独的 `Bar`） | 样式随组件走，不依赖宿主 Tailwind 配置，也不依赖 store / 应用配置 | 目录 barrel `components/scrollbar/index.ts:1-3`：`Scrollbar` ＋ `ScrollbarProps` / `ScrollbarStyle` / `ScrollbarType` 三个类型；根入口 `src/index.ts:120` 与 `:121-125` |

这两个包都是 `files: ["dist", "src"]`（`packages/core/base/icons/package.json:13-16`、`packages/core/ui-kit/common-ui/package.json:13-16`）而 `main` / `module` / `types` 与 `exports["."]` 仍指向 `./src/index.ts`（`:17-19`、`:22`）—— 也就是**源码解析**：宿主 Vite 直接编译 `.vue`，改完当场热更新；`build: vite build` 已经补齐（`:8`），dist 是给发布面准备的，入口还没切过去。三段的取舍见[外部模块](/guide/essentials/external)。

| 约定 | 出处 |
| --- | --- |
| 「不依赖 pinia、vue-router、业务 store 或应用配置」，需要这些的薄壳自己成一层 | `package.json` 的 description 字段（`packages/core/base/icons/package.json:4`、`packages/core/ui-kit/common-ui/package.json:4`）；"薄壳留在应用里"的口径已经变了 —— 那层壳现在是 `@antdv/layouts` 这个装配层包，应用侧只剩 `apps/web/src/layouts/index.vue` |
| 包内组件**一律显式 import**，不靠宿主的解析器 | `IconPicker.vue:4-24`；`internal/vite-config/src/plugins/auto-import.ts:27-29` 的 `Components()` 不配 `resolvers`，包组件不会进 `components.d.ts` |
| 包内**不用 auto-import 的隐式全局**：`useResponsiveMaxHeight.ts` 显式 import `toValue` / `MaybeRefOrGetter`，注释解释换工程就会 `toValue is not defined` | `packages/core/ui-kit/common-ui/src/components/scrollbar/useResponsiveMaxHeight.ts:1-12` |
| 配置不进包：`native` 由调用方传，包不读 app 配置 | `packages/core/ui-kit/common-ui/src/components/scrollbar/Scrollbar.vue:15-17`（`:16` 就是这条注释） |
| 样式自持，不靠宿主 Tailwind | `Scrollbar.vue:152-158` |
| 反过来，装配层该读 store 就读：`PageLoading` 读 `useAppStore().resolvedTheme` | `packages/layouts/src/basic/content/page-loading.vue:6`、`:23-25` |

## 相关页面

- [组件示例](/components/) —— 本章目录、示例页打开方式与统一约定
- [弹窗与抽屉](/components/modal-drawer) —— 它们内置的 body 滚动层用的是 shadcn `ScrollArea`；那一页展示的是在这里嵌套 `Scrollbar` 的场景
- [表格](/components/table) —— `Description` 常与表格组成详情页
- [图标指南](/guide/essentials/icons) —— 离线 Iconify 集合、新增集合的步骤
- [加载系统](/guide/in-depth/loading) —— 路由级 loading 与本页组件的分工
