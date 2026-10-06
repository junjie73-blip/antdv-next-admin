<script setup lang="ts">
import type { TabItem } from '@antdv/types';

import { CloseOutlined } from '@antdv-next/icons';
import { Icon } from '@iconify/vue';
import { cn } from '~/utils/cn';

defineOptions({ name: 'TabItem' });

const props = defineProps<{
  /** 选中态：影响样式与 scrollIntoView 定位 */
  active: boolean;
  /** 可关闭：由 store 统一判定（固定标签、只剩一个时不可关） */
  closable: boolean;
  /** 关闭按钮样式，来自 useTabStyle */
  closeClass: string;
  /** 标签本体样式，来自 useTabStyle */
  itemClass: string;
  showIcon: boolean;
  tab: TabItem;
}>();

const emit = defineEmits<{
  click: [key: string];
  close: [key: string];
  contextmenu: [event: MouseEvent, key: string];
}>();
</script>

<template>
  <div
    :class="cn('tab-item select-none', props.itemClass)"
    :data-active="props.active"
    :data-tab-key="props.tab.key"
    @click="emit('click', props.tab.key)"
    @contextmenu.prevent="emit('contextmenu', $event, props.tab.key)"
  >
    <Icon
      v-if="props.showIcon && props.tab.icon"
      :icon="props.tab.icon"
      :width="14"
      :height="14"
    />
    <span>{{ props.tab.title }}</span>
    <CloseOutlined
      v-if="props.closable"
      :class="cn('tab-item__close', props.closeClass)"
      @click.stop="emit('close', props.tab.key)"
    />
  </div>
</template>
