<script setup lang="ts">
import type { BasicColumn } from '../types';

import { computed } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';
import { cn } from '@antdv/shared/cn';

const props = withDefaults(
  defineProps<{
    column?: any | BasicColumn;
    editable?: boolean;
  }>(),
  {
    column: () => ({}),
    editable: false,
  },
);

const emit = defineEmits<{ (e: 'edit', column: BasicColumn): void }>();

const showEditIcon = computed(() => {
  return props.editable || props.column?.edit || props.column?.editRow;
});

const getAlignClass = computed(() => {
  const align = props.column?.align;
  switch (align) {
    case 'left': {
      return 'justify-start';
    }
    case 'right': {
      return 'justify-end';
    }
    case 'center':
    default: {
      return 'justify-center';
    }
  }
});

const handleEditClick = (e: Event) => {
  e.stopPropagation();
  emit('edit', props.column as BasicColumn);
};
</script>

<template>
  <div :class="cn('flex items-center gap-1', getAlignClass)">
    <span>{{ column?.title }}</span>

    <span
      v-if="showEditIcon"
      :class="
        cn(
          'cursor-pointer text-gray-400 transition-colors hover:text-primary dark:text-gray-500 dark:hover:text-primary-400',
        )
      "
      title="点击编辑"
      @click="handleEditClick"
    >
      <Icon icon="ant-design:edit-outlined" />
    </span>

    <slot></slot>
  </div>
</template>
