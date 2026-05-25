我来查看 Vben Admin Form 组件的官方文档，然后为你设计完整的提示词。
基于 Vben Admin 官方文档 ，我为你设计了一个**完整的企业级表单组件生成提示词**。这个提示词涵盖了文档中所有的核心特性和 API。

---

## 完整提示词（直接复制使用）

```markdown
请使用 Vue 3.3+ + TypeScript 5.0 + Antdv Next 实现一个完整的企业级 Schema 驱动表单组件，完全对标 Vben Admin 的 BasicForm 组件。

## 一、组件架构要求

### 1. 文件结构
```
src/components/Form/
├── index.ts                    # 入口导出
├── BasicForm.vue              # 主组件
├── FormItem.vue               # 表单项封装
├── useForm.ts                 # 核心 composable
├── types.ts                   # 完整类型定义
├── componentMap.ts            # 组件映射表
├── helper.ts                  # 工具函数
└── components/
    ├── ApiSelect.vue          # 远程下拉组件
    ├── ApiTreeSelect.vue      # 远程树选择
    ├── RadioButtonGroup.vue   # 单选按钮组
    └── ...
```

### 2. 使用方式支持
必须支持三种使用方式：
- **useForm 方式**（推荐）：`const [register, methods] = useForm(props)`
- **Template ref 方式**：`<BasicForm ref="formRef" />`
- **Direct props 方式**：`<BasicForm :schemas="schemas" />`

## 二、完整类型定义（TypeScript）

### 核心类型定义必须包含：

```typescript
// ComponentType 联合类型 - 所有支持的组件
export type ComponentType = {
     Input: ExtractPropTypes<(typeof import('antdv-next/es/input'))['default']>;
  InputGroup: ExtractPropTypes<(typeof import('antdv-next/es/input'))['InputGroup']>;
  InputPassword: ExtractPropTypes<(typeof import('antdv-next/es/input'))['InputPassword']>;
  InputSearch: ExtractPropTypes<(typeof import('antdv-next/es/input'))['InputSearch']>;
  InputTextArea: ExtractPropTypes<(typeof import('antdv-next/es/input'))['Textarea']>;
  InputNumber: ExtractPropTypes<(typeof import('antdv-next/es/input-number'))['default']>;
  Select: ExtractPropTypes<(typeof import('antdv-next/es/select'))['default']>;
  TreeSelect: ExtractPropTypes<(typeof import('antdv-next/es/tree-select'))['default']>;
  RadioGroup: ExtractPropTypes<(typeof import('antdv-next/es/radio'))['RadioGroup']>;
  Checkbox: ExtractPropTypes<(typeof import('antdv-next/es/checkbox'))['default']>;
  CheckboxGroup: ExtractPropTypes<(typeof import('antdv-next/es/checkbox'))['CheckboxGroup']>;
  AutoComplete: ExtractPropTypes<(typeof import('antdv-next/es/auto-complete'))['default']>;
  Cascader: ExtractPropTypes<(typeof import('antdv-next/es/cascader'))['default']>;
  DatePicker: ExtractPropTypes<(typeof import('antdv-next/es/date-picker'))['default']>;
  MonthPicker: ExtractPropTypes<(typeof import('antdv-next/es/date-picker'))['MonthPicker']>;
  RangePicker: ExtractPropTypes<(typeof import('antdv-next/es/date-picker'))['RangePicker']>;
  WeekPicker: ExtractPropTypes<(typeof import('antdv-next/es/date-picker'))['WeekPicker']>;
  TimePicker: ExtractPropTypes<(typeof import('antdv-next/es/time-picker'))['TimePicker']>;
  TimeRangePicker: ExtractPropTypes<
    (typeof import('antdv-next/es/time-picker'))['TimeRangePicker']
  >;
  Switch: ExtractPropTypes<(typeof import('antdv-next/es/switch'))['default']>;
  IconPicker: CustomComponents['IconPicker'];
  Render: Record<string, any>;
  Slider: ExtractPropTypes<(typeof import('antdv-next/es/slider'))['default']>;
  Rate: ExtractPropTypes<(typeof import('antdv-next/es/rate'))['default']>;
  Divider: ExtractPropTypes<(typeof import('antdv-next/es/divider'))['default']>;
  Transfer: ExtractPropTypes<(typeof import('antdv-next/es/transfer'))['default']>;
   };

