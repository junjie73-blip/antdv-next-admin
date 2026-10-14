<script setup lang="ts">
import type { TablePaginationProps } from '../types';

import { computed } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';
import {
  Input,
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

defineOptions({ name: 'TablePagination' });

const props = withDefaults(defineProps<TablePaginationProps>(), {
  pageSizeOptions: () => [10, 20, 50, 100],
  showQuickJumper: true,
  showSizeChanger: true,
  showTotal: undefined,
  siblingCount: 1,
});

const emit = defineEmits<{
  (e: 'update:current', page: number): void;
  (e: 'update:pageSize', size: number): void;
}>();

const range = computed<[number, number]>(() => [
  (props.current - 1) * props.pageSize + 1,
  Math.min(props.current * props.pageSize, props.total),
]);

/** 跳至：非法页码交给使用方判定，这里只保证不把 NaN 传出去 */
function jump(e: KeyboardEvent) {
  const page = Number((e.target as HTMLInputElement).value);
  if (Number.isFinite(page) && page > 0) emit('update:current', page);
}
</script>

<template>
  <div
    class="basic-table-pagination mt-3 flex flex-wrap items-center justify-end gap-2 text-sm"
  >
    <span
      v-if="props.showTotal"
      class="mr-auto text-gray-500 dark:text-gray-400"
    >
      {{ props.showTotal(props.total, range) }}
    </span>

    <Select
      v-if="props.showSizeChanger"
      :model-value="String(props.pageSize)"
      @update:model-value="
        (v: unknown) => emit('update:pageSize', Number(v))
      "
    >
      <SelectTrigger
        aria-label="每页条数"
        class="basic-table-page-size h-7 w-auto gap-1 rounded border-gray-200 px-1.5 text-xs data-[size=sm]:h-7 dark:border-gray-700"
        size="sm"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectItem
          v-for="option in props.pageSizeOptions"
          :key="String(option)"
          :value="String(option)"
        >
          {{ option }} 条/页
        </SelectItem>
      </SelectContent>
    </Select>

    <Pagination
      class="mx-0 w-auto justify-start"
      :items-per-page="props.pageSize"
      :page="props.current"
      :show-edges="true"
      :sibling-count="props.siblingCount"
      :total="props.total"
      @update:page="(page: number) => emit('update:current', page)"
    >
      <PaginationContent v-slot="{ items }" class="items-center gap-1">
        <PaginationPrevious
          class="basic-table-prev size-6 rounded-md px-1"
          size="icon-xs"
        >
          <Icon icon="ant-design:left-outlined" />
          <span class="sr-only">上一页</span>
        </PaginationPrevious>

        <template v-for="(item, index) in items" :key="index">
          <PaginationEllipsis
            v-if="item.type === 'ellipsis'"
            :index="index"
            class="basic-table-page-ellipsis size-6 text-gray-400"
          >
            ···
            <span class="sr-only">更多页码</span>
          </PaginationEllipsis>
          <PaginationItem
            v-else
            :class="
              cn(
                'basic-table-page size-6 border-transparent text-xs',
                `basic-table-page-${item.value}`,
                item.value === props.current &&
                  'bg-primary text-primary-foreground hover:bg-primary/90',
              )
            "
            :is-active="item.value === props.current"
            :size="'icon-xs'"
            :value="item.value as number"
          />
        </template>

        <PaginationNext
          class="basic-table-next size-6 rounded-md px-1"
          size="icon-xs"
        >
          <Icon icon="ant-design:right-outlined" />
          <span class="sr-only">下一页</span>
        </PaginationNext>
      </PaginationContent>
    </Pagination>

    <span
      v-if="props.showQuickJumper"
      class="flex items-center gap-1 text-gray-500 dark:text-gray-400"
    >
      跳至
      <Input
        aria-label="跳至页码"
        class="basic-table-quick-jumper h-7 w-12 px-1 text-center"
        type="text"
        @keydown.enter="jump"
      />
      页
    </span>
  </div>
</template>
