# Form 表单组件

基于 [Antdv Next Form](https://antdv-next.com/components/form) 封装的 JSON Schema 驱动表单组件，支持 28 种表单控件类型、动态校验、联动显隐、动态插槽等高级功能。

## 基础用法

```vue
<script setup lang="ts">
import { BasicForm } from '@/components/business/Form'
import { useForm } from '@/components/business/Form/useForm'

const schemas = [
  {
    field: 'username',
    label: '用户名',
    component: 'Input',
    componentProps: {
      placeholder: '请输入用户名',
    },
    rules: [{ required: true, message: '请输入用户名' }],
  },
  {
    field: 'email',
    label: '邮箱',
    component: 'Input',
    rules: [
      { required: true, message: '请输入邮箱' },
      { type: 'email', message: '邮箱格式不正确' },
    ],
  },
]

const [register, { validate, resetFields, getFieldsValue }] = useForm()
</script>

<template>
  <BasicForm :schemas="schemas" @register="register" @submit="handleSubmit" />
</template>
```

## 组件 Props

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| `schemas` | 表单配置项数组 | `FormSchema[]` | - |
| `model` | 表单数据模型 | `Recordable` | - |
| `labelWidth` | 标签宽度 | `number \| string` | - |
| `labelAlign` | 标签对齐方式 | `'left' \| 'right'` | `'right'` |
| `labelCol` | 标签布局配置 | `Partial<ColEx>` | `{ span: 6 }` |
| `wrapperCol` | 输入框布局配置 | `Partial<ColEx>` | `{ span: 18 }` |
| `baseColProps` | 每列基础栅格配置 | `Partial<ColEx>` | `{ span: 24 }` |
| `size` | 组件尺寸 | `'default' \| 'small' \| 'large'` | `'default'` |
| `disabled` | 是否禁用整个表单 | `boolean` | `false` |
| `compact` | 紧凑模式 | `boolean` | `false` |
| `autoSetPlaceHolder` | 自动设置 placeholder | `boolean` | `true` |
| `autoSubmitOnEnter` | 回车自动提交 | `boolean` | `true` |
| `showActionButtonGroup` | 显示操作按钮组 | `boolean` | `true` |
| `showResetButton` | 显示重置按钮 | `boolean` | `true` |
| `showSubmitButton` | 显示提交按钮 | `boolean` | `true` |
| `submitButtonOptions` | 提交按钮配置 | `ActionButtonOptions` | - |
| `resetButtonOptions` | 重置按钮配置 | `ActionButtonOptions` | - |
| `showAdvancedButton` | 显示展开/收起按钮 | `boolean` | - |
| `autoAdvancedLine` | 自动折叠行数 | `number` | `3` |
| `fieldMapToTime` | 时间字段映射配置 | `FieldMapToTime` | - |
| `mergeDynamicData` | 合并动态数据 | `Recordable` | - |

## 组件事件

| 事件名 | 说明 | 回调参数 |
|--------|------|----------|
| `register` | 注册表单实例 | `(instance: FormActionType) => void` |
| `submit` | 表单提交（校验通过后触发） | `(values: Recordable) => void` |
| `reset` | 表单重置 | `(values: Recordable) => void` |

## 组件插槽

| 插槽名 | 说明 |
|--------|------|
| `submitBefore` | 提交按钮前内容 |
| `resetBefore` | 重置按钮前内容 |
| `insertFooter` | 底部插入区域 |
| `centerFooter` | 底部中间区域 |
| `appendFooter` | 底部追加区域 |

## FormSchema 配置项

`FormSchema` 是表单的核心配置对象，每个表单项对应一个 Schema：

### 基础属性

| 属性 | 说明 | 类型 | 示例 |
|------|------|------|------|
| `field` | 字段名（必填） | `string` | `'username'` |
| `label` | 标签文本 | `string` | `'用户名'` |
| `component` | 组件类型 | `ComponentType` | `'Input'` |
| `defaultValue` | 默认值 | `any` | `''` |
| `required` | 是否必填 | `boolean` | `true` |
| `rules` | 校验规则 | `Rule[]` | 见下方说明 |
| `colProps` | 栅格配置 | `Partial<ColEx>` | `{ span: 12 }` |
| `itemProps` | FormItem 额外属性 | `Partial<FormItemProps>` | - |

### 动态控制属性

| 属性 | 说明 | 类型 |
|------|------|------|
| `show` | 控制显示/隐藏（CSS v-show） | `boolean \| (params) => boolean` |
| `ifShow` | 控制渲染/不渲染（v-if） | `boolean \| (params) => boolean` |
| `dynamicDisabled` | 动态禁用 | `boolean \| (params) => boolean` |
| `dynamicRules` | 动态校验规则 | `Rule[] \| (params) => Rule[]` |

### 渲染相关属性

| 属性 | 说明 | 类型 |
|------|------|------|
| `render` | 完全自定义渲染 | `(params) => VNode \| string` |
| `renderColContent` | 自定义列内容渲染 | `(params) => VNode \| string` |
| `renderComponentContent` | 自定义组件内部内容 | `(params) => any` |
| `slot` | 插槽名称 | `string` |
| `suffix` | 后缀内容 | `string \| number \| (params) => string` |
| `helpMessage` | 帮助提示信息 | `string \| string[]` |

### componentProps 支持两种形式：

**静态配置：**
```ts
{
  field: 'status',
  component: 'Select',
  componentProps: {
    options: [
      { label: '启用', value: 1 },
      { label: '禁用', value: 0 },
    ],
    placeholder: '请选择状态',
  },
}
```

**动态函数：**
```ts
{
  field: 'city',
  component: 'Select',
  componentProps: ({ values }) => ({
    options: values.province === 'beijing'
      ? beijingCities
      : shanghaiCities,
    disabled: !values.province,
  }),
}
```

## 支持的组件类型（ComponentType）

BasicForm 内置 **28 种**表单控件映射：

| 分类 | ComponentType | 对应组件 |
|------|---------------|----------|
| **输入类** | `Input` | 文本输入框 |
| | `InputPassword` | 密码输入框 |
| | `InputSearch` | 搜索输入框 |
| | `InputTextArea` | 多行文本域 |
| | `InputNumber` | 数字输入框 |
| | `AutoComplete` | 自动完成 |
| **选择类** | `Select` | 下拉选择 |
| | `TreeSelect` | 树形选择 |
| | `RadioGroup` | 单选组 |
| | `RadioButtonGroup` | 按钮式单选组 |
| | `Checkbox` | 复选框 |
| | `CheckboxGroup` | 复选框组 |
| | `Cascader` | 级联选择 |
| | `Transfer` | 穿梭框 |
| **日期时间类** | `DatePicker` | 日期选择器 |
| | `MonthPicker` | 月份选择器 |
| | `RangePicker` | 日期范围选择器 |
| | `WeekPicker` | 周选择器 |
| | `TimePicker` | 时间选择器 |
| | `TimeRangePicker` | 时间范围选择器 |
| **其他** | `Switch` | 开关 |
| | `Slider` | 滑动条 |
| | `Rate` | 评分 |
| | `Divider` | 分割线 |
| | `InputGroup` | 输入框组合 |

### 扩展自定义组件

通过 `addComponent` 方法注册自定义组件：

```ts
import { addComponent } from '@/components/business/Form/componentMap'
import MyCustomComponent from './MyCustomComponent.vue'

addComponent('MyCustom', MyCustomComponent)
```

然后在 Schema 中使用：
```ts
{ field: 'custom', component: 'MyCustom', label: '自定义' }
```

## 校验规则（Rule）

基于 Antdv Next 的校验规则体系：

```ts
interface RuleObject {
  required?: boolean           // 是否必填
  message?: string             // 错误提示信息
  type?: RuleType              // 校验类型
  min?: number                 // 最小值/最小长度
  max?: number                 // 最大值/最大长度
  len?: number                 // 精确长度
  pattern?: RegExp             // 正则表达式
  enum?: any[]                 // 枚举值
  whitespace?: boolean         // 是否允许空白字符
  trigger?: TriggerType        // 触发方式
  validator?: (rule, value, callback) => void  // 自定义校验器
}
```

### RuleType 可选值

`'string' | 'number' | 'boolean' | 'method' | 'regexp' | 'integer' | 'float' | 'object' | 'enum' | 'date' | 'url' | 'hex' | 'email' | 'tel'`

### 校验示例

```ts
const schemas = [
  {
    field: 'name',
    label: '名称',
    component: 'Input',
    rules: [
      { required: true, message: '请输入名称' },
      { min: 2, max: 20, message: '长度在 2-20 个字符之间' },
    ],
  },
  {
    field: 'age',
    label: '年龄',
    component: 'InputNumber',
    rules: [
      { required: true, message: '请输入年龄' },
      { type: 'integer', min: 0, max: 150, message: '年龄范围 0-150' },
    ],
  },
  {
    field: 'email',
    label: '邮箱',
    component: 'Input',
    rules: [
      { type: 'email', message: '请输入正确的邮箱地址' },
    ],
  },
]
```

## 联动显隐与动态规则

### 条件显示/隐藏

```ts
const schemas = [
  {
    field: 'type',
    label: '类型',
    component: 'Select',
    componentProps: {
      options: [
        { label: '个人', value: 'personal' },
        { label: '企业', value: 'company' },
      ],
    },
  },
  {
    field: 'companyName',
    label: '企业名称',
    component: 'Input',
    // 当 type 为 company 时才显示
    ifShow: ({ values }) => values.type === 'company',
  },
  {
    field: 'idCard',
    label: '身份证号',
    component: 'Input',
    // 使用 show 控制显隐（DOM 始终存在）
    show: ({ values }) => values.type === 'personal',
  },
]
```

### 动态校验规则

```ts
const schemas = [
  {
    field: 'paymentType',
    label: '支付方式',
    component: 'RadioGroup',
    componentProps: {
      options: [
        { label: '微信支付', value: 'wechat' },
        { label: '支付宝', value: 'alipay' },
        { label: '银行转账', value: 'bank' },
      ],
    },
  },
  {
    field: 'accountNumber',
    label: '账号',
    component: 'Input',
    dynamicRules: ({ values }) => {
      const baseRules = [{ required: true, message: '请输入账号' }]
      if (values.paymentType === 'bank') {
        baseRules.push({ pattern: /^\d+$/, message: '银行卡号为纯数字' })
      }
      return baseRules
    },
  },
]
```

### 动态禁用

```ts
{
  field: 'remark',
  label: '备注',
  component: 'InputTextArea',
  dynamicDisabled: ({ values }) => values.status === 'completed',
}
```

## useModal Composable API

`useForm` 是声明式操作表单的核心 Hook，返回 `[register, methods]` 元组：

```ts
const [register, methods] = useForm({
  // 初始 props（可选）
  labelWidth: 100,
})
```

### Methods 方法列表

| 方法 | 说明 | 参数 | 返回值 |
|------|------|------|--------|
| `getFieldsValue` | 获取所有字段值 | - | `Recordable` |
| `setFieldsValue` | 设置字段值 | `<T>(values: T)` | `Promise<void>` |
| `resetFields` | 重置表单 | - | `Promise<void>` |
| `validate` | 校验指定字段 | `nameList?: NamePath[]` | `Promise<any>` |
| `validateFields` | 校验并获取值 | `nameList?: NamePath[]` | `Promise<any>` |
| `submit` | 触发表单提交 | - | `Promise<void>` |
| `clearValidate` | 清除校验状态 | `name?: string \| string[]` | `Promise<void>` |
| `scrollToField` | 滚动到指定字段 | `name: NamePath, options?` | `Promise<void>` |
| `updateSchema` | 更新 Schema 配置 | `data: Partial<FormSchema>[]` | `Promise<void>` |
| `removeSchemaByField` | 根据 field 移除 Schema | `field: string \| string[]` | `Promise<void>` |
| `appendSchemaByField` | 在指定位置插入 Schema | `schema, prefixField?, first?` | `Promise<void>` |
| `setProps` | 动态修改表单 Props | `formProps: Partial<FormProps>` | `Promise<void>` |
| `getForm` | 获取原生 FormInstance | - | `FormInstance \| null` |

### 完整使用示例

```vue
<script setup lang="ts">
import { BasicForm } from '@/components/business/Form'
import { useForm } from '@/components/business/Form/useForm'

const schemas = ref([
  { field: 'name', label: '名称', component: 'Input', required: true },
  { field: 'desc', label: '描述', component: 'InputTextArea' },
])

const [register, {
  setFieldsValue,
  getFieldsValue,
  validate,
  resetFields,
  updateSchema,
  appendSchemaByField,
}] = useForm({ labelWidth: 120 })

// 编辑时回填数据
async function loadEditData(id: string) {
  const data = await api.getUser(id)
  setFieldsValue(data)
}

// 动态添加字段
function addExtraField() {
  appendSchemaByField(
    {
      field: 'extra',
      label: '额外字段',
      component: 'Input',
    },
    'desc', // 在 desc 字段后面插入
  )
}

// 提交
async function handleSubmit(values: Recordable) {
  console.log('表单数据:', values)
}
</script>

<template>
  <BasicForm
    :schemas="schemas"
    :register="register"
    @submit="handleSubmit"
  />
</template>
```

## 时间字段处理

### fieldMapToTime 时间范围转换

将 RangePicker 的范围值拆分为独立的起始/结束字段：

```ts
const [register] = useForm({
  schemas: formSchemas,
  fieldMapToTime: [
    // [RangePicker的field, [起始字段, 结束字段], 格式化格式]
    ['dateRange', ['startDate', 'endDate'], 'YYYY-MM-DD'],
    // 支持 timestamp 和 timestampStartDay 格式
    ['timeRange', ['startTime', 'endTime'], 'timestamp'],
  ],
})
```

支持的格式：
- `YYYY-MM-DD HH:mm:ss` — 默认日期格式
- `timestamp` — Unix 时间戳（秒）
- `timestampStartDay` — 当天起始时间戳

## 高级特性

### 自定义渲染（render）

当内置组件无法满足需求时，使用 `render` 完全自定义：

```ts
{
  field: 'customSlot',
  label: '自定义内容',
  render: ({ values }) => h('div', { class: 'flex gap-2' }, [
    h('span', '当前值:'),
    h('span', { class: 'text-blue-500 font-medium' }, values.customSlot || '-'),
  ]),
}
```

### 插槽方式（slot）

配合模板中的具名插槽使用：

```vue
<template>
  <BasicForm :schemas="schemas" @register="register">
    <!-- slot 名称对应 schema.slot -->
    <template #customSlot="{ model, field }">
      <a-button @click="handleCustom(model[field])">自定义操作</a-button>
    </template>
  </BasicForm>
</template>

<script setup lang="ts">
const schemas = [
  {
    field: 'customSlot',
    label: '自定义',
    component: 'Input',
    slot: 'customSlot', // 关联插槽名
  },
]
</script>
```

### 分割线（Divider）

使用 Divider 组件进行表单分组：

```ts
const schemas = [
  { field: 'name', label: '姓名', component: 'Input' },
  { field: 'phone', label: '电话', component: 'Input' },
  // 分割线
  {
    component: 'Divider',
    label: '地址信息', // 分割线文本
    componentProps: { orientation: 'left' },
  },
  { field: 'province', label: '省份', component: 'Select' },
  { field: 'city', label: '城市', component: 'Select' },
]
```