// RenderCallbackParams - 渲染回调参数
export interface RenderCallbackParams {
  schema: FormSchema;
  values: Recordable;
  model: Recordable;
  field: string;
}

// FormSchema - 表单项配置（文档中所有属性）
export interface FormSchema {
  field: string;                          // 字段名（必填）
  label?: string;                         // 标签名
  subLabel?: string;                      // 二级标签名（灰色）
  component?: ComponentType;              // 组件类型
  componentProps?: 
    | Recordable 
    | ((params: RenderCallbackParams) => Recordable);  // 组件属性，支持函数形式
  rules?: ValidationRule[];               // 校验规则
  required?: boolean;                     // 简化 required 校验
  rulesMessageJoinLabel?: boolean;        // 校验信息是否加入 label
  defaultValue?: any;                     // 默认值
  
  // 布局相关
  colProps?: Partial<ColEx>;              // 栅格配置
  labelWidth?: string | number;           // 覆盖全局 labelWidth
  disabledLabelWidth?: boolean;           // 禁用全局 labelWidth
  itemProps?: any;                        // FormItem 属性
  emptySpan?: number | Partial<ColEx>;    // 空白占位
  
  // 动态控制（支持函数形式）
  show?: boolean | ((params: RenderCallbackParams) => boolean);        // CSS 控制显示（保留 DOM）
  ifShow?: boolean | ((params: RenderCallbackParams) => boolean);      // JS 控制显示（移除 DOM）
  dynamicDisabled?: boolean | ((params: RenderCallbackParams) => boolean);  // 动态禁用
  dynamicRules?: ValidationRule[] | ((params: RenderCallbackParams) => ValidationRule[]);  // 动态规则
  
  // 自定义渲染
  render?: (params: RenderCallbackParams) => VNode | VNode[] | string;  // 完全自定义渲染
  renderColContent?: (params: RenderCallbackParams) => VNode | VNode[] | string; // 自定义整列（含 FormItem）
  renderComponentContent?: (params: RenderCallbackParams) => any;       // 自定义组件内部 slot
  
  // 插槽
  slot?: string;                          // 使用具名插槽
  colSlot?: string;                       // 整列插槽（含 FormItem）
  
  // 其他
  suffix?: string | number | ((params: RenderCallbackParams) => string | number);  // 后缀内容
  changeEvent?: string;                   // 自定义 change 事件名（默认 'update:value'）
  helpMessage?: string | string[];        // 帮助提示
  helpComponentProps?: HelpComponentProps;// 帮助提示组件配置
  isAdvanced?: boolean;                   // 是否属于高级搜索（用于折叠）
}

// FormProps - 表单整体配置（文档中所有 Props）
export interface FormProps {
  schemas?: FormSchema[];                 // 表单配置数组
  model?: Recordable;                     // 双向绑定数据（可选）
  labelWidth?: number | string;           // 标签宽度
  labelAlign?: 'left' | 'right';          // 标签对齐
  labelCol?: Partial<ColEx>;              // 全局 LabelCol
  wrapperCol?: Partial<ColEx>;            // 全局 wrapperCol
  baseColProps?: Partial<ColEx>;          // 基础栅格配置
  baseRowStyle?: object;                  // 行内样式
  
  // 功能开关
  submitOnReset?: boolean;                // 重置时是否提交
  autoFocusFirstItem?: boolean;           // 自动聚焦第一个输入框
  compact?: boolean;                      // 紧凑模式（减少 margin-bottom）
  size?: 'default' | 'small' | 'large';   // 组件尺寸
  disabled?: boolean;                     // 全局禁用
  autoSetPlaceHolder?: boolean;           // 自动设置 placeholder
  autoSubmitOnEnter?: boolean;            // 回车自动提交
  rulesMessageJoinLabel?: boolean;        // 校验信息拼接 label
  
  // 展开/收起
  showAdvancedButton?: boolean;           // 显示展开/收起按钮
  autoAdvancedLine?: number;              // 超过多少行自动折叠（默认 3）
  alwaysShowLines?: number;               // 折叠时始终显示的行数（默认 1）
  
