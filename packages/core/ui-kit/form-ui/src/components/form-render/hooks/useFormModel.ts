import type { Ref } from 'vue';

import type { FormSchema, NamePath, Recordable } from '../schema';

import { reactive, ref } from 'vue';

import { useForm as useTanstackForm } from '@tanstack/vue-form';

/**
 * 底层 TanStack 表单实例的类型别名。
 *
 * TanStack 的 `useForm` 有 12 个泛型位，本包只用到值与 meta，其余全部留空；
 * 把这串泛型收在一个工厂函数里，调用方（含 `context.ts`）只需要这个别名，
 * 不必每处抄一遍 `undefined × 11`。
 */
function createFormInstance() {
  return useTanstackForm<
    Recordable,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined
  >({
    defaultValues: {},
  });
}

export type TanstackForm = ReturnType<typeof createFormInstance>;

export interface UseFormModelOptions {
  /** 当前 schema 列表：默认值与"清哪些字段的校验"都从它取 */
  schemaRef: Ref<FormSchema[]>;
}

/**
 * 表单值这一层：TanStack 实例 + 默认值集合 + 插槽用的读写代理。
 *
 * 单独成一个 hook 有两个原因。一是**默认值**（`defaults`）必须是同一个响应式对象：
 * `initFormModel` 增量写、`resetFields` 读，散在两处很容易写成两份。二是插槽侧的
 * `formModel` 代理只依赖实例本身，和"配置怎么合并""行怎么分组"无关，
 * 分出去以后 form.vue 里不再混着"值"和"排版"两类状态。
 */
export function useFormModel(options: UseFormModelOptions) {
  const { schemaRef } = options;

  const form: TanstackForm = createFormInstance();

  /** 表单默认值集合（`resetFields` 的目标）；用 reactive 便于 initFormModel 增量写入 */
  const defaults = reactive<Recordable>({});

  /** 是否已经尝试过提交（校验失败时用于决定错误信息是否展示） */
  const submitAttemptedRef = ref(false);

  const getValues = (): Recordable => ({ ...form.state.values });

  /**
   * 给插槽用的表单值代理。
   *
   * `getValues()` 返回的是快照，插槽里 `v-model="model[field]"` 写回去只会落在
   * 一次性对象上；代理把读写都接到表单本身，赋值走 `setFieldValue`（才会触发校验）。
   */
  const readModelValue = (key: string) =>
    (form.state.values as Recordable | undefined)?.[key];

  const formModel = new Proxy({} as Recordable, {
    get(_target, key) {
      return typeof key === 'symbol' ? undefined : readModelValue(key);
    },
    getOwnPropertyDescriptor(_target, key) {
      return {
        configurable: true,
        enumerable: true,
        value: readModelValue(key as string),
      };
    },
    has(_target, key) {
      return key in (form.state.values ?? {});
    },
    ownKeys() {
      return Reflect.ownKeys(form.state.values ?? {});
    },
    set(_target, key, value) {
      if (typeof key !== 'symbol') form.setFieldValue(key, value);
      return true;
    },
  });

  /** 把 schema 上声明的 `defaultValue` 灌进实例与默认值集合（可重复调用，幂等） */
  function initFormModel() {
    const schemas = schemaRef.value || [];
    schemas.forEach((schema) => {
      if (!schema) return;
      if (schema.field && schema.defaultValue !== undefined) {
        defaults[schema.field] = schema.defaultValue;
        form.setFieldValue(schema.field as any, schema.defaultValue);
      }
    });
  }

  /** 只挑 `nameList` 里点名的字段；没点名就是全量 */
  function collectValues(nameList?: NamePath[]): Recordable {
    const all = { ...form.state.values };
    if (!nameList || nameList.length === 0) return all;
    const picked: Recordable = {};
    nameList.forEach((name) => {
      const key = String(name);
      picked[key] = all[key];
    });
    return picked;
  }

  function getFieldsValue(): Recordable {
    return { ...form.state.values };
  }

  async function setFieldsValue<T>(values: T) {
    Object.keys(values as any).forEach((key) => {
      form.setFieldValue(key as any, (values as any)[key]);
    });
  }

  async function resetFields() {
    submitAttemptedRef.value = false;
    form.reset({ ...defaults });
  }

  /**
   * 清空校验结果。
   *
   * `errors` 由 `errorMap` 派生，只抹 `errors` 会在下一次派生时又被填回来，
   * 所以必须连 `errorMap` 一起清。
   */
  async function clearValidate(name?: string | string[]) {
    // 不点名就是全量：清整张表；点名支持单个字符串或字符串数组
    let fields: string[] = allFieldNames();
    if (name) fields = Array.isArray(name) ? name : [name];
    fields.forEach((field) => {
      form.setFieldMeta(field as any, (meta: any) => ({
        ...meta,
        errorMap: {},
        errors: [],
        isTouched: false,
        isBlurred: false,
      }));
    });
    submitAttemptedRef.value = false;
  }

  /** schema 里所有声明了 field 的字段名，校验与清理的默认作用范围 */
  function allFieldNames(): string[] {
    return (schemaRef.value || [])
      .filter((s) => s && s.field)
      .map((s) => s.field);
  }

  return {
    allFieldNames,
    clearValidate,
    collectValues,
    defaults,
    form,
    formModel,
    getFieldsValue,
    getValues,
    initFormModel,
    resetFields,
    setFieldsValue,
    submitAttempted: submitAttemptedRef,
  };
}

export type UseFormModelReturn = ReturnType<typeof useFormModel>;
