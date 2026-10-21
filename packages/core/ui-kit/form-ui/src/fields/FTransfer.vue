<script setup lang="ts">
import { computed, ref } from 'vue';

import { normalizeOptions, optionValueEquals } from './utils';

interface Props {
  disabled?: boolean;
  id?: string;
  options?: any[];
  showSearch?: boolean;
  titles?: any[];
  value?: any;
  [key: string]: any;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  options: () => [],
  showSearch: false,
  titles: () => ['源列表', '目标列表'],
  value: undefined,
});

const emit = defineEmits<{ 'update:value': [value: any] }>();

const targetValues = computed<any[]>(() =>
  Array.isArray(props.value) ? props.value : [],
);

const normalized = computed(() => normalizeOptions(props.options));

const sourceOptions = computed(() =>
  normalized.value.filter(
    (opt) => !targetValues.value.some((v) => optionValueEquals(v, opt.value)),
  ),
);

const targetOptions = computed(() =>
  normalized.value.filter((opt) =>
    targetValues.value.some((v) => optionValueEquals(v, opt.value)),
  ),
);

const sourceChecked = ref<any[]>([]);
const targetChecked = ref<any[]>([]);
const sourceSearch = ref('');
const targetSearch = ref('');

function filterList(list: any[], keyword: string) {
  const k = keyword.trim().toLowerCase();
  if (!k) return list;
  return list.filter((o) =>
    String(o.label ?? '')
      .toLowerCase()
      .includes(k),
  );
}

function toggleChecked(list: any[], val: any) {
  const idx = list.findIndex((v) => optionValueEquals(v, val));
  if (idx === -1) list.push(val);
  else list.splice(idx, 1);
}

function moveToTarget() {
  if (props.disabled) return;
  emit('update:value', [
    ...targetValues.value,
    ...sourceChecked.value.splice(0),
  ]);
}

function moveToSource() {
  if (props.disabled) return;
  emit(
    'update:value',
    targetValues.value.filter(
      (v) => !targetChecked.value.some((c) => optionValueEquals(c, v)),
    ),
  );
  targetChecked.value.splice(0);
}
</script>

<template>
  <div class="flex w-full items-center gap-2" :id="id" data-field-control>
    <div class="flex-1 rounded-md border">
      <div class="border-b bg-muted/40 px-2 py-1 text-xs font-medium">
        {{ titles[0] }} ({{ sourceChecked.length }}/{{ sourceOptions.length }})
      </div>
      <div v-if="showSearch" class="p-1.5">
        <input
          v-model="sourceSearch"
          placeholder="请输入搜索内容"
          class="w-full rounded border border-input px-2 py-1 text-sm outline-hidden focus-visible:border-ring"
        />
      </div>
      <div class="max-h-44 min-h-24 overflow-y-auto p-1">
        <label
          v-for="opt in filterList(sourceOptions, sourceSearch)"
          :key="String(opt.value)"
          class="flex cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1 text-sm hover:bg-accent"
        >
          <input
            type="checkbox"
            class="size-3.5 accent-primary"
            :checked="
              sourceChecked.some((v) => optionValueEquals(v, opt.value))
            "
            :disabled="opt.disabled"
            @change="toggleChecked(sourceChecked, opt.value)"
          />
          <span>{{ opt.label }}</span>
        </label>
      </div>
    </div>
    <div class="flex shrink-0 flex-col gap-1">
      <button
        type="button"
        class="rounded border px-1.5 py-0.5 text-xs disabled:opacity-50"
        :disabled="disabled || sourceChecked.length === 0"
        aria-label="向右移动"
        @click="moveToTarget"
      >
        ›
      </button>
      <button
        type="button"
        class="rounded border px-1.5 py-0.5 text-xs disabled:opacity-50"
        :disabled="disabled || targetChecked.length === 0"
        aria-label="向左移动"
        @click="moveToSource"
      >
        ‹
      </button>
    </div>
    <div class="flex-1 rounded-md border">
      <div class="border-b bg-muted/40 px-2 py-1 text-xs font-medium">
        {{ titles[1] }} ({{ targetChecked.length }}/{{ targetOptions.length }})
      </div>
      <div v-if="showSearch" class="p-1.5">
        <input
          v-model="targetSearch"
          placeholder="请输入搜索内容"
          class="w-full rounded border border-input px-2 py-1 text-sm outline-hidden focus-visible:border-ring"
        />
      </div>
      <div class="max-h-44 min-h-24 overflow-y-auto p-1">
        <label
          v-for="opt in filterList(targetOptions, targetSearch)"
          :key="String(opt.value)"
          class="flex cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1 text-sm hover:bg-accent"
        >
          <input
            type="checkbox"
            class="size-3.5 accent-primary"
            :checked="
              targetChecked.some((v) => optionValueEquals(v, opt.value))
            "
            :disabled="opt.disabled"
            @change="toggleChecked(targetChecked, opt.value)"
          />
          <span>{{ opt.label }}</span>
        </label>
      </div>
    </div>
  </div>
</template>
