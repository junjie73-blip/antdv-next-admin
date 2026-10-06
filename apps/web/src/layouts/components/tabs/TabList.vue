<script setup lang="ts">
import type { TabItem } from '@antdv-admin/types'

import { computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import TabItemView from './TabItem.vue'

defineOptions({ name: 'TabList' })

const props = withDefaults(
  defineProps<{
    activeKey: string
    /** 固定标签数量：它们永远排在最前，不允许被拖到它们前面 */
    affixCount: number
    closeClass: string
    /** 允许拖拽排序（设置项 tabDragSort） */
    draggable: boolean
    itemClass: string
    listClass: string
    showIcon: boolean
    tabs: TabItem[]
  }>(),
  { draggable: true },
)

const emit = defineEmits<{
  activate: [key: string]
  close: [key: string]
  contextmenu: [event: MouseEvent, key: string]
  /** 拖拽结束后的完整新顺序，由上层写回 store（store 是唯一数据源） */
  reorder: [tabs: TabItem[]]
}>()

/**
 * v-model 直接接到 sortable 的结果上。
 * 若只监听 @end 再手动改数组，SortableJS 已经把真实 DOM 节点移动了，
 * Vue 的虚拟 DOM 仍按旧顺序 patch，会出现顺序错乱或重复节点。
 */
const list = computed<TabItem[]>({
  get: () => props.tabs,
  set: (next) => emit('reorder', next),
})

function onMove(event: { draggedIndex: number, relatedIndex: number }) {
  // 固定标签（首页）既不能被拖动，也不能被插到前面
  return (
    event.draggedIndex >= props.affixCount &&
    event.relatedIndex >= props.affixCount
  )
}
</script>

<template>
  <VueDraggable
    v-model="list"
    :disabled="!props.draggable"
    :on-move="onMove"
    item-key="key"
    :animation="180"
    ghost-class="tab-ghost"
    class="tab-list"
    :class="props.listClass"
    @vue:mounted="({ el }) => mountedScroll(el as HTMLElement)"
  >
    <TabItemView
      v-for="tab in list"
      :key="tab.key"
      :active="tab.key === props.activeKey"
      :closable="!tab.affix && props.tabs.length > props.affixCount"
      :close-class="props.closeClass"
      :item-class="props.itemClass"
      :show-icon="props.showIcon"
      :tab="tab"
      @click="emit('activate', $event)"
      @close="emit('close', $event)"
      @contextmenu="(event, key) => emit('contextmenu', event, key)"
    />
  </VueDraggable>
</template>

<style scoped>
/* 拖拽占位：只降低透明度，避免与卡片风格的实色背景混成一块 */
.tab-ghost {
  opacity: 0.4;
}
</style>
