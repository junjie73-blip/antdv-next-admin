<script setup lang="ts">
import { Textarea } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

interface Props {
  autoSize?: any;
  disabled?: boolean;
  id?: string;
  maxlength?: number;
  placeholder?: string;
  rows?: number;
  showCount?: boolean;
  value?: any;
  [key: string]: any;
}

const props = withDefaults(defineProps<Props>(), {
  autoSize: undefined,
  disabled: false,
  maxlength: undefined,
  placeholder: undefined,
  rows: 4,
  showCount: false,
  value: undefined,
});

const emit = defineEmits<{ 'update:value': [value: any] }>();

function onValueChange(next: number | string) {
  emit('update:value', next);
}
</script>

<template>
  <div class="w-full">
    <Textarea
      :model-value="value === undefined || value === null ? '' : String(value)"
      :disabled="disabled"
      :rows="rows"
      :maxlength="maxlength"
      :placeholder="placeholder"
      :id="id"
      data-field-control
      :class="cn('w-full')"
      @update:model-value="onValueChange"
    />
    <div
      v-if="showCount && maxlength"
      class="mt-0.5 text-right text-xs text-muted-foreground"
    >
      {{ String(value ?? '').length }} / {{ maxlength }}
    </div>
  </div>
</template>