  // 操作按钮
  showActionButtonGroup?: boolean;        // 显示操作按钮组（默认 true）
  showResetButton?: boolean;              // 显示重置按钮
  showSubmitButton?: boolean;             // 显示提交按钮
  resetButtonOptions?: ActionButtonOptions;   // 重置按钮配置
  submitButtonOptions?: ActionButtonOptions;  // 提交按钮配置
  actionColOptions?: Partial<ColEx>;      // 操作按钮栅格配置
  
  // 自定义逻辑
  resetFunc?: () => Promise<void>;        // 自定义重置逻辑
  submitFunc?: () => Promise<void>;       // 自定义提交逻辑
  fieldMapToTime?: FieldMapToTime;        // 时间字段映射
  
  // 额外数据
  mergeDynamicData?: Recordable;          // 合并到表单值的额外数据
}

// FormActionType - 表单操作方法（useForm 返回的方法）
export interface FormActionType {
  getFieldsValue: () => Recordable;                                    // 获取表单值
  setFieldsValue: <T>(values: T) => Promise<void>;                     // 设置表单值
  resetFields: () => Promise<void>;                                    // 重置表单
  validate: (nameList?: NamePath[]) => Promise<any>;                   // 校验整个表单
  validateFields: (nameList?: NamePath[]) => Promise<any>;             // 校验指定字段
  submit: () => Promise<void>;                                         // 提交表单
  clearValidate: (name?: string | string[]) => Promise<void>;          // 清空校验
  scrollToField: (name: NamePath, options?: ScrollOptions) => Promise<void>; // 滚动到字段
  
  // Schema 操作
  updateSchema: (data: Partial<FormSchema> | Partial<FormSchema>[]) => Promise<void>;  // 更新 Schema
  removeSchemaByField: (field: string | string[]) => Promise<void>;    // 删除 Schema
  appendSchemaByField: (schema: FormSchema, prefixField?: string, first?: boolean) => Promise<void>; // 插入 Schema
  
  // Props 操作
  setProps: (formProps: Partial<FormProps>) => Promise<void>;          // 设置 Props
}

// 辅助类型
export interface ColEx {
  span?: number;
  offset?: number;
  xs?: number | { span?: number; offset?: number };
  sm?: number | { span?: number; offset?: number };
  md?: number | { span?: number; offset?: number };
  lg?: number | { span?: number; offset?: number };
  xl?: number | { span?: number; offset?: number };
  xxl?: number | { span?: number; offset?: number };
}

export interface ActionButtonOptions {
  text?: string;
  loading?: boolean;
  disabled?: boolean;
  preIcon?: string;
  postIcon?: string;
  iconSize?: number;
  color?: 'error' | 'warning' | 'success' | 'primary' | 'default';
  onClick?: () => any;
}

export interface HelpComponentProps {
  maxWidth?: string;
  showIndex?: boolean;
  text?: string | string[];
  color?: string;
  fontSize?: string;
  icon?: string;
  absolute?: boolean;
  position?: any;
}

export type FieldMapToTime = [string, [string, string], string?][];  // [field, [startField, endField], format?]

export type NamePath = string | number | (string | number)[];
export type Recordable<T = any> = Record<string, T>;
```

## 三、核心功能实现要求

### 1. useForm 实现
```typescript
// 必须实现以下签名
export function useForm(props?: FormProps): [
  (instance: FormActionType) => void,  // register 函数
  FormActionType                       // 操作方法对象
]
```

**关键逻辑**：
- 使用 `ref` 存储表单实例
- `register` 函数接收 `FormActionType` 实例并存储
- 所有方法通过存储的实例调用实际组件方法

### 2. BasicForm.vue 实现要点

**模板结构**：
```vue
<template>
  <a-form 
    :model="formModel" 
    v-bind="formProps"
    @finish="handleSubmit"
  >
    <a-row v-bind="rowProps">
      <!-- 普通 Schema 项 -->
      <template v-for="schema in getSchema" :key="schema.field">
        <FormItem 
          v-if="getShow(schema).ifShow"
          :schema="schema"
          :form-model="formModel"
          :form-action-type="formActionType"
          v-bind="getShow(schema).show"
        />
      </template>
      
      <!-- 操作按钮区域 -->
      <a-col v-bind="actionColOptions" v-if="showActionButtonGroup">
        <a-space>
          <slot name="resetBefore" />
          <a-button v-if="showResetButton" @click="handleReset" v-bind="resetButtonOptions">
            {{ resetButtonOptions.text || '重置' }}
          </a-button>
          <slot name="submitBefore" />
          <a-button v-if="showSubmitButton" type="primary" html-type="submit" v-bind="submitButtonOptions">
            {{ submitButtonOptions.text || '提交' }}
          </a-button>
        </a-space>
      </a-col>
    </a-row>
  </a-form>
