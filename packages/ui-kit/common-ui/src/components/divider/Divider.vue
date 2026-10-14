<script setup lang="ts">
import { computed } from 'vue';

import { Separator } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/cn';

defineOptions({ name: 'Divider' });

const props = withDefaults(
  defineProps<{
    dashed?: boolean;
    titlePlacement?: 'center' | 'left' | 'right';
    type?: 'horizontal' | 'vertical';
  }>(),
  {
    dashed: false,
    titlePlacement: undefined,
    type: 'horizontal',
  },
);

/** 实线由 Separator 自己画；虚线把它的高度/宽度收成 0，改走边框 */
const lineClass = computed(() => {
  if (!props.dashed) return undefined;
  return props.type === 'vertical'
    ? 'w-0 border-l border-dashed border-gray-200 dark:border-gray-700'
    : 'h-0 border-t border-dashed border-gray-200 dark:border-gray-700';
});

const verticalClass = computed(() =>
  cn('mx-2 inline-block h-4 align-middle', lineClass.value),
);

const plainClass = computed(() => cn('my-4 w-full', lineClass.value));

const labelClass = computed(() =>
  cn(
    'my-4 flex items-center gap-3 text-xs text-gray-500',
    props.titlePlacement === 'left' ? 'flex-row-reverse' : '',
  ),
);

/** 只在两端都留线（居中）时才画第二段线，靠左/靠右是「线 + 文字」两段 */
const trailingLine = computed(
  () => props.titlePlacement !== 'left' && props.titlePlacement !== 'right',
);
</script>

<template>
  <Separator v-if="type === 'vertical'" orientation="vertical" :class="verticalClass">
    <slot></slot>
  </Separator>

  <div v-else-if="$slots.default" role="separator" :class="labelClass">
    <span class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></span>
    <span class="shrink-0"><slot></slot></span>
    <span v-if="trailingLine" class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></span>
  </div>

  <Separator v-else :class="plainClass">
    <slot></slot>
  </Separator>
</template>
