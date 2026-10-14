<script setup lang="ts">
import type { TabItem as TabItemData } from '@antdv/types';

import { onMounted, useTemplateRef } from 'vue';

import { useTabDragSort } from '../useTabDragSort';
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
    tabs: TabItemData[];
  }>(),
  { draggable: true },
);

const emit = defineEmits<{
  activate: [key: string];
  close: [key: string];
  contextmenu: [event: MouseEvent, key: string];
  /** 拖拽结束后的完整新顺序，由上层写回数据源（数据源是唯一真相） */
  reorder: [tabs: TabItemData[]];
}>();

const listRef = useTemplateRef<HTMLElement>('list');

const { initSortable } = useTabDragSort({
  affixCount: () => props.affixCount,
  isDisabled: () => !props.draggable,
  onReorder: (next) => emit('reorder', next),
  tabs: () => props.tabs,
});

onMounted(() => {
  if (listRef.value) initSortable(listRef.value);
});
</script>

<template>
  <div
    ref="list"
    class="tab-list"
    :class="props.listClass"
  >
    <TabItemView
      v-for="tab in props.tabs"
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
  </div>
</template>

<style scoped>
/* 拖拽占位：只降低透明度，避免与卡片风格的实色背景混成一块 */
.tab-ghost {
  opacity: 0.4;
}
</style>
