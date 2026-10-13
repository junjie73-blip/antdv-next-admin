import type { Component, VNode } from 'vue';

import type { ComponentType } from './componentMap';

export type Recordable<T = any> = Record<string, T>;

export type NamePath = (number | string)[] | number | string;

export type FieldMapToTime = [string, [string, string], string?][];

/**
 * 兼容旧 antdv `RuleObject` 的规则结构（本仓库实现为自有类型，不再依赖 antdv-next）。
 * 支持：required / type / min / max / len / pattern / whitespace / validator。
 */
export interface Rule {
  enum?: Recordable;
  len?: number;
  max?: number;
  message?: string;
  min?: number;
  pattern?: RegExp | string;
  required?: boolean;
  transform?: (v: any) => any;
  type?:
    | 'array'
    | 'boolean'
    | 'email'
    | 'float'
    | 'integer'
    | 'number'
    | 'object'
    | 'regexp'
    | 'string'
    | 'url';
  validator?: (
    rule: Rule,
    value: any,
    callback?: (error?: any) => void,
  ) => any;
  whitespace?: boolean;
  /** 兼容旧字段；本实现统一在 change/submit 时校验 */
  trigger?: string;
  [key: string]: unknown;
}

/** 24 栅格列配置（替代 antdv ColProps） */
export interface ColEx {
  class?: string;
  offset?: number;
  order?: number;
  pull?: number;
  push?: number;
  span?: number;
  style?: Record<string, any>;
}

/** a-form-item 透传属性（宽松兼容） */
export type FormItemProps = Record<string, any>;

export interface RenderCallbackParams<T extends ComponentType = ComponentType> {
  field: string;
  model: Recordable;
  schema: FormSchema<T>;
  values: Recordable;
}

export interface ActionButtonOptions {
  disabled?: boolean;
  iconSize?: number;
  loading?: boolean;
  onClick?: () => any;
  postIcon?: string;
  preIcon?: string;
  text?: string;
}

export interface HelpComponentProps {
  absolute?: boolean;
  color?: string;
  fontSize?: string;
  icon?: string;
  maxWidth?: string;
  position?: any;
  showIndex?: boolean;
  text?: string | string[];
}

export interface BaseFormSchema {
  field: string;
  label?: string;
  subLabel?: string;
  rules?: Rule[];
  required?: boolean;
  rulesMessageJoinLabel?: boolean;
  defaultValue?: any;

  colProps?: Partial<ColEx>;
  labelWidth?: number | string;
  disabledLabelWidth?: boolean;
  itemProps?: Partial<FormItemProps>;
  emptySpan?: number | Partial<ColEx>;

  /** 全行对齐：当在多列布局(grid.cols>1)中独占一行时，输入框宽度自动对齐到多列总宽度 */
  fullRowAlign?: boolean;

  show?: ((params: RenderCallbackParams) => boolean) | boolean;
  ifShow?: ((params: RenderCallbackParams) => boolean) | boolean;
  dynamicDisabled?: ((params: RenderCallbackParams) => boolean) | boolean;
  dynamicRules?: ((params: RenderCallbackParams) => Rule[]) | Rule[];

  render?: (params: RenderCallbackParams) => string | VNode | VNode[];
  renderColContent?: (params: RenderCallbackParams) => string | VNode | VNode[];
  renderComponentContent?: (params: RenderCallbackParams) => any;

  slot?: string;
  colSlot?: string;

  suffix?:
    | ((params: RenderCallbackParams) => number | string)
    | number
    | string;
  changeEvent?: string;
  helpMessage?: string | string[];
  helpComponentProps?: HelpComponentProps;
  isAdvanced?: boolean;

  children?: BaseFormSchema[];
}

export interface FormSchema<
  T extends ComponentType = ComponentType,
> extends BaseFormSchema {
  component?: T;
  /** 控件属性：对象或随表单值动态计算的函数 */
  componentProps?:
    | ((params: RenderCallbackParams<T>) => Record<string, any>)
    | Record<string, any>;
}

export interface FormGridProps {
  /** 每行列数，1-4。如设置 2 则每行两个字段 */
  cols?: number;
  /** 列间距，默认 24 */
  gutter?: [number, number] | number;
  /** 响应式断点配置，如 { xs: 1, sm: 2, md: 3 } */
  responsive?: Record<string, number>;
}

export interface FormProps {
  schemas?: FormSchema[];
  model?: Recordable;
  labelWidth?: number | string;
  labelAlign?: 'left' | 'right';
  labelCol?: Partial<ColEx>;
  wrapperCol?: Partial<ColEx>;
  baseColProps?: Partial<ColEx>;
  baseRowStyle?: Record<string, any>;
  grid?: FormGridProps;
  submitOnReset?: boolean;
  autoFocusFirstItem?: boolean;
  compact?: boolean;
  size?: 'default' | 'large' | 'small';
  disabled?: boolean;
  autoSetPlaceHolder?: boolean;
  autoSubmitOnEnter?: boolean;
  rulesMessageJoinLabel?: boolean;
  showAdvancedButton?: boolean;
  autoAdvancedLine?: number;
  alwaysShowLines?: number;
  showActionButtonGroup?: boolean;
  showResetButton?: boolean;
  showSubmitButton?: boolean;
  resetButtonOptions?: ActionButtonOptions;
  submitButtonOptions?: ActionButtonOptions;
  actionColOptions?: Partial<ColEx>;
  resetFunc?: () => Promise<void>;
  submitFunc?: () => Promise<void>;
  fieldMapToTime?: FieldMapToTime;
  mergeDynamicData?: Recordable;
  colon?: boolean;
  scrollToFirstError?: boolean;
}

/** 校验失败时抛出的错误（兼容旧 antdv 结构） */
export interface FormValidateError {
  errorFields?: { name: string; errors: string[] }[];
  outOfDate?: boolean;
  values?: Recordable;
}

export interface FormActionType {
  getFieldsValue: () => Recordable;
  setFieldsValue: <T>(values: T) => Promise<void>;
  resetFields: () => Promise<void>;
  validate: (nameList?: NamePath[]) => Promise<any>;
  validateFields: (nameList?: NamePath[]) => Promise<any>;
  submit: () => Promise<void>;
  clearValidate: (name?: string | string[]) => Promise<void>;
  scrollToField: (
    name: NamePath,
    options?: ScrollIntoViewOptions,
  ) => Promise<void>;

  updateSchema: (
    data: Partial<FormSchema> | Partial<FormSchema>[],
  ) => Promise<void>;
  removeSchemaByField: (field: string | string[]) => Promise<void>;
  appendSchemaByField: (
    schema: FormSchema,
    prefixField?: string,
    first?: boolean,
  ) => Promise<void>;

  setProps: (formProps: Partial<FormProps>) => Promise<void>;

  /** 底层 @tanstack/vue-form 实例（替代旧 antd FormInstance） */
  getForm: () => any;

  /**
   * 实例当前是否还挂在组件树上。
   * `useForm` 依据它判断"现在写进去有没有人看得见"（详见 useForm.ts）。
   */
  isMounted?: () => boolean;
}

export type UseFormReturnType = [
  register: (instance: FormActionType) => void,
  methods: FormActionType,
];

export interface ComponentMapType {
  [key: string]: Component;
}

export interface ApiSelectProps {
  api?: (...args: any[]) => Promise<any>;
  immediate?: boolean;
  labelField?: string;
  numberToString?: boolean;
  options?: any[];
  params?: Recordable;
  resultField?: string;
  valueField?: string;
}
