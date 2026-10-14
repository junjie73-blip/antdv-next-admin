<script setup lang="ts">
import { computed } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';
import { cn } from '@antdv/shared/utils/cn';

defineOptions({ name: 'Result' });

const props = withDefaults(
  defineProps<{
    status?: ResultStatus;
    subTitle?: string;
    title?: string;
  }>(),
  {
    status: 'info',
    subTitle: undefined,
    title: undefined,
  },
);

type ResultStatus =
  | '403'
  | '404'
  | '500'
  | 'error'
  | 'info'
  | 'success'
  | 'warning';

/** 状态到图标/配色：错误页沿用迁移前 antd 的语义色 */
const PRESET: Record<ResultStatus, { color: string; icon: string }> = {
  '403': { color: 'text-amber-500', icon: 'carbon:warning' },
  '404': { color: 'text-blue-500', icon: 'carbon:document' },
  '500': { color: 'text-red-500', icon: 'carbon:fire' },
  error: { color: 'text-red-500', icon: 'carbon:close-outline' },
  info: { color: 'text-blue-500', icon: 'carbon:information' },
  success: { color: 'text-emerald-500', icon: 'carbon:checkmark-outline' },
  warning: { color: 'text-amber-500', icon: 'carbon:warning-alt' },
};

const preset = computed(
  () => PRESET[props.status] ?? PRESET.info
);

const iconClass = computed(() => cn('shrink-0', preset.value.color));
</script>

<template>
  <div
    data-common-result
    :data-status="props.status"
    class="flex flex-col items-center py-10 text-center"
  >
    <Icon :icon="preset.icon" :width="48" :class="iconClass" />

    <div v-if="props.title" class="mt-4 text-lg font-medium">
      {{ props.title }}
    </div>
    <div v-if="props.subTitle" class="mt-2 text-sm text-muted-foreground">
      {{ props.subTitle }}
    </div>

    <div v-if="$slots.default" class="mt-4 w-full">
      <slot></slot>
    </div>

    <div v-if="$slots.extra" class="mt-6 flex justify-center gap-2">
      <slot name="extra"></slot>
    </div>
  </div>
</template>
