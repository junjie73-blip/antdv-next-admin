<script setup lang="ts">
import { Textarea } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

interface Props {
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  rows?: number;
  value?: any;
  [key: string]: any;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  placeholder: '请输入 Markdown 内容',
  rows: 8,
  value: undefined,
});

const emit = defineEmits<{ 'update:value': [value: any] }>();
</script>

<template>
  <Textarea
    :model-value="value === undefined || value === null ? '' : String(value)"
    :disabled="disabled"
    :rows="rows"
    :placeholder="placeholder"
    :id="id"
    data-field-control
    :class="cn('w-full font-mono')"
    @update:model-value="(next: string | number) => emit('update:value', next)"
  />
</template>
