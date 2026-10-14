import type { ComputedRef, InjectionKey } from 'vue';

export interface DescriptionsContext {
  bordered: boolean;
  column: number;
  layout: 'horizontal' | 'vertical';
  size: 'default' | 'middle' | 'small';
}

export const DESCRIPTIONS_KEY: InjectionKey<ComputedRef<DescriptionsContext>> =
  Symbol('descriptions');
