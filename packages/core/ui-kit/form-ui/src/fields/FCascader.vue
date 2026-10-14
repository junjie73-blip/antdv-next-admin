<script setup lang="ts">
import { computed, ref } from 'vue';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { X } from '@lucide/vue';

import { optionValueEquals } from './utils';

interface Props {
  allowClear?: boolean;
  disabled?: boolean;
  fieldNames?: { children?: string; label?: string; value?: string };
  id?: string;
  options?: any[];
  placeholder?: string;
  value?: any;
  [key: string]: any;
}

const props = withDefaults(defineProps<Props>(), {
  allowClear: false,
  disabled: false,
  fieldNames: undefined,
  options: () => [],
  placeholder: undefined,
  value: undefined,
});

const emit = defineEmits<{ 'update:value': [value: any] }>();

const open = ref(false);

const path = computed<any[]>(() =>
  Array.isArray(props.value) ? props.value : [],
);

/** 每一层的候选列表：根据已选路径逐级下钻 */
const columns = computed<any[][]>(() => {
  const childrenKey = props.fieldNames?.children ?? 'children';
  const cols: any[][] = [];
  let nodes = props.options;
  for (const selected of path.value) {
    if (!nodes?.length) break;
    cols.push(nodes);
    const found = nodes.find((n) =>
      optionValueEquals(n?.[props.fieldNames?.value ?? 'value'] ?? n?.value, selected),
    );
    nodes = found ? found[childrenKey] ?? found.children : undefined;
    if (!nodes?.length) break;
  }
  if (cols.length === 0 || (nodes?.length && cols.length < 4)) {
    if (nodes?.length) cols.push(nodes);
  }
  return cols.slice(0, Math.max(cols.length, 1));
});

const displayLabel = computed(() => {
  if (path.value.length === 0) return '';
  const labels = path.value
    .map((v, i) => {
      let nodes = props.options;
      for (let j = 0; j < i; j++) {
        const found = (nodes ?? []).find((n: any) =>
          optionValueEquals(n?.[props.fieldNames?.value ?? 'value'] ?? n?.value, path.value[j]),
        );
        nodes = found
          ? found[props.fieldNames?.children ?? 'children'] ?? found.children
          : [];
      }
      const node = (nodes ?? []).find((n: any) =>
        optionValueEquals(n?.[props.fieldNames?.value ?? 'value'] ?? n?.value, v),
      );
      return node
        ? node[props.fieldNames?.label ?? 'label'] ?? node.label
        : String(v);
    })
    .filter((l) => l !== undefined && l !== null);
  return labels.join(' / ');
});

const hasValue = computed(() => path.value.length > 0);

function labelOf(node: any) {
  const key = props.fieldNames?.label ?? 'label';
  return node?.[key] ?? node?.label;
}

function valueOf(node: any) {
  const key = props.fieldNames?.value ?? 'value';
  return node?.[key] ?? node?.value;
}

function childrenOf(node: any) {
  const key = props.fieldNames?.children ?? 'children';
  return node?.[key] ?? node?.children;
}

function pick(colIndex: number, node: any) {
  if (node?.disabled) return;
  const next = [...path.value.slice(0, colIndex), valueOf(node)];
  const children = childrenOf(node);
  if (children?.length) {
    emit('update:value', next);
  } else {
    emit('update:value', next);
    open.value = false;
  }
}

function clear(event: MouseEvent) {
  event.stopPropagation();
  event.preventDefault();
  emit('update:value', undefined);
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
        <span class="truncate">{{ hasValue ? displayLabel : placeholder || '请选择' }}</span>
        <span
          v-if="allowClear && hasValue && !disabled"
          class="shrink-0 cursor-pointer opacity-60 hover:opacity-100"
          @click="clear"
        >
          <X class="size-3.5" />
        </span>
        <span v-else class="shrink-0 text-muted-foreground" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m6 9 6 6 6-9" />
          </svg>
        </span>
      </button>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      :side-offset="4"
      class="min-w-40 p-0"
    >
      <div class="flex">
        <div
          v-for="(col, colIndex) in columns"
          :key="colIndex"
          class="max-h-60 min-w-36 overflow-y-auto border-r p-1 last:border-r-0"
        >
          <button
            v-for="node in col"
            :key="String(valueOf(node))"
            type="button"
            :disabled="node?.disabled"
            :class="
              cn(
                'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50',
                optionValueEquals(path[colIndex], valueOf(node)) &&
                  'bg-accent font-medium text-accent-foreground',
              )
            "
            @click="pick(colIndex, node)"
          >
            <span class="truncate">{{ labelOf(node) }}</span>
            <span v-if="childrenOf(node)?.length" class="shrink-0 text-muted-foreground">›</span>
          </button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
