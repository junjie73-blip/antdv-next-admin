<script setup lang="ts">
import { computed } from 'vue';

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@antdv/shadcn-ui';

defineOptions({ name: 'Popconfirm' });

const props = withDefaults(
  defineProps<{
    cancelText?: string;
    danger?: boolean;
    description?: string;
    disabled?: boolean;
    okText?: string;
    placement?: 'bottom' | 'left' | 'right' | 'top';
    title?: string;
  }>(),
  {
    cancelText: '取消',
    danger: false,
    description: undefined,
    disabled: false,
    okText: '确定',
    placement: 'top',
    title: undefined,
  },
);

const emit = defineEmits<{ cancel: []; confirm: [] }>();

const open = defineModel<boolean>('open', { default: false });

const panelClass = computed(() =>
  props.placement === 'left' || props.placement === 'right'
    ? 'w-56 p-3'
    : 'w-64 p-3',
);

function handleConfirm() {
  open.value = false;
  emit('confirm');
}

function handleCancel() {
  open.value = false;
  emit('cancel');
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child :disabled="props.disabled">
      <slot></slot>
    </PopoverTrigger>
    <PopoverContent
      data-common-popconfirm
      :side="props.placement"
      align="center"
      :side-offset="6"
      :class="panelClass"
    >
      <div
        v-if="props.title || $slots.title"
        class="mb-1 text-sm font-medium leading-relaxed"
      >
        <slot name="title">{{ props.title }}</slot>
      </div>
      <div
        v-if="props.description || $slots.description"
        class="mb-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400"
      >
        <slot name="description">{{ props.description }}</slot>
      </div>
      <div class="flex items-center justify-end gap-2">
        <Button size="xs" variant="outline" @click="handleCancel">
          {{ props.cancelText }}
        </Button>
        <Button
          size="xs"
          :variant="props.danger ? 'destructive' : 'default'"
          @click="handleConfirm"
        >
          {{ props.okText }}
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
