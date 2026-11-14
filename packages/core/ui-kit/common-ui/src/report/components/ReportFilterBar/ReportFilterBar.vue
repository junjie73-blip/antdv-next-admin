<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import type { FilterSpec, FilterValues } from '../../core/types';

import { computed, ref, watch } from 'vue';

import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

/**
 * 报表过滤器面板。
 *
 * 分层位置：`components/`，**只产出不消费** —— 它按 `FilterSpec[]` 长出控件、
 * 把当前取值回抛出去，自己不认识数据源也不认识 `useReportData`。
 * 接起来的责任在页面（或由 `ReportViewer :filters` 代劳），这样过滤条也能单独用在列表页上。
 *
 * 取值形状与 `core/aggregate.applyReportFilters` 一一对应（那边是唯一的解释者）：
 * `between → [from, to]`、`in → unknown[]`、`select → 标量`、`number → 标量`、`text → 字符串`。
 *
 * 不做的事：不 debounce（组件回抛是同步的，宿主想防抖请包在 `useDebounceFn` 里）、
 * 不猜候选项（`options` 没给就等宿主喂 `optionSets`，不去查库）、不做过滤器之间的联动。
 */
const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes['class'];
    filters: FilterSpec[];
    /** 每个字段的候选项；`FilterSpec.options` 优先 */
    optionSets?: Record<
      string,
      Array<{ label?: string; value: boolean | number | string }>
    >;
    values?: FilterValues;
  }>(),
  { class: undefined, optionSets: undefined, values: undefined },
);

const emit = defineEmits<{
  (event: 'change', values: FilterValues): void;
  (event: 'update:values', values: FilterValues): void;
}>();

const draft = ref<FilterValues>({ ...props.values });

/** 外部受控：父级换了 values 就跟着换，父级不传时组件自己持有草稿 */
watch(
  () => props.values,
  (next) => {
    if (next) draft.value = { ...next };
  },
);

const sorted = computed(() => props.filters ?? []);

function optionsOf(filter: FilterSpec) {
  return filter.options ?? props.optionSets?.[filter.field] ?? [];
}

function commit(field: string, value: unknown) {
  draft.value = { ...draft.value, [field]: value };
  emit('update:values', { ...draft.value });
  emit('change', { ...draft.value });
}

function clearAll() {
  draft.value = {};
  emit('update:values', {});
  emit('change', {});
}

function modelOf(filter: FilterSpec): string | string[] | undefined {
  const value = draft.value[filter.field];
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value.map((item) => String(item));
  return String(value);
}

/** Select 的取值面是字符串，回抛前按 options 还原成声明时的原始类型 */
function rawOf(filter: FilterSpec, text: unknown): unknown {
  const options = optionsOf(filter);
  const restore = (item: unknown) => {
    const hit = options.find((option) => String(option.value) === String(item));
    return hit ? hit.value : String(item);
  };
  return Array.isArray(text) ? text.map(restore) : restore(text);
}

function rangeOf(filter: FilterSpec, index: 0 | 1, value: string) {
  const current = draft.value[filter.field];
  const list = Array.isArray(current) ? [...current] : [];
  list[index] = parseCell(filter, value);
  commit(filter.field, list);
}

/** 数字区间给数字、日期区间给 ISO 串：字符串比较对 `YYYY-MM-DD` 恰好等于时间序 */
function parseCell(filter: FilterSpec, value: string): unknown {
  if (value === '') return null;
  return filter.dataType === 'number' ? Number(value) : value;
}

function boundOf(filter: FilterSpec, index: 0 | 1): string {
  const current = draft.value[filter.field];
  if (!Array.isArray(current)) return '';
  const value = current[index];
  return value === null || value === undefined ? '' : String(value);
}

function isDateRange(filter: FilterSpec): boolean {
  return filter.dataType === 'date';
}
</script>

<template>
  <div
    :class="cn('flex flex-wrap items-end gap-3', props.class)"
    :data-filter-count="sorted.length"
    data-slot="report-filter-bar"
  >
    <div
      v-for="filter in sorted"
      :key="filter.field"
      class="flex min-w-40 flex-col gap-1.5"
    >
      <Label
        :for="`report-filter-${filter.field}`"
        class="text-muted-foreground text-xs"
      >
        {{ filter.label ?? filter.field }}
      </Label>

      <!-- 区间：日期给两个 date 输入，数值给两个 number 输入 -->
      <div
        v-if="filter.kind === 'between'"
        class="flex items-center gap-1"
        :data-filter-kind="filter.kind"
      >
        <Input
          :id="`report-filter-${filter.field}`"
          :model-value="boundOf(filter, 0)"
          :type="isDateRange(filter) ? 'date' : 'number'"
          class="w-auto"
          @update:model-value="
            (value: number | string) => rangeOf(filter, 0, String(value))
          "
        />
        <span class="text-muted-foreground text-xs">至</span>
        <Input
          :model-value="boundOf(filter, 1)"
          :type="isDateRange(filter) ? 'date' : 'number'"
          class="w-auto"
          @update:model-value="
            (value: number | string) => rangeOf(filter, 1, String(value))
          "
        />
      </div>

      <!-- 多选 -->
      <Select
        v-else-if="filter.kind === 'in'"
        :model-value="modelOf(filter)"
        multiple
        @update:model-value="
          (value: unknown) =>
            commit(filter.field, rawOf(filter, value as unknown[]))
        "
      >
        <SelectTrigger
          :id="`report-filter-${filter.field}`"
          class="w-auto min-w-40"
          size="sm"
        >
          <SelectValue placeholder="全部" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="option in optionsOf(filter)"
            :key="String(option.value)"
            :value="String(option.value)"
          >
            {{ option.label ?? option.value }}
          </SelectItem>
        </SelectContent>
      </Select>

      <!-- 单选 -->
      <Select
        v-else-if="filter.kind === 'select'"
        :model-value="modelOf(filter)"
        @update:model-value="
          (value: unknown) => commit(filter.field, rawOf(filter, value))
        "
      >
        <SelectTrigger
          :id="`report-filter-${filter.field}`"
          class="w-auto min-w-40"
          size="sm"
        >
          <SelectValue placeholder="全部" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="option in optionsOf(filter)"
            :key="String(option.value)"
            :value="String(option.value)"
          >
            {{ option.label ?? option.value }}
          </SelectItem>
        </SelectContent>
      </Select>

      <!-- 数值 -->
      <Input
        v-else-if="filter.kind === 'number'"
        :id="`report-filter-${filter.field}`"
        :model-value="
          draft[filter.field] === undefined || draft[filter.field] === null
            ? ''
            : String(draft[filter.field])
        "
        type="number"
        @update:model-value="
          (value: number | string) =>
            commit(
              filter.field,
              value === '' || value === null ? null : Number(value),
            )
        "
      />

      <!-- 文本 -->
      <Input
        v-else
        :id="`report-filter-${filter.field}`"
        :model-value="
          draft[filter.field] === undefined || draft[filter.field] === null
            ? ''
            : String(draft[filter.field])
        "
        placeholder="搜索…"
        type="text"
        @update:model-value="
          (value: number | string) => commit(filter.field, String(value))
        "
      />
    </div>

    <Button
      v-if="sorted.length > 0"
      class="h-8 px-2 text-xs"
      size="sm"
      type="button"
      variant="ghost"
      data-slot="report-filter-clear"
      @click="clearAll"
    >
      清空
    </Button>
  </div>
</template>
