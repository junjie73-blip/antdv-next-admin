<script setup lang="ts">
import { Textarea } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/cn';

interface Props {
  disabled?: boolean;
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
    :value="value === undefined || value === null ? '' : String(value)"
    :disabled="disabled"
    :rows="rows"
    :placeholder="placeholder"
    data-field-control
    :class="cn('w-full font-mono')"
    @input="emit('update:value', ($event.target as HTMLTextAreaElement).value)"
  />
</template>
