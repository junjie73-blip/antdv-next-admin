# 表单

`BasicForm` 是「schema 驱动 + 命令式实例」的表单容器：字段配置进 `schemas`，值存在底层表单实例里，页面通过 `@register` 拿到 `useForm()` 的那组方法去读写和校验。底座是 `@tanstack/vue-form`（`useForm` / `useField` 负责值、字段元信息与校验调度），label、栅格行、错误文案与二十来个字段控件全部由本包自己渲染，不再借 `a-form` / `a-form-item` 的 DOM 与规则引擎。它解决的仍是后台表单的三件重复劳动 —— 栅格排版、字段显隐/联动、取值拼装。

源码：`packages/core/ui-kit/form-ui/src/`（`components/form-render/form.vue` 625 行、`form-field.vue` 288 行、`helper.ts` / `utils.ts` / `schema.ts` / `context.ts`、`components/form-actions.vue`、`fields/F*.vue` 十六个字段控件、`config.ts`、`rule-registry.ts`、`use-antdv-form.ts`、`types.ts`）。导出面 `src/index.ts:1-43`：`BasicForm` / `FormItem`（其实是 `form-field.vue`）/ `useForm` / `componentMap` / `addComponent` / `getComponent` / `runRule` / `compileFieldValidator` / `deepMerge` / `formatDateFields` / `handleRangeValue` 与那批类型。

## useForm：注册与实例

```ts
// packages/core/ui-kit/form-ui/src/types.ts:116-119
export type UseFormReturnType = [
  register: (instance: FormActionType) => void,
  methods: FormActionType,
];
```

和表格的 `useTable` 不一样：第二个返回值是**方法对象本体**，不是 `Ref`，可以直接解构（`views/components/form/basic/index.vue:175-176`）。

```vue
<script setup lang="ts">
import type { FormSchema } from '@antdv/form-ui';
import { BasicForm, useForm } from '@antdv/form-ui';

const schemas: FormSchema[] = [
  {
    field: 'username',
    label: '用户',
    component: 'Input',
    required: true,
    colProps: { span: 12 },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    defaultValue: 'active',
  },
];

const [register, { validate, setFieldsValue, getFieldsValue }] = useForm({
  schemas,
  labelWidth: 100,
  showAdvancedButton: true,
  alwaysShowLines: 2,
});
</script>

<template>
  <BasicForm @register="register" @submit="(values) => console.log(values)" />
</template>
```

`register` 在组件 `onMounted` 时才发出（`form.vue:623-626`），同一个实例也在 `defineExpose` 上（`form.vue:632`），所以模板 ref 拿到的是同一组方法。`useForm` 收到实例的那一刻做三件事：记引用、把 `useForm(props)` 攒下的初始配置 `setProps` 进去、兑现挂载前攒下的待写入值（`use-antdv-form.ts:32-41`）。

::: tip

待写入队列：`setFieldsValue` 在没挂载时也不会丢 `useForm` 对 `setFieldsValue` / `resetFields` 会先判断实例是否还挂在组件树上（活实例判定 `use-antdv-form.ts:25-30`，依据是组件的 `isMounted`：`form.vue:589,535` 置位、`:623-630` 翻转），实例是死的就先把值**累加**进 `pendingValues`（`:53-64`，注释在 `:17-23`），等下一次 `register` 再补写。`resetFields` 会先把队列清空（`:66-73`），避免下次挂载被旧数据盖回来。这套队列专门救「先灌值、再 `openModal`」的写法：弹窗默认销毁内容，写进上一次 register 的死对象是静默失败的。行为有单测覆盖（`form-ui/__tests__/useForm.test.ts:37,52,67,76`）。
:::

::: warning

队列只保护写值，不保护校验和取值只有 `setFieldsValue` / `resetFields` 走活实例判定；`getFieldsValue`、`validate`、`validateFields`、`updateSchema` 等用的是不校验挂载状态的 `getFormInstance()`（`use-antdv-form.ts:43-45,47-136`）。表单没挂载时 **`validate()` 不报错，直接返回 `{}`**（`:75-81`）—— 拿它当「校验通过」的判断条件会永远为真。
:::

**没有 `useModalForm` / `useDrawerForm`。** 表单模块不提供弹窗/抽屉的桥接（`src/index.ts:1-43` 里没有，全仓也搜不到这两个名字）；`views/system/*` 的做法就是页面自己写一份 schema 再用模板 prop 挂上去。

