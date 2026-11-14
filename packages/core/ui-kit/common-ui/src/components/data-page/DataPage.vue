<script setup lang="ts">
import type { DataPageProps, DataRow } from './types';

import { computed, ref } from 'vue';

import { Button, Input, Progress } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';

import { Card } from '../card';
import { PageHeader } from '../page-header';
import { Tag } from '../tag';

/**
 * 数据工作台：把「项目管理 / 模板中心 / AI 开发 / 审批流」这一批列表页
 * 收敛成同一套骨架（与参考 admin 的四段式一致）：
 *
 *   1. 顶部统计卡（指标 + 图标）
 *   2. 查询区（关键字 + 条件下拉 + 查询/重置）
 *   3. 工具栏（主操作 + 批量操作 + 已选计数）
 *   4. 数据表格（状态标签、进度条、行选择、分页）
 *
 * 页面侧只提供静态数据与列定义，交互（查询、选择、分页、新建/删除）
 * 在这里统一实现，避免 17 个页面各写一份半残的占位。
 */
const props = withDefaults(defineProps<DataPageProps>(), {
  createFields: undefined,
  createLabel: '新建',
  description: '',
  filters: () => [],
  icon: 'carbon:data-vis-4',
  primaryKey: 'id',
  stats: () => [],
  statusColors: () => ({}),
  statusKey: '',
});

const keyword = ref('');
const filterValues = ref<Record<string, string>>({});
const selected = ref<string[]>([]);
const pageNum = ref(1);
const pageSize = 8;
const rows = ref<DataRow[]>([...props.rows]);
const createOpen = ref(false);
const draft = ref<DataRow>({});

const toneClass: Record<string, string> = {
  amber: 'text-amber-600 bg-amber-500/10',
  blue: 'text-blue-600 bg-blue-500/10',
  green: 'text-emerald-600 bg-emerald-500/10',
  red: 'text-rose-600 bg-rose-500/10',
  violet: 'text-violet-600 bg-violet-500/10',
};

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return rows.value.filter((row) => {
    const matchKeyword =
      !kw ||
      Object.values(row).some((v) => String(v).toLowerCase().includes(kw));
    const matchFilter = Object.entries(filterValues.value).every(
      ([key, value]) => !value || row[key] === value,
    );
    return matchKeyword && matchFilter;
  });
});

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filtered.value.length / pageSize)),
);
const paged = computed(() => {
  const start = (Math.min(pageNum.value, totalPages.value) - 1) * pageSize;
  return filtered.value.slice(start, start + pageSize);
});

const createColumns = computed(() => {
  const keys =
    props.createFields ?? props.columns.slice(0, 3).map((c) => c.key);
  return props.columns.filter(
    (c) => keys.includes(c.key) && c.key !== props.statusKey,
  );
});

function search() {
  pageNum.value = 1;
}
function reset() {
  keyword.value = '';
  filterValues.value = {};
  pageNum.value = 1;
}

function toggle(id: string) {
  const index = selected.value.indexOf(id);
  if (index !== -1) selected.value.splice(index, 1);
  else selected.value.push(id);
}
const allChecked = computed(
  () =>
    paged.value.length > 0 &&
    paged.value.every((r) =>
      selected.value.includes(String(r[props.primaryKey])),
    ),
);
function toggleAll() {
  const ids = paged.value.map((r) => String(r[props.primaryKey]));
  selected.value = allChecked.value
    ? selected.value.filter((id) => !ids.includes(id))
    : [...new Set([...selected.value, ...ids])];
}

function openCreate() {
  draft.value = Object.fromEntries(createColumns.value.map((c) => [c.key, '']));
  createOpen.value = true;
}
function submitCreate() {
  const next: DataRow = { ...draft.value };
  next[props.primaryKey] = `N${Date.now().toString().slice(-6)}`;
  if (props.statusKey) next[props.statusKey] = '进行中';
  rows.value.unshift(next);
  createOpen.value = false;
  pageNum.value = 1;
  keyword.value = '';
}
function removeSelected() {
  rows.value = rows.value.filter(
    (r) => !selected.value.includes(String(r[props.primaryKey])),
  );
  selected.value = [];
}

function cellColor(value: string): string {
  return props.statusColors[value] ?? 'default';
}
function progressOf(row: DataRow): number | undefined {
  const raw = row.progress;
  if (!raw) return undefined;
  const num = Number.parseInt(String(raw).replace('%', ''), 10);
  return Number.isNaN(num) ? undefined : num;
}
</script>

