<script setup lang="ts">
import type {
  FetchParams,
  Recordable,
  TableActionType,
} from '~/components/business/Table/types';

import type { TreeDataNode, TreeTableProps } from './types';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { Icon } from '@iconify/vue';
import { useDebounceFn, useEventListener } from '@vueuse/core';
import { Tree } from 'antdv-next';
import { BasicTable } from '~/components/business/Table';
import { cn } from '~/utils/cn';

const props = withDefaults(defineProps<TreeTableProps>(), {
  treeTitle: '目录',
  treeDefaultExpandAll: true,
  treeSearchPlaceholder: '请输入关键词搜索',
  treeWidth: 260,
  treeMinWidth: 200,
  treeMaxWidth: 480,
  tableTitle: '列表',
  tableRowKey: 'id',
  tablePageSize: 10,
  showSearch: true,
  treeEmptyText: '暂无数据',
  tableEmptyText: '暂无数据',
});

const emit = defineEmits<{
  treeSelect: [selectedKey: string, selectedNode: TreeDataNode];
}>();

const panelWidth = ref(props.treeWidth);
const isDragging = ref(false);
const searchValue = ref('');
const selectedKey = ref<string>('');
const currentTreeKey = ref('');
const panelRef = ref<HTMLElement>();
const basicTableRef = ref<TableActionType>();
const expandedKeys = ref<string[]>([]);

function handleRegister(instance: TableActionType) {
  basicTableRef.value = instance;
}