## FormProps 常字段

类型定义 `types.ts:38-71`；带运行期默认值的只有 8 个键（`form.vue:36-45`）：`showActionButtonGroup` / `showSubmitButton` / `showResetButton` / `submitOnReset` / `autoSubmitOnEnter` / `labelAlign: 'right'` / `colon: false` / `scrollToFirstError: true`。

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `schemas` | — | 字段配置；`setProps` 把它从合并逻辑里单独摘出来做整体替换（`form.vue:572-582`） |
| `grid` | — | `{ cols, gutter }`；`cols` 只接受 1-4，越界静默回落到响应式列数（`form.vue:163-168`），断点是写死的 Tailwind 值（`:60-67`：`<sm` 1 列 / `<md` 2 列 / `<xl` 3 列 / 其余 4 列），`responsive` 无人读 |
| `labelWidth` / `labelCol` | `labelCol: { span: 4 }` | 给了 `labelWidth` 就走 `style.width`，`labelCol` 被忽略（`form.vue:201-207`）；`labelCol.span` 换成百分比宽度（`form-field.vue:175-182`） |
| `wrapperCol` | `{ span: 18 }` | 只进了 context（`form.vue:213`），**字段渲染并不读它** —— 起作用的是 `itemProps.wrapperCol.style`（`form-field.vue:168-171`） |
| `size` | — | 声明在 `types.ts:51`，全模块没人读；控件尺寸得逐个字段用 `componentProps` 调 |
| `disabled` | — | 表单级禁用，与 `dynamicDisabled` 取或（`form-field.vue:74-84`），并禁用两颗动作按钮（`form.vue:680`） |
| `showActionButtonGroup` / `showSubmitButton` / `showResetButton` | 都是 `true` | 动作区整块和两颗按钮（`form.vue:672-699`、`form-actions.vue:61-105`） |
| `submitButtonOptions` / `resetButtonOptions` | 文案 `查询` / `重置`，图标 `carbon:search` / `carbon:restart` | **`text` / `preIcon` / `disabled` 生效**（`form.vue:340-350` 合并默认，`form-actions.vue:67-93` 绑定）；`loading` / `postIcon` / `iconSize` / `onClick` 声明在 `schema.ts:65-73` 但没人读 |
| `actionColOptions` | — | 只有 `style` 会被读（`form.vue:677`），它是盖在动作区那个栅格单元上的最后一层样式（`form-actions.vue:56`），能改 `width` / `margin-left` 来覆盖行内末尾的默认排布 |
| `submitOnReset` | `true` | 重置后自动再提交一次（`form.vue:469-481`） |
| `resetFunc` | — | **给了就直接走它并 `return`**，不再重置也不再提交（`form.vue:470-473`） |
| `showAdvancedButton` / `alwaysShowLines` | 关 / `3` | 折叠按**行数**算，不是字段数（`form.vue:226,281-294`） |
| `fieldMapToTime` | — | `[字段, [起, 止], 格式?]`，把区间拆成两个字段并删掉原字段（`utils.ts:65-96`）；第三个分量认 `timestamp`、`timestampStartDay`，缺省按 `YYYY-MM-DD` 出串 |
| `submitFunc` | — | 提交时优先于 `@submit`，但仍排在模板 `onFinish` 之后（`form.vue:455-461`） |
| `baseRowStyle` | — | 摊进行容器的 `:style`（`form.vue:307-320`） |
| `gutter` 相关 | 水平 24 / 行间距 16 | 行容器吃负边距、字段吃一半内边距（`form.vue:172-194`、`form-field.vue:137-151`）；`gutter` 单值时垂直为 0，所以兜了 `DEFAULT_ROW_GAP_PX = 16`（`:183-194`） |

::: warning

声明了但没人读的 FormProps 以下字段在 `types.ts:38-71` 里是合法配置项，全模块搜不到任何使用点（`autoSubmitOnEnter` 只出现在 `form.vue:41` 的默认值里，没有键盘监听）：

- `model` —— 表单值一律存在底层 `@tanstack/vue-form` 实例里，外部传进来的初始对象不会被读，也不会被同步回去。
- `baseColProps`、`autoFocusFirstItem`、`compact`、`autoSetPlaceHolder`、`autoAdvancedLine`、`mergeDynamicData`、`size`。
- 顶层 `rulesMessageJoinLabel` —— 起作用的是 **schema 上那一份**（`helper.ts:156,185`，另见 `rule-registry.ts:161-164`）。

