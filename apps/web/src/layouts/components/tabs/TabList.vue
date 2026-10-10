<script setup lang="ts">
import type { TabItem } from '@antdv/types';

import { computed } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';

import TabItemView from './TabItem.vue';

defineOptions({ name: 'TabList' });

const props = withDefaults(
  defineProps<{
    activeKey: string;
    /** 固定标签数量：它们永远排在最前，不允许被拖到它们前面 */
    affixCount: number;
    closeClass: string;
    /** 允许拖拽排序（设置项 tabDragSort）；不传时按 withDefaults 的 true 处理 */
    draggable?: boolean;
    /** 由 useTabStyle 提供的类名函数：选中与否决定样式，风格切换只改这里 */
    itemClass: (active: boolean) => string;
    listClass: string;
    showIcon: boolean;
    tabs: TabItem[];
  }>(),
  { draggable: true },
);

const emit = defineEmits<{
  activate: [key: string];
  close: [key: string];
  contextmenu: [event: MouseEvent, key: string];
  /** 拖拽结束后的完整新顺序，由上层写回 store（store 是唯一数据源） */
  reorder: [tabs: TabItem[]];
}>();

/**
 * v-model 直接接到 sortable 的结果上。
 * 若只监听 @end 再手动改数组，SortableJS 已经把真实 DOM 节点移动了，
 * Vue 的虚拟 DOM 仍按旧顺序 patch，会出现顺序错乱或重复节点。
 */
const list = computed<TabItem[]>({
  get: () => props.tabs,
  set: (next) => emit('reorder', next),
});

/**
 * 固定标签守卫（sortable 的 onMove）。
 *
 * sortable 的 MoveEvent 只提供 dragged / related 两个 DOM 节点，没有
 * `draggedIndex` / `relatedIndex` 这种字段（早期 vuedraggable 才有），
 * 所以索引必须自己从容器里量。用结构性类型声明入参：它比 MoveEvent 更宽，
 * 赋值检查照样通过，也不需要额外依赖 @types/sortablejs。
 */
function onMove(event: {
  dragged?: HTMLElement | null;
  from?: HTMLElement | null;
  related?: HTMLElement | null;
  to?: HTMLElement | null;
}): boolean {
  if (props.affixCount <= 0) return true;

  const draggedIndex = indexOfChild(event.to ?? event.from, event.dragged);
  const relatedIndex = indexOfChild(event.to ?? event.from, event.related);

  // 任一环节落在固定区就拒绝：被拖的不能是固定标签，落点也不能越过它们
  return draggedIndex >= props.affixCount && relatedIndex >= props.affixCount;
}

/** 找不到节点时返回 -1，任何 affixCount>0 的比较都会把它判成「不允许」 */
function indexOfChild(container: HTMLElement | null | undefined, node: HTMLElement | null | undefined): number {
  if (!container || !node) return -1;
  return [...container.children].indexOf(node);
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
  >
    <TabItemView
      v-for="tab in list"
      :key="tab.key"
      :active="tab.key === props.activeKey"
      :closable="!tab.affix && props.tabs.length > props.affixCount"
      :close-class="props.closeClass"
      :item-class="props.itemClass(tab.key === props.activeKey)"
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
