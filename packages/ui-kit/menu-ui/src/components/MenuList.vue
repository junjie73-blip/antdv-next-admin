<script setup lang="ts">
import type { MenuNode } from '../types';
import type { MenuVariant } from '../useMenuStyle';

import { useMenuContext } from '../context';
import MenuItem from './MenuItem.vue';

defineOptions({ name: 'MenuList' });

const props = defineProps<{
  /** 浮层内的缩进基准（面板第一级视作 depth 1） */
  baseDepth?: number;
  nodes: MenuNode[];
  variant: MenuVariant;
}>();

const context = useMenuContext();
</script>

<template>
  <!--
    用 ul/li + role="menubar"：菜单是可键盘遍历的导航，不是列表卡片。
    `variant` 决定排向（横向条 flex-row、内联与浮层 flex-column），
    三处共用一份 DOM 结构，样式差异全部来自 `useMenuStyle`。
  -->
  <ul
    :class="context.style.listClass(props.variant)"
    :data-menu-variant="props.variant"
    role="menubar"
    data-menu-list
  >
    <MenuItem
      v-for="node in props.nodes"
      :key="node.key"
      :base-depth="props.baseDepth"
      :node="node"
      :variant="props.variant"
    />
  </ul>
</template>
