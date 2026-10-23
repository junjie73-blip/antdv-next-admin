import type { ActionButtonOptions } from '../schema';

/** 提交按钮的默认文案与图标，调用方的 `submitButtonOptions` 覆盖之 */
export function resolveSubmitButtonOptions(
  options?: ActionButtonOptions,
): ActionButtonOptions {
  return {
    preIcon: 'carbon:search',
    text: '查询',
    ...options,
  };
}

/** 重置按钮同上 */
export function resolveResetButtonOptions(
  options?: ActionButtonOptions,
): ActionButtonOptions {
  return {
    preIcon: 'carbon:restart',
    text: '重置',
    ...options,
  };
}

/**
 * 「展开 / 收起」这颗按钮的文案与图标。
 *
 * 它没有对应的调用方配置项（`showAdvancedButton` 只管要不要出现），
 * 所以完全由折叠状态决定，箭头方向跟文案一起翻，避免出现"写着收起、箭头朝下"。
 * 返回形状对齐 `FormActions` 的 `advancedOptions` prop（只有文案与图标两件事）。
 */
export function resolveAdvancedButtonOptions(isAdvanced: boolean): {
  icon: string;
  text: string;
} {
  return {
    icon: isAdvanced ? 'carbon:chevron-up' : 'carbon:chevron-down',
    text: isAdvanced ? '收起' : '展开',
  };
}
