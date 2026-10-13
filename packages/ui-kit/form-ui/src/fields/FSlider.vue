<script setup lang="ts">
import { computed } from 'vue';

import { Slider } from '@antdv/shadcn-ui';

interface Props {
  disabled?: boolean;
  max?: number;
  min?: number;
  range?: boolean;
  step?: number;
  value?: any;
  [key: string]: any;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  max: 100,
  min: 0,
  range: undefined,
  step: 1,
  value: undefined,
});

const emit = defineEmits<{ 'update:value': [value: any] }>();

const isRange = computed(
  () => Array.isArray(props.value) || props.range === true,
);

const model = computed<number[]>(() => {
  if (isRange.value) {
    return Array.isArray(props.value) ? props.value : [props.min, props.max];
  }
  return [typeof props.value === 'number' ? props.value : props.min];
});

function onChange(next: any) {
  const arr = Array.isArray(next) ? next : [next];
  emit('update:value', isRange.value ? arr : arr[0]);
}
</script>

<template>
  <Slider
    :model-value="model"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    :class="isRange ? '' : 'is-single'"
    data-field-control
    @update:model-value="onChange"
  />
</template>
