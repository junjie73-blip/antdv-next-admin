<script setup lang="ts">
import { computed, ref } from 'vue';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { X } from '@lucide/vue';

import { normalizeOptions, optionValueEquals } from './utils';

interface Props {
  allowClear?: boolean;
  disabled?: boolean;
  id?: string;
  maxTagCount?: number;
  mode?: 'multiple' | undefined;
  options?: any[];
  placeholder?: string;
  showSearch?: boolean;
  value?: any;
  fieldNames?: { label?: string; value?: string };
  [key: string]: any;
}

const props = withDefaults(defineProps<Props>(), {
  allowClear: false,
  disabled: false,
  fieldNames: undefined,
  maxTagCount: undefined,
  mode: undefined,
  options: () => [],
  placeholder: undefined,
  showSearch: false,
  value: undefined,
});

const emit = defineEmits<{ 'update:value': [value: any] }>();

const open = ref(false);
const search = ref('');

const normalized = computed(() =>
  normalizeOptions(props.options, props.fieldNames),
);

const filtered = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  if (!props.showSearch || !keyword) return normalized.value;
  return normalized.value.filter((opt) =>
    String(opt.label ?? '').toLowerCase().includes(keyword),
  );
});

const selectedValues = computed<any[]>(() => {
  if (props.mode === 'multiple') {
    return Array.isArray(props.value) ? props.value : [];
  }
  return props.value === undefined || props.value === null
    ? []
    : [props.value];
});

const isSelected = (val: any) =>
  selectedValues.value.some((v) => optionValueEquals(v, val));

const displayLabel = computed(() => {
  const opt = normalized.value.find((o) =>
    optionValueEquals(o.value, props.value),
  );
  return opt ? String(opt.label) : '';
});

const multipleLabels = computed(() =>
  selectedValues.value.map((v) => {
    const opt = normalized.value.find((o) => optionValueEquals(o.value, v));
    return opt ? String(opt.label) : String(v);
  }),
);

const hasValue = computed(() =>
  props.mode === 'multiple'
    ? selectedValues.value.length > 0
    : props.value !== undefined &&
      props.value !== null &&
      props.value !== '',
);

function toggleOption(val: any, disabled?: boolean) {
  if (disabled) return;
  if (props.mode === 'multiple') {
    const next = selectedValues.value.some((v) => optionValueEquals(v, val))
      ? selectedValues.value.filter((v) => !optionValueEquals(v, val))
      : [...selectedValues.value, val];
    emit('update:value', next);
  } else {
    emit('update:value', val);
    open.value = false;
  }
}

function removeValue(val: any) {
  emit(
    'update:value',
    selectedValues.value.filter((v) => !optionValueEquals(v, val)),
  );
}

function clear(event: MouseEvent) {
  event.stopPropagation();
  event.preventDefault();
  emit('update:value', props.mode === 'multiple' ? [] : undefined);
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        role="combobox"
        :aria-expanded="open"
        :disabled="disabled"
        :id="id"
        data-field-control
        :class="
          cn(
            'flex w-full min-h-9 items-center justify-between gap-1 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs outline-hidden transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 text-left',
            !hasValue && 'text-muted-foreground',
          )
        "
      >
        <span class="flex flex-1 flex-wrap items-center gap-1 overflow-hidden">
          <template v-if="mode === 'multiple' && hasValue">
            <span
              v-for="(label, idx) in multipleLabels"
              :key="idx"
              class="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-xs"
            >
              {{ label }}
              <span
                v-if="allowClear && !disabled"
                class="cursor-pointer opacity-60 hover:opacity-100"
                @click.stop="removeValue(selectedValues[idx])"
              >
                <X class="size-3" />
              </span>
            </span>
          </template>
          <template v-else>
            <span class="truncate">{{
              hasValue ? (mode === 'multiple' ? '' : displayLabel) : placeholder || '请选择'
            }}</span>
          </template>
        </span>
        <span
          v-if="allowClear && hasValue && !disabled && mode !== 'multiple'"
          class="shrink-0 cursor-pointer opacity-60 hover:opacity-100"
          @click="clear"
        >
          <X class="size-3.5" />
        </span>
        <span
          v-if="!hasValue || mode !== 'multiple'"
          class="shrink-0 text-muted-foreground"
          aria-hidden="true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m6 9 6 6 6-9" />
          </svg>
        </span>
      </button>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      :side-offset="4"
      class="w-[var(--reka-popover-trigger-width,min-width)] min-w-40 p-0"
    >
      <div v-if="showSearch" class="border-b p-1.5">
        <input
          v-model="search"
          type="text"
          placeholder="搜索"
          class="w-full rounded border border-input bg-transparent px-2 py-1 text-sm outline-hidden focus-visible:border-ring"
        />
      </div>
      <div class="max-h-60 overflow-y-auto p-1">
        <button
          v-for="opt in filtered"
          :key="String(opt.value)"
          type="button"
          :disabled="opt.disabled"
          :class="
            cn(
              'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50',
              isSelected(opt.value) && 'bg-accent font-medium text-accent-foreground',
            )
          "
          @click="toggleOption(opt.value, opt.disabled)"
        >
          <span
            v-if="mode === 'multiple'"
            :class="
              cn(
                'flex size-4 shrink-0 items-center justify-center rounded-sm border',
                isSelected(opt.value)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input',
              )
            "
          >
            <svg
              v-if="isSelected(opt.value)"
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <span class="truncate">{{ opt.label }}</span>
        </button>
        <div
          v-if="filtered.length === 0"
          class="px-2 py-6 text-center text-sm text-muted-foreground"
        >
          暂无数据
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
