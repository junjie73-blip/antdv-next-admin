<script setup lang="ts">
import type { MenuConfig } from '@antdv/types';

import { computed } from 'vue';

import { LAYOUT_HEADER_ROW_STYLE } from '@antdv/layouts';
import { cn } from '@antdv/shared/cn';
import { menuKeyOf } from '@antdv/shared/menu';
import { Icon } from '@iconify/vue';
import { Tooltip } from 'antdv-next';
import logoIconUrl from '~/assets/images/logo.png';
import { useAppStore } from '~/stores/modules/app';

import { useShell } from '../composables/useLayout';

defineOptions({ name: 'LayoutNavRail' });

/**
 * 图标栏（双列形态的第一列）。
 *
 * - 双列菜单：这里是一级菜单，右侧主栏放它的子树；
 * - 混合双列：这里是当前一级菜单的二级，右侧主栏放三级及以下。
 *
 * 高亮项完全由路由推导（`regions.railActiveKey`）：点击只负责跳，
 * 跳完由"当前所在链"决定选中，因此不会出现"点了没亮 / 亮了好几项"。
 */

const appStore = useAppStore();
const { regions, source } = useShell();

const menus = computed(() => regions.railMenus.value);
const activeKey = computed(() => regions.railActiveKey.value);
const width = computed(() => appStore.railWidth);
const isDark = computed(
  () => appStore.darkSidebar || appStore.resolvedTheme === 'dark',
);

function keyOf(menu: MenuConfig) {
  return menuKeyOf(menu);
}

function isActive(menu: MenuConfig) {
  return keyOf(menu) === activeKey.value;
}

/** 选中项：主色底 + 主色字 + 左侧指示条 */
function itemClass(menu: MenuConfig) {
  return cn(itemClassName.value, isActive(menu) ? activeClassName : '');
}

function openMenu(menu: MenuConfig) {
  void source.openMenu(menu);
}

const railClassName = computed(() =>
  cn(
    'flex h-full shrink-0 flex-col border-e transition-[width] duration-200',
    isDark.value
      ? 'border-gray-800 bg-gray-900'
      : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900',
  ),
);

const itemBase = [
  'relative flex w-full items-center justify-center gap-1.5',
  'mx-2 rounded-lg py-2.5 transition-colors duration-200',
];

const itemClassName = computed(() =>
  cn(
    ...itemBase,
    isDark.value
      ? 'text-slate-300 hover:bg-white/6 hover:text-white'
      : 'text-slate-500 hover:bg-black/5 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-white/6 dark:hover:text-white',
  ),
);

const activeClassName =
  'bg-[color-mix(in_srgb,var(--ant-color-primary)_12%,transparent)] !text-[var(--ant-color-primary)] font-semibold';
</script>

<template>
  <aside data-layout-region="nav-rail" :class="railClassName" :style="{ width: `${width}px` }">
    <!-- Logo：图标栏形态下品牌位放在这里，主栏不再重复占高 -->
    <div
      data-layout-logo="rail"
      class="flex shrink-0 items-center justify-center overflow-hidden border-b border-inherit"
      :style="LAYOUT_HEADER_ROW_STYLE"
    >
      <img :src="logoIconUrl" alt="logo" class="h-8 w-8 object-contain" />
    </div>

    <!-- 图标列表：纵向溢出同样用封装组件，不留系统滚动条 -->
    <Scrollbar
      root-class="min-h-0 flex-1 py-2"
      wrap-class="overflow-x-hidden"
    >
      <Tooltip
        v-for="menu in menus"
        :key="keyOf(menu)"
        placement="right"
        :title="menu.title"
      >
        <button
          type="button"
          class="flex w-full"
          :aria-current="isActive(menu) ? 'page' : undefined"
          @click="openMenu(menu)"
        >
          <span :class="itemClass(menu)">
            <Icon :icon="menu.icon || 'carbon:category'" class="text-lg" />
            <!-- 左侧指示条：与主栏选中态同一套语言 -->
            <span
              v-if="isActive(menu)"
              class="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-[3px] bg-[var(--ant-color-primary)]"
            ></span>
          </span>
        </button>
      </Tooltip>
    </Scrollbar>
  </aside>
</template>
