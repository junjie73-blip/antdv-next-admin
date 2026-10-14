<script setup lang="ts">
import { computed, ref } from 'vue';

import { cn } from '@antdv/shared/cn';
import { Eye, EyeOff, Search, X } from '@lucide/vue';

interface Props {
  allowClear?: boolean;
  disabled?: boolean;
  id?: string;
  maxlength?: number;
  placeholder?: string;
  readonly?: boolean;
  searchButton?: boolean;
  type?: 'password' | 'text' | undefined;
  value?: any;
  [key: string]: any;
}

const props = withDefaults(defineProps<Props>(), {
  allowClear: false,
  disabled: false,
  maxlength: undefined,
  placeholder: undefined,
  readonly: false,
  searchButton: false,
  type: undefined,
  value: undefined,
});

const emit = defineEmits<{
  search: [value: any];
  'update:value': [value: any];
}>();

const visible = ref(false);

const inputType = computed(() => {
  if (props.type === 'password') return visible.value ? 'text' : 'password';
  return 'text';
});

const hasValue = computed(
  () => props.value !== undefined && props.value !== null && props.value !== '',
);

function onInput(event: Event) {
  emit('update:value', (event.target as HTMLInputElement).value);
}

function clear() {
  emit('update:value', undefined);
}
</script>

<template>
  <div
    :class="
      cn(
        'flex w-full items-center gap-1 rounded-md border border-input bg-transparent px-3 shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50',
      )
    "
  >
    <slot name="prefix"></slot>
    <input
      :type="inputType"
      :value="hasValue ? String(value) : ''"
      :disabled="disabled"
      :readonly="readonly"
      :maxlength="maxlength"
      :placeholder="placeholder"
      :id="id"
      data-field-control
      class="h-9 w-full min-w-0 bg-transparent text-sm outline-hidden placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed"
      @input="onInput"
      @keydown.enter="emit('search', value)"
    />
    <span
      v-if="allowClear && hasValue && !disabled && !readonly"
      class="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
      data-clear
      @click="clear"
    >
      <X class="size-3.5" />
    </span>
    <button
      v-if="type === 'password'"
      type="button"
      class="shrink-0 text-muted-foreground hover:text-foreground"
      :aria-label="visible ? '隐藏密码' : '显示密码'"
      @click="visible = !visible"
    >
      <EyeOff v-if="visible" class="size-4" />
      <Eye v-else class="size-4" />
    </button>
    <button
      v-if="searchButton"
      type="button"
      class="shrink-0 text-muted-foreground hover:text-foreground"
      aria-label="搜索"
      @click="emit('search', value)"
    >
      <Search class="size-4" />
    </button>
    <slot name="suffix"></slot>
  </div>
</template>
