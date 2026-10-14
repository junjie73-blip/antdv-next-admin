import type { ComputedRef, InjectionKey } from 'vue';

import type { TabPaneProps } from './types';

export const TABS_KEY: InjectionKey<
  ComputedRef<{
    active: number | string | undefined;
    panes: TabPaneProps[];
    register: (pane: TabPaneProps) => void;
  }>
> = Symbol('tabs');
