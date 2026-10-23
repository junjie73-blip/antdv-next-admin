# 公共组件（`@antdv/common-ui`）

这一页讲 `packages/core/ui-kit/common-ui` —— 与路由无关、跨页面复用的展示型组件，61 个值导出。它们**全部由 `@antdv/shadcn-ui` 的原语（reka-ui）组合出来**，不认得 antdv-next，也不认得应用：包里没有 store、没有路由、没有 `~/...` 别名。

迁移落地的顺序是「代码先动、文档后动」，所以这一页是补齐的：原先散在 `apps/web/src/components/business/` 下的 `Description`、`CountTo` 已经进了这个包，另一批（Badge、Steps、Result、Transfer、Image、Upload、Tabs……）是从示例页里"每页各写一份"抽出来的。

::: tip 本页只写 API，不写故事

每个组件的 props / 事件 / 插槽 / 实例方法都照 `defineProps` / `defineEmits` / `defineExpose` 的源码抄，附 file:line。想看"点哪里看到什么"，去[组件示例](/components/)里对应的路由页；想看设计令牌，去[设计令牌与全局样式](/guide/essentials/design)。:::

## 怎么引用：根入口 + 一条 charts 子路径

`packages/core/ui-kit/common-ui/package.json` 的 `exports` 只有三条：`.`（→ `./src/index.ts`）、`./charts`（→ `./src/components/charts/index.ts`）和 `./package.json`。除 `./charts` 之外**没有别的子路径**，所以 `@antdv/common-ui/components/badge` 这种写法在 Node 解析阶段就会 `ERR_PACKAGE_EXPORTS` 报错，不是"能用但不推荐"。

`ECharts` 是唯一的例外，它**故意不进根 barrel**：组件里 `import * as echarts from 'echarts'` 会把整个图表库的全量注册表拖进模块图，塞进根入口等于让每个 `from '@antdv/common-ui'` 的消费者都付一份解析成本（口径同 `@antdv/hooks/echarts`，见 `components/charts/index.ts:1-5`）。

```ts
// ✅ 具名导入，一律从包根 barrel
import { Card, MicroAppContainer, Popconfirm, Tag } from '@antdv/common-ui';

// ✅ 图表只有子路径
import { ECharts } from '@antdv/common-ui/charts';

// ❌ 子路径不存在
import { Badge } from '@antdv/common-ui/components/badge';
```

ESLint 配的是 `vue/component-name-in-template-casing: PascalCase`（`internal/lint-configs/eslint-config/src/configs/vue.ts:71`），模板里就写 `<Card>`、`<Popconfirm>`，不需要 `as ACard` 那类别名 —— 那是给 `a-*` kebab 标签准备的旧约定。

目录结构是**一个组件一个 kebab 目录**：

```text
packages/core/ui-kit/common-ui/src/components/<kebab>/
  ├── <PascalCase>.vue      # 组件本体
  ├── index.ts              # 具名 + default 双导出（barrel 只取具名）
  ├── types.ts              # 可选：props / emits / 数据结构
  └── context.ts            # 可选：provide / inject 键
```

内部互相引用走相对路径（`status-tag/StatusTag.vue:6` 引 `../tag`），对外只认 barrel。

## 全量导出

从 `src/index.ts` 数出来的 61 个值导出，按用途分组：

| 组 | 导出名 |
| --- | --- |
| 容器与排版 | `Card`、`Divider`、`Space`、`Empty`、`EmptyState`、`ErrorBoundary` |
| 页面外壳 | `PageHeader`、`PageToolbar`、`ToolbarField` |
| 状态与标识 | `Badge`、`Tag`、`StatusTag`、`Alert`、`Result`、`Steps` |
| 数据展示 | `Description`、`Descriptions`、`DescriptionsItem`、`Statistic`、`CountTo`、`Image`、`Listy`、`Timeline`、`TimelineItem`、`Tooltip` |
| 交互与容器切换 | `Tabs`、`TabPane`、`Segmented`、`Popconfirm`、`Transfer`、`Tree` |
| 微前端 | `MicroAppContainer` |
| 上传 | `Upload`、`UploadDragger`、`UploadList` |
| 骨架与加载 | `PageSkeleton`、`TableSkeleton`、`Loading`、`createContainerLoading`、`createFullscreenLoading`、`createLoading`、`useLoading`、`vLoading`、`Scrollbar` |
| 编辑器 | `CronEditor`、`MarkdownEditor` |
| 登录页版式 | `AuthColorPresets`、`AuthFormPanel`、`AuthPageLayout`、`AuthSocialLogin` |
| 提示容器 | `Toaster` |
| 更新提示 | `ReloadPrompt`（`check-update` 的那枚浮动按钮，见 `guide/in-depth/check-update.md`） |
| 全局配置 | `ConfigProvider`、`DEFAULT_GLOBAL_CONFIG`、`GLOBAL_CONFIG_KEY`、`normalizeComponentSize`、`textsByLocale`、`useGlobalConfig` |
| 装饰动效 | `BorderBeam` |
| 注入键 | `DESCRIPTION_DICT_RESOLVER`、`PERMISSION_CHECK`（导入导出组件的权限判定入口） |

类型导出：`BorderBeamProps`、`CountToEvents` / `CountToInstance` / `CountToProps`、`CronEditorEmits` / `CronEditorProps` / `CronField` / `CronPreset`、`DescriptionInstance` / `DescriptionItem` / `DescriptionLayout` / `DescriptionProps` / `DescriptionSize` / `DictResolver`、`ComponentSizeOption` / `Direction` / `GlobalConfig` / `GlobalTheme` / `LocaleKey` / `ResolvedComponentSize` / `ResolvedGlobalConfig`、`ListyEmits` / `ListyItem` / `ListyItemHeight` / `ListyProps` / `ListyRow` / `ListyScrollState` / `ListyScrollToOptions` / `ListySize`、`LoadingProps` / `LoadingSize` / `LoadingTheme` / `LoadingInstance` / `CreateLoadingOptions` / `UseLoadingOptions` / `LoadingDirectiveBinding`、`markdown-editor` 的 10 个类型（`MarkdownEditor*` 七个 + `ImageUploadConfig` / `UploadResponse` / `VideoUploadConfig`）、`MicroAppContainerProps` / `MicroAppContainerEmits`、`PageHeaderProps` / `PageToolbarProps` / `ToolbarFieldProps`、`PermissionChecker`、`ScrollbarProps` / `ScrollbarStyle` / `ScrollbarType`、`TabPaneProps`、`ToasterProps`（vue-sonner 同名类型原样转口）、`TransferDirection` / `TransferItem` / `TransferKey`、`NormalTreeNode` / `TreeContext` / `TreeFieldNames` / `TreeKey`、`UploadChangeParam` / `UploadFile` / `UploadListType` / `UploadRequestOptions`、`Auth*Props` 与 `AuthColorPreset` / `AuthFeatureItem` / `AuthSocialItem`。`EChartsProps` 不在这份清单里 —— 它只从 `@antdv/common-ui/charts` 出口。

::: warning `UploadProps` 没有对外导出

`components/upload/index.ts` 里声明了 `export type { UploadProps }`，但 `packages/core/ui-kit/common-ui/src/index.ts:161-166` 的再导出不含它。想在页面里标注 Upload 的 props 类型，只能自己 `import type { UploadFile, UploadChangeParam } from '@antdv/common-ui'` 拼，或者不标。:::

## ConfigProvider（全局配置）

`components/config-provider/ConfigProvider.vue`（215 行）。props 形状在 `config-provider/types.ts:58-84`，兜底值在 `:118-128`，注入键 `GLOBAL_CONFIG_KEY` 在 `:114-115`。

**底座是 reka-ui 的 `ConfigProvider`**（`ConfigProvider.vue:194-201`），它外面再套一个 `display: contents` 的 `<div>` 承载主题变量与档位（`:202-213`）。不是"把插槽转发一下"的简易封装：reka 那六个参数 `dir` / `locale` / `scrollBody` / `nonce` / `teleportTo` / `useId` 全部接上了（有真实读取点，见下），我方在这之上补的是 reka 不管的三件事 —— **内置文案、组件尺寸档位、子树主题变量**。

