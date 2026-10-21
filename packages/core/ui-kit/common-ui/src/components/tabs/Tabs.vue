<script setup lang="ts">
import type { Ref } from 'vue';

import type { TabPaneProps } from './types';

import { computed, provide, ref, watch } from 'vue';

import { Tabs, TabsList, TabsTrigger } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

import { TABS_KEY } from './context';

defineOptions({ name: 'Tabs' });

const props = withDefaults(
  defineProps<{
    activeKey?: number | string;
    defaultActiveKey?: number | string;
    type?: 'card' | 'line';
  }>(),
  {
    activeKey: undefined,
    defaultActiveKey: undefined,
    type: 'line',
  },
);

const emits = defineEmits<{
  change: [number | string];
  'update:activeKey': [number | string];
}>();

const panes: Ref<TabPaneProps[]> = ref([]);
const innerActive = ref<number | string | undefined>(props.defaultActiveKey);

const active = computed(() => props.activeKey ?? innerActive.value);

function register(pane: TabPaneProps) {
  if (!panes.value.includes(pane)) panes.value.push(pane);
  // 首个标签在子组件注册后才可见
  if (active.value === undefined) innerActive.value = pane.value;
}

function activate(key: number | string) {
  if (String(key) === String(active.value)) return;
  if (props.activeKey === undefined) innerActive.value = key;
  emits('update:activeKey', key);
  emits('change', key);
}

// 受控值改变时（父组件直接赋值）也要通知一次 change 之外的情形：只同步内部值
watch(
  () => props.activeKey,
  (value) => {
    if (value !== undefined) innerActive.value = value;
  },
);

provide(
  TABS_KEY,
  computed(() => ({
    active: active.value,
    panes: panes.value,
    register,
  })),
);

const listClass = computed(() =>
  cn(
    props.type === 'line'
      ? 'rounded-none border-b bg-transparent p-0'
      : 'rounded-none bg-transparent p-0',
  ),
);

const triggerClass = computed(() => {
  if (props.type === 'line') {
    return cn(
      'data-[state=active]:border-primary rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none',
    );
  }
  return cn(
    'data-[state=active]:bg-background rounded-t-md border border-b-0 bg-gray-50 data-[state=active]:shadow-none dark:bg-gray-800/60',
  );
});
</script>

<template>
  <Tabs
    data-common-tabs
    :model-value="String(active ?? '')"
    class="gap-0"
    @update:model-value="(value: any) => activate(String(value))"
  >
    <TabsList data-common-tabs-list :class="listClass">
      <TabsTrigger
        v-for="pane in panes"
        :key="String(pane.value)"
        :class="triggerClass"
        :disabled="pane.disabled"
        :value="String(pane.value)"
        @click="activate(pane.value)"
      >
        {{ pane.label ?? pane.tab }}
      </TabsTrigger>
    </TabsList>
    <div data-common-tabs-content class="pt-3">
      <slot></slot>
    </div>
  </Tabs>
</template>