`colon` 与 `scrollToFirstError` 已经不是死字段：前者进 context 决定 label 后要不要补冒号（`form-field.vue:186`、`form-label.vue:57`），后者决定校验失败时是否滚到第一个错误字段（`form.vue:414-416`、`:524-529`）。两者都可以用 `setProps` 改。
:::

## setProps 的「目标优先」

`deepMerge` 是这个模块所有合并的底座，它的冲突规则写在文件头注释里（`utils.ts:5-11`，`deepMerge` 本体 `:20-55`）：**保留 target**。四条实际后果：

| 情况 | 结果 | 源码 |
| --- | --- | --- |
| target 没有这个键（或值为 `undefined`） | 写入（数组/纯对象做浅拷贝） | `utils.ts:32-39` |
| target 已有标量/函数，source 给新值 | **忽略新值** | `utils.ts:5-11`（落到循环末尾无事发生） |
| target 已有数组 | **保留旧数组**，即使 source 给了新数组 | `utils.ts:41` |
| target 没有数组、source 给数组 | 用 source 的数组替换 | `utils.ts:43-46` |
| 两边都是纯对象 | 递归合并（内部仍按上面几条） | `utils.ts:48-51` |

因为 `setProps` 把 target 定成**上一次的 `propsRef`**（`form.vue:572-582`），而 `getProps` 把 target 定成**模板 props**（`form.vue:150-160`），于是：

- `withDefaults` 给了默认值的那 8 个键（`form.vue:36-45`），`setProps` / `useForm(props)` **永远改不动**，只能在模板上直接传 prop。分步表示例页把这条印在了界面上（`views/components/form/steps/index.vue:69-76`）。
- 同一个键的第二次 `setProps` 也是空操作；数组型配置（`fieldMapToTime`）第一次之后就再也换不掉。
- `schemas` 不受影响，它是整体替换（`form.vue:578-581`）。
- `updateSchema` 同一个坑：它是 `deepMerge(旧 schema, 补丁)`（`form.vue:531-543`），所以改 `label`、换 `ifShow` 函数、换整份 `rules` 数组都会被旧值顶掉，只有**新增键**和嵌套纯对象写得进去。

::: tip

想真正换掉一个已有配置把整份 `schemas` 数组重算一遍再 `setProps({ schemas })`（分步表单就是这么做的，`views/components/form/steps/index.vue:134,200,225`），或者直接用模板 prop 绑一个 `computed`（`views/components/form/validation/index.vue` 的四份 schema 就是四份独立常量）。
:::

## FormSchema：字段配置

定义在 `schema.ts:86-136`（`BaseFormSchema` 86-126，`FormSchema` 128-136 加 `component` / `componentProps`）。每个回调都能拿到 `{ schema, values, model, field }`（`RenderCallbackParams`，`schema.ts:58-63`）。

