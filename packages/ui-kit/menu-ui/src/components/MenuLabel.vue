<script setup lang="ts">
import type { MenuBadge as MenuBadgeConfig } from '@antdv/types';

import { computed } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';

import MenuBadge from './MenuBadge.vue';

defineOptions({ name: 'MenuLabel' });

const props = withDefaults(
  defineProps<{
    badge?: MenuBadgeConfig;
    /** 侧栏折叠：只留图标，标题/徽标/附加文字全部收起 */
    collapsed?: boolean;
    extra?: boolean | number | string;
    icon?: string;
    /** 缺图标的项也占一个图标位，保证一列文字左边缘对齐 */
    keepIconSlot?: boolean;
    title: string;
  }>(),
  { badge: undefined, collapsed: false, extra: undefined, icon: undefined, keepIconSlot: false },
);

/**
 * `extra` 的类型是 `boolean | number | string`：布尔值只表达"有附加信息"，
 * 本身没有可显示的内容。迁移前直接把它塞给 h()，`true` 会被渲染成字符串
 * "true" 挂在菜单右侧 —— 这里按类型收窄，布尔值不显示。
 */
const extraText = computed(() => {
  const { extra } = props;
  return typeof extra === 'string' || typeof extra === 'number'
    ? String(extra)
    : '';
});

const showIcon = computed(() => Boolean(props.icon) || props.keepIconSlot);
</script>

<template>
  <span class="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
    <!-- 图标槽：宽度固定，缺图标时留空位而不是塌陷 -->
    <span
      v-if="showIcon"
      class="inline-flex w-5 shrink-0 items-center justify-center text-lg leading-none"
      data-menu-icon
    >
      <Icon v-if="icon" :icon="icon" />
    </span>

    <!--
      折叠时标题淡出而不是瞬间消失：侧栏宽度是渐变收的，文字跟着淡掉才不跳。
      标题与徽标同进同退，所以包成一个节点给 Transition 用。
    -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <span v-if="!collapsed" class="flex min-w-0 flex-1 items-center gap-1.5">
        <span class="min-w-0 flex-1 truncate" data-menu-label>{{ title }}</span>
        <MenuBadge :badge="badge" />
      </span>
    </Transition>
  </span>

  <span
    v-if="!collapsed && extraText"
    class="menu-extra shrink-0 text-[11px] text-slate-400 dark:text-slate-500"
    data-menu-extra
  >
    {{ extraText }}
  </span>
</template>
