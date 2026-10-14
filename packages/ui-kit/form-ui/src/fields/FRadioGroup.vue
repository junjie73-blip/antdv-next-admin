<script setup lang="ts">
import { computed } from 'vue';

import { RadioGroup, RadioGroupItem } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/cn';

import { normalizeOptions } from './utils';

interface Props {
  buttonStyle?: string;
  disabled?: boolean;
  id?: string;
  optionType?: 'button' | undefined;
  options?: any[];
  size?: string;
  value?: any;
  [key: string]: any;
}

const props = withDefaults(defineProps<Props>(), {
  buttonStyle: undefined,
  disabled: false,
  optionType: undefined,
  options: () => [],
  size: undefined,
  value: undefined,
});

const emit = defineEmits<{ 'update:value': [value: any] }>();

const normalized = computed(() => normalizeOptions(props.options));

const isButtonStyle = computed(() => props.optionType === 'button');

function onSelectChange(val: any) {
  const opt = normalized.value.find((o) => String(o.value) === val);
  emit('update:value', opt ? opt.value : val);
}
</script>

<template>
  <RadioGroup
    :model-value="value === undefined || value === null ? '' : String(value)"
    :disabled="disabled"
    :id="id"
    data-field-control
    :class="cn('flex flex-wrap gap-4', isButtonStyle && 'gap-0')"
    @update:model-value="onSelectChange"
  >
    <label
      v-for="opt in normalized"
      :key="String(opt.value)"
      :class="
        cn(
          'flex items-center gap-1.5 text-sm',
          isButtonStyle &&
            'relative m-0 -ms-px min-h-9 cursor-pointer items-center justify-center gap-0 border border-input bg-transparent px-3 py-1.5 first:ms-0 first:rounded-s-md last:rounded-e-md has-[[data-state=checked]]:z-10 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary has-[[data-state=checked]]:font-medium has-[[data-state=checked]]:[&>span]:text-primary-foreground has-[input:disabled]:pointer-events-none has-[input:disabled]:opacity-50',
          !isButtonStyle && 'cursor-pointer',
          opt.disabled && 'cursor-not-allowed opacity-50',
        )
      "
    >
      <RadioGroupItem
        :value="String(opt.value)"
        :disabled="opt.disabled"
        :class="cn(isButtonStyle && 'sr-only')"
      />
      <span>{{ opt.label }}</span>
    </label>
  </RadioGroup>
</template>
