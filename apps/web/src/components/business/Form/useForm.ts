import type {
  FormActionType,
  FormProps,
  FormSchema,
  NamePath,
  UseFormReturnType,
} from './types';

import { ref, unref } from 'vue';

import { deepMerge } from './helper';

export function useForm(props?: Partial<FormProps>): UseFormReturnType {
  const formRef = ref<FormActionType | null>(null);
  const formProps = ref<Partial<FormProps>>(props || {});

  /**
   * 表单还没挂载时的待写入值，挂载（`register`）那一刻兑现。
   *
   * 全站列表页都是这个写法：
   *
   * ```ts
   * formMethods.setFieldsValue(record)   // 先灌数据
   * modalMethods.openModal()             // 再开弹窗
   * ```
   *
   * 而 `BasicModal` 默认 `destroyOnHidden: true`：弹窗没开时表单组件根本不在组件树上，
   * 第一次打开后关闭，表单又被销毁。`formRef` 里留着的是**上一次 register 的对象引用**，
   * 卸载不会让它变 null —— 于是 `setFieldsValue` 写进了一具尸体，
   * 重新打开时表单渲染的是 schema 的 defaultValue，**编辑态永远回填不上**，
   * 保存还会把这条记录改成空值。表现就是"点编辑，弹窗里啥都没有"。
   *
   * 这里不去改 20 多个调用点的顺序（`openModal` 之后再 `await nextTick()` 灌值
   * 那种写法很脆，依赖 Modal 的挂载时机），而是让这个引用失效时把值暂存起来，
   * 等真正的实例注册上来再补写一次。
   */
  let pendingValues: null | Record<string, unknown> = null;

  /** 实例是否还在组件树上（老的/手搓的实例不带 `isMounted`，按"活着"处理） */
  function getLiveInstance(): FormActionType | null {
    const instance = unref(formRef);
    if (!instance) return null;
    return instance.isMounted?.() === false ? null : instance;
  }

  function register(instance: FormActionType) {
    if (instance) {
      formRef.value = instance;
      instance.setProps(unref(formProps));
      if (pendingValues) {
        void instance.setFieldsValue(pendingValues);
        pendingValues = null;
      }
    }
  }

  function getFormInstance(): FormActionType | null {
    return unref(formRef);
  }

  const methods: FormActionType = {
    getFieldsValue: () => {
      const instance = getFormInstance();
      return instance?.getFieldsValue() || {};
    },

    setFieldsValue: async <T>(values: T) => {
      const instance = getLiveInstance();
      if (instance) {
        await instance.setFieldsValue(values);
        return;
      }
      // 多次调用要累加而不是覆盖：后面的字段赢，符合"逐次灌值"的直觉
      pendingValues = { ...pendingValues, ...(values as Record<string, unknown>) };
    },

    resetFields: async () => {
      // 显式重置就是把待写入值也清掉，否则下次挂载又被旧数据盖回来
      pendingValues = null;
      const instance = getLiveInstance();
      if (instance) {
        await instance.resetFields();
      }
    },

    validate: async (nameList?: NamePath[]) => {
      const instance = getFormInstance();
      if (instance) {
        return instance.validate(nameList);
      }
      return {};
    },

    validateFields: async (nameList?: NamePath[]) => {
      const instance = getFormInstance();
      if (instance) {
        return instance.validateFields(nameList);
      }
      return {};
    },

    submit: async () => {
      const instance = getFormInstance();
      if (instance) {
        await instance.submit();
      }
    },

    clearValidate: async (name?: string | string[]) => {
      const instance = getFormInstance();
      if (instance) {
        await instance.clearValidate(name);
      }
    },

    scrollToField: async (name: NamePath, options?: ScrollIntoViewOptions) => {
      const instance = getFormInstance();
      if (instance) {
        await instance.scrollToField(name, options);
      }
    },

    updateSchema: async (data: Partial<FormSchema> | Partial<FormSchema>[]) => {
      const instance = getFormInstance();
      if (instance) {
        await instance.updateSchema(data);
      }
    },

    removeSchemaByField: async (field: string | string[]) => {
      const instance = getFormInstance();
      if (instance) {
        await instance.removeSchemaByField(field);
      }
    },

    appendSchemaByField: async (
      schema: FormSchema,
      prefixField?: string,
      first?: boolean,
    ) => {
      const instance = getFormInstance();
      if (instance) {
        await instance.appendSchemaByField(schema, prefixField, first);
      }
    },

    setProps: async (newProps: Partial<FormProps>) => {
      const instance = getFormInstance();
      if (instance) {
        await instance.setProps(newProps);
      }
      // 本地缓存：schemas 不参与合并，避免数组被拼接
      const { schemas, ...rest } = newProps;
      formProps.value = deepMerge(formProps.value || {}, rest);
      if (schemas) {
        formProps.value.schemas = schemas;
      }
    },

    getForm: () => {
      const instance = getFormInstance();
      return instance?.getForm() || null;
    },
  };

  return [register, methods];
}