// ============ 树数据过滤 ============
function getAllKeys(nodes: TreeDataNode[]): string[] {
  const keys: string[] = [];
  const walk = (list: TreeDataNode[]) => {
    for (const node of list) {
      keys.push(node.key);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return keys;
}

function filterTree(nodes: TreeDataNode[], keyword: string): TreeDataNode[] {
  const lower = keyword.toLowerCase();
  return nodes.reduce<TreeDataNode[]>((acc, node) => {
    const titleMatch = node.title.toLowerCase().includes(lower);
    const filteredChildren = node.children?.length
      ? filterTree(node.children, keyword)
      : [];
    if (titleMatch || filteredChildren.length > 0) {
      acc.push({
        ...node,
        children:
          filteredChildren.length > 0 ? filteredChildren : node.children,
      });
    }
    return acc;
  }, []);
}

const filteredTreeData = computed(() =>
  searchValue.value.trim()
    ? filterTree(props.treeData, searchValue.value.trim())
    : props.treeData,
);

watch(
  () => props.treeData,
  () => {
    if (props.treeDefaultExpandAll) {
      expandedKeys.value = getAllKeys(props.treeData);
    }
  },
  { immediate: true },
);

// ============ 搜索（useDebounceFn） ============
const debouncedSearch = useDebounceFn((val: string) => {
  searchValue.value = val;
  expandedKeys.value = getAllKeys(
    val.trim() ? filteredTreeData.value : props.treeData,
  );
}, 300);

async function handleTreeSelect(
  _selectedKeys: unknown[],
  info: { node: { key: string } },
) {
  const key = info.node?.key;
  if (!key) return;
  selectedKey.value = key;
  currentTreeKey.value = key;
  emit('treeSelect', key, info.node as TreeDataNode);
  await basicTableRef.value?.reload();
}

function wrappedApi(params: FetchParams): Promise<Recordable> {
  return props.tableApi!({
    treeKey: currentTreeKey.value,
    page: params.page || 1,
    pageSize: params.pageSize || props.tablePageSize,
  }) as unknown as Promise<Recordable>;
}

// ============ 拖拽（useEventListener 自动清理） ============
function handleDragMove(e: MouseEvent) {
  if (!isDragging.value || !panelRef.value) return;
  const rect = panelRef.value.getBoundingClientRect();
  panelWidth.value = Math.max(
    props.treeMinWidth,
    Math.min(props.treeMaxWidth, e.clientX - rect.left),
  );
}

function handleDragStart(e: MouseEvent) {
  isDragging.value = true;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  e.preventDefault();
}

function handleDragEnd() {
  isDragging.value = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
}

useEventListener(document, 'mousemove', handleDragMove);
useEventListener(document, 'mouseup', handleDragEnd);

onBeforeUnmount(() => {
  // 恢复 body 样式（useEventListener 会自动解绑事件）
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});

// ============ 样式类名 ============
const containerClassName = cn(
  'flex h-full overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900',
);

const treePanelClassName = computed(() =>
  cn(
    'flex h-full shrink-0 flex-col border-r border-gray-100 dark:border-gray-800',
    isDragging.value && 'transition-none',
  ),
);

const treePanelStyle = computed(() => ({ width: `${panelWidth.value}px` }));

const treeHeaderClassName = cn(
  'flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800',
);
const treeHeaderTitleClassName = cn(
  'text-sm font-medium text-gray-700 dark:text-gray-300',
);
const treeBodyClassName = cn('min-h-0 flex-1 overflow-hidden p-2');
const treeSearchClassName = cn('mb-2');

const resizeHandleClassName = computed(() =>
  cn(
    'w-1 shrink-0 cursor-col-resize',
    'bg-transparent transition-colors hover:bg-blue-400/30',
    isDragging.value && 'bg-blue-500/30',
  ),
);

const tablePanelClassName = cn(
  'flex h-full min-w-0 flex-1 flex-col overflow-hidden',
);
const tableHeaderClassName = cn(
  'flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800',
);
const tableHeaderTitleClassName = cn(
  'text-sm font-medium text-gray-700 dark:text-gray-300',
);
const tableBodyClassName = cn('flex-1 overflow-hidden');
const emptyClassName = cn(
  'flex flex-col items-center justify-center py-16',
  'text-gray-400 dark:text-gray-500',
);
const placeholderClassName = cn(
  'flex h-full flex-col items-center justify-center',
  'text-gray-400 dark:text-gray-500',
);
const nothingSelectedClassName = cn('text-sm text-gray-400 dark:text-gray-500');
</script>

<template>
  <div ref="panelRef" :class="containerClassName">
    <div :class="treePanelClassName" :style="treePanelStyle">
      <div :class="treeHeaderClassName">
        <span :class="treeHeaderTitleClassName">{{ treeTitle }}</span>
      </div>

      <div :class="treeBodyClassName">
        <PerfectScrollbar class="h-full">
          <div v-if="showSearch" :class="treeSearchClassName">
            <a-input
              :placeholder="treeSearchPlaceholder"
              allow-clear
              @change="(e: any) => debouncedSearch(e.target.value)"
            >
              <template #prefix>
                <Icon icon="carbon:search" class="text-gray-400" />
              </template>
            </a-input>
          </div>

          <Tree
            v-if="filteredTreeData.length > 0"
            :tree-data="filteredTreeData as any"
            :expanded-keys="expandedKeys"
            :selected-keys="selectedKey ? [selectedKey] : []"
            :field-names="{ key: 'key', title: 'title', children: 'children' }"
            block-node
            @select="handleTreeSelect"
            @expand="(keys: string[]) => (expandedKeys = keys)"
          />

          <div v-else :class="emptyClassName">
            <Icon icon="carbon:search" class="mb-2 text-3xl" />
            <span class="text-sm">{{ treeEmptyText }}</span>
          </div>
        </PerfectScrollbar>
      </div>
    </div>

    <div :class="resizeHandleClassName" @mousedown="handleDragStart"></div>

    <div :class="tablePanelClassName">
      <div :class="tableHeaderClassName">
        <span :class="tableHeaderTitleClassName">
          {{ tableTitle }}
          <template v-if="selectedKey">
            <span :class="nothingSelectedClassName"> 已选择节点 </span>
          </template>
        </span>
      </div>

      <div :class="tableBodyClassName">
        <template v-if="selectedKey && tableApi">
          <BasicTable
            :api="wrappedApi"
            :columns="tableColumns"
            :row-key="tableRowKey"
            :pagination="true"
            :immediate="false"
            size="small"
            :empty-text="tableEmptyText"
            @register="handleRegister"
          />
        </template>

        <div v-else :class="placeholderClassName">
          <Icon icon="carbon:tree-view-alt" class="mb-3 text-4xl" />
          <span class="text-sm text-gray-400">请在左侧选择节点查看数据</span>
        </div>
      </div>
    </div>
  </div>
</template>