| 字段 | 生效条件与出处 |
| --- | --- |
| `field` | 必填；没有 `field` 又不是 `Divider` 的 schema 会被行分组**直接丢弃**（`form.vue:259`） |
| `component` | 查 `componentMap` 的字符串键（见下一节） |
| `componentProps` | 对象或函数；**写成函数时走 `helper.ts:69-76` 直接返回，不再自动补 placeholder / allowClear** |
| `required` | 仓库唯一自带的「规则简写」，展开成一条 `{ required: true, message }` 插到规则最前（`helper.ts:181-189`），同时驱动星号（`form-field.vue:110-114`） |
| `rulesMessageJoinLabel` | 为真时必填文案变成 `${label}不能为空`，否则是 `'该项为必填项'`（`helper.ts:185`、`rule-registry.ts:86`） |
| `rules` | 交给自有的 `runRule` 逐条执行（`rule-registry.ts:73-147`）；`pattern` 不是 RegExp 的规则会被**丢弃并 console.warn**（`helper.ts:169-179`） |
| `dynamicRules` | 函数形式**整份接管**该字段规则，`rules` 与 `required` 都不再参与（`helper.ts:158-165`） |
| `ifShow` | 假值时根节点 `v-if` 不渲染（`form-field.vue:225`）—— 但字段仍在底层表单里，**照样参与校验**（校验候选来自 `schemas`：`form.vue:383-386`） |
| `show` | 只是 `v-show`（`form-field.vue:226`），同样参与校验 |
| `dynamicDisabled` | 结果绑成控件的 `disabled`（`form-field.vue:74-84,261`）；不写时它是 `false`，于是 `componentProps.disabled` 会被顶掉（显式绑定在 `v-bind` 之后） |
| `colProps.span` | 缺省取 `floor(24 / 实际列数)`（`form.vue:170`、`form-field.vue:142-145`），换算成 `width: span/24` 的百分比（`:147-155`） |
| `itemProps` | **只有三个键有用**：`required`（补星号，`form-field.vue:112`）、`style`（并进根节点样式 `:152`）、`wrapperCol.style`（并进控件列 `:163-173`）。类型是宽松的 `Record<string, any>`（`schema.ts:56`），其余键（含 `validateTrigger`）不落任何地方 |
| `fullRowAlign` | **只在 `grid.cols > 1` 且该字段独占整行时生效**（`form-field.vue:157-173`）；效果是 `wrapperStyle.maxWidth = calc(100% - gutter)` |
| `suffix` | 渲染进控件的 `#suffix`（`form-field.vue:121-135,265-269`）；字段控件里**只有 `FInput` 系声明了这个插槽**，其余控件传了不显示。`slot` 字段和 `Divider` 拿不到它 |
| `helpMessage` | 字符串或数组（数组用 `\n` 拼接，`form-label.vue:43-47`），渲染成 label 后的 tooltip；`helpComponentProps`（`schema.ts:75-84`）**没人读**，气泡宽度是写死的 280px（`form-label.vue:66-71`） |
| `slot` | 该字段的内容改为渲染页面同名插槽，作用域参数是 `{ model, field }`（`form-field.vue:247-253`）；`model` 是一个**代理**，写它会走底层 `setFieldValue`（`form.vue:97-127`），转发链路 `form.vue:661-667` |
| `defaultValue` | 挂载、每次 `setProps({ schemas })` 与 `appendSchemaByField` 都会重灌一遍（`form.vue:358-367`，调用点 `:569,580,617`），也是 `resetFields` 的目标（`:489-492`） |

::: warning

schema 上这些字段是死的 `subLabel`、`emptySpan`、`disabledLabelWidth`、`render`、`renderColContent`、`renderComponentContent`、`colSlot`、`isAdvanced`、`children`、`changeEvent`、`helpComponentProps`（`schema.ts:86-126` 里都在，`form.vue` / `form-field.vue` / `helper.ts` 一个都没读）。尤其别按 vue-vben-admin 的经验去写 `render` / `colSlot` —— 这里的 `form-field.vue` 只有 `slot` 一条自定义渲染路径（`:247-253`），`render` 写了不报错，也不显示。规则级的 `trigger` 同样只是兼容字段：本实现统一在 change（且仅限首次提交之后）与 submit 两个时机跑（`schema.ts:39-40`、`form-field.vue:38-45`）。
:::

## 组件解析：只查 `componentMap`

`component` 这个字符串**唯一的解析路径**是 `componentMap` 这张表：`getComponentInstance` → `getComponent(schema.component)`（`form-field.vue:116-119` → `config.ts:107-109`）。内置键就是 `ComponentType` 那 28 个（`config.ts:22-50`，注册表 `:67-101`）。

::: tip

和 `types/components.d.ts` 没有关系 `apps/web/types/components.d.ts` 是 `unplugin-vue-components` 扫目录得到的**模板标签**产物，schema 解析完全不经过它。写 `component: 'AInput'` 或任何不在表里的名字，`getComponent` 返回 `undefined`，字段既不报错也不警告，直接退化成一行纯文本 <code v-pre>{{ formModel[field] }}</code>（`form-field.vue:274-276`，取值与序列化在 `:215-220`，对象走 `JSON.stringify`）。
:::

几个容易误会的点：

