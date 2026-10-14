<script setup lang="ts">
import { computed, ref } from 'vue';

import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

import { normalizeOptions } from './utils';

interface Props {
  disabled?: boolean;
  id?: string;
  options?: any[];
  placeholder?: string;
  value?: any;
  [key: string]: any;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  options: () => [],
  placeholder: undefined,
  value: undefined,
});

const emit = defineEmits<{ 'update:value': [value: any] }>();

const open = ref(false);

const normalized = computed(() => normalizeOptions(props.options));

const filtered = computed(() => {
  const keyword = String(props.value ?? '').trim().toLowerCase();
  if (!keyword) return normalized.value;
  return normalized.value.filter((opt) =>
    String(opt.label ?? '').toLowerCase().includes(keyword),
  );
});

function onInput(event: Event) {
  emit('update:value', (event.target as HTMLInputElement).value);
  open.value = true;
}

function pick(val: any) {
  emit('update:value', val);
  open.value = false;
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverAnchor as-child>
      <div
        :class="
          cn(
            'flex w-full items-center rounded-md border border-input bg-transparent px-3 shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 has-[input:disabled]:opacity-50',
          )
        "
      >
        <input
          :value="value === undefined || value === null ? '' : String(value)"
          :disabled="disabled"
          :placeholder="placeholder"
          :id="id"
          data-field-control
          class="h-9 w-full min-w-0 bg-transparent text-sm outline-hidden placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed"
          @input="onInput"
          @focus="open = true"
        />
      </div>
    </PopoverAnchor>
    <PopoverContent
      align="start"
      :side-offset="4"
      class-name="w-[var(--reka-popover-trigger-width,min-width)] p-0"
      :hide-after-escape="false"
    >
      <div class="max-h-60 overflow-y-auto p-1">
        <button
          v-for="opt in filtered"
          :key="String(opt.value)"
          type="button"
          :disabled="opt.disabled"
          class="flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
          @click="pick(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </PopoverContent>
  </Popover>
</template>
