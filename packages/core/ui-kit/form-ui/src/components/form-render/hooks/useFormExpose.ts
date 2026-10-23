import type { Ref } from 'vue';

import type {
  FormActionType,
  FormProps,
  FormSchema,
  NamePath,
  Recordable,
} from '../../../types';
import type { TanstackForm } from './useFormModel';

import { onBeforeUnmount, onMounted, ref } from 'vue';

export interface UseFormExposeOptions {
  appendSchemaByField: (
    schema: FormSchema,
    prefixField?: string,
    first?: boolean,
  ) => Promise<void>;
  clearValidate: (name?: string | string[]) => Promise<void>;
  /** 底层 TanStack 实例，`getForm()` 原样交给调用方 */
  form: TanstackForm;
  /**
   * 注入给字段的实例引用：`form-field.vue` 里点"跳到下一个字段"这类操作走它拿 API。
   * 由调用方创建 —— `provide` 发生在装配之前，得先有它才能注入。
   */
  formActionTypeRef: Ref<FormActionType | null>;
  getFieldsValue: () => Recordable;
  onRegister: (instance: FormActionType) => void;
  removeSchemaByField: (field: string | string[]) => Promise<void>;
  resetFields: () => Promise<void>;
  scrollToField: (
    name: NamePath,
    options?: ScrollIntoViewOptions,
  ) => Promise<void>;
  setFieldsValue: <T>(values: T) => Promise<void>;
  setProps: (props: Partial<FormProps>) => Promise<void>;
  submit: () => Promise<void>;
  updateSchema: (
    data: Partial<FormSchema> | Partial<FormSchema>[],
  ) => Promise<void>;
  validate: (nameList?: NamePath[]) => Promise<Recordable>;
  validateFields: (nameList?: NamePath[]) => Promise<Recordable>;
}

/**
 * 对外 API（`FormActionType`）的装配处，兼管"实例是否还挂在树上"这件事。
 *
 * 单独成一个 hook 的理由和 table 那边一样：改对外承诺时只看这一个文件就知道
 * 有没有破坏兼容。另外 `isMounted` 不是装饰 —— `useForm()` 靠它判断
 * "现在写进去有没有人看得见"（弹窗 `destroyOnHidden` 之后实例还留着引用，
 * 直接写值会静默丢失），所以生命周期与这份对象放在一起维护才不容易漏。
 */
export function useFormExpose(options: UseFormExposeOptions) {
  const { form, formActionTypeRef, onRegister, ...api } = options;

  /** 是否还挂在组件树上（useForm 依赖它把写值转成待写入队列） */
  const isMountedRef = ref(false);

  const formActionType: FormActionType = {
    ...api,
    getForm: () => form,
    isMounted: () => isMountedRef.value,
  };

  formActionTypeRef.value = formActionType;

  onMounted(() => {
    isMountedRef.value = true;
    onRegister(formActionType);
  });

  onBeforeUnmount(() => {
    isMountedRef.value = false;
  });

  return { formActionType, isMounted: isMountedRef };
}

export type UseFormExposeReturn = ReturnType<typeof useFormExpose>;
