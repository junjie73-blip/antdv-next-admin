<script setup lang="ts">
import type { TreeKey } from '@antdv/common-ui';

import type {
  FetchParams,
  Recordable,
  TableActionType,
  TreeDataNode,
  TreeTableEmits,
  TreeTableProps,
} from '../types';

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { Scrollbar, Tree } from '@antdv/common-ui';

import { IconifyIcon as Icon } from '@antdv/icons/icon';
import { cn } from '@antdv/shared/utils/cn';
import { Input } from '@antdv/shadcn-ui';
import { useDebounceFn, useEventListener } from '@vueuse/core';

import BasicTable from '../BasicTable.vue';

/**
 * 左树右表：点树节点 → 带着 `treeKey` 重新拉右侧表格。
 *
 * 表格实例通过 `@register` 拿（`basicTableRef`），所以选中节点后能直接 `reload()`；
 * 首屏不拉数据（`:immediate="false"`），没选中节点时右侧只显示占位。
 * 左侧面板宽度可拖，`mousemove` / `mouseup` 交给 `useEventListener` 自动解绑。
 */
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

const emit = defineEmits<TreeTableEmits>();

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
  const matched: TreeDataNode[] = [];
  for (const node of nodes) {
    const titleMatch = node.title.toLowerCase().includes(lower);
    const filteredChildren = node.children?.length
      ? filterTree(node.children, keyword)
      : [];
    if (titleMatch || filteredChildren.length > 0) {
      matched.push({
        ...node,
        children:
          filteredChildren.length > 0 ? filteredChildren : node.children,
      });
    }
  }
  return matched;
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

// shadcn Input 走 v-model，不再提供 @change/allow-clear，这里用 watch 驱动防抖搜索
const treeSearchText = ref('');
watch(treeSearchText, (val) => debouncedSearch(val));

async function handleTreeSelect(
  _selectedKeys: TreeKey[],
  info: { node: Record<string, any>; selected?: boolean },
) {
  const key = info.node?.key as string;
  if (!key) return;
  selectedKey.value = key;
  currentTreeKey.value = key;
  emit('treeSelect', key, info.node as TreeDataNode);
  // BasicTable 由 `selectedKey` 才挂载，首次选中时 action 还没注册出来，等一次 flush 再取数
  await nextTick();
  await basicTableRef.value?.reload();
}

// 模板只在 `selectedKey && tableApi` 时挂载 BasicTable，所以这里拿到的 params 一定带着 api
function wrappedApi(params: FetchParams): Promise<Recordable> {
  return props.tableApi?.({
    treeKey: currentTreeKey.value,
    page: params.pageNum || 1,
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
// 一律语义 token：写死 gray-100 / white 的面板在深色下是白底白字
const containerClassName = cn(
  'flex h-full overflow-hidden rounded-xl border bg-card',
);

const treePanelClassName = computed(() =>
  cn(
    'flex h-full shrink-0 flex-col border-r',
    isDragging.value && 'transition-none',
  ),
);

const treePanelStyle = computed(() => ({ width: `${panelWidth.value}px` }));

const treeHeaderClassName = cn(
  'flex shrink-0 items-center justify-between border-b px-4 py-3',
);
const treeHeaderTitleClassName = cn('text-sm font-medium text-foreground');
const treeBodyClassName = cn('min-h-0 flex-1 overflow-hidden p-2');
const treeSearchClassName = cn('mb-2');

const resizeHandleClassName = computed(() =>
  cn(
    'w-1 shrink-0 cursor-col-resize',
    'bg-transparent transition-colors hover:bg-primary/30',
    isDragging.value && 'bg-primary/40',
  ),
);

const tablePanelClassName = cn(
  'flex h-full min-w-0 flex-1 flex-col overflow-hidden',
);
const tableHeaderClassName = cn(
  'flex shrink-0 items-center justify-between border-b px-4 py-3',
);
const tableHeaderTitleClassName = cn('text-sm font-medium text-foreground');
const tableBodyClassName = cn('flex-1 overflow-hidden');
const emptyClassName = cn(
  'flex flex-col items-center justify-center py-16 text-muted-foreground',
);
const placeholderClassName = cn(
  'flex h-full flex-col items-center justify-center text-muted-foreground',
);
const nothingSelectedClassName = cn('ml-2 text-xs text-muted-foreground');
</script>

<template>
  <div ref="panelRef" :class="containerClassName">
    <div :class="treePanelClassName" :style="treePanelStyle">
      <div :class="treeHeaderClassName">
        <span :class="treeHeaderTitleClassName">{{ treeTitle }}</span>
      </div>

      <div :class="treeBodyClassName">
        <Scrollbar root-class="h-full">
          <div v-if="showSearch" :class="treeSearchClassName">
            <div class="relative">
              <span
                class="text-muted-foreground absolute inset-y-0 left-2.5 flex items-center"
              >
                <Icon icon="carbon:search" />
              </span>
              <Input
                v-model="treeSearchText"
                :placeholder="treeSearchPlaceholder"
                class="pl-8"
              />
            </div>
          </div>

          <Tree
            v-if="filteredTreeData.length > 0"
            :tree-data="filteredTreeData as any"
            :expanded-keys="expandedKeys"
            :selected-keys="selectedKey ? [selectedKey] : []"
            :field-names="{ key: 'key', title: 'title', children: 'children' }"
            block-node
            @select="handleTreeSelect"
            @expand="
              (keys: TreeKey[]) => (expandedKeys = keys.map((k) => String(k)))
            "
          />

          <div v-else :class="emptyClassName">
            <Icon icon="carbon:search" :size="30" class="mb-2" />
            <span class="text-sm">{{ treeEmptyText }}</span>
          </div>
        </Scrollbar>
      </div>
    </div>

    <div :class="resizeHandleClassName" @mousedown="handleDragStart"></div>

    <div :class="tablePanelClassName">
      <div :class="tableHeaderClassName">
        <span :class="tableHeaderTitleClassName">
          {{ tableTitle }}
          <span v-if="selectedKey" :class="nothingSelectedClassName">
            已选择节点
          </span>
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
          <Icon icon="carbon:tree-view-alt" :size="36" class="mb-3" />
          <span class="text-sm">请在左侧选择节点查看数据</span>
        </div>
      </div>
    </div>
  </div>
</template>
