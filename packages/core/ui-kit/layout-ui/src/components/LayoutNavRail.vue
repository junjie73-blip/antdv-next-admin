<script setup lang="ts">
import type { MenuConfig, MenuKey } from '@antdv/types';

import type { LayoutRailConfig } from '../types';

import { IconifyIcon as Icon } from '@antdv/icons/icon';
import { Scrollbar } from '@antdv/common-ui';
import { LAYOUT_HEADER_ROW_STYLE, LAYOUT_RAIL_WIDTH } from '@antdv/layouts';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@antdv/shadcn-ui';
import { menuKeyOf } from '@antdv/utils';

import { useLayoutStyle } from '../useLayoutStyle';

defineOptions({ name: 'LayoutNavRail' });

/**
 * 图标栏（双列形态的第一列）。
 *
 * - 双列菜单：这里是一级菜单，右侧主栏放它的子树；
 * - 混合双列：这里是当前一级菜单的二级，右侧主栏放三级及以下。
 *
 * 高亮项完全由使用方传进来（迁移前是 `regions.railActiveKey`，同样由路由推导）：
 * 点击只负责跳，跳完由"当前所在链"决定选中，因此不会出现"点了没亮 / 亮了好几项"。
 */
const props = withDefaults(defineProps<LayoutRailConfig>(), {
  activeKey: undefined,
  logo: undefined,
  tone: () => ({}),
  width: LAYOUT_RAIL_WIDTH,
});

const emit = defineEmits<{ navigate: [key: MenuKey] }>();

const style = useLayoutStyle(() => props.tone);

function keyOf(menu: MenuConfig): MenuKey {
  return menuKeyOf(menu);
}

function isActive(menu: MenuConfig) {
  return keyOf(menu) === props.activeKey;
}
</script>

<template>
  <aside
    data-layout-region="nav-rail"
    :class="style.railClass()"
    :style="{ width: `${props.width}px` }"
  >
    <!-- Logo：图标栏形态下品牌位放在这里，主栏不再重复占高 -->
    <div
      data-layout-logo="rail"
      class="flex shrink-0 items-center justify-center overflow-hidden border-b border-inherit"
      :style="LAYOUT_HEADER_ROW_STYLE"
    >
      <img
        v-if="props.logo"
        :src="props.logo"
        :alt="props.title ?? 'logo'"
        class="h-8 w-8 object-contain"
      />
      <Icon v-else icon="carbon:cube" class="text-2xl" />
    </div>

    <!-- 图标列表：纵向溢出同样用封装组件，不留系统滚动条 -->
    <TooltipProvider>
      <Scrollbar
        root-class="min-h-0 flex-1 py-2"
        wrap-class="overflow-x-hidden"
      >
        <Tooltip v-for="menu in props.menus" :key="keyOf(menu)">
          <TooltipTrigger as-child>
            <button
              type="button"
              data-rail-item
              :data-menu-key="keyOf(menu)"
              :aria-current="isActive(menu) ? 'page' : undefined"
              :aria-disabled="menu.disabled ? 'true' : undefined"
              class="flex w-full"
              :disabled="menu.disabled"
              @click="emit('navigate', keyOf(menu))"
            >
              <span :class="style.railItemClass(isActive(menu))">
                <Icon :icon="menu.icon || 'carbon:category'" class="text-lg" />
                <!-- 左侧指示条：与主栏选中态同一套语言 -->
                <span
                  v-if="isActive(menu)"
                  data-rail-active-bar
                  class="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-[3px] bg-primary"
                ></span>
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {{ menu.title }}
          </TooltipContent>
        </Tooltip>
      </Scrollbar>
    </TooltipProvider>
  </aside>
</template>
