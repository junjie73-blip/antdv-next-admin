<script setup lang="ts">
import { computed } from 'vue';

import { cn } from '@antdv/shared/cn';
import dayjs from 'dayjs';

interface Props {
  disabled?: boolean;
  format?: string;
  placeholder?: string;
  range?: boolean;
  value?: any;
  valueFormat?: string;
  [key: string]: any;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  format: undefined,
  placeholder: undefined,
  range: false,
  value: undefined,
  valueFormat: undefined,
});

const emit = defineEmits<{ 'update:value': [value: any] }>();

function toDayjs(v: any): dayjs.Dayjs | null {
  if (v === undefined || v === null || v === '') return null;
  if (dayjs.isDayjs(v)) return v;
  const d = dayjs(v);
  return d.isValid() ? d : null;
}

const fmt = computed(() => props.valueFormat || props.format || 'HH:mm:ss');

const singleValue = computed(() => {
  const d = toDayjs(props.value);
  return d ? d.format('HH:mm:ss') : '';
});

const rangeValues = computed(() => {
  const arr = Array.isArray(props.value) ? props.value : [];
  return [toDayjs(arr[0])?.format('HH:mm:ss') ?? '', toDayjs(arr[1])?.format('HH:mm:ss') ?? ''];
});

function emitOne(d: dayjs.Dayjs | null) {
  if (!d) {
    emit('update:value', undefined);
    return;
  }
  emit('update:value', props.valueFormat ? d.format(fmt.value) : d);
}

function onTimeInput(index: null | number, raw: string) {
  if (!raw) {
    if (index === null) emitOne(null);
    return;
  }
  const [h = '0', m = '0', s = '0'] = raw.split(':');
  const base = dayjs()
    .hour(Number(h))
    .minute(Number(m))
    .second(Number(s) || 0)
    .millisecond(0);
  if (index === null) {
    emitOne(base);
  } else {
    const arr = Array.isArray(props.value) ? [...props.value] : [];
    const next = [
      index === 0 ? base : toDayjs(arr[0]) ?? base,
      index === 1 ? base : toDayjs(arr[1]) ?? base,
    ];
    emit(
      'update:value',
      next.map((d) => (props.valueFormat ? d.format(fmt.value) : d)),
    );
  }
}
</script>

<template>
  <div
    :class="
      cn(
        'flex w-full items-center gap-1 rounded-md border border-input bg-transparent px-3 shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 has-[input:disabled]:opacity-50',
      )
    "
  >
    <template v-if="range">
      <input
        type="time"
        step="1"
        :value="rangeValues[0]"
        :disabled="disabled"
        data-field-control
        class="h-9 min-w-0 flex-1 bg-transparent text-sm outline-hidden disabled:cursor-not-allowed"
        @change="onTimeInput(0, ($event.target as HTMLInputElement).value)"
      />
      <span class="text-muted-foreground">~</span>
      <input
        type="time"
        step="1"
        :value="rangeValues[1]"
        :disabled="disabled"
        class="h-9 min-w-0 flex-1 bg-transparent text-sm outline-hidden disabled:cursor-not-allowed"
        @change="onTimeInput(1, ($event.target as HTMLInputElement).value)"
      />
    </template>
    <input
      v-else
      type="time"
      step="1"
      :value="singleValue"
      :disabled="disabled"
      data-field-control
      class="h-9 w-full min-w-0 bg-transparent text-sm outline-hidden disabled:cursor-not-allowed"
      @change="onTimeInput(null, ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>
