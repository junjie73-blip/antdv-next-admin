import type { ComputedRef, Ref } from 'vue';

import type { FormProps } from '../../../types';

import { computed } from 'vue';

import {
  resolveAdvancedButtonOptions,
  resolveResetButtonOptions,
  resolveSubmitButtonOptions,
} from '../helpers/buttons';

export interface UseFormButtonsOptions {
  getProps: ComputedRef<FormProps>;
  /** 折叠状态（来自 `useFormRows`），决定"展开/收起"的文案与箭头 */
  isAdvanced: Ref<boolean>;
}

/**
 * 三颗按钮的最终配置。
 *
 * 文案与图标都有内置默认（`查询 / 重置 / 展开`），调用方给同名字段就覆盖 ——
 * 默认值只写一处（`helpers/buttons.ts`），模板里不再散着 `||` 兜底。
 */
export function useFormButtons(options: UseFormButtonsOptions) {
  const { getProps, isAdvanced } = options;

  const submitButtonOptions = computed(() =>
    resolveSubmitButtonOptions(getProps.value.submitButtonOptions),
  );

  const resetButtonOptions = computed(() =>
    resolveResetButtonOptions(getProps.value.resetButtonOptions),
  );

  const advancedButtonOptions = computed(() =>
    resolveAdvancedButtonOptions(isAdvanced.value),
  );

  return { advancedButtonOptions, resetButtonOptions, submitButtonOptions };
}

export type UseFormButtonsReturn = ReturnType<typeof useFormButtons>;
