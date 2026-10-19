<script setup lang="ts">
import { computed, useSlots } from 'vue';

import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Card as ShadcnCard,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

defineOptions({ name: 'Card' });

const props = withDefaults(
  defineProps<{
    bodyClass?: string;
    description?: string;
    /** `borderless` 对应迁移前的 `variant="borderless"`：嵌在页面里时不再描边投影 */
    variant?: 'borderless' | 'outlined';
    title?: string;
  }>(),
  {
    bodyClass: undefined,
    description: undefined,
    title: undefined,
    variant: 'outlined',
  },
);

const slots = useSlots();

const rootClass = computed(() =>
  cn(
    'gap-0 py-0',
    props.variant === 'borderless' ? 'border-0 shadow-none' : '',
  ),
);

const hasHead = computed(
  () =>
    Boolean(props.title || props.description) ||
    Boolean(slots.title || slots.extra),
);

const headerClass = computed(() =>
  cn(
    'flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800',
    slots.extra ? 'flex-wrap' : '',
  ),
);
</script>

<template>
  <ShadcnCard :class="rootClass">
    <CardHeader v-if="hasHead" :class="headerClass">
      <div class="min-w-0 flex-1">
        <CardTitle class="text-base">
          <slot name="title">{{ props.title }}</slot>
        </CardTitle>
        <CardDescription v-if="props.description" class="mt-1 text-xs">
          {{ props.description }}
        </CardDescription>
      </div>
      <div v-if="slots.extra" class="flex shrink-0 items-center gap-2">
        <slot name="extra"></slot>
      </div>
    </CardHeader>

    <CardContent :class="cn('px-4 py-4', props.bodyClass)">
      <slot></slot>
    </CardContent>

    <CardFooter v-if="slots.footer" class="px-4 py-3">
      <slot name="footer"></slot>
    </CardFooter>
  </ShadcnCard>
</template>
