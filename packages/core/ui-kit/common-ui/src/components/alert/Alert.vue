<script setup lang="ts">
import type { AlertVariants } from '@antdv/shadcn-ui';

import { computed } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';
import {
  AlertDescription,
  AlertTitle,
  Alert as ShadcnAlert,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

defineOptions({ name: 'Alert' });

const props = withDefaults(
  defineProps<{
    description?: string;
    message?: string;
    showIcon?: boolean;
    type?: 'error' | 'info' | 'success' | 'warning';
    variant?: AlertVariants['variant'];
  }>(),
  {
    description: undefined,
    message: undefined,
    showIcon: true,
    type: 'info',
    variant: undefined,
  },
);

const ICONS: Record<'error' | 'info' | 'success' | 'warning', string> = {
  error: 'carbon:close-filled',
  info: 'carbon:information-filled',
  success: 'carbon:checkmark-outline',
  warning: 'carbon:warning-alt',
};

const rootVariant = computed<AlertVariants['variant']>(
  () => props.variant ?? (props.type === 'error' ? 'destructive' : 'default'),
);

const toneClass = computed(() =>
  props.type === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
    : props.type === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
      : '',
);
</script>

<template>
  <ShadcnAlert
    data-common-alert
    :variant="rootVariant"
    :class="cn('items-start gap-2', toneClass)"
  >
    <Icon
      v-if="props.showIcon"
      :icon="ICONS[props.type]"
      class="mt-0.5 shrink-0 text-base"
    />
    <div class="min-w-0 flex-1 space-y-0.5">
      <AlertTitle v-if="props.message || $slots.icon || $slots.title">
        <slot name="title">{{ props.message }}</slot>
      </AlertTitle>
      <AlertDescription
        v-if="props.description || $slots.default"
        class="text-sm leading-relaxed"
      >
        <slot>{{ props.description }}</slot>
      </AlertDescription>
    </div>
  </ShadcnAlert>
</template>
