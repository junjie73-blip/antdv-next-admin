import type { ComputedRef, InjectionKey } from 'vue';

export const TIMELINE_KEY: InjectionKey<
  ComputedRef<{ labelPlacement: 'left' | 'right'; labeled: boolean }>
> = Symbol('timeline');
