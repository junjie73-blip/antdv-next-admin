import type { ComputedRef, InjectionKey } from 'vue';

import type { ResponsiveColumn } from './grid';

export interface DescriptionsContext {
  bordered: boolean;
  column: ResponsiveColumn;
  layout: 'horizontal' | 'vertical';
  size: 'default' | 'middle' | 'small';
  /** 统一 label 列宽（数字按 px，字符串原样），由列级而非单元格内部控制对齐 */
  labelWidth?: number | string;
}

export const DESCRIPTIONS_KEY: InjectionKey<ComputedRef<DescriptionsContext>> =
  Symbol('descriptions');
