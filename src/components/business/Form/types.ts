import type { ColProps, FormInstance, FormItemProps } from 'antdv-next'
import type { Component, VNode } from 'vue'
import type { AntdvComponents, ComponentType } from './componentMap'

export type Recordable<T = any> = Record<string, T>

// 提取组件的 Props 类型
type ExtractComponentProps<T> = T extends abstract new (props: infer P) => any ? P : never

// 根据 ComponentType 映射到对应的 Props 类型
export type ComponentPropsMap = {
  [K in ComponentType]: ExtractComponentProps<AntdvComponents[K]>
}

export type NamePath = string | number | (string | number)[]

export type FieldMapToTime = [string, [string, string], string?][]

export type RuleType = 'string' | 'number' | 'boolean' | 'method' | 'regexp' | 'integer' | 'float' | 'object' | 'enum' | 'date' | 'url' | 'hex' | 'email' | 'tel'

export interface RuleObject {
  warningOnly?: boolean
  enum?: any[]
  len?: number
  max?: number
  message?: string
  min?: number
  pattern?: RegExp
  required?: boolean
  transform?: (value: any) => any
  type?: RuleType
  whitespace?: boolean
  trigger?: 'change' | 'blur' | 'focus' | ('change' | 'blur' | 'focus')[]
  validateTrigger?: 'change' | 'blur' | 'focus' | ('change' | 'blur' | 'focus')[]
  validator?: (rule: RuleObject, value: any, callback: (error?: string) => void) => Promise<void | any> | void
  defaultField?: RuleObject
}

export type Rule = RuleObject

export interface ColEx extends Partial<ColProps> {}

export interface RenderCallbackParams<T extends ComponentType = ComponentType> {
  schema: FormSchema<T>
  values: Recordable
  model: Recordable
  field: string
}

export interface ActionButtonOptions {
  text?: string
  loading?: boolean
  disabled?: boolean
  preIcon?: string
  postIcon?: string
  iconSize?: number
  onClick?: () => any
}

export interface HelpComponentProps {
  maxWidth?: string
  showIndex?: boolean
  text?: string | string[]
  color?: string
  fontSize?: string
  icon?: string
  absolute?: boolean
  position?: any
}

// 基础 FormSchema 接口（不带泛型）
interface BaseFormSchema {
  field: string
  label?: string
  subLabel?: string
  rules?: Rule[]
  required?: boolean
  rulesMessageJoinLabel?: boolean
  defaultValue?: any

  colProps?: Partial<ColEx>
  labelWidth?: string | number
  disabledLabelWidth?: boolean
  itemProps?: Partial<FormItemProps>
  emptySpan?: number | Partial<ColEx>

  /** 全行对齐：当在多列布局(grid.cols>1)中独占一行时，输入框宽度自动对齐到多列总宽度 */
  fullRowAlign?: boolean

  show?: boolean | ((params: RenderCallbackParams) => boolean)
  ifShow?: boolean | ((params: RenderCallbackParams) => boolean)
  dynamicDisabled?: boolean | ((params: RenderCallbackParams) => boolean)
  dynamicRules?: Rule[] | ((params: RenderCallbackParams) => Rule[])

  render?: (params: RenderCallbackParams) => VNode | VNode[] | string
  renderColContent?: (params: RenderCallbackParams) => VNode | VNode[] | string
  renderComponentContent?: (params: RenderCallbackParams) => any

  slot?: string
  colSlot?: string

  suffix?: string | number | ((params: RenderCallbackParams) => string | number)
  changeEvent?: string
  helpMessage?: string | string[]
  helpComponentProps?: HelpComponentProps
  isAdvanced?: boolean

  children?: FormSchema[]
}

// 泛型 FormSchema，根据 component 类型自动推断 componentProps
export interface FormSchema<T extends ComponentType = ComponentType> extends BaseFormSchema {
  component?: T
  componentProps?: Partial<ComponentPropsMap[T]> | ((params: RenderCallbackParams<T>) => Partial<ComponentPropsMap[T]>)
}

export interface FormGridProps {
  /** 每行列数，1-4。如设置 2 则每行两个字段 */
  cols?: number
  /** 列间距，默认 24 */
  gutter?: number | [number, number]
  /** 响应式断点配置，如 { xs: 1, sm: 2, md: 3 } */
  responsive?: Record<string, number>
}

export interface FormProps {
  schemas?: FormSchema[]
  model?: Recordable
  labelWidth?: number | string
  labelAlign?: 'left' | 'right'
  labelCol?: Partial<ColEx>
  wrapperCol?: Partial<ColEx>
  baseColProps?: Partial<ColEx>
  baseRowStyle?: object

  /** 网格布局配置，用于控制每行字段列数 */
  grid?: FormGridProps

  submitOnReset?: boolean
  autoFocusFirstItem?: boolean
  compact?: boolean
  size?: 'default' | 'small' | 'large'
  disabled?: boolean
  autoSetPlaceHolder?: boolean
  autoSubmitOnEnter?: boolean
  rulesMessageJoinLabel?: boolean

  showAdvancedButton?: boolean
  autoAdvancedLine?: number
  alwaysShowLines?: number

  showActionButtonGroup?: boolean
  showResetButton?: boolean
  showSubmitButton?: boolean
  resetButtonOptions?: ActionButtonOptions
  submitButtonOptions?: ActionButtonOptions
  actionColOptions?: Partial<ColEx>

  resetFunc?: () => Promise<void>
  submitFunc?: () => Promise<void>
  fieldMapToTime?: FieldMapToTime

  mergeDynamicData?: Recordable
}

export interface FormActionType {
  getFieldsValue: () => Recordable
  setFieldsValue: <T>(values: T) => Promise<void>
  resetFields: () => Promise<void>
  validate: (nameList?: NamePath[]) => Promise<any>
  validateFields: (nameList?: NamePath[]) => Promise<any>
  submit: () => Promise<void>
  clearValidate: (name?: string | string[]) => Promise<void>
  scrollToField: (name: NamePath, options?: ScrollIntoViewOptions) => Promise<void>

  updateSchema: (data: Partial<FormSchema> | Partial<FormSchema>[]) => Promise<void>
  removeSchemaByField: (field: string | string[]) => Promise<void>
  appendSchemaByField: (schema: FormSchema, prefixField?: string, first?: boolean) => Promise<void>

  setProps: (formProps: Partial<FormProps>) => Promise<void>

  getForm: () => FormInstance | null
}

export type UseFormReturnType = [register: (instance: FormActionType) => void, methods: FormActionType]

export interface ComponentMapType {
  [key: string]: Component
}

export interface ApiSelectProps {
  api?: (...args: any[]) => Promise<any>
  params?: Recordable
  resultField?: string
  labelField?: string
  valueField?: string
  immediate?: boolean
  numberToString?: boolean
  options?: any[]
}