<template>
  <div class="space-y-4" data-page-view>
    <PageHeader :description="description" :icon="icon" :title="title" />

    <!-- 1. 统计卡 -->
    <div
      v-if="stats.length"
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <Card v-for="stat in stats" :key="stat.label" class="shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-xs text-muted-foreground">
              {{ stat.label }}
            </p>
            <p class="mt-1 text-2xl font-semibold tabular-nums">
              {{ stat.value }}
            </p>
          </div>
          <div
            :class="
              cn(
                'flex size-10 shrink-0 items-center justify-center rounded-lg',
                toneClass[stat.tone ?? 'blue'],
              )
            "
          >
            <Icon :icon="stat.icon || 'carbon:data-vis-4'" class="size-5" />
          </div>
        </div>
      </Card>
    </div>

    <!-- 2 + 3 + 4. 查询 / 工具栏 / 表格 -->
    <Card class="shadow-sm">
      <template #title>{{ title }}列表</template>
      <template #extra>
        <span class="text-xs text-muted-foreground">共 {{ filtered.length }} 条</span>
      </template>

      <div class="space-y-3">
        <!-- 查询区 -->
        <div class="flex flex-wrap items-center gap-2">
          <Input
            v-model="keyword"
            class="w-full sm:w-56"
            placeholder="输入关键字查询"
            @keydown.enter="search"
          />
          <select
            v-for="filter in filters"
            :key="filter.key"
            v-model="filterValues[filter.key]"
            class="h-9 rounded-md border border-input bg-background px-2 text-sm"
            :aria-label="filter.label"
          >
            <option value="">{{ filter.label }}</option>
            <option
              v-for="option in filter.options || []"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
          <Button size="sm" @click="search">
            <Icon icon="carbon:search" class="size-4" /> 查询
          </Button>
          <Button size="sm" variant="outline" @click="reset">
            <Icon icon="carbon:renew" class="size-4" /> 重置
          </Button>
        </div>

        <!-- 工具栏 -->
        <div
          class="flex flex-wrap items-center gap-2 border-t border-border pt-3"
        >
          <Button size="sm" @click="openCreate">
            <Icon icon="carbon:add" class="size-4" /> {{ createLabel }}
          </Button>
          <Button
            size="sm"
            variant="outline"
            :disabled="!selected.length"
            @click="removeSelected"
          >
            <Icon icon="carbon:trash-can" class="size-4" /> 批量删除
          </Button>
          <span class="ml-auto text-xs text-muted-foreground">
            已选 {{ selected.length }} 项
          </span>
        </div>

        <!-- 表格 -->
        <div class="overflow-x-auto rounded-md border border-border">
          <table class="w-full min-w-[640px] text-sm">
            <thead class="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th class="w-10 px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    :checked="allChecked"
                    aria-label="全选"
                    @change="toggleAll"
                  />
                </th>
                <th
                  v-for="column in columns"
                  :key="column.key"
                  class="px-3 py-2 text-left font-medium"
                  :style="column.width ? { width: column.width } : undefined"
                >
                  {{ column.title }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr
                v-for="row in paged"
                :key="String(row[primaryKey])"
                class="transition-colors hover:bg-muted/40"
              >
                <td class="px-3 py-2.5">
                  <input
                    type="checkbox"
                    :checked="selected.includes(String(row[primaryKey]))"
                    :aria-label="`选择 ${String(row[primaryKey])}`"
                    @change="toggle(String(row[primaryKey]))"
                  />
                </td>
                <td
                  v-for="column in columns"
                  :key="column.key"
                  class="px-3 py-2.5 align-middle"
                >
                  <Tag
                    v-if="column.key === statusKey"
                    :color="cellColor(row[column.key] || '')"
                  >
                    {{ row[column.key] }}
                  </Tag>
                  <div
                    v-else-if="
                      progressOf(row) !== undefined && column.key === 'progress'
                    "
                    class="flex items-center gap-2"
                  >
                    <Progress
                      :model-value="progressOf(row)"
                      class="h-1.5 w-20"
                    />
                    <span class="text-xs tabular-nums text-muted-foreground">
                      {{ row[column.key] }}
                    </span>
                  </div>
                  <span v-else class="text-foreground">{{
                    row[column.key] || '-'
                  }}</span>
                </td>
              </tr>
              <tr v-if="!paged.length">
                <td
                  :colspan="columns.length + 1"
                  class="px-3 py-12 text-center text-sm text-muted-foreground"
                >
                  暂无数据，试试调整查询条件
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 分页 -->
        <div class="flex items-center justify-end gap-2 pt-1">
          <span class="text-xs text-muted-foreground">
            第 {{ Math.min(pageNum, totalPages) }} / {{ totalPages }} 页
          </span>
          <Button
            size="sm"
            variant="outline"
            :disabled="pageNum <= 1"
            @click="pageNum--"
          >
            上一页
          </Button>
          <Button
            size="sm"
            variant="outline"
            :disabled="pageNum >= totalPages"
            @click="pageNum++"
          >
            下一页
          </Button>
        </div>
      </div>
    </Card>

    <!-- 新建面板：与参考 admin 的「新增」弹窗同一职责，用轻量内联卡片承接 -->
    <Card v-if="createOpen" class="shadow-sm">
      <template #title>{{ createLabel }}</template>
      <template #extra>
        <Button size="sm" variant="ghost" @click="createOpen = false">
          <Icon icon="carbon:close" class="size-4" />
        </Button>
      </template>
      <div class="space-y-3">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label
            v-for="column in createColumns"
            :key="column.key"
            class="flex flex-col gap-1 text-xs text-muted-foreground"
          >
            {{ column.title }}
            <Input
              v-model="draft[column.key]"
              :placeholder="`请输入${column.title}`"
            />
          </label>
        </div>
        <div class="flex justify-end gap-2">
          <Button size="sm" variant="outline" @click="createOpen = false">
取消
</Button>
          <Button
            size="sm"
            :disabled="createColumns.every((c) => !draft[c.key])"
            @click="submitCreate"
          >
            <Icon icon="carbon:save" class="size-4" /> 保存
          </Button>
        </div>
      </div>
    </Card>
  </div>
</template>