- **别名现在是真的别名**：`MonthPicker` / `WeekPicker` / `RangePicker` / `TimeRangePicker` / `RadioButtonGroup` / `CheckboxGroup` / `InputPassword` / `InputSearch` 都由 `withProps`（`config.ts:52-65`）把基础控件包一层固定 props —— 月份面板与周面板来自 `{ picker: 'month' | 'week' }`（`:87,89`），区间来自 `{ range: true }`（`:88,91`），不用再自己写进 `componentProps`。`InputGroup` 与 `InputTextArea` 是没有固定 props 的纯改名（`:69` 的 `InputGroup: FInput`、`:72` 的 `InputTextArea: FTextarea`）。
- **`Divider` 走不到 `componentMap`**：`form.vue` 在按行分组时就把 `component === 'Divider'` 单独摘出来占一整行（`form.vue:261-265`），模板里渲染成 `Separator` + 文案（`:643-653`，`Separator` 来自 `@antdv/shadcn-ui`，`:23`），`config.ts:95` 那条注册项没人用。**分割线现在留在原地**（它 flush 当前行后插进 `rows`），不再排到全部字段之后；`label` 变成分割线文案，`componentProps` 在这条路径上不被读取。
- **注册自定义字段**：`addComponent(name, component)`（`config.ts:103-105`）。表是模块级单例，注册一次全局可引用，也**没有反注册 API**；新键不在 `ComponentType` 联合里，要像示例那样收口一次类型（`views/components/form/custom-component/index.vue:40`，注册在 `:96`）。字段组件要满足的契约只有一个：吃 `value` prop、发 `update:value`（`form-field.vue:257-264`；对照 `views/components/form/custom-component/components/TagPickerField.vue`）。
- **单个勾选框现在可用**：`FCheckbox` 按 `options` 是不是数组分流 —— 不传 `options` 时读 `value === true` 的布尔态并发 `update:value`（`fields/FCheckbox.vue:24-35`），不再需要绕 `slot`。`Switch` 同理（`fields/FSwitch.vue`）。
- **`ASelect` / `ATreeSelect` 现在没有 `api`**：这两个键在表里就是 `FSelect` / `FTreeSelect` 的**降级壳**（`config.ts:97-99`，注释写明「web 侧会用带数据请求能力的包装组件通过 `addComponent` 覆盖」，但全仓目前只有示例页注册过 `TagPickerField`，没有任何数据请求包装）。`types.ts:125-134` 那个 `ApiSelectProps` 接口（`api` / `resultField` / `labelField` / `valueField` / `numberToString` / `immediate`）在全仓只出现在它自己的定义处，没有任何实现读它 —— 选项一律靠 `componentProps.options` 给，异步取数请自己在页面里把结果灌进 `componentProps` 或注册一个包装组件。

**表格的可编辑列不共用这张表。** `BasicColumn.editComponent` 是 Table 模块自己的 `ComponentType` 联合（17 个键，`packages/core/ui-kit/table-ui/src/types.ts:90-108`），编辑格按名字取组件、取不到就退化成 `Input`（`TableEditableCell.vue:80` 的 `getComponent(name) ?? getComponent('Input')`）。两份联合只是命名对齐（表格那份的 `:89` 注释就是这么写的），表单里的 28 个键写进表格列有一半会静默变成输入框。

## 值、校验与提交

实例方法集合 `FormActionType`（`types.ts:81-114`）的实现都在 `form.vue:357-606`：

| 方法 | 行为 |
| --- | --- |
| `validate(nameList?)` / `validateFields(nameList?)` | 候选字段取自 `schemas`（不取「当前渲染的字段」），逐个跑底层 `validateField(field, 'submit')`，再汇总 `meta.errors` 去重（`form.vue:381-409`）；`validateFields` 就是它（`:440-442`）；**可以只喂一部分字段名**（`collectValues` `:369-378`），分步表单靠这个做「本步校验」 |
| 校验失败 | 抛出 antd 形状的 `{ errorFields, message, outOfDate, values }`（`form.vue:417-430`），`errorFields[i].name` 是**数组**；`scrollToFirstError` 不为 `false` 时先滚到第一个错误字段（`:414-416`） |
| 校验成功 | 返回值已过 `formatDateFields`，并按 `fieldMapToTime` 拆区间（`:365-369`） |
| `submit()` | 等价于点提交按钮，走 `handleSubmit`（`form.vue:445-466`） |
| `getFieldsValue()` | 底层 `state.values` 浅拷贝（`form.vue:500-502`） |
| `setFieldsValue(values)` | 逐键 `setFieldValue`（`form.vue:494-498`），不需要字段当前正渲染 |
| `resetFields()` | `form.reset({ ...defaults })` 退回 `defaultValue`，并清掉「提交过」标记（`form.vue:489-492`） |
| `clearValidate(name?)` | 逐字段把 `errorMap` / `errors` / `isTouched` / `isBlurred` 抹平（`form.vue:504-522`，`errors` 由 `errorMap` 派生，只清 `errors` 无效） |
| `scrollToField(name, options?)` | 按 `[data-field="…"]` 查节点再 `scrollIntoView`，默认 `{ behavior: 'smooth', block: 'center' }`（`form.vue:524-529`） |
| `updateSchema` / `removeSchemaByField` / `appendSchemaByField` | 改 `schemaRef`（`form.vue:531-570`），`updateSchema` 受「目标优先」限制；`remove`/`append` 按 `field` 定位，前缀字段找不到就什么都不做，`append` 之后会重灌默认值（`:569`） |
| `getForm()` | 拿到底层 `@tanstack/vue-form` 实例（`form.vue:584-586`，类型注释就在 `types.ts:106-107`） |
| `setProps(partial)` | 见上面那节 |
| `isMounted()` | 给 `useForm` 用的挂载标记（`form.vue:589,535,553-560`） |

