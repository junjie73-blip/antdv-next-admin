# 表单

`BasicForm` 把 antdv-next 的 `a-form` 包成了「schema 驱动 + 命令式实例」：字段配置进 `schemas`，值存在组件内部的 `formModel` 里，页面通过 `@register` 拿到 `useForm()` 的那组方法去读写和校验。它解决的是后台表单的三件重复劳动 —— 栅格排版、字段显隐/联动、取值拼装。

源码：`apps/web/src/components/business/Form/`（`BasicForm.vue` / `useForm.ts` / `types.ts` / `componentMap.ts` / `helper.ts` / `components/FormItem.vue`）。导出面只有 8 行：`Form/index.ts:1-8`。

## useForm：注册与实例

```ts
// apps/web/src/components/business/Form/types.ts:192-195
export type UseFormReturnType = [
  register: (instance: FormActionType) => void,
  methods: FormActionType,
];
```

和表格的 `useTable` 不一样：第二个返回值是**方法对象本体**，不是 `Ref`，可以直接解构（`views/components/form/basic/index.vue:172`）。

```vue
<script setup lang="ts">
import type { FormSchema } from '~/components/business/Form';
import { BasicForm, useForm } from '~/components/business/Form';

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

`register` 在组件 `onMounted` 时才发出（`BasicForm.vue:438-441`），收到实例的那一刻做三件事：把 `useForm(props)` 的初始配置 `setProps` 进去、兑现挂载前攒下的待写入值（`useForm.ts:46-55`）。同一个实例也通过 `defineExpose` 暴露（`BasicForm.vue:447`），所以模板 ref 拿到的是同一组方法。

::: tip 待写入队列：`setFieldsValue` 在没挂载时也不会丢 `useForm` 对 `setFieldsValue` / `resetFields` 会先判断实例是否还挂在组件树上（`useForm.ts:40-44` + `BasicForm.vue:405,422,443-445`），实例是死的就先把值累加进 `pendingValues`，等下一次 `register` 再补写（`useForm.ts:67-84`）。这套队列专门救「先灌值、再 `openModal`」的写法：弹窗默认销毁内容，写进上一次 register 的死对象是静默失败的。行为有单测覆盖（`Form/__tests__/use-form.spec.ts:63-163`）。:::

::: warning 队列只保护写值，不保护校验和取值只有 `setFieldsValue` / `resetFields` 走活实例判定；`getFieldsValue`、`validate`、`validateFields`、`updateSchema` 等用的是不校验挂载状态的 `getFormInstance()`（`useForm.ts:57-65,86-129`）。表单没挂载时 **`validate()` 不报错，直接返回 `{}`**（`useForm.ts:86-92`）—— 拿它当「校验通过」的判断条件会永远为真。:::

**没有 `useModalForm` / `useDrawerForm`。** 表单模块不提供弹窗/抽屉的桥接（`Form/index.ts:1-8` 里没有，全仓也搜不到这两个名字）；`views/system/*` 的做法就是页面自己写一份 `modalFormSchemas` 再用模板 prop 挂上去（`views/system/dept/index.vue:201,641`）。

## FormProps 常字段

类型定义 `Form/types.ts:122-153`；带运行期默认值的只有 6 个键（`BasicForm.vue:35-44`）。

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `schemas` | — | 字段配置；`setProps` 把它从合并逻辑里单独摘出来做整体替换（`BasicForm.vue:384-392`） |
| `grid` | — | `{ cols, gutter }`；`cols` 只接受 1-4，越界静默回落到响应式列数（`BasicForm.vue:93-98`），`responsive` 无人读（`types.ts:119`） |
| `labelWidth` / `labelCol` | `labelCol: { span: 4 }` | 给了 `labelWidth` 就走 `style.width`，`labelCol` 被忽略（`BasicForm.vue:204-210`） |
| `wrapperCol` | cols>1 时 `{ span: 18 }` | 单列时按 `labelWidth` 换成 flex（`BasicForm.vue:212-221`） |
| `size` / `disabled` | — | 直接绑给 `a-form`（`BasicForm.vue:457-458`） |
| `showActionButtonGroup` / `showSubmitButton` / `showResetButton` | 都是 `true` | 动作区整块和两颗按钮（`BasicForm.vue:495-518`） |
| `submitButtonOptions` / `resetButtonOptions` | 文案 `查询` / `重置`，图标 `carbon:search` / `carbon:restart` | **只有 `text` 和 `preIcon` 生效**（`BasicForm.vue:224-234,502-518`）；`loading` / `disabled` / `postIcon` / `iconSize` / `onClick` 声明在 `types.ts:39-47` 但模板里没人读 |
| `submitOnReset` | `true` | 重置后自动再提交一次（`BasicForm.vue:296-304`） |
| `showAdvancedButton` / `alwaysShowLines` | 关 / `3` | 折叠按**行数**算，不是字段数（`BasicForm.vue:152-157`） |
| `fieldMapToTime` | — | `[字段, [起, 止], 格式?]`，把区间拆成两个字段并删掉原字段（`helper.ts:196-227`） |
| `submitFunc` | — | 提交时优先于 `@submit`（`BasicForm.vue:282-288`） |
| `baseRowStyle` | — | 摊进 `<a-row>`（`BasicForm.vue:196-202`） |

::: warning 声明了但没人读的 FormProps 以下字段在 `types.ts:122-153` 里是合法配置项，全模块搜不到任何使用点（`autoSubmitOnEnter` 只出现在 `BasicForm.vue:40` 的默认值里，没有键盘监听）：

- `model` —— 表单值一律存在组件内部的 `formModel`（`BasicForm.vue:72,242-244`），外部传进来的初始对象不会被读，也不会被同步回去。
- `baseColProps`、`actionColOptions` —— 栅格实际由 `grid.cols` 推导（`BasicForm.vue:101,171-180`）。
- `autoFocusFirstItem`、`compact`、`autoSetPlaceHolder`、`autoAdvancedLine`、`mergeDynamicData`、`resetFunc`。
- 顶层 `rulesMessageJoinLabel` —— 起作用的是 **schema 上那一份**（`helper.ts:158,188`）。
- `grid.responsive` —— 断点是写死的 Tailwind 值（`BasicForm.vue:62-69`）。

`colon` 和 `scrollToFirstError` 反过来：它们出现在 `withDefaults`（`BasicForm.vue:42-43`）里，但**不是** `FormProps` 的字段；模板把 `:colon="false"` 写死（`BasicForm.vue:459`），而 `getProps` 只挑了 5 个键绑给 `a-form`，所以这类原生属性**只有写在 `<BasicForm>` 标签上**才有效 —— 它走 `useAttrs()` 透传（`BasicForm.vue:87-90,460`），`setProps({ … })` 到不了那里。:::

## setProps 的「目标优先」

`deepMerge` 是这个模块所有合并的底座，它的冲突规则是**保留 target**（`helper.ts:317-359`，第 354-355 行的注释原文就是「其它情况：目标优先」）。四条实际后果：

| 情况 | 结果 | 源码 |
| --- | --- | --- |
| target 没有这个键 | 写入 | `helper.ts:332-338` |
| target 已有标量/函数，source 给新值 | **忽略新值** | `helper.ts:354-355` |
| target 已有数组，source 给新数组 | **保留旧数组** | `helper.ts:340-341` |
| 两边都是纯对象 | 递归合并（内部仍按上面三条） | `helper.ts:350-353` |

因为 `BasicForm.setProps` 把 target 定成**上一次的 `propsRef`**（`BasicForm.vue:384-392`），而 `getProps` 把 target 定成**模板 props**（`BasicForm.vue:79-84`），于是：

- `withDefaults` 给了默认值的 `showActionButtonGroup` / `showSubmitButton` / `showResetButton` / `submitOnReset` / `labelAlign` 这几个键，`setProps` / `useForm(props)` **永远改不动**，只能在模板上直接传 prop。分步表示例页把这条印在了界面上（`views/components/form/steps/index.vue:65-67`、`918-920`）。
- 同一个键的第二次 `setProps` 也是空操作；数组型配置（`fieldMapToTime`）第一次之后就再也换不掉。
- `schemas` 不受影响，它是整体替换（`BasicForm.vue:388-391`）。
- `updateSchema` 同一个坑：它是 `deepMerge(旧 schema, 补丁)`（`BasicForm.vue:344-356`），所以改 `label`、换 `ifShow` 函数、换整份 `rules` 数组都会被旧值顶掉，只有**新增键**和嵌套纯对象写得进去。

::: tip 想真正换掉一个已有配置把整份 `schemas` 数组重算一遍再 `setProps({ schemas })`（分步表单就是这么做的，`views/components/form/steps/index.vue:114-124`），或者直接用模板 prop 绑一个 `computed`（`views/components/form/validation/index.vue:347-380` 的 `timingSchemas` + `:schemas`）。:::

## FormSchema：字段配置

定义在 `Form/types.ts:61-111`（`component` / `componentProps` 的泛型推断在 104-111）。每个回调都能拿到 `{ schema, values, model, field }`（`types.ts:32-37`）。

| 字段 | 生效条件与出处 |
| --- | --- |
| `field` | 必填，`formModel` 的键；`Divider` 可以不写（`BasicForm.vue:124`） |
| `component` | 查 `componentMap` 的字符串键（见下一节） |
| `componentProps` | 对象或函数；**写成函数时走 `helper.ts:70-77` 直接返回，不再自动补 placeholder / allowClear** |
| `required` | 仓库唯一自带的「规则简写」，展开成一条 `{ required: true, message }`（`helper.ts:183-191`） |
| `rulesMessageJoinLabel` | 为真时必填文案变成 `${label}不能为空`，否则是 `'该项为必填项'`（`helper.ts:188`） |
| `rules` | 原样交给 `a-form-item`（`FormItem.vue:160`）；`pattern` 不是 RegExp 的规则会被**丢弃并 console.warn**（`helper.ts:171-181`） |
| `dynamicRules` | 函数形式**整份接管**该字段规则，`rules` 与 `required` 都不再参与（`helper.ts:160-167`） |
| `ifShow` | 假值时连 `a-form-item` 都不渲染 → 不参与校验（`FormItem.vue:155`） |
| `show` | 只是 `v-show`，字段仍在注册表里，**照样参与校验**（`FormItem.vue:156`） |
| `dynamicDisabled` | 结果绑成组件的 `disabled`（`FormItem.vue:192`）；不写时它是 `false`，于是 `componentProps.disabled` 会被顶掉（显式绑定在 `v-bind` 之后） |
| `colProps.span` | 缺省取 `floor(24 / 实际列数)`（`BasicForm.vue:101,171-180`） |
| `itemProps` | 整份 `v-bind` 给 `a-form-item`（`FormItem.vue:109,158`），校验时机 `validateTrigger` 就从这里传 |
| `fullRowAlign` | **只在 `grid.cols > 1` 且该字段独占整行时生效**（`FormItem.vue:108-137`）；效果是 `wrapperCol.style.maxWidth`，附带的 `form-item-full-row-align` 类名全仓没有对应样式 |
| `suffix` | 渲染进组件的 `#suffix`（`FormItem.vue:196-200`），只对有这个插槽的控件有意义；`slot` 字段和 `Divider` 拿不到它 |
| `helpMessage` | 字符串或数组（数组用 `\n` 拼接，`FormItem.vue:139-145`），渲染成 label 后的 tooltip；`helpComponentProps`（`types.ts:49-58`）**没人读**，气泡宽度等是写死的（`FormItem.vue:169-172`） |
| `slot` | 该字段的内容改为渲染页面同名插槽，作用域参数是 `{ model, field }`（`FormItem.vue:184-186`，转发链路 `BasicForm.vue:472-478`） |
| `defaultValue` | 挂载与每次 `setProps({ schemas })` 都会重灌一遍（`BasicForm.vue:246-254,388-391`） |

::: warning schema 上这些字段是死的 `subLabel`、`emptySpan`、`disabledLabelWidth`、`render`、`renderColContent`、`renderComponentContent`、`colSlot`、`isAdvanced`、`children`、`changeEvent`（`types.ts:61-101` 里都在，`FormItem.vue` / `BasicForm.vue` / `helper.ts` 一个都没读）。尤其别按 vben 的经验去写 `render` / `colSlot` —— 这里的 `FormItem.vue` 只有 `slot` 一条自定义渲染路径（`FormItem.vue:184-206`），`render` 写了不报错，也不显示。:::

## 组件解析：只查 `componentMap`

`component` 这个字符串**唯一的解析路径**是 `componentMap` 这张表：`getComponentInstance` → `getComponent(schema.component)`（`FormItem.vue:76-79` → `componentMap.ts:126-128`）。内置键就是 `ComponentType` 那 28 个（`componentMap.ts:30-58`，注册在 91-120）。

::: tip 和 `types/components.d.ts` 没有关系 `apps/web/types/components.d.ts` 是 `unplugin-vue-components` 给**模板标签**用的自动导入产物，schema 解析完全不经过它。写 `component: 'AInput'` 或任何不在表里的名字，`getComponent` 返回 `undefined`，字段既不报错也不警告，直接退化成一行纯文本 <code v-pre>{{ formModel[field] }}</code>（`FormItem.vue:204-206`）。:::

几个容易误会的点：

- **有四个键只是别名**：`MonthPicker` / `WeekPicker` → `DatePicker`，`TimeRangePicker` → `TimePicker`（不是 RangePicker），`RadioButtonGroup` → `RadioGroup`，`InputTextArea` → `TextArea`（`componentMap.ts:96,101,107-111`）。`component: 'MonthPicker'` 不会自动给你月份面板，`picker: 'month'` 得自己写进 `componentProps`。
- **`Divider` 走不到 `componentMap`**：`BasicForm` 在按行分组时就把 `component === 'Divider'` 单独摘出来（`BasicForm.vue:127-135,189-193`），模板里另起一轮 `v-for` 渲染（`BasicForm.vue:483-492`），`componentMap.ts:115` 那条注册项没人用。副作用是**所有 `Divider` 都排在全部字段之后**（两个 `v-for` 的先后顺序），写在 schema 中间的分割线不会留在原地；`label` 变成分割线文案，`componentProps` 原样 `v-bind` 给 `a-divider`。
- **注册自定义字段**：`addComponent(name, component)`（`componentMap.ts:122-124`）。表是模块级单例，注册一次全局可引用，也**没有反注册 API**；新键不在 `ComponentType` 联合里，要像示例那样收口一次类型（`views/components/form/custom-component/index.vue:40`，注册在 94 行）。字段组件要满足的契约只有一个：吃 `value` prop、发 `update:value`（`FormItem.vue:193-194`；对照 `views/components/form/custom-component/components/TagPickerField.vue:8-22`）。
- **单勾选框不能用 `component: 'Checkbox'`**：`FormItem` 只喂 `value` / `update:value`，而 antdv-next 的勾选态在 `checked` 上（`antdv-next/dist/checkbox/Checkbox.d.ts:9-13,31-33`），点了不会变。`Switch` 可以，因为它把 `value` 做成了 `checked` 的别名并同发 `update:value`（`antdv-next/dist/switch/index.d.ts:26-31,58-59`）。要单个勾选就走 `slot`。

::: warning `ASelect` / `ATreeSelect` 的 `api` 不是「接口函数」 `componentMap` 里注册的这两个组件（`componentMap.ts:117-118`）真实 props 是 `api: string` —— 一个 URL，交给 `useRequest` 发请求，结果**直接当选项数组**用（`Form/components/ApiSelect.vue:7-9,19`、`ATreeSelect.vue:7-9,20`），没有 `resultField` / `labelField` / `valueField` / `numberToString` / `immediate` 这些能力：`types.ts:201-210` 那个 `ApiSelectProps` 接口在全仓只出现在它自己的定义处，没有任何实现读它。另外 `watchDebounced(api, …)`（`ApiSelect.vue:15` / `ATreeSelect.vue:16`）监听的是解构出来的**字符串本身**而不是 getter，所以 URL 后续变化不会重新取数 —— 这条按源码读出的行为没有任何示例覆盖，别依赖它。导出名和注册键也不一致：`Form/index.ts:3-4` 把这两个文件导成为 `ASelect` 和 **`ApiTreeSelect`**，而 schema 里要写的键是 `ATreeSelect`。:::

**表格的可编辑列不共用这张表。** `BasicColumn.editComponent` 是 Table 模块自己的 `ComponentType` 联合（`Table/types.ts:81-98,134`），`TableEditableCell.tsx:119-182` 是一个只对 `Input` / `InputNumber` / `Select` / `DatePicker` / `Switch` 分支的 `switch`，`default` 一律渲染 `<Input>`。所以那份联合里另外 12 个名字（含 `ApiSelect` / `ApiTreeSelect` / `ApiCascader` / `ApiRadioGroup` / `Checkbox` / `Radio` / `RangePicker` / `TimePicker` / `TreeSelect` 等）写进去只会得到一个静默退化成输入框的编辑格。

## 值、校验与提交

实例方法集合 `FormActionType`（`types.ts:155-190`）的实现都在 `BasicForm.vue:257-423`：

| 方法 | 行为 |
| --- | --- |
| `validate(nameList?)` / `validateFields(nameList?)` | 调 `a-form` 的同名方法（`antdv-next/dist/form/Form.d.ts:104-105`），成功后再过 `formatDateFields` + `handleRangeValue`（`BasicForm.vue:257-271`）；**可以只喂一部分字段名**，分步表单靠这个做「本步校验」 |
| `submit()` | 等价于点提交按钮，走 `handleSubmit`（`BasicForm.vue:274-293`） |
| `getFieldsValue()` | `{ ...formModel }` 浅拷贝（`BasicForm.vue:327-329`） |
| `setFieldsValue(values)` | 逐键写 `formModel`（`BasicForm.vue:321-325`），不触发校验，也不需要字段当前正渲染 |
| `resetFields()` | 先 `a-form.resetFields()`，再把每个键退回 `defaultValue`（`BasicForm.vue:312-319`） |
| `clearValidate(name?)` / `scrollToField(name, options?)` | 透传（`BasicForm.vue:331-342`） |
| `updateSchema` / `removeSchemaByField` / `appendSchemaByField` | 改 `schemaRef`（`BasicForm.vue:344-382`），`updateSchema` 受「目标优先」限制；`remove`/`append` 按 `field` 定位，前缀字段找不到就什么都不做 |
| `getForm()` | 拿到 antd 的 `FormInstance`（`BasicForm.vue:394-396`） |
| `setProps(partial)` | 见上面那节 |
| `isMounted()` | 给 `useForm` 用的挂载标记（`BasicForm.vue:405,422`） |

::: warning 三个方法在仓库里没有任何调用点 `validateFields`、`scrollToField`、`updateSchema` / `appendSchemaByField` / `removeSchemaByField` 在 `apps/web/src` 里除了类型声明和自身实现之外搜不到使用者（表格实例上对应的三个转发方法直接是空函数，见下）。它们是可用 API，但**没有示例或业务页验证过**。:::

- **提交优先级**：`@finish` 属性（模板透传的 `onFinish`）> `submitFunc` > `emit('submit', values)`（`BasicForm.vue:282-288`）。校验失败被 `catch` 吞掉，只在控制台 `console.error('Form submit error:', …)`（`BasicForm.vue:290-292`），**不会二次抛出**，所以想拿失败详情要自己 `await validate()`，别依赖 `@submit`。
- **重置**：`resetFields()` 之后按 `submitOnReset` 决定是再提交一次还是 `emit('reset', 重置前的值快照)`（`BasicForm.vue:296-304`，第 297 行取的是改动前的 `formModel`）。
- **日期值**：`formatDateFields` 只对 `DATE_COMPONENTS` 那 6 个组件名生效（`helper.ts:233-240,259-296`），格式取 `componentProps.valueFormat` → `format` → `'YYYY-MM-DD HH:mm:ss'`；`RangePicker` / `TimeRangePicker` **显式跳过**（`helper.ts:282-284`），区间交给 `fieldMapToTime`。
- **`fieldMapToTime` 只在值恰好是长度为 2 的数组时生效**，并会 `delete` 掉原字段（`helper.ts:202-224`）。
- **事件只有三个**：`register` / `submit` / `reset`（`BasicForm.vue:46-50`）。
- **动作区插槽**：`#submitBefore`、`#resetBefore`、`#actionAfter`（`BasicForm.vue:501-523`），内置按钮的排布是「提交 → 重置 → 展开/收起」。

## 和表格搜索区的关系

`BasicTable` 内部就是挂一个 `BasicForm`（`Table/BasicTable.vue:686-688`），中间层是 `Table/hooks/useTableForm.ts`：

- **`useSearchForm` 单独给 `true` 不够**，搜索区渲染条件是 `useSearchForm && formConfig` 同时为真（`Table/BasicTable.vue:401-403`）。
- `formConfig` 被整个摊进表单 props，并补一组默认值（`useTableForm.ts:150-171`），其中 `autoSubmitOnEnter: true`（第 160 行）落在上面那份「没人读」的清单里。
- 表格在 `useSearchForm` 为真时会注入 `submitFunc` / `resetFunc`（`useTableForm.ts:165-168`）：`submitFunc` 真的生效（`BasicForm.vue:284-285`）；**`resetFunc` 永远不会被调用**（`BasicForm.vue` 全文没有读它），于是 `useTableForm.ts:277-297` 那段「重置时必须清掉表格记住的 searchInfo」的注释和实现都是死代码 —— 重置实际走的是 `submitOnReset` → `submitFunc` 这条路。
- 表格实例转发的表单方法（`Table/BasicTable.vue:649-659`）里，`updateFormSchema` / `appendFormSchema` / `removeFormSchema` 是**空函数** `() => {}`（`BasicTable.vue:656-658`），调用了不会有任何效果；`getFormValues` / `setFormValues` / `resetForm` / `submitForm` / `validateForm` / `getForm` 是通的。

## 在线示例

| 路由 | 内容 |
| --- | --- |
| `#/components/form/basic` | 一张 14 字段的表单：`required` 简写、`rules`、`colProps.span` 两列排版、`showAdvancedButton` + `alwaysShowLines: 2` 的折叠、`fieldMapToTime` 拆 `timeRange`（`views/components/form/basic/index.vue:11-192`）。四个按钮分别演示 `validate()` / `resetFields()` / `setFieldsValue()` / `getFieldsValue()`，结果 JSON打在第二张卡片（233-252）。这一页两张卡片都没写 `variant="borderless"`（235、248），和目录页那条约定不一致 |
| `#/components/form/steps` | 四段，全部**一个 `BasicForm` 实例跑完整条流程**，换步骤靠 `setProps({ schemas })`（`views/components/form/steps/index.vue:10-16,114-124`）：① 下一步带本步门禁、最后出本地摘要（790）；② 下一步不校验 + 草稿（843）；③ 步骤条可点回退 + 底部按钮塞进 `#submitBefore` / `#actionAfter`（907）；④ `slot` 字段做表格化多选与只读摘要（966） |
| `#/components/form/validation` | 四张卡片对应四份 schema：必填与格式（385）、长度与数值区间（416）、异步与跨字段（448）、校验时机与结果（479） |
| `#/components/form/custom-component` | 四张卡片：`MarkdownEditor` 内置扩展（236）、`addComponent('TagPickerField', …)`（251）、`ifShow`/`show`/`dynamicDisabled`/`dynamicRules` 联动（270）、自定义 `validator` 拦截提交（287） |
| `#/components/form-designer` | 第三方表单设计器，见下一节 |

::: warning 分步表单的草稿是示例页自己写的键名 `demo:form-steps:draft` 定义在 `views/components/form/steps/index.vue:55`，写/读/删分别是本页的 `saveDraft`（498-510）、`readStoredDraft` + `restoreDraft`（477-523）、`clearDraft`（525-529）。**`BasicForm` 完全没有草稿能力**，`FormProps` 里也没有相关字段；草稿存的是 `{ savedAt, step, values }` 的 `JSON.stringify`，只活在这台浏览器里。同理，「提交」只做整表校验并把值打出来，一个请求都不发（`372-377`、`545-550`、`775-780`）。:::

::: tip 分步的两个硬约束

1. **步骤 schema 上不要写 `defaultValue`** —— 每次 `setProps({ schemas })` 都会重跑 `initFormModel()` 把字段盖回默认值，初值改成挂载前 `setFieldsValue` 灌一次（`steps/index.vue:62-64`，机制在 `BasicForm.vue:388-391`；队列行为由 `useForm.ts:67-75` 提供）。
2. **整表校验必须把别的步骤挂成 `show: false` 再校验**：不带字段名的 `validate()` 只覆盖当前渲染的字段，前面步骤的 `a-form-item` 已经卸载、不在注册表里，脏值会静默过关（`steps/index.vue:165-203`）。`ifShow: false` 是真卸载，等于没校验（`FormItem.vue:155`）。:::

**校验页里哪些规则是自己写的**：仓库只有一条自带的「规则预设」，就是 `required` 简写（`helper.ts:183-191`）。其余全是 antd 原生规则字段，原样交给 `a-form-item`：`type: 'email'` / `type: 'url'` / `type: 'number'`（`validation/index.vue:96,114,143`）、`min` / `max`（133、154-157）、`pattern`（105、377）、`trigger`（377）、`validateTrigger`（356，经 `itemProps`）。页面上手写的 validator 有三条：用户名查重（`setTimeout(600ms)` + 本地数组 `OCCUPIED_NAMES`，**没有接口**，224-241）、密码强度正则（252-264）、确认密码与省/市/区跨字段一致性（274-339，走 `dynamicRules`）。

## 表单设计器不是 `BasicForm`

`#/components/form-designer` 整页 39 行，只渲染一个第三方组件：`<fc-designer ref="designerRef" height="100%" :config="designerConfig" />`（`views/components/form-designer/index.vue:37`），来自 `@form-create/antd-designer`，在入口全局安装（`apps/web/src/main.ts:9,54`）。

- `designerConfig` 就是那 15 个开关（14 个 `show*` 加一个 `autoActive`，`form-designer/index.vue:11-27`），没有任何逻辑读取设计器的产出。
- 它依赖 `registerVendorAntdComponents(app)`（`main.ts:49`）：`a-*` 平时靠编译期自动导入注入，而设计器的模板是发布前就编译好的，运行时才 `resolveComponent('a-layout-sider')`，缺这份全局注册就会「没报错但整块空白」（`plugins/vendor-antd-components.ts:44-58`）。
- 设计器产出的是 form-create 自己的 rule JSON（`type` / `field` / `title` / `validate`），**和本仓库的 `FormSchema`（`component` / `rules`，`Form/types.ts:61-111`）不是同一套字段名**，页面里也没有任何转换器或保存逻辑 —— 想接 `BasicForm` 得自己写映射。

## 相关页面 / Related

- [组件示例](/components/)
- [表格](/components/table)
- [Mock 服务（Nitro）](/guide/essentials/mock)
- [国际化](/guide/in-depth/internationalization) —— 表单模块没有任何 i18n 调用：自动 placeholder 模板（`helper.ts:43-59`）、必填文案（`helper.ts:188`）、按钮默认文案（`BasicForm.vue:224-239`）全是写死的中文。
