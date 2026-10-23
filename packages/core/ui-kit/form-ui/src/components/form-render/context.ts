import type { ComputedRef, Ref } from 'vue';

import type { ColEx, FormActionType } from '../../types';
import type { Recordable } from './schema';

/**
 * `form.vue` → `form-field.vue` 的隐式契约。
 *
 * 用注入而不是逐层透传 props：字段数在运行时才知道，中间还夹着行分组，
 * 每加一个渲染参数都要改一遍模板。代价是这层契约没有编译期校验，
 * 所以键与形状都收在这里，两侧只允许 import 本文件。
 */
export interface FormContext {
  /** 底层 @tanstack/vue-form 实例 */
  form: any;
  /** 对外实例；`form.vue` 在装配末尾才填，所以这里是可空 */
  formActionTypeRef: Ref<FormActionType | null>;
  /** 插槽里直接读写的表单值代理（`getValues()` 是快照，写不回去） */
  getValues: () => Recordable;
  grid: {
    cols?: ComputedRef<number>;
    gutter?: ComputedRef<[number, number] | number>;
    span?: ComputedRef<number>;
  };
  /** 由 `useFormGrid` 的 `resolveLabelCol` 算出：`labelWidth` 或 `span`，二选一 */
  labelCol: ComputedRef<Partial<ColEx>>;
  model: Recordable;
  /** 校验失败时用于决定错误信息是否展示 */
  submitAttempted?: Ref<boolean>;
  wrapperCol: ComputedRef<Partial<ColEx>>;
  getProps: ComputedRef<any>;
}

export const FORM_CONTEXT_KEY = 'formContext';
