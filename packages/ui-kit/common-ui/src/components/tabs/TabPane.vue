<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';

import { TABS_KEY } from './context';

defineOptions({ name: 'TabPane' });

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    label?: string;
    tab?: string;
    value: number | string;
  }>(),
  {
    disabled: false,
    label: undefined,
    tab: undefined,
  },
);

const context = inject(TABS_KEY, undefined);
const isActive = computed(() => String(context?.value.active) === String(props.value));

// 首次激活后才挂载，之后靠 v-show 保留内部状态
const mounted = ref(isActive.value);
watch(isActive, (value) => {
  if (value) mounted.value = true;
});

if (context) context.value.register(props);
</script>

<template>
  <div v-if="mounted" data-common-tabs-pane :class="isActive ? '' : 'hidden'">
    <slot></slot>
  </div>
</template>
