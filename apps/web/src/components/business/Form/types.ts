import type {
  ColProps,
  FormInstance,
  FormItemProps,
  RuleObject,
} from 'antdv-next';

import type { Component, VNode } from 'vue';

import type { AntdvComponents, ComponentType } from './componentMap';

export type Recordable<T = any> = Record<string, T>;

// 提取组件的 Props 类型
type ExtractComponentProps<T> = T extends abstract new (props: infer P) => any
  ? P
  : never;

// 根据 ComponentType 映射到对应的 Props 类型
export interface ComponentPropsMap {
  [K in ComponentType]: ExtractComponentProps<AntdvComponents[K]>;
}

export type NamePath = (number | string)[] | number | string;

export type FieldMapToTime = [string, [string, string], string?][];

export type Rule = RuleObject;

export interface ColEx extends Partial<ColProps> {}

export interface RenderCallbackParams<T extends ComponentType = ComponentType> {
  schema: FormSchema<T>;
  values: Recordable;
  model: Recordable;
  field: string;
}

export interface ActionButtonOptions {
  text?: string;
  loading?: boolean;
  disabled?: boolean;
  preIcon?: string;
  postIcon?: string;
  iconSize?: number;
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

// 基础 FormSchema 接口（不带泛型）
interface BaseFormSchema {
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

  children?: FormSchema[];
}

// 泛型 FormSchema，根据 component 类型自动推断 componentProps
export interface FormSchema<
  T extends ComponentType = ComponentType,
> extends BaseFormSchema {
  component?: T;
  componentProps?:
    | ((params: RenderCallbackParams<T>) => Partial<ComponentPropsMap[T]>)
    | Partial<ComponentPropsMap[T]>;
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
  baseRowStyle?: object;
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

  getForm: () => FormInstance | null;

  /**
   * 实例当前是否还挂在组件树上。
   *
   * `useForm` 只拿得到上一次 `register` 传过来的对象引用，组件卸载后这个引用并不会变空，
   * 在它身上写值等于写进一具尸体（详见 `useForm.ts` 里的待写入队列）。
   * 所以由组件自己维护挂载标记，`useForm` 用它判断"现在写进去有没有人看得见"。
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
  params?: Recordable;
  resultField?: string;
  labelField?: string;
  valueField?: string;
  immediate?: boolean;
  numberToString?: boolean;
  options?: any[];
}
