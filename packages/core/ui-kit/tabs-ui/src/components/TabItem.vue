<script setup lang="ts">
import type { TabItem as TabItemData } from '@antdv/types';

import { IconifyIcon as Icon } from '@antdv/icons/icon';
import { cn } from '@antdv/shared/cn';

defineOptions({ name: 'TabItem' });

const props = defineProps<{
  /** 选中态：影响样式与 scrollIntoView 定位 */
  active: boolean;
  /** 可关闭：判定收敛在上层（固定标签不可关），组件只按结果画不画关闭按钮 */
  closable: boolean;
  /** 关闭按钮样式，来自 useTabStyle */
  closeClass: string;
  /** 标签本体样式，来自 useTabStyle */
  itemClass: string;
  showIcon: boolean;
  tab: TabItemData;
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
    :data-scroll-key="props.tab.key"
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
    <!--
      关闭图标包一层 span：closeClass 里的 `text-xs` 是字号来源，
      图标用 `1em` 跟随它（旧实现用的是 antd 图标，本身就是 1em），
      同时让点击热区与旧实现的 `.anticon` 一致 —— 落在图标外层而不是 svg 上。
    -->
    <span
      v-if="props.closable"
      :class="cn('tab-item__close inline-flex items-center', props.closeClass)"
      @click.stop="emit('close', props.tab.key)"
    >
      <Icon icon="ant-design:close-outlined" size="1em" />
    </span>
  </div>
</template>
