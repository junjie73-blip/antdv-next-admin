import type { Component } from 'vue';

import type {
  ActionButtonOptions,
  ColEx,
  FieldMapToTime,
  FormSchema,
  NamePath,
  Recordable,
} from './components/form-render/schema';

export type {
  ActionButtonOptions,
  BaseFormSchema,
  ColEx,
  ComponentType,
  FieldMapToTime,
  FormItemProps,
  FormSchema,
  HelpComponentProps,
  NamePath,
  Recordable,
  RenderCallbackParams,
  Rule,
} from './components/form-render/schema';

/** 剩下的都是「用表单的人」要看到的类型：属性、实例 API、返回值。 */

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

/** 校验失败时抛出的错误：`name` 是字段路径数组，`message` 是第一条错误文案 */
export interface FormValidateError {
  errorFields?: { errors: string[]; name: (number | string)[] }[];
  message?: string;
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
   * `useForm` 依据它判断"现在写进去有没有人看得见"（详见 use-antdv-form.ts）。
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