- **两条校验时机**：`onSubmitAsync` 每次都跑；`onChangeAsync` **只在首次提交之后**才跑（`form-field.vue:38-45`）。原因写在注释里：抽屉/弹窗打开时 `setFieldsValue` 灌初值会把字段标成 touched，change 校验一跑就是一屏「该项为必填项」。错误文案的展示条件是 `isTouched || isBlurred || submitAttempted`（`form-field.vue:188-195`）。
- **`runRule` 覆盖的是 async-validator 的常用子集**：`required`（含 `whitespace`）、`transform`、自定义 `validator`（reject 与 callback 两种写法都接，且**空值也照跑**，跨字段一致性和「必须选中」全靠这条，`rule-registry.ts:89-108`）、非必填空值跳过后续内置规则（`:110-111`）、`type`（`email` / `url` / `number` / `integer` / `float` / `array` / `object` / `regexp` / `string` / `boolean`，`:19-60`）、`pattern`、`len` / `min` / `max`（数字比大小、字符串与数组比长度，`:125-144`）。默认文案是中文的「该项为必填项 / ${label}类型不正确 / ${label}格式不正确 / 不得少于 N 个字符」。
- **提交优先级**：模板透传的 `onFinish` > `submitFunc` > `emit('submit', values)`（`form.vue:455-461`）。校验失败被 `catch` 吞掉，只在控制台 `console.error('Form submit error:', …)`（`:463-465`），**不会二次抛出**，所以想拿失败详情要自己 `await validate()`，别依赖 `@submit`。
- **重置**：先看 `resetFunc`（给了就只跑它），否则取改动前的值快照 → `resetFields()` → 按 `submitOnReset` 决定是再提交一次还是 `emit('reset', 快照)`（`form.vue:469-481`）。
- **日期值**：`formatDateFields` 只对 `DATE_COMPONENTS` 那 6 个组件名生效（`utils.ts:98-105,128-165`），格式取 `componentProps.valueFormat` → `format` → `'YYYY-MM-DD HH:mm:ss'`；dayjs 与 `Date` 都吃（`isDayjsOrDate` `:111-122`）；`RangePicker` / `TimeRangePicker` **显式跳过**（`:151-153`），区间交给 `fieldMapToTime`。
- **`fieldMapToTime` 只在值恰好是长度为 2 的数组时生效**，并会 `delete` 掉原字段（`utils.ts:71-93`）。
- **事件只有三个**：`register` / `submit` / `reset`（`form.vue:47-51`）。
- **动作区插槽**：`#submitBefore`、`#resetBefore`、`#actionAfter`（`form-actions.vue:66,79,104`，转发在 `form.vue:690-698`），内置按钮的排布是「提交 → 重置 → 展开/收起」。
- **动作区是栅格单元，不是另起一行**：它挂在最后一个可见行的容器里，宽度取该行剩下的栅格（`actionsSpan = 24 - 末行已占`，`form.vue:331-339`），所以字段没铺满一行时按钮就贴着行尾；末行正好铺满 24、或末行是 `Divider` 时给满 24 并靠 `margin-left: auto` 右对齐独占一行。剩余栅格放不下按钮时靠 `min-width: max-content` + 行容器 `flex-wrap` 整块落到下一行，不会把按钮压扁（`form-actions.vue:48-57`）。折叠与展开读同一个 `rowsWithActions` 的末行，切换只是可见行数变了，不存在两套定位规则，也就不会抖动。
- **配置优先级：模板显式绑定 > `setProps`（含 `useForm(options)`）> 组件默认值**。Vue 会把没传的 Boolean prop cast 成 `false`，`withDefaults` 的默认值也在同一个对象里，所以 `form.vue:139-160` 先用 `vnode.props` 挑出父级真的绑过的键，其余键让给 `setProps` —— 少了这一步，`useForm({ showAdvancedButton: true })` 这类开关会永远打不开。