| prop | 默认 | 说明 |
| --- | --- | --- |
| `locale` | `'zh-CN'` | 决定内置词条（`okText` / `cancelText` / `emptyText`），同时透传给 reka 底座：日期与数字类原语经 `useLocale()` 读它做 `Intl` 排版，见[日期排版走 reka 的注入](#日期排版走-reka-的注入) |
| `okText` / `cancelText` / `emptyText` | 按 `locale` 展开 | `textsByLocale`（`config-provider/types.ts:132-141`）只有中英两套；显式给出即覆盖词条 |
| `placeholder` | `'-'` | 空值占位符，`Description` 与字典取不到值时用它 |
| `componentSize` | `'medium'` | 尺寸档位。`'middle'` 是 `@antdv/types` 的存量别名，解析时折成 `'medium'`（`normalizeComponentSize`，`config-provider/types.ts:143-148`），读侧只见三档 |
| `dir` | `'ltr'` | 阅读方向，透传 reka（弹层定位、排版方向）并写在容器 `dir` 属性上 |
| `theme` | `{}` | 子树主题覆盖：`mode`（`dark` / `light` / `system`）、`preset`、`primary`、`radius`，见 `GlobalTheme`（`types.ts:29-50`） |
| `cssVars` | `{}` | 任意 CSS 变量的出口，**最后写入**，优先级高于 `theme` 派生出的那两条 |
| `scrollBody` / `nonce` / `teleportTo` / `useId` | 不给 | 原样透传给 reka 底座：锁 body 滚动、CSP nonce、portal 默认容器、id 生成器（SSR 水合一致性） |

宿主自己的 `class` / `style` / 事件监听与内部那些合到同一个元素上（`inheritAttrs: false` + `useAttrs()`，`ConfigProvider.vue:21`、`:162-188`），所以 `<ConfigProvider class="foo" @click="…">` 不会丢。`data-common-config-provider` / `data-config-locale` / `data-config-size` 是调试与 e2e 的抓手。

### 容器为什么是 `display: contents`

`wrapperClass` 的第一项就是 `'contents'`（`:164-173`）：这层 `<div>` **不生成盒子**，子节点的布局与"根本没有 provider 这层"完全一致 —— 否则给 `Grid` / `Flex` 的直接子项套一层 provider，栅格就会塌成一列。CSS 自定义属性按 DOM 树继承，跟盒子无关，所以变量照样下发。宿主若想复用这个元素，写内联 `style="display:flex"` 覆盖掉 `contents` 即可，变量传递不受影响。

### 谁在读这份配置

`useGlobalConfig()`（`use-global-config.ts:18-20`）返回合并完的 reactive 配置；没挂 provider 也能调，退回 `DEFAULT_GLOBAL_CONFIG`。因为返回的是 reactive 对象，**解构会丢响应性**，取值写 `config.okText`。

| 读侧 | 读什么 | 落在哪 |
| --- | --- | --- |
| `Popconfirm` | `okText` / `cancelText` | `popconfirm/Popconfirm.vue:45-46` |
| `Empty` / `EmptyState` | `emptyText` | `empty/Empty.vue:34`、`empty-state/EmptyState.vue:23` |
| `Transfer` | `emptyText`（右列空态） | `transfer/Transfer.vue:261` |
| `Description` | `placeholder` + `componentSize` | `description/Description.vue:70` |
| `Loading` | `componentSize` | `loading/Loading.vue:31-33` |
| `Segmented` | `componentSize` | `segmented/Segmented.vue:50-52` |
| `Steps` | `componentSize`（只有 `small` 有独立视觉） | `steps/Steps.vue:52` |

这些组件的 `size` / 文案 props 默认值一律是 `undefined` —— 写死 `'default'` 就等于没有全局档位。各家的词汇不统一，所以 `medium` 落地时按各自的叫法映射：`Loading` → `default`、`Segmented` → `middle`、`Description` → `default`（它只有 `small` / `middle` 两档比默认更紧凑）。

::: warning 档位下发给子项要 reactive，不能快照 `Segmented` 的档位还要再往下走一层：`@antdv/shadcn-ui` 的 `ToggleGroup` 用 `provide('toggleGroup', …)` 把它交给每个 `ToggleGroupItem`。那层 provide 原先给的是**普通对象**，等于 setup 那一刻的快照 —— 切档时组自己身上的 `data-size` 跟着变了、按钮高度却不动，看起来就像"档位只写了个属性"。现在写成带 getter 的 `reactive()`（`toggle-group/ToggleGroup.vue:24-33`），子项每次渲染重新取。**自己写跨层的档位下发时同样别快照。** :::

### 日期排版走 reka 的注入

`dayjs` 只管我们自己格式出来的字符串；日历里的月份标题、星期表头由 **reka 原语**排版，读的是 provider 透传给 reka 底座的那份 `locale`。链路是两跳：provider → reka `ConfigProvider` 的注入 → 各 Root 里的 `useLocale(propLocale)`（显式 prop 优先，否则取注入，再兜底 `'en'`），Root 拿到值后再交给 `useDateFormatter` 做 `Intl` 格式化，并 watch 语言变化重设。

- **覆盖到的 Root**：`CalendarRoot` / `RangeCalendarRoot` / `DateFieldRoot` / `DatePickerRoot` / `MonthPickerRoot` / `YearPickerRoot` 与对应 Range 变体，外加 `TimeField` / `NumberField` / `ColorField`。
- **字段壳不许写死 `locale`**。`FDatePicker`（`packages/core/ui-kit/form-ui/src/fields/FDatePicker.vue`）原先在 `<Calendar>` / `<RangeCalendar>` 上写死 `locale="zh-CN"`，月份名还另存了一份硬编码中文数组，切语言时"按钮变了、日历还是中文"就是这一处。现在它不传 `locale`，12 个月名由 `useLocale()` 的返回值喂给 `Intl.DateTimeFormat`（`:161-174`）。
- **`useDateFormatter()` 本身不读注入** —— 它的参数是普通字符串，只有 Root 会把注入值传下去。所以"自己 new 一个 formatter"的包装组件不在桥接范围内：`@antdv/shadcn-ui` 的 `calendar/Calendar.vue:27` 就是 `useDateFormatter(props.locale ?? 'en')`，那份 formatter 只服务 `layout` 的 `month-and-year` / `month-only` / `year-only` 三个 `NativeSelect` 变体；默认分支渲染的 `<CalendarHeading />` 与星期表头才是走注入的。要在 `layout` 模式下也让月/年下拉跟语言，得把 `locale` 显式传进这个包装组件。

端到端锚点：`apps/web/e2e/config-provider.spec.ts` —— 切到 `en-US` 后断言标题从 `2026年10月` 变成 `Oct 2026`、星期表头从 `一 二 … 日` 变成 `S M T W T F S`。

::: warning 主题与变量不要从 `useGlobalConfig()` 读 `theme` / `cssVars` 已经由 provider 写成容器上的 CSS 变量和 `.dark` / `.light` class，组件继续用 `var(--*)`、`bg-primary` 这些工具类即可。再按 JS 值分支就出现"样式走 CSS 变量、逻辑走 JS 值"两套口径（`use-global-config.ts:14-16`）。:::

### 子树主题，不是第二个全局写侧

全站主题色的唯一写侧仍是 `@antdv/preferences` 的 `applyPreferencesToDom()`（把 `--primary`、`.dark`、`data-theme` 写在 `<html>` 上，见[设计令牌与全局样式](/guide/essentials/design)）。`ConfigProvider` 只做**子树覆盖**：`themeVars`（`:144-150`）只写这次给了的那几条，留空就删掉声明、让子树重新继承 `<html>` 的值 —— 即"留空 = 不覆盖"，不是"覆盖成默认值"。

子树覆盖能生效，靠的是 `@antdv/design/src/token/index.css` 用 `@theme inline` 声明 token：值就地展开，工具类编译成 `hsl(var(--primary))` 这条**表达式**本身，而不是在 `:root` 求过一次的实际颜色，所以非 `:root` 的祖先改了就跟着改。`radius` 用**绝对值**（数字按 `--radius` 的 16px 基准换算成 rem，`8` → `0.5rem`；字符串原样），与偏好的倍率刻度（0–1，基准 16px）不是一回事 —— 子树覆盖是给"这一块要更方/更圆"用的。

::: warning 档位与主题名要落在同一个元素 `@antdv/design` 的暗色预设写成 `.dark[data-theme='violet']`，Tailwind 的 `dark:` 变体是 `&:where(.dark, .dark *)`。所以 `mode` 生成的 class 与 `preset` 生成的 `data-theme` 必须挂在同一个节点上（实现里就是这么写的，`:202-211`），拆到两层就只剩一半生效。:::

::: warning 被 teleport 出去的弹层不在这棵子树里 `Dialog` / `Popover` / `Select` 的浮层默认挂到 `body`，CSS 变量按 DOM 树继承，于是它们跟的是 `<html>` 上的档位，不是 provider 的。要让局部主题覆盖到弹层，把 `teleportTo` 指进这棵子树（`scrollBody` / `nonce` / `useId` 不受影响）。:::

### 嵌套

内层只覆盖自己**显式给出**的字段，其余继承外层（`ConfigProvider.vue:39-47`、`:53-96`）。两个细节：

- 文案继承的是外层的**成品值**，外层写死 `okText: 'Confirm'` 时内层不会退回"确定 / OK"；但内层自己换 `locale` 会按新语言重新展开词条 —— 换语言的人要的是那种语言的说法。
- `theme` / `cssVars` 是浅合并：内层只改 `radius`，外层的主色与明暗仍然在。

真实用例：`apps/web/src/App.vue:48-51`（配置对象在 `:41-44`）在根部挂了它，只下发 `component-size` 与 `locale`（偏好是唯一来源）；`theme` / `cssVars` 故意留空，主题色与圆角仍由 `applyPreferencesToDom()` 写在 `<html>` 上，避免同一份配置两个写侧。

## Badge（徽标）

`components/badge/Badge.vue`（130 行），props 与默认值在 `:10-35`。

| prop | 默认 | 说明 |
| --- | --- | --- |
| `count` | `0` | 数字气泡；`> max` 时显示 `${max}+`（`:57-59`） |
| `max` | `99` | 上限 |
| `dot` | `false` | 红点模式，忽略 `count` 的显示 |
| `show` | `true` | 显隐；`visible = show && (dot \|\| count > 0)`（`:53`）—— `count` 为 0 且没开 `dot` 时气泡不出现 |
| `status` | 无 | `'default' \| 'error' \| 'processing' \| 'success' \| 'warning'`，**给了它就换模式**（`statusMode`，`:48`） |
| `text` | 无 | 只在 `status` 模式下跟着圆点显示 |
| `color` / `numberStyle` / `offset` / `title` | 无 | 自定义色 / 数字样式 / 偏移 / 原生 title |

两种模式互斥：有 `status` → 圆点 + `text` + 默认插槽；没有 → 默认插槽外面套 `<sup>` 气泡。**没有默认插槽时气泡退化成行内独立显示**（`standalone`，`:50-51`）。事件：无。

状态色是**字面量类名表** `STATUS_DOT`（`:37-44`，`processing: 'animate-pulse bg-blue-500'` 等）—— Tailwind 只扫字面量，这张表不能改成拼接。

真实用例：`apps/web/src/views/security/dashboard/components/SecurityTimeline.vue:11`。

## Steps（步骤条）

`components/steps/Steps.vue`（163 行），props `:9-26`，事件 `:28`。

| prop | 默认 | 说明 |
| --- | --- | --- |
| `current` | `0` | 当前步下标；配 `v-model:current` 用 |
| `items` | `[]` | `StepItem[] = { title?, description? }`（`:30-33`）—— **只有这两个字段**，没有 antd 的 `status` / `icon` 逐项配置 |
| `direction` | `'horizontal'` | `'horizontal' \| 'vertical'` |
| `size` | `'default'` | `'default' \| 'small'`，small 时图标 12px、否则 14px（`:47-49`） |
| `status` | 无 | `'error' \| 'finish' \| 'process'`，**只改写当前这一步**，其余仍按 `current` 推导（`stateOf`，`:51-56`） |
| `clickable` | `false` | 为真时步骤渲染成 `<button>`（`aria-label` 取 `item.title`），点击才发事件 |

事件：`change: [number]`、`update:current: [number]`。`select()` 里有守卫：**`clickable` 为 false 时点步骤不发任何事件**。配色同样走字面量表 `CIRCLE`（`:37-43`，四档：`error` / `finish` / `process` / `wait`），完成态显示 `carbon:checkmark`。

真实用例：`apps/web/src/views/components/form/steps/index.vue:12`（配 `Result` 做提交成功页）。

## Result（结果页）

`components/result/Result.vue`（70 行），props `:9-20`。

| prop | 默认 | 说明 |
| --- | --- | --- |
| `status` | `'info'` | `'403' \| '404' \| '500' \| 'error' \| 'info' \| 'success' \| 'warning'`（`:22-29`） |
| `title` / `subTitle` | 无 | 主标题 / 副标题，两者都是可选文本节点 |

插槽：`default`（说明区）、`extra`（操作按钮区，`:66-67`）。事件：无。图标与配色在 `PRESET` 表里（`:31-40`）：`403` → amber `carbon:warning`、`404` → blue `carbon:document`、`500` → red `carbon:fire`、`error` → `carbon:close-outline`、`info` → `carbon:information`、`success` → emerald `carbon:checkmark-outline`、`warning` → `carbon:warning-alt`。非法 `status` 兜回 `info`（`:42`）。

## Transfer（穿梭框）

`components/transfer/Transfer.vue`（294 行），props `:15-36`，事件 `:38-41`，类型在 `transfer/types.ts`。

| prop | 默认 | 说明 |
| --- | --- | --- |
| `dataSource` | `[]` | `TransferItem[] = { key, disabled?, title?, [k: string]: any }` |
| `targetKeys`（`v-model:target-keys`） | `[]` | `defineModel<TransferKey[]>('targetKeys')`（`:43`），右列表按它的顺序展示，左列表保持 `dataSource` 顺序 |
| `oneWay` | `false` | 只留「→」按钮 |
| `operation` | `['>', '<']` | 两个按钮的文案 |
| `titles` | `['源列表', '目标列表']` | 面板标题 |
| `showSearch` | `false` | 面板顶部搜索框 |
| `render` | 无 | `(item) => string`，不传则取 `item.title` |
| `disabled` / `listStyle` | `false` / 无 |  |

事件：`change: [TransferKey[], TransferDirection, TransferKey[]]`、`select: [TransferDirection, TransferKey[]]`；`TransferDirection = 'left' | 'right'`。

**键的比较一律先转字符串**（`transferKey()`，`types.ts:12-15`）：mock 接口混用数字与字符串键，`Set` 直比会漏。所以 `targetKeys` 传 `[1, '2']` 是等价的，但反过来断言 `change` 的载荷类型时要按 `TransferKey` 收。

真实用例：`apps/web/src/views/system/post/index.vue:14`（角色 ↔ 岗位分配）。

## Image（图片与预览）

`components/image/Image.vue`（150 行），props `:17-40`。

| prop | 默认 | 说明 |
| --- | --- | --- |
| `src` / `alt` / `width` / `height` | 无 / `''` / 无 / 无 | `width` / `height` 收 `number \| string` |
| `fallback` | 无 | 加载失败时换用它（不是 antd 的 `onError` 回调） |
| `preview` | `true` | `boolean \| { visible?, onVisibleChange? }`（`:44-47`） |
| `rootClassName` / `class` / `style` | 无 |  |

事件：`update:previewVisible: [boolean]`（`:42`）。预览层是 shadcn `Dialog` + `DialogContent` + `DialogTitle` + `DialogDescription`。

::: warning `preview` 三种写法的差别

- `preview` 不给 / `true` → 可点，非受控。
- <code v-pre>preview={{ visible }}</code>（`visible` 是 boolean）→ **受控**，配合 `@update:preview-visible` 回写。
- <code v-pre>preview={{ visible: false }}</code> 且没有 `onVisibleChange` → 视为**静态关闭**，整块预览入口不渲染（`showPreview`，`:55-60`）；`preview=false` 同样关闭。这是迁移前"隐藏预览"的用法，行为保留但写法容易写错，注意 `preview={false}` 与 <code v-pre>preview={{ visible: false }}</code> 等价、而 <code v-pre>preview={{}}</code> 是可点。:::

## Upload / UploadDragger / UploadList

`components/upload/`：`Upload.vue` 314 行（props `:13-46`）、`UploadDragger.vue` 11 行、`UploadList.vue` 128 行（props `:12-26`）、`types.ts`。

| prop | 默认 | 说明 |
| --- | --- | --- |
| `fileList`（`v-model:file-list`） | `[]` | `defineModel<UploadFile[]>('fileList')`（`:56`） |
| `accept` / `multiple` | 无 / `false` | 交给 `useFileDialog` 的 computed（`:62-63`），props 变了隐藏 `input` 会同步刷新 |
| `listType` | `'text'` | `'text' \| 'picture' \| 'picture-card'` |
| `autoUpload` | `true` | 关掉后要手动调实例方法 `upload()` |
| `beforeUpload` | 无 | `(file, list) => any`：**返回 `false` 跳过上传**（返回 Promise reject 也跳过；返回 Blob/File 用它替掉原文件） |
| `customRequest` | 无 | `({ file, filename, onSuccess, onError, onProgress }) => (() => void) \| void`，返回的函数当"中止"用 |
| `maxCount` | 无 | `=== 1` 时选新文件会清掉旧列表；超限的文件直接跳过 |
| `disabled` / `drag` / `showUploadList` / `previewFile` | `false` / `false` / `true` / 无 |  |

事件：`change: [UploadChangeParam]`、`drop: [DragEvent]`、`preview: [UploadFile, MouseEvent]`、`remove: [UploadFile]`。`UploadChangeParam = { file, fileList, event? }`，删除时 `status: 'removed'` 也会走一次 `change`。

实例方法（`defineExpose`，`:279`）：**`upload()`** 与 `reset()`。

::: warning 迁移后没有的两件事

1. **没有 `action`**。上传动作只有 `customRequest` 一条路；不传就是"本地模拟"—— 300ms 后 `onSuccess({})`（`:164`），进度、成功、失败都能在没有任何后端的情况下走完。写文档或抄示例时别把它当成真实上传。
2. **没有 `<a-upload>` 的 `submit()`**。`autoUpload=false` 场景调的是 `upload()`（`components/upload/Upload.vue:254`）。:::

选文件走 `@vueuse/core` 的 `useFileDialog`（`:7`、`:70` 起），注入点是模板里那个隐藏 `<input data-common-upload-input>`（`:294-302`；`:65-69` 的注释解释了为什么给它显式元素：单测能在 jsdom 里直接对该 input 驱动 `change`）。应用侧的 `AvatarUploader`（`packages/core/ui-kit/common-ui/src/components/avatar-uploader/AvatarUploader.vue:12`）、`ImportExport`（`packages/core/ui-kit/common-ui/src/components/import-export/ImportExport.vue:13`）用的是同一个 hook。

- `UploadDragger` 只是 `<Upload drag v-bind="$attrs"><slot /></Upload>` 的薄壳，`defineOptions({ name: 'UploadDragger', inheritAttrs: false })`。拖拽区文案自己写在默认插槽里。
- `UploadList` 可独立使用：props `items`（`[]`）、`listType`（`'text'`）、`showRemoveIcon`（`true`）、`disabled`（`false`）；事件 `preview` / `remove` / `retry`。`picture-card` 是 96px（`size-24`）方块、点卡片预览；进度条是 shadcn `Progress`；状态色 uploading 蓝 / error 红 / done 绿，失败项显示"重试"。
- 缩略图用 `URL.createObjectURL`，uid 存在 Map 里，`remove` / `reset` / 卸载时 `revokeObjectURL`。

真实用例：`apps/web/src/views/components/upload/index.vue:10`（`Card, Image, Scrollbar, Upload`）、`apps/web/src/views/system/file/index.vue:20`（`UploadDragger`）。细节见[编辑器与文件上传](/components/editor-upload)。

## Tabs / TabPane（标签页）

`components/tabs/`：`Tabs.vue` 111 行（props `:15-26`、事件 `:28`）、`TabPane.vue` 40 行、`context.ts`（`TABS_KEY`）。

| Tabs prop | 默认 | 说明 |
| --- | --- | --- |
| `activeKey` | 无 | 受控；不给时内部 `innerActive` 自管 |
| `defaultActiveKey` | 无 | 非受控初值；**没有传的话，第一个注册进来的 pane 自动激活**（`register()`，`:38-42`） |
| `type` | `'line'` | `'line' \| 'card'` |

Tabs 事件：`change: [number | string]`、`update:activeKey: [number \| string]`（同一 key 重复点不发，`:44-49` 的 `activate` 有 `String()` 比较）。

| TabPane prop | 默认 | 说明 |
| --- | --- | --- |
| `value` | **必填** | `number \| string` —— 这是 pane 的身份 |
| `label` / `tab` | 无 | 两个都支持：`tab` 优先，`label` 兜底（迁移前两种写法都在用） |
| `disabled` | `false` |  |

::: warning 三条与 antdv-next 不同的地方，逐条踩过

1. **pane 用 `value`，不是 `key`。** 写 `<TabPane key="a">` 时 `key` 会被 Vue 当 vnode diff 键吃掉，pane 拿不到 `value`，注册进 `Tabs` 的是 `undefined` —— 标签头出来但点了没反应。
2. **没有 `add` 事件，也没有 `edit`。** antdv-next 的 `Tabs` 有 `edit(key | MouseEvent, 'add' | 'remove')`；本包的 `Tabs` 只发 `change` 与 `update:activeKey`（`Tabs.vue:28`）。可编辑标签页要在外面自己放「+」「×」按钮。
3. **pane 是懒挂载 + 保状态。** `TabPane.vue:27-31`：`mounted` 只在首次激活时置真，模板 `:37` 之后用 `hidden` 类隐藏而不是 `v-if` 卸载 —— 切回去时表单内容、滚动位置都还在。要"每次切回都重来"请自己在 `@change` 里 `reset()`。:::

真实用例：`apps/web/src/views/account/center/index.vue:13-14`、`apps/web/src/views/system/notice/index.vue:14-15`、`apps/web/src/views/components/editor/index.vue:16-17`。

## Tooltip（文字提示）

`components/tooltip/Tooltip.vue`（78 行），props `:13-34`。

| prop | 默认 | 说明 |
| --- | --- | --- |
| `title` | 无 | 提示文本；也可以用 `#title` 插槽 |
| `placement` | `'top'` | antd 的十二方位：`top` / `topLeft` / `topRight` / `bottom` / `bottomLeft` / `bottomRight` / `left` / `leftTop` / `leftBottom` / `right` / `rightTop` / `rightBottom` |

`PLACEMENT` 表把十二方位映射成 reka-ui 的 `side` + `align`（`:37-56`）。默认插槽是触发元素，走 `TooltipTrigger as-child`，所以**包裹层不会多一个 DOM 节点**，但代价是触发元素必须自己可聚焦 —— 图标按钮直接裸用没问题，`<div>` 得加 `tabindex`。

::: warning `title` 为空时整个提示层不渲染

`Tooltip.vue` 的模板是 `v-if` 有内容才包 `TooltipProvider`，否则 `<slot v-else>` 原样输出。所以 `:title="row.remark"` 传空串 = 没有 tooltip（这是想要的行为），但也意味着"鼠标悬停才有内容"得自己判断，不要指望空提示框会显示一个空白气泡。:::

## CronEditor（Cron 表达式）

`components/cron-editor/`（`CronEditor.vue` 346 行 + `types.ts`）。

| prop                      | 默认    | 说明             |
| ------------------------- | ------- | ---------------- |
| `v-model`（`modelValue`） | `''`    | 6 段 cron 表达式 |
| `disabled`                | `false` |                  |

事件：`update:modelValue`、`change`（都是 `(value: string)`）。

内部把表达式拆成六个字段（秒 / 分 / 时 / 日 / 月 / 周，`CronField`：`{ key, label, min, max, allowEvery, defaultValue }`），配 12 个中文预设（`每分钟` = `'0 * * * * *'` 一直到 `每年 1 月 1 日` = `'0 0 0 1 1 *'`）。人话描述用 `cronstrue` + `cronstrue/locales/zh_CN`；表达式输入框是 `readonly`，只能靠字段面板或预设改值。

真实用例：`apps/web/src/views/components/cron/index.vue:4`，演示细节见[图表与 Cron](/components/chart-cron)。

## CountTo（数字滚动）

`components/count-to/CountTo.vue`（128 行），props 默认值 `:9-21`（类型 `CountToProps` 在 `types.ts:4-78`）。

| prop | 默认 | 说明 |
| --- | --- | --- |
| `startVal` / `endVal` | `0` / `0` | 起止值 |
| `duration` | `2000` | 毫秒 |
| `autoplay` | `true` | 挂载即播；**只有 `endVal` 变化会自动重播** |
| `decimals` | `0` | `toFixed` 位数 |
| `decimal` / `separator` | `'.'` / `','` | 小数点字符 / 千分位 |
| `prefix` / `suffix` | `''` |  |
| `useEasing` | `true` | `false` 走线性 |
| `easingFn` | `'easeOutExpo'` | **只有三个值**：`easeInOutCubic` / `easeOutExpo` / `linear`（`:29-34`），传别的拿到 `undefined` |
| `className` / `style` | 无 | 落在输出 `<span class="count-to">` 上 |

事件：`change`（**每帧一次**，别在监听里做重活）、`finished`。实例方法（`defineExpose<CountToInstance>`，`:116`）：`start()` / `pause()` / `reset()` / `getCurrentValue()`。

动画由 `useRafFn` 驱动（不是 `setInterval`）：帧率跟浏览器、标签页隐藏自然停、卸载自动 pause。`start()` 第一行是 `if (isActive) return`，所以**能暂停但不能续播**：`pause()` 之后只有 `reset()` + `start()` 从头再来，`resume` 没有对外暴露。

真实用例：`apps/web/src/views/components/count-to/index.vue:7`、`apps/web/src/views/screen/components/RealtimeNumber.vue:3`、`apps/web/src/views/security/dashboard/components/SecurityScoreCard.vue:10`。被删掉的是**应用侧那份业务副本** `apps/web/src/components/business/CountTo/`（提交 756a1c91 连同 `business/Description/` 一起删），组件本体现在就在本包的 `src/components/count-to/`。

## Description / Descriptions（描述列表）

两组组件解决同一件事：`Descriptions` + `DescriptionsItem` 是**声明式**（自己写插槽），`Description` 是**配置式**（`schema` + `data`）。

`Descriptions`（`descriptions/Descriptions.vue`，62 行）：props `title`、`column`(3)、`layout`(`'horizontal'`)、`bordered`(false)、`size`(`'default' | 'middle' | 'small'`)；插槽 `title`（默认取 `props.title`，`:46-51`）、`extra`、`default`。 `DescriptionsItem`（77 行）：props `label`、`span`(1)；插槽 `label`（`:71`）、`default`。

`Description`（`description/Description.vue`，218 行）默认值在 `:22-29`，类型全在 `types.ts`：

| prop | 默认 | 说明 |
| --- | --- | --- |
| `data` | 无 | 字段值来源 |
| `schema` | 无 | `DescriptionItem[]`；`show === false` 的项被过滤 |
| `column` | `3` | **只有 `number`**，没有断点对象；响应式列数自己在外面算 |
| `size` | 无 | `DescriptionSize = 'large' \| 'middle' \| 'small'`（`types.ts:15`）—— **`'default'` 已经删掉了**，注释写明原因：旧组件库把 `default` 判为废弃。不传 = 组件默认，`large` 与不传渲染一致；内部再映射成 `Descriptions` 的 `'default' \| 'middle' \| 'small'`（`Description.vue:59-61`） |
| `layout` / `bordered` / `colon` | `'horizontal'` / `false` / `true` |  |
| `loading` | `false` | 为真时渲染自己的转圈占位 |
| `emptyText` | `'-'` | `null` / `undefined` / `''` 都替换成它（`:66`） |
| `title` / `className` / `style` | 无 |  |

`DescriptionItem` 的取值优先级（`renderValue()` 的分支见 `:120-128`）：`#<field>` 插槽 → `render(value, data)` → 内置 `type` → 纯文本；标签同理 `#<field>-label` → `renderLabel` → `label` → `field`。`type` 支持 `'date' \| 'datetime' \| 'dict' \| 'image' \| 'images' \| 'tag' \| 'text'`，配 `dictType` / `dateFormat` / `imageSize`。

::: warning 四条限制（都验证到行为）

- **`type: 'tag'` 不渲染 Tag**：`case 'tag'` 与 `case 'text'` 与 `default` 落到同一个分支（`:163-165`）。要标签请用 `render` 自己 `h(Tag, ...)`。
- **`type: 'dict'` 不再读 pinia 字典 store**：改成注入式 —— 宿主 `provide(DESCRIPTION_DICT_RESOLVER, fn)`（`description/context.ts:16`，注释说明了包不允许引 pinia / `~/...`）。没注入时 `dictResolver?.(...) ?? String(value)`（`description/Description.vue:51`，注入在 `:46`），即**显示原值**，空值显示 `-`。截至本文更新，本仓库没有任何地方 provide 这个键（只单测里 provide 过），所以应用里 `type: 'dict'` 目前只会回显原值 —— 要用真字典，自己 provide。
- **`setData()` 是空壳**：实现只 `console.warn('[Description] setData 不支持在只读模式下使用')`（`:175-177`），组件只读，可用实例方法只有 `getData()`（`:174`，`defineExpose` 在 `:179`）。
- **`DescriptionBordered`（`types.ts:25`）没有任何地方使用**，遗留类型。:::

真实用例：`apps/web/src/views/components/description/index.vue:23`、`apps/web/src/views/system/online/index.vue:24`（`Description as DetailDescription`）。

## StatusTag / EmptyState / ErrorBoundary / 骨架屏

四个"应用侧原来各写一份"的小组件，现在都在包里。

**StatusTag**（`status-tag/StatusTag.vue`，54 行）：props `status`（**必填**，`string`）、`type?: 'export' | 'instance' | 'task' | 'workflow'`。语义映射 `MAP`（`:15-26`）：`'0'` 处理中 / `'1'` 已完成 / `'2'` 已终止 / `'3'` 已挂起，加 `pending` / `processing` / `completed` / `failed` / `cancelled` / `timeout`；再由 `PRESET_BY_SEMANTIC`（`:33-39`）把状态语义色对齐到 `Tag` 的预设色名（processing→blue、success→green、error→red、warning→gold、default→default）。**认不出的 status 直接原样当文本、色走 default**（`:41-45`，用 `isNil` 而不是 `??`，避免空串被兜掉）。渲染结果就是 `<Tag :color>`。

**EmptyState**（`empty-state/EmptyState.vue`，32 行）：props `title`（`'暂无数据'`）、`description`（`''`）、`icon`（`'ant-design:inbox-outlined'`，Iconify 名）+ 默认插槽（放操作按钮）。配色全部是语义 token（底盘 `bg-muted`、图标 `text-muted-foreground`、标题 `text-foreground`）—— 早先写死的 `bg-gray-50` / `text-gray-900` 在深色下是黑底黑字，已经换掉。与 `Empty` 的分工：`Empty` 是组件库语义的空数据占位（`description?: false | string`、`image?: false | string`），`EmptyState` 是页面级的"这里什么都没有 + 你可以做点什么"。`Listy` 的默认空状态就是它。

**ErrorBoundary**（`error-boundary/ErrorBoundary.vue`，145 行）：props `fallback?: (error: Error, reset: () => void) => VNode`、`resetOnError`(true)、`maxStackDepth`(5)；事件 `error: [Error]`、`reset: []`。机制：`onErrorCaptured` 把 message 前缀成 `[${info}] ...` 并返回 `false` 阻断上抛（`:34-58`），DEV 下额外打一个 `console.group` + `console.trace`（`:48-55`）；默认兜底 UI 是「⚠️ 出错了 / 🔄 重试 / 可展开的堆栈」，堆栈区套 `Scrollbar root-class="h-32"`（要定高而不是 `max-h-32`：`max-*` 只裁掉可视高度，滚动区量不到确定高度就成了「看得见一半、滚不动」）；子内容包在 `<Suspense>` 里，`#fallback` 用 `loading` 插槽；重挂载靠 `<slot :key="errorId">` 换 key。

::: warning `maxStackDepth` 目前没有生效路径

它在 `interface Props`（`:11-14`）里声明、默认值给在 `:20`，但实现里只用了 `error.stack` 整段展示，没有按层数裁剪的代码。写进 `:max-stack-depth` 不会改变渲染结果 —— 别把它当可用 API，本文按"声明了但没用"记录。:::

**PageSkeleton / TableSkeleton**（`skeleton/`）：都基于 shadcn `Skeleton`，底色统一 `cn('bg-gray-200 dark:bg-gray-700', 'rounded-sm')`（`PageSkeleton.vue:55`、`TableSkeleton.vue:53`）。

| 组件 | props（默认） |
| --- | --- |
| `PageSkeleton` | `loading`(true)、`variant`(`'page'`，可 `'card' \| 'detail' \| 'form' \| 'page'`)、`rows`(5，仅 page 类型)、`showTitle`(true)、`showActions`(true)、`showSidebar`(false)、`class` |
| `TableSkeleton` | `loading`(true)、`columns`(5)、`rows`(8)、`showHeader`(true)、`showActions`(true)、`showPagination`(true)、`class` |

真实用例：`apps/web/src/views/components/loading/index.vue:6-17`（骨架 + Loading 那五个组件一起用）。

## BorderBeam（边框光带）

`components/border-beam/BorderBeam.vue`（119 行），props 与默认值 `:12-22`，类型在 `border-beam/types.ts`（20 行）。纯装饰组件：把一段渐变沿容器边框转一圈，内容还是自己的默认插槽。

| prop | 默认 | 说明 |
| --- | --- | --- |
| `color` | `'var(--primary)'` | 光带头部颜色，接受任意 CSS 颜色（含 `var(...)`） |
| `tailColor` | `'transparent'` | 尾部颜色；默认透明，于是头部从背景里淡出来 |
| `duration` | `6` | 绕容器一圈的秒数，落进 `animation-duration`（`:41-44`） |
| `delay` | `0` | 出发前的延迟秒数，落进 `animation-delay`；**负值原样写入**，用来让光带从中途入场 |
| `size` | `25` | 弧长占一圈角度的百分比 → `--bb-size: ${size}%` |
| `borderWidth` | `2` | 光带粗细，数字按 px（`toLength()`，`:25-27`） |
| `radius` | `'var(--radius)'` | 圆角：数字按 16px 基准换算成 rem（`radiusToRem`），字符串原样写进 CSS，所以能直接给 `'999px'` 或另一个变量 |
| `class` / `style` | 无 | `class` 走 `cn('relative', props.class)`；`style` 展开在根节点最后，可以覆盖组件自己写的变量 |

事件：无。插槽：只有 `default`。

实现只有三条腿：根节点写 CSS 变量与圆角 → `.border-beam__ring` 用两层 mask 相减（外层铺满边框盒、内层只到内容盒，`mask-composite: exclude`）留出一圈 padding 环 → `.border-beam__spin` 是一块 `inset: -50%` 的同心大方块，背景是 `conic-gradient(transparent → tail → color)`，把它 `rotate(360deg)` 无限转，光带就沿着边框跑。方块放大到容器两倍并同心，**旋转中心才永远是容器中心**，容器扁平时上下边的扫过速度才均匀。`@media (prefers-reduced-motion: reduce)` 下 `animation: none`：动效停在原位，边框仍然在。

::: warning 两个必须知道的边界

1. **环铺满的是父级的 padding box**（绝对定位的 `inset: 0` 参照它）。容器自己再写 `border-*` 工具类，光带会压在边框内侧；要描边就让 `borderWidth` 一个人做。
2. **`border-beam` 这个钩子类走静态 `class`，不进 `cn()`**（钩子类在 `:49`，`:50` 才是 `cn('relative', props.class)`；解释这条的注释**在它下方**的 `:53-57`，位于根元素内部）：tailwind-merge 把它认成 `border-{color}` 那一档，调用方一旦传 `border-border`，同名冲突会把钩子类整条吃掉，表现为"边框没了"。同理，`<template>` 根节点前**不要放注释** —— dev 构建会保留注释节点，组件根就变成 Fragment，`class` / `style` 透传与 `attrs` 继承一起失效。:::

真实用例：`apps/web/src/views/components/border-beam/index.vue`（六组配置 + 一张真实统计卡）。

## Listy（通用列表 / 虚拟滚动）

`components/listy/Listy.vue`（430 行），props 与默认值 `:23-39`，类型在 `listy/types.ts`（134 行）。定位是"行式展示的默认外壳"：数据、加载骨架、空状态、行内插槽四件事，业务字段随对象一起传进来，插槽里按原样取用。再加一个 `virtual` 开关，同一套行模板就变成万级数据的虚拟列表。

| prop | 默认 | 说明 |
| --- | --- | --- |
| `items` | `[]` | `ListyItem[]`。约定字段只有 `title` / `description` / `extra` / `icon` / `key`，其余字段随便加（`[field: string]: unknown`） |
| `itemKey` | 无 | 字段名或 `(index, item) => key`；缺省依次退到 `item.key` 与下标（`rowKey()`，`:222`） |
| `size` | `'middle'` | `'small' \| 'middle' \| 'large'`，换的是行的紧凑程度（`rowClass`，`:202-208`）与标题字号 |
| `loading` | `false` | 骨架态：`<ul aria-busy="true">` 顶替列表 |
| `loadingRows` | `3` | 骨架行数 |
| `selectable` | `false` | 行可点：给手型与 `hover:bg-accent` |
| `emptyText` / `emptyIcon` | `'暂无数据'` / `'ant-design:inbox-outlined'` | 空状态文案与图标（透给 `EmptyState`） |
| `virtual` | `false` | 打开虚拟滚动：只渲染视口内的行 |
| `containerHeight` | `320` | 虚拟模式的滚动视口高度。数字按 px，字符串原样写进 style（`'50vh'`、`'100%'`） |
| `itemHeight` | `40` | 行高：数字，或 `(index, item) => number`（`ListyItemHeight`）。直排模式下它不参与渲染 |
| `measureHeights` | `false` | 实测回灌：关掉行内高度，由内容撑开，进入窗口的行用 `ResizeObserver` 量真值。此时 `itemHeight` 退成"首帧估算" |
| `overscan` | `5` | 视口上下各多渲染几行。**只在建立时读一次**（VueUse 把选项解构掉了），改它要重挂组件 |
| `class` / `style` | 无 | 同 BorderBeam：`listy` 钩子类走静态 class，其余进 `cn()` |

事件两个：`itemClick: [ListyItem, number]`（模板里写 `@item-click`）与 `scroll: [ListyScrollState]`（`@scroll`）。后者是"位置变了才抛"的快照：`{ startIndex, endIndex, visibleCount, scrollTop, scrollHeight, progress }`，程序化滚动与就地换数据都走同一条路。

插槽七个：`header`、`loading`（整段替换骨架）、`empty`（整段替换空状态）、`item`（整行）、`item-media`（行首）、`item-extra`（行尾）、`footer`。`header` / `footer` 用 `slots.xxx` 判空，**缺席时整块不渲染**，不会留下一条空分隔线。虚拟模式下插槽拿到的是**上游绝对下标**，不是窗口内序号。

暴露的状态与方法（`defineExpose`，`:295`）：`visibleItems` / `visibleRange` / `scrollState` / `totalHeight` / `isScrolling` / `directions` / `arrivedState` / `containerElement` 是响应式状态，外部 `computed(() => listyRef.value?.scrollState)` 直接读就在依赖图里；方法是 `scrollToIndex(index, { behavior, block })` / `scrollTo(offset, behavior)` / `scrollToTop()` / `scrollToBottom()` / `recalc()`。下标越界会被夹进合法区间，空列表调用不报错。

基础用法（20 000 条，只挂窗口内那十几行）：

```vue
<script setup lang="ts">
import type { ListyItem, ListyScrollState } from '@antdv/common-ui';

import { ref } from 'vue';

import { Listy } from '@antdv/common-ui';

const rows: ListyItem[] = Array.from({ length: 20_000 }, (_, index) => ({
  description: `第 ${index} 条`,
  key: index,
  title: `条目 ${index}`,
}));

const listy = ref<InstanceType<typeof Listy> | null>(null);

function onScroll(state: ListyScrollState) {
  // startIndex / endIndex / visibleCount / scrollTop / scrollHeight / progress
  console.log(state.startIndex, state.progress);
}
</script>

<template>
  <Listy
    ref="listy"
    :container-height="320"
    :items="rows"
    :item-height="48"
    item-key="key"
    selectable
    :virtual="true"
    @item-click="(item) => console.log(item.title)"
    @scroll="onScroll"
  />
  <button @click="listy?.scrollToIndex(10_000, { behavior: 'smooth' })">
    跳到第 10 000 行
  </button>
</template>
```

### 虚拟模式怎么跑起来的

三件事全部压在 `@vueuse/core` 上，没有自己写滚动算术：`useVirtualList` 管窗口与偏移，`useScroll` 管位置 / 方向 / 到边状态，`useResizeObserver` 管容器尺寸与动态行高实测。

- **占位块就是 `<ul>` 自己**：`wrapperProps.style` 给出 `marginTop`（窗口之前所有行的高）与 `height`（剩下的尾巴），两者相加恒等于内容总高。所以虚拟与直排共用同一份 `<li>` 模板，不需要"外层撑高 + 内层绝对定位"两套结构。
- **`itemHeight` 一律以函数形式交给 VueUse**（`rowHeight()`，`:60`；接线在 `:87`）。传数字会被冻在建立那一刻，之后改属性不重算；给函数则每轮都读最新 props，代价是 VueUse 内部的定位扫描从 O(1) 变 O(n) —— 万级 uniform 高度实测在几十微秒量级，换的是"改属性即生效"。
- **算术高度必须等于实际高度**。固定模式靠把 `height` 内联进 `<li>`（`box-border`，含内边距）钉死，DOM 与算术同一把尺；内容真会换行的场景要么给一个算得准的函数，要么开 `measure-heights` 去量。
- **`measure-heights` 只观察当前窗口里的行**（`measuredTargets`，`:158`）。VueUse 在目标数组变化时会重建 observer，而 `observe()` 对新元素必定回调一次，所以头部插数据导致下标错位时，错位的缓存会被下一轮实测覆盖，不需要手动清。
- **首帧自己算一次窗口**（`onMounted` 里的 `recalc()`）：`useElementSize` 与 `ResizeObserver` 都是异步回调，少了这一下，万级列表在第一次滚动之前是空的（无 `ResizeObserver` 的环境更是永远等不到）。容器尺寸变化不用管，`totalHeight` 与 VueUse 的 size watch 会带着重算。

::: warning `selectable` 是显式的，不是"挂了监听就自动变手型"

组件声明了 `emits`，监听器就不再出现在 `attrs` 里，实现层嗅不到"有没有人监听"（`:199` 的注释记的就是这条）。反过来说就算嗅得到也不该那么做：纯展示的列表给出 hover 反馈，是在骗用户去点一个点了没用的东西。:::

::: warning 虚拟模式需要一个能滚的盒子

`container-height` 给 `'100%'` 时要求祖先有高度，否则视口量出来是 0，窗口只剩 `overscan` 那几行。高度函数（`itemHeight` 传函数时）**必须只读不写**：在里面改响应式状态会让"滚动 → 重算 → 高度变 → 再重算"自激。:::

真实用例：`apps/web/src/views/components/listy/index.vue`（基础 / 加载 / 空状态 / 插槽 + 固定行高 20 000 条 / 函数行高 / 动态实测 / 直排对照，共八张卡）。单测两份：`__tests__/listy.test.ts`（12 例）与 `__tests__/listy-virtual.test.ts`（17 例，jsdom 只钉状态与样式）；滚动几何由 `apps/web/e2e/listy-virtual.spec.ts`（8 例 × 三引擎）在浏览器里量：行高是否真等于 48px、`marginTop + height` 是否等于内容总高、容器变矮后行数是否跟着缩。

## PageHeader / PageToolbar / ToolbarField（页面外壳）

后台页的"门面"三件套：`components/page-header/PageHeader.vue`（63 行，props 在 `types.ts:1-8`）、`components/page-toolbar/PageToolbar.vue`（58 行，props `types.ts:1-13`）、`components/page-toolbar/ToolbarField.vue`（28 行）。存在的理由是这轮改版式的一条判断：**同一件事在 17 个页面里各写一遍，就一定有 17 个版本** —— 标题字号、页头与工具栏的竖向节奏、标签的三种灰、窄屏下被顶出视口的新增按钮，都是这么长出来的。

### PageHeader

| prop | 默认 | 说明 |
| --- | --- | --- |
| `title` | `''` | 页面标题，渲染成页内**唯一的** `<h1>`（`:39-44`）；要塞徽标/计数就用 `#title` 插槽覆盖 |
| `description` | `''` | 标题下一行说明；空串整行不渲染（`:45-52`） |
| `icon` | `''` | iconify 图标名。给了才渲染那枚 `size-10` 的主色徽标底（`:31-37`，`bg-primary/10 text-primary`），没给就是纯文字标题 |

插槽：`title`、`description`、`extra`（`extra` 是右侧操作区，只在有该插槽时挂出容器，`:55-62`）。钩子：`data-page="header"` / `"header-icon"` / `"header-title"` / `"header-desc"` / `"header-extra"` —— 端到端巡检与样式回归都按这些标记找元素，**改名要同批改 `apps/web/src/views/__tests__/page-shell-convention.spec.ts:187-196`**。

两条刻意的取舍写在组件注释里（`:16-25`）：根元素**不带任何上下外边距与内边距**（页面根容器的 `space-y-*` / `gap` 是竖向节奏的唯一来源，页头再加一档 `mb-*` 就叠成两种间距）；操作区在窄屏折到下一行而不是挤压标题（`flex-wrap` + `min-w-0` + `truncate`），标题被挤成三行的页面看起来就不像成品。

### PageToolbar

| prop | 默认 | 说明 |
| --- | --- | --- |
| `stackOnNarrow` | `true` | 窄屏（`< 640px`）时操作区独占一行右对齐：`max-sm:w-full max-sm:justify-end`（`:18-25`）。筛选控件本来就会换行，操作区继续钉右侧会被顶出可视区 —— "看不见的新增按钮"等于没有新增 |

插槽分工是这套外壳的关键：`#filters`（或默认插槽，两者取其一，见 `hasFilters`，`:16`）靠左成一组放筛选，`#actions` 靠右成一组放页面级操作（导出 / 打印 / 批量）。之前同一行里既有"查询 / 重置"又有"新增 / 导出"，两组都是实心主色，读起来分不清"这是查还是这是做"。钩子：`data-page="toolbar"` / `"toolbar-filters"` / `"toolbar-actions"`。根元素同样不带间距。

### ToolbarField

一个筛选项 = 标签 + 控件（`:18-27`，钩子 `data-page="toolbar-field"` / `"toolbar-field-label"`）。它存在的理由只有一个：标签的字号、颜色与控件间距原来每页各写一遍，同一个"状态"标签在三页里是三种灰。`label` 不传时只剩控件本身（用于纯输入框占位）。

真实用例：`apps/web/src/views/system/notice/index.vue`（直接用 `PageToolbar` + `ToolbarField` 组筛选行）；`apps/web/src/views/system/log/index.vue`、`apps/web/src/views/system/login-log/index.vue` 走的是 `BasicTable` 的 `toolbar` / `toolbar-actions` 两个插槽 —— 表格页不必自己再摆一台工具栏，`BasicTable` 内部就是这套 `PageToolbar`（见 `components/table.md`）。

## Auth 系列（登录 / 注册页版式）

`components/auth/` 四个组件：`AuthPageLayout`（整屏左右分栏外壳 + 品牌栏）、`AuthFormPanel`（标题区 + 表单槽）、`AuthSocialLogin`（第三方入口行）、`AuthColorPresets`（工具条里的主题色触发点）。这一层不认识 store、路由与 i18n，文案和色板一律由宿主算好后传进来。

`AuthPageLayout` 的骨架是三层：`[data-auth="canvas"]` 是纯装饰层（`aria-hidden` + `pointer-events: none` + `overflow: hidden`，主色光斑 / 网格 / 蓝图圆弧 / 地平线都在这层，只从 `--primary` 推导，不引入第二套颜色），`[data-auth="card"]` 是分栏行本身（`lg` 以上左栏 `52%` 品牌、右栏 `48%` 表单，`lg` 以下收成单列、品牌栏直接 `hidden`），`[data-auth="footer"]` 绝对定位在底部（`lg` 起左对齐，跟品牌栏共用同一组水平内边距）。注意 `card` 这个钩子的语义已经从"视口正中那张卡片"变成"铺满视口宽度的分栏行"，几何断言要按这个来写。

品牌栏右侧默认是一台界面示意（`[data-auth="slogan-visual"]`：窗口栏 + 侧边栏 + 三张 KPI 卡 + 12 根柱状 + 表格行），柱高是组件内写死的一组装饰值 —— 认证外壳刻意不接数据源，真接就得认识 store。`#sloganVisual` 插槽可以整块换掉，传了 `sloganImage` 则换成图片。`brandBadge` 是大标题上方那行引导语（如「企业级中后台解决方案」）：分栏版式的左栏是整屏高度的画布，光一句标题压不住那半屏空白。光斑漂移与网格视差是 28–40s 的慢周期动效，`prefers-reduced-motion: reduce` 下全部 `animation: none`。

`AuthSocialItem.icon` 有两种形态：**字符串**按 iconify 图标名解析，**Vue 组件**原样渲染。组件形态是给"图标不在 iconify 离线集里"的场景留的口子 —— 品牌 logo 只能宿主自带。登录 / 注册页那四枚（GitHub / WeChat / QQ / Google）走的就是这条路：SVG 放在 `apps/web/src/assets/icons/`，`vite-plugin-svg-icons` 把它们打成 `#icon-<文件名>` 的雪碧图（注册脚本是 `main.ts` 里的 `import 'virtual:svg-icons-register'`），再用 `@antdv/icons` 的 `SvgIcon` 包一层：

```ts
import type { AuthSocialItem } from '@antdv/common-ui';

import { h } from 'vue';

import { SvgIcon } from '@antdv/icons';

const socialIcon = (name: string) => () => h(SvgIcon, { name, size: 18 });

export const AUTH_SOCIAL_ITEMS: AuthSocialItem[] = [
  { icon: socialIcon('github'), label: 'GitHub', value: 'github' },
];
```

::: warning 组件形态自己负责尺寸

`AuthSocialLogin` 只给最外层那圈 `size-[18px]` 类名，压不住 `SvgIcon` 写在内联 style 上的宽高（不给 `size` 就是默认的 16px），所以宿主必须显式传 `size`。:::

真实用例：`apps/web/src/config/auth-social.ts`（四枚雪碧图入口，登录与注册共用）与 `apps/web/src/views/login/index.vue`。

## MicroAppContainer（微前端容器）

`components/micro-app-container/MicroAppContainer.vue` 给 `@micro-zoe/micro-app` 的 `<micro-app>` 自定义元素套了一层声明式外壳：加载遮罩、失败重试、未配置地址的占位。SDK 在运行时给每个实例派发 `beforeload-${name}` / `mounted-${name}` / `unmount-${name}` / `error-${name}` 四个 **window** 事件，组件用 `useEventListener` 把它们收敛成 Vue 的 emits（`:76-79`，卸载自动解绑）。

props（`types.ts:1-11`，默认值 `MicroAppContainer.vue:20-26`）：

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `name` | `string` | 必填 | micro-app 实例名，同时是事件名前缀 |
| `url` | `string` | `undefined` | 子应用入口地址；不传时 800ms 后显示「未配置应用地址」占位（`:82-92`） |
| `className` | `string` | `undefined` | 追加到根节点，根类名是 `micro-app-container relative size-full` |
| `baseroute` | `string` | `undefined` | 透传给 `<micro-app>` |
| `keepAlive` | `boolean` | 未设默认 | 透传成 `keep-alive` 属性 |
| `disableMemoryRouter` | `boolean` | `true` | 透传 `disable-memory-router` |
| `disablePatchRequest` | `boolean` | `false` | 透传 `disable-patch-request` |

事件：`beforeload`、`mounted`、`unmount` 无参，`error` 带一个 `Error`（`types.ts:13-18`）—— SDK 给的是 `CustomEvent`，组件从 `detail.message` 取文案，取不到就回落成 `子应用 ${name} 加载失败`（`:61-67`）。

::: warning

`<micro-app>` 标签不是组件 `<micro-app>` 由 `internal/vite-config` 的 `isCustomElement` 认下（`MicroAppContainer.vue:17-18` 的注释），所以不需要在任何 `componentMap` 里注册；把它当局部组件声明反而会触发 `Failed to resolve component`。**没有装 micro-app SDK 的宿主工程里这一页只是外壳**：遮罩与占位照常渲染，`<micro-app>` 退化成未知标签，不会有任何子应用挂载。重试按钮只翻本地状态（`handleRetry` 仅重置 `loading`/`hasError`/`retryCount`，`:69-73`），不会重新触发 SDK 的加载流程。:::

::: warning

这个组件目前还没有消费者 应用侧真正在跑的嵌入页是 `apps/web/src/views/micro-app/SubAppView.vue`，它自己直接写 `<micro-app>`（`:286`）并另有一套 loading/error 状态（`hasError` 在 `:29`，处理函数 `:136-164`，加载/错误兜底 UI `:308-332`），没有引本组件。本组件是从 `apps/web/src/components/business/` 迁进来的通用外壳，迁移动机是"可复用"，但目前**复用它的地方是零** —— 用之前先确认要不要顺手把 SubAppView 改成消费它，别再加第三份。:::

## 图表：`@antdv/common-ui/charts`

`ECharts` 是这个包唯一的子路径导出，三个 prop（`option` 必填 / `height` 默认 `'320px'` / `loading` 默认 `false`），没有事件也不 `defineExpose`。完整行为拆解在[图表与 Cron](/components/chart-cron)的图表小节，这里只登记它为什么单独一条出口：`import * as echarts from 'echarts'` 会把全量注册表带进模块图，不该让所有 `@antdv/common-ui` 消费者买单。

## Toaster（提示容器）

`components/toast/Toaster.vue`（201 行）是 vue-sonner `Toaster` 的主题化外壳：props 就是 `ToasterProps`（`index.ts` 把它转口出来），`v-bind="props"` 原样透传，只额外盖三层东西 —— `--normal-*` 变量组（`:43-48`）、`toastOptions.classes`（`:58-63`，与宿主的逐档合并）、六档"具名插槽 + 默认内容"的状态徽标（`:96-165`）。配色规范、两只 toaster 的分工与 `message` / `notification` 的关系都写在[弹窗与抽屉](/components/modal-drawer)的「轻提示与通知」一节，这里只说它为什么在本包。

::: warning 样式层不放在 `@antdv/shadcn-ui` 里

shadcn 那只 `Sonner.vue` 把 `rich-colors` 写死在 `v-bind` 之后、状态图标写死在插槽里，外部既传不进也传不出；不改它源码就只能用选择器去赌它选了哪几个 lucide 图标，子包一升级就失效。所以本包直接以 vue-sonner 为底座自建外壳，`@antdv/shadcn-ui` 一行未动，它新增/删除/迭代组件都波及不到这里。宿主侧对应地只换 import 来源：`import { Toaster } from '@antdv/common-ui'`。:::

## 其余条目一览

这些组件的示例与坑散在各路由页里，此处只给签名，避免重复。

| 组件 | props（默认值） | 事件 / 插槽 |
| --- | --- | --- |
| `Alert` | `type`(`'info'`)、`message`、`description`、`showIcon`(true)、`variant` | 插槽 `title`（默认取 `message`）、`default`；error 时根 variant 回退 `destructive` |
| `Card` | `title`、`description`、`variant`(`'outlined' \| 'borderless'`)、`bodyClass` | 插槽 `title`、`extra`、`footer`、`default`；有 title/description/extra 才出头部 |
| `Divider` | `type`(`'horizontal'`)、`dashed`(false)、`titlePlacement` | 默认插槽当分割线文字 |
| `Segmented` | `options`(`(SegmentedOption \| string)[]`)、`value`、`size`(`'middle'`)、`block`(false)、`disabled`(false) | `change`、`update:value`；`SegmentedOption = { label, value, icon?, disabled? }` |
| `Space` | `direction`(`'horizontal'`)、`size`(`'small'`，可 `'large' \| 'middle' \| number`)、`align`、`wrap`(false) | large 24 / middle 16 / small 8 |
| `Statistic` | `title`、`value`、`precision`、`prefix`、`suffix`、`decimalSeparator`(`'.'`)、`groupSeparator`(`','`)、`loading`(false)、`valueStyle` | 插槽 `title`、`prefix`、`suffix`、`formatter`、`default` |
| `Tag` | `color`、`bordered`(true) | `color` 命中预设名（blue / cyan / default / geekblue / gold / green / lime / magenta / orange / purple / red / volcano）用预设类名，否则当自定义背景色（字面量表 `PRESET`） |
| `Popconfirm` | `title`、`description`、`okText`(`'确定'`)、`cancelText`(`'取消'`)、`danger`(false)、`placement`(`'top'`，只有 `top \| bottom \| left \| right`)、`disabled`、`v-model:open` | `confirm`、`cancel`；插槽 `title`、`description`、`default`（触发元素） |
| `Timeline` / `TimelineItem` | Timeline：`mode`、`labelPlacement`、`pending`(`boolean \| string`)、`reverse`。Item：`color`(`'blue'`)、`label`、`position` | Item 插槽 `dot`、`label`、`default`；父子通过 `TIMELINE_KEY` 通信 |
| `Tree` | `treeData`、`checkable`(false)、`selectable`(true)、`blockNode`(false)、`checkedKeys` / `expandedKeys` / `selectedKeys`（三个都有 `v-model:`）与对应 `default*`、`defaultExpandAll`(false)、`fieldNames` | `check`、`expand`、`select` + 三个 `update:*Keys`；内部递归组件 `tree/TreeNodes.vue` |

## 这个包的八条约定

写错不会报错，只会静默失效 —— 这几条都是从行为验证出来的。

| 约定 | 为什么 |
| --- | --- |
| `Checkbox` / `Switch` 永远用 `:model-value` + `@update:model-value`（或直接 `v-model`） | 这两个原语**不在本包的 barrel 里**，来自 `@antdv/shadcn-ui`（`packages/core/ui-kit/shadcn-ui/src/index.ts:15`、`:58`），组件体只是把 props / emits 原样 `useForwardPropsEmits` 给 reka-ui 的 `CheckboxRoot` / `SwitchRoot`，reka v2 的模型名是 `modelValue`。写 `:checked` 会被忽略（勾选框永远停在初始值），写 `@change` 收不到。仓库里的正确写法：`apps/web/src/views/account/settings/index.vue:286-291`。会混淆是因为 antdv-next 的 `Switch` 才是 `:checked` —— 但仓库里已经没有任何文件再从 `antdv-next` 引 `Switch`（实测 `grep -rn Switch \| grep antdv-next` 零命中），早先欠这笔债的 `SettingDrawer/**` 目录也不存在了，设置抽屉现在是 `packages/layouts/src/widgets/setting-drawer/**`，`Switch` 取自 `@antdv/shadcn-ui` |
| `<TabPane value="...">`，不是 `key` | `TabPane.vue:13` 的必填 prop 叫 `value`；`key` 被 Vue 吃掉，pane 注册成 `undefined`（见上方 Tabs 小节） |
| `Popconfirm` 用 `danger`，不是 `ok-type="danger"` | `popconfirm/Popconfirm.vue:22` 声明的就是 `danger?: boolean`（默认 `false` 在 `:33`）；`okType` 这个 prop 全文件不存在，传了不报错也不生效 |
| `Modal.confirm` → `confirm()`；`message` → 也从 `@antdv/popup-ui` 拿 | `packages/core/ui-kit/popup-ui/src/index.ts` 就四行 `export *`（`:1-4`：alert、drawer、message、modal）加类型，四个入口都在那个包。应用侧 **44 个文件**引 `@antdv/popup-ui`（口径：`grep -rl "@antdv/popup-ui" apps/web/src \| wc -l` = 44，其中 `.vue` 39 个；分布是 views 35 / components 5 / utils 2 / plugins 1 / 根 `App.vue` 1），`@antdv/layouts` 的 widgets 里另有 5 个（`notification`、`account-drawer`、`logout`、`setting-drawer/index.vue`、`setting-drawer/components/setting-footer.vue`）。典型写法 `import { confirm, message } from '@antdv/popup-ui'`（如 `apps/web/src/views/account/center/index.vue:19`） |
| Tailwind 只认**字面量类名** | 状态 → 颜色一律查表（`Badge.vue:37-44` 的 `STATUS_DOT`、`Steps.vue:37-43` 的 `CIRCLE`、`Tag.vue` 的 `PRESET`），不要 `bg-${color}-500` 拼接，也不要指望扫描器认识动态串 |
| 模板里不要写 `cn(...)` 并带尾逗号 | `<div :class="cn('a', 'b',)">` 这种写法会让模板表达式解析失败；把 `cn()` 收进 `<script setup>` 里的 `computed` / 常量，模板只引用变量名（示例页全部是这个形态） |
| BEM 钩子类（`border-beam`、`listy`）写在静态 `class` 上，不进 `cn()` | `twMerge` 按"工具类家族"消解冲突：`border-beam` 被认成 `border-{color}` 一档、`listy` 被认成 `list-{type}` 一档。调用方传 `border-border` 或 `list-none` 时会把钩子类整条吃掉，组件的环 / 行样式当场消失。钩子类位置：`BorderBeam.vue:49`（注释在 `:53-57`）、`Listy.vue:314`（注释在 `:323-326`）；回归单测 `common-ui/__tests__/border-beam.test.ts:77-79`、`common-ui/__tests__/listy.test.ts:133-136` |
| `<template>` 根元素之前不要放注释 | dev 构建保留注释节点，根节点前多一条注释就等于模板变成 Fragment：`wrapper.classes()` 为空、非 prop 的 `class` / `style` 也不再自动继承。要写说明就放进根元素内部（这两个新组件都踩过这条） |

## 与 antdv-next 的关系

这个包**不 import antdv-next**，workspace 依赖只有 `@antdv/icons`、`@antdv/popup-ui`、`@antdv/request`、`@antdv/shadcn-ui`、`@antdv/shared` 五个，外部依赖是 `@vueuse/core`、`cronstrue`、`es-toolkit`、`marked`、`vue`、`vue-sonner`、`@iconify/vue`、`@lucide/vue` 与 tiptap 那一组，加上只服务 `./charts` 子路径的 `echarts`（`packages/core/ui-kit/common-ui/package.json`）。`@antdv/request` 与 `@antdv/popup-ui` 都只在 MarkdownEditor 那条上传/报错链上出现（`markdown-editor/utils.ts:1-2`、`MarkdownEditor.vue:20`），引的是 `request` 和 `message` —— 不是 store，也不是路由。换宿主工程只要装上这几个 workspace 包就能跑，机制见[外部模块](/guide/essentials/external)。

::: tip

`antdv-next` 已经从可执行代码里清零 口径：把「导入形态」（`from 'antdv-next'` / `import('antdv-next')` / `@antdv-next/*`）当正则扫 `apps` + `packages` + `internal` 的 `*.ts` / `*.mts` / `*.tsx` / `*.vue` / `*.js`，命中 3 条，**全部在 `__tests__` 目录里且全是字符串** —— 守卫用例自己喂进去的正/反例样本（`apps/web/src/views/__tests__/gallery-api-usage.spec.ts:156`、`:159`）和一条注释（`packages/core/hooks/__tests__/boundary.test.ts:14`）。去掉测试目录之后是**零命中**。`apps/web` 那侧曾经的四处落脚点已经逐个拆掉：给 `@form-create/antd-designer` 手工登记 36 个 `a-*` 名字的 `plugins/vendor-antd-components.ts` 连同表单设计器一起删除；`settings/theme/` 整目录没了，`apps/web/src/settings/index.ts` 只剩「偏好 → DOM」这一条链路，注释（`:9-14`）明确写着不再翻译任何 UI 库的 `ThemeConfig`；`App.vue:3-7` 现在从 `@antdv/common-ui` 取 `ConfigProvider` 与 `Toaster`；`views/screen/components/ScreenHeader.vue:4-5` 的全屏图标改成了 `@iconify/vue` 的 `Icon`。构建层同样干净：`createOptimizeDeps()` 的白名单是 `['@vueuse/core', 'es-toolkit']`（`internal/vite-config/src/config/application.ts:59-66`），`internal/vite-config/src/optimize.ts` 里既没有 `antdv-next` 也没有 `vendor-ui` 分桶。:::

剩下的字面命中分三类，都不是依赖：`packages/core/base/shared/src/cache/tokenCrypto.ts:13`、`:60` 里的 `'antdv-next-token-*'` 是历史缓存键（改了会让已登录用户掉线，属于刻意保留，边界守卫也不拦字符串）；守卫测试（`gallery-api-usage.spec.ts:122` 的合并正则、`packages/core/base/icons/__tests__/icons.test.ts:30-32`、`packages/core/base/design/__tests__/design.test.ts:462`、`:587`、`packages/request/__tests__/structure.spec.ts:46`）把它当**反例**写死，是防止有人塞回去的保险丝；`internal/vite-config/__tests__/config.test.ts:133-137` 甚至留了一条 `/node_modules/antdv-next/es/button/index.js` 的断言，要求它落进兜底的 `vendor` 桶 —— 注释说明这是"防止有人把 antd 塞回构建又不补分组规则"。除此之外仓库里出现的 `antdv-next.com` 全是 mock 菜单的示例外链与测试 fixture，`antdv-next-admin` 是仓库名本身。

## 相关页面

- [组件示例](/components/) —— 示例页路由与打开方式
- [设计令牌与全局样式](/guide/essentials/design) —— 本包组件用的 `--*` 变量、`@source` 登记规则
- [数据与展示](/components/display) —— `Description` / `CountTo` 的示例页与坑
- [编辑器与文件上传](/components/editor-upload) —— `Upload` / `Image` / 裁剪的示例页
- [图表与 Cron](/components/chart-cron) —— `CronEditor` 示例页
- [弹窗与抽屉](/components/modal-drawer) —— `confirm()` / `message` 来自 `@antdv/popup-ui`
- [表格](/components/table) —— `Tag` / `Space` / `Popconfirm` 在表格操作列里的用法
