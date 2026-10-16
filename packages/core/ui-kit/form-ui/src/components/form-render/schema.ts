import type { VNode } from 'vue';

import type { ComponentType } from '../../config';

export type { ComponentType };

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
  validator?: (rule: Rule, value: any, callback?: (error?: any) => void) => any;
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

/** 单个字段的透传属性（宽松兼容旧 a-form-item 的用法） */
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