::: warning

三个方法在仓库里没有任何调用点 `validateFields`、`scrollToField`、`updateSchema` / `appendSchemaByField` / `removeSchemaByField` 在 `apps/web/src` 里除了类型声明和自身实现之外搜不到使用者（表格实例上对应的三个转发方法直接是空函数，见下）。它们是可用 API，但**没有示例或业务页验证过**。
:::

## 和表格搜索区的关系

`BasicTable` 内部就是挂一个 `BasicForm`（`packages/core/ui-kit/table-ui/src/BasicTable.vue:29,1160-1166`），中间层是 `hooks/useTableForm.ts`：

- **`useSearchForm` 单独给 `true` 不够**，搜索区渲染条件是 `useSearchForm && formConfig` 同时为真（`BasicTable.vue:1031`）。
- `formConfig` 被整个摊进表单 props，并补一组默认值（`useTableForm.ts:132-146`），其中 `autoSubmitOnEnter: true`（第 138 行）落在上面那份「没人读」的清单里。
- 表格在 `useSearchForm` 为真时会注入 `submitFunc` / `resetFunc`（`useTableForm.ts:143-146`），**两个现在都真的生效**：`submitFunc` 走 `form.vue:457-458`；`resetFunc` 走 `form.vue:470-473` 的早退分支，于是表格的 `handleReset` 能在重置后把「表格记住的搜索条件」一起清掉 —— `useTableForm.ts:255-276` 那段注释（含「以前 `submitOnReset` 为假时连状态都不动」的历史说明）描述的就是这条修复后的链路。
- 表单配置变了会往 `useForm` 里补 `setProps`（`useTableForm.ts:149-158` 与 `:284-291` 两处 `watch`），但受「目标优先」限制，只有新增键写得进去。
- 表格实例转发的表单方法（`BasicTable.vue:1126-1134`）里，`updateFormSchema` / `appendFormSchema` / `removeFormSchema` 是**空函数** `() => {}`（`:1132-1134`），调用了不会有任何效果；`getFormValues` / `setFormValues` / `resetForm` / `submitForm` / `validateForm` / `getForm` 是通的。

## 在线示例

| 路由 | 内容 |
| --- | --- |
| `#/components/form/basic` | 一张 14 字段的表单（`views/components/form/basic/index.vue:14-174`）：`required` 简写、`rules`、`colProps.span` 两列排版、`showAdvancedButton` + `alwaysShowLines: 2` 的折叠、`fieldMapToTime` 拆 `timeRange`（`:176-190`）。四个按钮分别演示 `validate()` / `resetFields()` / `setFieldsValue()` / `getFieldsValue()`（`:175,200-235`），结果 JSON 打在第二张卡片（`:251-255`）。这一页两张卡片都没写 `variant="borderless"`（`:238,251`），和目录页那条约定不一致 |
| `#/components/form/steps` | 四段，全部**一个 `BasicForm` 实例跑完整条流程**，换步骤靠 `setProps({ schemas })`（`views/components/form/steps/index.vue:22-23,134,200,225`）：① 下一步带本步门禁、最后出本地摘要；② 下一步不校验 + 草稿；③ 步骤条可点回退 + 底部按钮塞进 `#submitBefore` / `#actionAfter`；④ `slot` 字段做表格化多选与只读摘要 |
| `#/components/form/validation` | 四张卡片对应四份 schema：必填与格式（`:394`）、长度与数值区间（`:429`）、异步与跨字段校验（`:470`）、校验时机与结果（`:509`） |
| `#/components/form/custom-component` | 四张卡片：`MarkdownEditor` 内置扩展（`:239`，字段值由 `FMarkdown` 决定，存的是 Markdown 源码）、`addComponent('TagPickerField', …)`（`:254`，注册在 `:96`）、`ifShow`/`show`/`dynamicDisabled`/`dynamicRules` 联动（`:278`）、自定义 `validator` 拦截提交（`:295`） |

::: warning

分步表单的草稿是示例页自己写的键名 `demo:form-steps:draft` 定义在 `views/components/form/steps/index.vue:62`，写/读/删分别是本页的 `saveDraft`、`readStoredDraft` / `restoreDraft`、`clearDraft`（`:534-595` 那一段，直接读写 `localStorage`）。**`BasicForm` 完全没有草稿能力**，`FormProps` 里也没有相关字段；草稿存的是 `{ savedAt, step, values }` 的 `JSON.stringify`，只活在这台浏览器里。同理，「提交」只做整表校验并把值打出来，一个请求都不发。
:::

