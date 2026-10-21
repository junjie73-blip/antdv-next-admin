<script setup lang="ts">
import type { MenuNode } from '../types';
import type { MenuVariant } from '../useMenuStyle';

import { computed } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';

import { useMenuContext } from '../context';
import { isBranchSelected } from '../menu-tree';
import MenuLabel from './MenuLabel.vue';

defineOptions({ name: 'MenuRow' });

const props = defineProps<{
  /** 浮层里的缩进基准：面板内第一级不再叠加外层深度 */
  baseDepth?: number;
  node: MenuNode;
  variant: MenuVariant;
}>();

const context = useMenuContext();

const selected = computed(() => context.selectedKeys.value.has(props.node.key));
const expanded = computed(() => context.openKeys.value.has(props.node.key));
const hasChildren = computed(() => props.node.children.length > 0);

/**
 * 当前页面在谁家的子树里，谁就亮（等价 antd 的 `submenu-selected`）：
 * 横向栏与侧栏都 tint 文字主色，只有选中的那一行才叠底色与加粗。
 * 浮层用不上 —— 那里的子菜单正飘在屏幕上，父级已经看得见。
 */
const inSelectedPath = computed(() => {
  if (props.variant === 'popup') return false;
  const keys = [...context.selectedKeys.value];
  return props.node.children.some((child) =>
    keys.some((key) => isBranchSelected(child, key)),
  );
});

const indentStyle = computed(() => {
  if (props.variant === 'bar') return undefined;
  const level =
    props.variant === 'popup'
      ? props.node.depth - (props.baseDepth ?? props.node.depth - 1)
      : props.node.depth;
  return { paddingLeft: `${Math.max(level, 1) * context.indent.value}px` };
});

/**
 * 点击语义照迁移前的两套行为，不合并成一套：
 * - 侧栏（迁移前接的是 antd `@select`）：点目录只展开，不导航；
 * - 横向栏（接的是 antd `@click`）：点目录也导航，应用侧 `openMenuByKey`
 *   会跳到该目录的第一个叶子 —— "停在 404 时点一级菜单没反应"就是当年改这一处修掉的。
 * 浮层里的目录不导航：hover 已经把子树摊开，点击再跳会变成"划过就换页"。
 */
function onClick() {
  const { disabled, external, leaf } = props.node;
  if (disabled || external) return;
  if (leaf || props.variant === 'bar') {
    context.select(props.node);
    return;
  }
  if (props.variant === 'popup') return;
  context.toggle(props.node);
}
</script>

<template>
  <component
    :is="node.external ? 'a' : 'button'"
    :aria-current="selected ? 'page' : undefined"
    :aria-expanded="hasChildren ? expanded : undefined"
    :class="
      context.style.rowClass(
        {
          disabled: node.disabled,
          expanded,
          inSelectedPath,
          selected,
        },
        variant,
      )
    "
    :disabled="!node.external && node.disabled"
    :href="node.external"
    :rel="node.external ? 'noopener noreferrer' : undefined"
    :style="indentStyle"
    :target="node.external ? '_blank' : undefined"
    :type="node.external ? undefined : 'button'"
    :data-menu-key="node.key"
    :data-menu-depth="node.depth"
    :data-menu-mode="variant"
    :data-menu-state="
      selected ? 'selected' : inSelectedPath ? 'ancestor' : undefined
    "
    role="menuitem"
    @click="onClick"
  >
    <!-- 选中竖条：迁移前用 ::before 画；自绘后放一个真元素，深色下的辉光靠 token 混色 -->
    <Transition
      enter-active-class="transition-[transform,opacity,scale] duration-200 ease-out"
      enter-from-class="opacity-0 scale-y-0"
      leave-active-class="transition-[transform,opacity,scale] duration-150 ease-in"
      leave-to-class="opacity-0 scale-y-0"
    >
      <span
        v-if="selected && variant !== 'bar'"
        :class="context.style.activeBarClass()"
        aria-hidden="true"
        data-menu-active-bar
      ></span>
    </Transition>

    <MenuLabel
      :badge="node.badge"
      :collapsed="variant === 'inline' && context.collapsed.value"
      :extra="node.extra"
      :icon="node.icon"
      :keep-icon-slot="context.keepIconSlot"
      :title="node.title"
    />

    <Icon
      v-if="hasChildren"
      :class="context.style.arrowClass(variant)"
      :icon="
        variant === 'inline' ? 'carbon:chevron-down' : 'carbon:chevron-right'
      "
      :style="
        variant === 'inline' && expanded
          ? { transform: 'rotate(180deg)' }
          : undefined
      "
      aria-hidden="true"
      data-menu-arrow
    />
  </component>
</template>
