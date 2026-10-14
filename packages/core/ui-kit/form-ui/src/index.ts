export { default as BasicForm } from './BasicForm.vue';
export {
  addComponent,
  componentMap,
  getComponent,
} from './componentMap';

export type { ComponentType } from './componentMap';
export { default as FormItem } from './components/FormItem.vue';

export {
  deepMerge,
  formatDateFields,
  getDynamicDisabled,
  getDynamicRules,
  getShow,
  handleRangeValue,
  setComponentProps,
} from './helper';

export { compileFieldValidator, runRule } from './rules';

export type {
  ActionButtonOptions,
  BaseFormSchema,
  ColEx,
  ComponentMapType,
  FieldMapToTime,
  FormActionType,
  FormGridProps,
  FormItemProps,
  FormProps,
  FormSchema,
  FormValidateError,
  HelpComponentProps,
  NamePath,
  Recordable,
  RenderCallbackParams,
  Rule,
  UseFormReturnType,
} from './types';

export { useForm } from './useForm';