::: tip 分步的两个硬约束

1. **步骤 schema 上不要写 `defaultValue`** —— 每次 `setProps({ schemas })` 都会重跑 `initFormModel()` 把字段盖回默认值（`form.vue:358-367,508-511`），初值改成挂载前 `setFieldsValue` 灌一次，靠的就是那条待写入队列（`steps/index.vue:96`，机制在 `use-antdv-form.ts:17-23,53-64`）。这条是页面自己的注释写在界面上的（`steps/index.vue:69-76`）。
2. **整表校验必须把别的步骤挂成 `show: false` 再校验**：`validate()` 的候选字段来自 `schemas`（`form.vue:383-386`），所以页面的做法是把各步 schema 拼成一份临时全量表、非当前步骤加 `show: false`（`steps/index.vue:188-200`），失败时按 `errorFields[0].name[0]` 反查该跳回哪一步（`:206-211`）。注意 `ifShow: false` 与 `show: false` **都参与校验**（区别只在渲染），页面注释里「换成 `ifShow: false` 就真卸载了，等于没校验」那句与实测不符；真正不参与校验的是被折叠掉的行（`form.vue:288-294` 把 FormField 整个省掉）和已从 `schemas` 移除的字段。
:::

**校验页里哪些规则是自己写的**：仓库只有一条自带的「规则预设」，就是 `required` 简写（`helper.ts:181-189`）。其余全是 `Rule` 的原生字段（`schema.ts:17-42`）：`type: 'email'` / `type: 'url'` / `type: 'number'`、`min` / `max`、`pattern`（`validation/index.vue` 的几份 schema 里）、以及页面上手写的三条 validator —— 用户名查重（`setTimeout(600ms)` + 本地数组 `OCCUPIED_NAMES`，**没有接口**，`validation/index.vue:168,227-241`）、密码强度正则（`:256-264`）、确认密码与省/市/区跨字段一致性（`:275-341`，走 `dynamicRules`）。

::: warning

「校验时机」那张卡片演示的是两个已经失效的写法 第四张卡片用 `itemProps: { validateTrigger: 'blur' | 'change' }` 和规则级 `trigger: 'blur'` 去切时机（`validation/index.vue:358-385`），但 `itemProps` 只有 `required` / `style` / `wrapperCol.style` 会被读（`form-field.vue:112,152,168`），规则级 `trigger` 也声明成兼容字段（`schema.ts:39-40`）。实际时机由 `submitAttempted` 决定（`form-field.vue:38-45`）：首次提交前只有 submit 跑，提交过之后 change 实时纠正。开关拨动看不到差别是**符合实现**的，不是 bug 复现。
:::

## 表单设计器已随 `antdv-next` 一起移除

原先的 `#/components/form-designer` 整页只渲染一个第三方组件（`@form-create/antd-designer` 的 `<fc-designer>`），而它的模板是发布前就编译好的，运行时才 `resolveComponent('a-…')` 找组件 —— 为了它，入口里必须手工登记一批 `a-*` 全局组件（`registerVendorAntdComponents`）。这一页、那份注册和 `antdv-next` 依赖现在都删了：本仓库的 `a-*` 历来走各文件自己的显式 import（局部绑定），全局注册表只是第三方模板的脚手架，留着只会让人以为可以照抄。

要重新做「拖拽生成表单」，缺的不是注册表而是映射：设计器产出 form-create 自己的 rule JSON（`type` / `field` / `title` / `validate`），**和本仓库的 `FormSchema`（`component` / `rules`，`schema.ts:86-136`）不是同一套字段名**，得自己写转换器才能喂给 `BasicForm`。

## 相关页面 / Related

- [组件示例](/components/)
- [表格](/components/table)
- [Mock 服务（Nitro）](/guide/essentials/mock)
- [国际化](/guide/in-depth/internationalization) —— 表单模块没有任何 i18n 调用（全包搜 `useI18n` / `t(` 零命中）：自动 placeholder 模板（`helper.ts:42-58`）、必填与类型文案（`helper.ts:185`、`rule-registry.ts:86-143`）、按钮默认文案（`form.vue:340-355`）全是写死的中文。
