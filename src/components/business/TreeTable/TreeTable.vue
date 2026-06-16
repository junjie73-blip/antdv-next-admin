<script setup lang="ts">
import type { TreeDataNode, TreeTableProps } from './types'
import type { FetchParams, Recordable, TableActionType } from '@/components/business/Table/types'

import { Icon } from '@iconify/vue'
import { useDebounceFn } from '@vueuse/core'
import { Tree } from 'antdv-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { BasicTable } from '@/components/business/Table'
import { cn } from '@/utils/cn'

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
})

const emit = defineEmits<{
  treeSelect: [selectedKey: string, selectedNode: TreeDataNode]
}>()

const panelWidth = ref(props.treeWidth)
const isDragging = ref(false)
const searchValue = ref('')
const selectedKey = ref<string>('')
const currentTreeKey = ref('')
const panelRef = ref<HTMLElement>()
const basicTableRef = ref<TableActionType>()

function handleRegister(instance: TableActionType) {
  basicTableRef.value = instance
}

const filteredTreeData = computed(() => {
  if (!searchValue.value.trim())
    return props.treeData
  return filterTree(props.treeData, searchValue.value.trim())
})

const expandedKeys = ref<string[]>([])

watch(() => props.treeData, () => {
  if (props.treeDefaultExpandAll) {
    expandedKeys.value = getAllKeys(props.treeData)
  }
}, { immediate: true })

function getAllKeys(nodes: TreeDataNode[]): string[] {
  const keys: string[] = []
  function walk(list: TreeDataNode[]) {
    for (const node of list) {
      keys.push(node.key)
      if (node.children?.length)
        walk(node.children)
    }
  }
  walk(nodes)
  return keys
}

function filterTree(nodes: TreeDataNode[], keyword: string): TreeDataNode[] {
  const result: TreeDataNode[] = []
  for (const node of nodes) {
    const titleMatch = node.title.toLowerCase().includes(keyword.toLowerCase())
    const filteredChildren = node.children?.length
      ? filterTree(node.children, keyword)
      : []

    if (titleMatch || filteredChildren.length > 0) {
      result.push({
        ...node,
        children: filteredChildren.length > 0 ? filteredChildren : node.children,
      })
    }
  }
  return result
}

const debouncedSearch = useDebounceFn((val: string) => {
  searchValue.value = val
  if (val.trim()) {
    expandedKeys.value = getAllKeys(filteredTreeData.value)
  }
  else {
    expandedKeys.value = getAllKeys(props.treeData)
  }
}, 300)

async function handleTreeSelect(_selectedKeys: any[], info: { node: any }) {
  const key = info.node?.key as string
  if (!key)
    return
  selectedKey.value = key
  currentTreeKey.value = key
  emit('treeSelect', key, info.node)
  await basicTableRef.value?.reload()
}

function wrappedApi(params: FetchParams): Promise<Recordable> {
  return props.tableApi!({
    treeKey: currentTreeKey.value,
    page: params.page || 1,
    pageSize: params.pageSize || props.tablePageSize,
  }) as unknown as Promise<Recordable>
}

function handleDragStart(e: MouseEvent) {
  isDragging.value = true
  document.addEventListener('mousemove', handleDragMove)
  document.addEventListener('mouseup', handleDragEnd)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  e.preventDefault()
}

function handleDragMove(e: MouseEvent) {
  if (!isDragging.value || !panelRef.value)
    return
  const rect = panelRef.value.getBoundingClientRect()
  let newWidth = e.clientX - rect.left
  newWidth = Math.max(props.treeMinWidth, Math.min(props.treeMaxWidth, newWidth))
  panelWidth.value = newWidth
}

function handleDragEnd() {
  isDragging.value = false
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mouseup', handleDragEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mouseup', handleDragEnd)
})

const containerClassName = cn(
  'flex h-full rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden',
)

const treePanelClassName = computed(() =>
  cn(
    'flex flex-col flex-shrink-0 h-full border-r border-gray-100 dark:border-gray-800',
    isDragging.value && 'transition-none',
  ),
)

const treePanelStyle = computed(() => ({
  width: `${panelWidth.value}px`,
}))

const treeHeaderClassName = cn(
  'flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0',
)

const treeHeaderTitleClassName = cn('text-sm font-medium text-gray-700 dark:text-gray-300')

const treeBodyClassName = cn('flex-1 min-h-0 overflow-hidden p-2')

const treeSearchClassName = cn('mb-2')

const resizeHandleClassName = computed(() =>
  cn(
    'w-1 cursor-col-resize flex-shrink-0',
    'bg-transparent hover:bg-blue-400/30 transition-colors',
    isDragging.value && 'bg-blue-500/30',
  ),
)

const tablePanelClassName = cn('flex-1 flex flex-col min-w-0 overflow-hidden h-full')

const tableHeaderClassName = cn(
  'flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0',
)

const tableHeaderTitleClassName = cn('text-sm font-medium text-gray-700 dark:text-gray-300')

const tableBodyClassName = cn('flex-1 overflow-hidden')

const emptyClassName = cn('flex flex-col items-center justify-center py-16 text-gray-400')

const placeholderClassName = cn(
  'flex flex-col items-center justify-center h-full text-gray-400',
)

const nothingSelectedClassName = cn('text-sm text-gray-400')
</script>

<template>
  <div
    ref="panelRef"
    :class="containerClassName"
  >
    <div
      :class="treePanelClassName"
      :style="treePanelStyle"
    >
      <div :class="treeHeaderClassName">
        <span :class="treeHeaderTitleClassName">{{ treeTitle }}</span>
      </div>

      <div :class="treeBodyClassName">
        <PerfectScrollbar class="h-full">
          <div
            v-if="showSearch"
            :class="treeSearchClassName"
          >
            <a-input
              :placeholder="treeSearchPlaceholder"
              allow-clear
              @change="(e: any) => debouncedSearch(e.target.value)"
            >
              <template #prefix>
                <Icon
                  icon="carbon:search"
                  class="text-gray-400"
                />
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
            @expand="(keys: string[]) => { expandedKeys = keys }"
          />

          <div
            v-else
            :class="emptyClassName"
          >
            <Icon
              icon="carbon:search"
              class="text-3xl mb-2"
            />
            <span class="text-sm">{{ treeEmptyText }}</span>
          </div>
        </PerfectScrollbar>
      </div>
    </div>

    <div
      :class="resizeHandleClassName"
      @mousedown="handleDragStart"
    />

    <div :class="tablePanelClassName">
      <div :class="tableHeaderClassName">
        <span :class="tableHeaderTitleClassName">
          {{ tableTitle }}
          <template v-if="selectedKey">
            <span :class="nothingSelectedClassName">
              已选择节点
            </span>
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

        <div
          v-else
          :class="placeholderClassName"
        >
          <Icon
            icon="carbon:tree-view-alt"
            class="text-4xl mb-3"
          />
          <span class="text-sm text-gray-400">请在左侧选择节点查看数据</span>
        </div>
      </div>
    </div>
  </div>
</template>
