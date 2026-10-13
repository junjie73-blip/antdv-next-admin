<script setup lang="ts">
import type { MenuNode } from '../types';
import type { MenuVariant } from '../useMenuStyle';

import { computed } from 'vue';

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/cn';

import { useMenuContext } from '../context';
import MenuList from './MenuList.vue';
import MenuRow from './MenuRow.vue';

defineOptions({ name: 'MenuItem' });

const props = defineProps<{
  /** 浮层里的缩进基准：面板内第一级不再叠加外层深度 */
  baseDepth?: number;
  node: MenuNode;
  variant: MenuVariant;
}>();

const context = useMenuContext();

const hasChildren = computed(() => props.node.children.length > 0);
const expanded = computed(() => context.openKeys.value.has(props.node.key));

/**
 * 子菜单是"就地展开"还是"浮层"：
 * - 横向栏、浮层面板里：只能浮层（没有"就地"可言）
 * - 侧栏折叠态：整列只剩图标，就地展开会把这一列撑爆，也走浮层
 * - 侧栏展开态：就地展开，展开与否由受控 `openKeys` 决定
 *
 * 禁用项不挂浮层：reka 的 trigger 是 button，带着 `disabled` 时 hover 事件
 * 仍然会冒泡，会出现"灰着的菜单划过弹出子项"。
 */
const flyout = computed(
  () =>
    hasChildren.value &&
    !props.node.disabled &&
    (props.variant !== 'inline' || context.collapsed.value),
);
</script>

<template>
  <li class="menu-item relative" role="none">
    <HoverCard v-if="flyout" :close-delay="150" :open-delay="60">
      <HoverCardTrigger as-child>
        <MenuRow :base-depth="baseDepth" :node="node" :variant="variant" />
      </HoverCardTrigger>

      <!--
        面板尺寸交给内容（`w-max`）：菜单标题长短不一，定宽会把"组件示例"
        这种短标题也撑成 256px，浮层看起来像一块空板。
      -->
      <HoverCardContent
        align="start"
        :class="cn(context.style.panelClass(), 'w-max min-w-[160px] p-1')"
        :side="variant === 'bar' ? 'bottom' : 'right'"
        :side-offset="variant === 'bar' ? 2 : -8"
      >
        <MenuList
          :base-depth="node.depth"
          :nodes="node.children"
          variant="popup"
        />
      </HoverCardContent>
    </HoverCard>

    <template v-else>
      <MenuRow :base-depth="baseDepth" :node="node" :variant="variant" />

      <div
        v-if="hasChildren && expanded"
        :id="`menu-sub-${node.key}`"
        data-menu-submenu
        role="group"
      >
        <MenuList
          :base-depth="node.depth"
          :nodes="node.children"
          variant="inline"
        />
      </div>
    </template>
  </li>
</template>
