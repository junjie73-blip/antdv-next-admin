<script setup lang="ts">
import { Textarea } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/cn';

interface Props {
  autoSize?: any;
  disabled?: boolean;
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

function onInput(event: Event) {
  emit('update:value', (event.target as HTMLTextAreaElement).value);
}
</script>

<template>
  <div class="w-full">
    <Textarea
      :value="value === undefined || value === null ? '' : String(value)"
      :disabled="disabled"
      :rows="rows"
      :maxlength="maxlength"
      :placeholder="placeholder"
      data-field-control
      :class="cn('w-full')"
      @input="onInput"
    />
    <div
      v-if="showCount && maxlength"
      class="mt-0.5 text-right text-xs text-muted-foreground"
    >
      {{ String(value ?? '').length }} / {{ maxlength }}
    </div>
  </div>
</template>
