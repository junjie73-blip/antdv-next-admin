import type { Ref } from 'vue';

import type { FormProps } from '../../../types';
import type { FormSchema } from '../schema';

import { computed, getCurrentInstance, ref, unref } from 'vue';

import { deepMerge } from '../utils';

export interface UseFormConfigOptions {
  /** 组件收到的原始 props（`defineProps` 的返回值） */
  props: FormProps;
  /** schema 换了一批之后的收尾（灌默认值） */
  onSchemasReplaced: () => void;
  schemaRef: Ref<FormSchema[]>;
}

/**
 * 配置合并：`props`（模板上写的）与 `propsRef`（`setProps` 传进来的）合成实际生效的一份。
 *
 * 这里有两个坑不显眼但会咬人，都留了注释：
 *
 * 1. **`explicitPropKeys`**：Vue 会把 Boolean prop 在"父级没传"时 cast 成 `false`，
 *    `withDefaults` 的默认值也落在同一个对象里；`deepMerge` 的标量规则是"目标优先"，
 *    于是这些合成值会盖掉 `setProps` 的配置 —— 而 `useForm(options)` 的配置正是走
 *    `setProps` 这条路，结果就是 `showAdvancedButton: true` 这类开关永远打不开。
 *    所以只有 `vnode.props` 里真的出现过的键才算父级的显式意图。
 * 2. **`schemas` 绝不进 `propsRef`**：合并时数组会被拼接，schema 单独用 `schemaRef` 存。
 */
export function useFormConfig(options: UseFormConfigOptions) {
  const { onSchemasReplaced, props, schemaRef } = options;

  const propsRef = ref<Partial<FormProps>>({});

  /** 父级**真的绑过**的 prop 键名（camel 与 kebab 两种写法都登记） */
  const instance = getCurrentInstance();
  const explicitPropKeys = computed(() => {
    const raw = instance?.vnode?.props ?? {};
    const keys = new Set<string>();
    for (const key of Object.keys(raw)) {
      keys.add(key);
      keys.add(
        key.replaceAll(/-([a-z])/gu, (_m, c: string) => c.toUpperCase()),
      );
    }
    return keys;
  });

  /** 实际生效的配置：运行时配置打底，模板上显式绑过的键覆盖它 */
  const getProps = computed(() => {
    const merged = { ...props } as Record<string, any>;
    const runtime = unref(propsRef) as Record<string, any>;
    for (const key of Object.keys(runtime)) {
      const value = runtime[key];
      if (value === undefined || explicitPropKeys.value.has(key)) continue;
      merged[key] = value;
    }
    merged.schemas = unref(schemaRef);
    return merged as FormProps;
  });

  async function setProps(newProps: Partial<FormProps>) {
    // schemas 单独处理，绝不进入 propsRef，避免合并时数组被拼接
    const { schemas, ...rest } = newProps;
    /* `deepMerge` 的标量规则是"目标优先"，所以把新来的补丁放在 target：
       后一次 `setProps` 要能改掉前一次的配置（`disabled: true` 关不回 false 就是 bug）。 */
    propsRef.value = deepMerge({ ...rest }, unref(propsRef) || {});
    if (schemas) {
      schemaRef.value = schemas;
      onSchemasReplaced();
    }
  }

  return { getProps, propsRef, setProps };
}

export type UseFormConfigReturn = ReturnType<typeof useFormConfig>;
