<script setup lang="ts">
import { cn } from '@antdv/shared/cn';

interface Props {
  disabled?: boolean;
  formatter?: (value: number | string | undefined) => string;
  id?: string;
  max?: number;
  min?: number;
  placeholder?: string;
  precision?: number;
  step?: number;
  value?: any;
  [key: string]: any;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  formatter: undefined,
  max: undefined,
  min: undefined,
  placeholder: undefined,
  precision: undefined,
  step: 1,
  value: undefined,
});

const emit = defineEmits<{ 'update:value': [value: any] }>();

const display = (() => {
  if (props.value === undefined || props.value === null || props.value === '')
    return '';
  if (props.formatter) return props.formatter(props.value);
  return String(props.value);
})();

function clamp(num: number): number {
  let next = num;
  if (props.min !== undefined) next = Math.max(next, props.min);
  if (props.max !== undefined) next = Math.min(next, props.max);
  if (props.precision !== undefined) {
    const factor = 10 ** props.precision;
    next = Math.round(next * factor) / factor;
  }
  return next;
}

function onInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  if (raw === '') {
    emit('update:value', undefined);
    return;
  }
  const num = Number(raw);
  if (!Number.isNaN(num)) {
    emit('update:value', clamp(num));
  }
}

function stepBy(direction: number) {
  const base = typeof props.value === 'number' ? props.value : (props.min ?? 0);
  emit('update:value', clamp(base + direction * props.step));
}
</script>

<template>
  <div
    :class="
      cn(
        'flex w-full items-center rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 has-[input:disabled]:opacity-50',
      )
    "
  >
    <input
      type="number"
      :value="display"
      :disabled="disabled"
      :placeholder="placeholder"
      :min="min"
      :max="max"
      :step="step"
      :id="id"
      data-field-control
      class="h-9 w-full min-w-0 bg-transparent px-3 text-sm outline-hidden placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      @input="onInput"
    />
    <div class="flex flex-col border-l">
      <button
        type="button"
        class="px-1.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
        :disabled="disabled || (max !== undefined && (value ?? -Infinity) >= max)"
        aria-label="增加"
        @click="stepBy(1)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6" /></svg>
      </button>
      <button
        type="button"
        class="border-t px-1.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
        :disabled="disabled || (min !== undefined && (value ?? Infinity) <= min)"
        aria-label="减少"
        @click="stepBy(-1)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-9" /></svg>
      </button>
    </div>
  </div>
</template>