</template>
```

**关键逻辑**：
- 使用 `shallowRef` 或 `reactive` 管理表单数据 `formModel`
- 使用 `computed` 处理 `getSchema`，支持动态更新
- 实现 `fieldMapToTime` 转换逻辑（时间范围字段映射）
- 支持 `Divider` 类型特殊处理（占满整行、作为分隔线）

### 3. FormItem.vue 实现要点

**职责**：
- 根据 `schema.component` 从 `componentMap` 获取实际组件
- 处理 `componentProps` 的函数形式（传入 schema、formModel、formActionType）
- 处理 `rules` 的动态生成（支持 `dynamicRules` 和 `required`）
- 处理 `show`/`ifShow`/`dynamicDisabled` 的动态计算
- 支持 `render` 函数优先级高于组件映射

**伪代码逻辑**：
```typescript
// 获取组件 props
const getComponentProps = computed(() => {
  const { componentProps } = props.schema;
  if (isFunction(componentProps)) {
    return componentProps({
      schema: props.schema,
      formModel: props.formModel,
      formActionType: props.formActionType,
      field: props.schema.field,
    });
  }
  return componentProps || {};
});

// 获取校验规则
const getRules = computed(() => {
  const { rules, required, dynamicRules } = props.schema;
  if (isFunction(dynamicRules)) {
    return dynamicRules({ schema, values: formModel, model: formModel, field });
  }
  if (required && !rules) {
    return [{ required: true, message: `${label}不能为空` }];
  }
  return rules;
});
```

### 4. componentMap.ts 实现

```typescript
import { Input, Select, DatePicker, /* ... */ } from 'ant-design-vue';
import ApiSelect from './components/ApiSelect.vue';
import RadioButtonGroup from './components/RadioButtonGroup.vue';
// ...

const componentMap = new Map<ComponentType, Component>();

componentMap.set('Input', Input);
componentMap.set('InputGroup', Input.Group);
componentMap.set('InputPassword', Input.Password);
componentMap.set('InputSearch', Input.Search);
componentMap.set('InputTextArea', Input.TextArea);
componentMap.set('Select', Select);
componentMap.set('ApiSelect', ApiSelect);
componentMap.set('RadioButtonGroup', RadioButtonGroup);
componentMap.set('DatePicker', DatePicker);
componentMap.set('RangePicker', DatePicker.RangePicker);
// ... 其他组件

