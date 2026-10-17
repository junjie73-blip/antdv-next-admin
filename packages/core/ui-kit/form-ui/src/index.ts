export { default as FormItem } from './components/form-render/form-field.vue';
export { default as BasicForm } from './components/form-render/form.vue';

export {
  getDynamicDisabled,
  getDynamicRules,
  getShow,
  setComponentProps,
} from './components/form-render/helper';

export {
  deepMerge,
  formatDateFields,
  handleRangeValue,
} from './components/form-render/utils';

export { addComponent, componentMap, getComponent } from './config';

export type { ComponentType } from './config';

export { compileFieldValidator, runRule } from './rule-registry';

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

export { useForm } from './use-antdv-form';
