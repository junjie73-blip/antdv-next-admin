<script setup lang="ts">
import { computed } from 'vue';

import { Checkbox } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/cn';

import { normalizeOptions, optionValueEquals } from './utils';

interface Props {
  disabled?: boolean;
  options?: any[];
  value?: any;
  [key: string]: any;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  options: undefined,
  value: undefined,
});

const emit = defineEmits<{ 'update:value': [value: any] }>();

const isGroup = computed(() => Array.isArray(props.options));

const normalized = computed(() =>
  isGroup.value ? normalizeOptions(props.options) : [],
);

const groupValue = computed<any[]>(() =>
  Array.isArray(props.value) ? props.value : [],
);

const singleChecked = computed(
  () => props.value === true,
);

function toggleOption(val: any, optDisabled?: boolean) {
  if (props.disabled || optDisabled) return;
  const next = groupValue.value.some((v) => optionValueEquals(v, val))
    ? groupValue.value.filter((v) => !optionValueEquals(v, val))
    : [...groupValue.value, val];
  emit('update:value', next);
}
</script>

<template>
  <div v-if="isGroup" class="flex flex-wrap items-center gap-x-4 gap-y-2">
    <label
      v-for="opt in normalized"
      :key="String(opt.value)"
      :class="
        cn(
          'flex items-center gap-1.5 text-sm',
          opt.disabled || disabled
            ? 'cursor-not-allowed opacity-50'
            : 'cursor-pointer',
        )
      "
      @click.prevent="toggleOption(opt.value, opt.disabled)"
    >
      <Checkbox
        :model-value="groupValue.some((v) => optionValueEquals(v, opt.value))"
        :disabled="disabled || opt.disabled"
        data-field-control
      />
      <span>{{ opt.label }}</span>
    </label>
  </div>
  <label
    v-else
    :class="
      cn(
        'inline-flex items-center gap-1.5 text-sm',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      )
    "
    @click.prevent="!disabled && emit('update:value', !singleChecked)"
  >
    <Checkbox
      :model-value="singleChecked"
      :disabled="disabled"
      data-field-control
    />
    <slot></slot>
  </label>
</template>