export { componentMap };
```

### 5. ApiSelect 组件实现

**Props**（必须包含）：
- `api`: `() => Promise<OptionsItem[]>` - 数据接口
- `params`: `object` - 接口参数（响应式，变化自动重新加载）
- `resultField`: `string` - 结果字段路径（如 'data.list'）
- `labelField`: `string` - 标签字段（默认 'label'）
- `valueField`: `string` - 值字段（默认 'value'）
- `immediate`: `boolean` - 是否立即请求（默认 true）
- `numberToString`: `boolean` - 是否将 number 转为 string

**功能**：
- 使用 `watch` 监听 `params` 变化，自动重新加载
- 加载状态管理（loading）
- 支持 `v-model:value` 绑定

### 6. 高级功能实现

**fieldMapToTime 处理**：
```typescript
// 提交前转换时间范围字段
const handleSubmit = async () => {
  let values = { ...formModel };
  
  // fieldMapToTime 转换
  // ['datetime', ['startTime', 'endTime'], 'YYYY-MM-DD']
  props.fieldMapToTime?.forEach(([field, [startField, endField], format]) => {
    const rangeValue = values[field];
    if (rangeValue && isArray(rangeValue) && rangeValue.length === 2) {
      const [start, end] = rangeValue;
      if (format === 'timestamp') {
        values[startField] = dayjs(start).unix();
        values[endField] = dayjs(end).unix();
      } else if (format === 'timestampStartDay') {
        values[startField] = dayjs(start).startOf('day').unix();
        values[endField] = dayjs(end).startOf('day').unix();
      } else {
        values[startField] = dayjs(start).format(format || 'YYYY-MM-DD');
        values[endField] = dayjs(end).format(format || 'YYYY-MM-DD');
      }
      delete values[field]; // 删除原字段
    }
  });
  
  emit('submit', values);
};
```

## 四、代码示例要求

请提供以下 4 个完整使用示例：

### 示例 1：基础用法（useForm 方式）
```typescript
const schemas: FormSchema[] = [
  {
    field: 'username',
    component: 'Input',
    label: '用户名',
    required: true,
    colProps: { span: 12 },
  },
  {
    field: 'status',
    component: 'Select',
    label: '状态',
    componentProps: {
      options: [
        { label: '启用', value: 1 },
        { label: '禁用', value: 0 },
      ],
    },
  },
];

const [register, { validate, setFieldsValue }] = useForm({
  labelWidth: 100,
  schemas,
  showSubmitButton: true,
  submitFunc: async () => {
    const values = await validate();
    console.log(values);
  },
});
```

### 示例 2：动态显示/联动
```typescript
const schemas: FormSchema[] = [
  {
    field: 'type',
    component: 'Select',
    label: '类型',
    componentProps: {
      options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }],
    },
  },
  {
    field: 'aField',
    component: 'Input',
    label: 'A 类型字段',
    show: ({ values }) => values.type === 'a',  // 动态显示
  },
  {
    field: 'bField',
    component: 'InputNumber',
    label: 'B 类型字段',
    ifShow: ({ values }) => values.type === 'b', // JS 控制显示
    dynamicDisabled: ({ values }) => values.type !== 'b', // 动态禁用
  },
];
```

### 示例 3：ApiSelect 远程加载
```typescript
const schemas: FormSchema[] = [
  {
    field: 'userId',
    component: 'ApiSelect',
    label: '选择用户',
    componentProps: {
      api: async () => {
        const res = await fetchUsers();
        return res.data.list;
      },
      params: { status: 1 },  // 自动监听变化
      labelField: 'nickname',
      valueField: 'id',
      immediate: true,
    },
  },
];
```

### 示例 4：自定义渲染
```typescript
const schemas: FormSchema[] = [
  {
    field: 'custom',
    label: '自定义渲染',
    colProps: { span: 12 },
    render: ({ model, field }) => {
      return h(Input, {
        value: model[field],
        onChange: (e) => { model[field] = e.target.value; },
        placeholder: '完全自定义渲染',
      });
    },
  },
  {
    field: 'withSuffix',
    component: 'Input',
    label: '带后缀',
    componentProps: { placeholder: '请输入金额' },
    renderComponentContent: () => ({
      suffix: () => h('span', '元'),
    }),
  },
];
```

## 五、性能与边界要求

1. **响应式优化**：使用 `shallowRef` 存储表单数据，避免深层响应式开销
2. **防抖处理**：`ApiSelect` 等远程组件需防抖处理
3. **内存管理**：`useComponentRegister` 注册的组件在页面销毁时清理
4. **类型安全**：所有 Props、Emits、Slots 必须完整类型定义
5. **错误处理**：API 错误时显示友好提示，不阻断表单功能

## 六、输出要求

1. 提供完整的可运行代码（TypeScript 无类型错误）
2. 包含所有类型的详细 JSDoc 注释
3. 提供 `Form.md` 文档说明（包含所有 Props、Methods、Types）
4. 代码风格使用 Vue 3 `<script setup lang="ts">` 语法
5. 使用 `dayjs` 处理日期，`async-validator` 处理校验

请按以上要求生成完整的表单组件代码库。
```