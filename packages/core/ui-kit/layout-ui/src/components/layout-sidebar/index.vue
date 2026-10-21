<script setup lang="ts">
import type { MenuKey } from '@antdv/types';

import type { LayoutSiderConfig } from '../../layout';

import { computed } from 'vue';

import { Scrollbar } from '@antdv/common-ui';
import { IconifyIcon as Icon } from '@antdv/icons/icon';
import { BasicMenu } from '@antdv/menu-ui';
import { cn } from '@antdv/shared/utils/cn';

import { useLayoutStyle } from '../../hooks/use-layout';
import { useSidebarDrag } from '../../hooks/use-sidebar-drag';
import {
  LAYOUT_DRAWER_WIDTH,
  LAYOUT_HEADER_ROW_STYLE,
  LAYOUT_SIDEBAR_COLLAPSED_WIDTH,
  LAYOUT_SIDEBAR_WIDTH,
  layoutRuntime,
} from '../../layout';
import SidebarCollapsedButton from '../widgets/sidebar-collapsed-button/index.vue';

defineOptions({ name: 'LayoutSider' });

const props = withDefaults(defineProps<LayoutSiderConfig>(), {
  collapsed: false,
  keepIconSlot: true,
  logo: undefined,
  openKeys: () => [],
  overlay: false,
  selectedKeys: () => [],
  showLogo: true,
  title: undefined,
  tone: () => ({}),
  width: LAYOUT_SIDEBAR_WIDTH,
});

const emit = defineEmits<{
  /** 叶子点击（外链不参与，由菜单自己忽略） */
  navigate: [key: MenuKey];
  toggleCollapse: [];
  'update:openKeys': [keys: MenuKey[]];
  /** 拖拽结束后的宽度（使用方写回偏好 `sidebarWidth`） */
  'update:width': [width: number];
}>();

/**
 * 每一级菜单的缩进量（迁移前 antd 默认 24）。
 *
 * antd 是按层级**内联**写 `padding-left: level * inlineIndent` 的，所以想改缩进
 * 只能从这个 prop 进去，类选择器打不过内联样式。原来那条
 * `[&_.ant-menu-sub_.ant-menu-item]:pl-12` 就是这样变成死代码的：它从来没生效过，
 * 深层级（组件示例 → 表单 → 基础表单）于是被 3 × 24 = 72px 的缩进推到只剩两三个字的
 * 宽度。16px 一级时，三级仍留出约 150px 给标题。
 */
const SIDEBAR_INLINE_INDENT = 16;

const style = useLayoutStyle(() => props.tone);

/**
 * 拖拽改宽度：只在"常驻 + 展开"时提供（折叠态只有 64px 的图标列，浮态宽度是抽屉宽度，
 * 两者都不该被拖）。拖动过程中用 `draggingWidth` 画预览，抬起才 emit。
 */
const {
  draggingWidth,
  isDragging,
  start: startDrag,
} = useSidebarDrag({
  commit: (width) => emit('update:width', width),
  width: () => props.width,
});

/** 浮层里永远展开；常驻形态才受折叠开关影响 */
const collapsed = computed(() => !props.overlay && !!props.collapsed);

const showDragHandle = computed(() => !props.overlay && !collapsed.value);

/** 菜单与底色走深色：偏好「深色侧栏」或整体深色（geek 恒深色）都算 */
const menuTheme = computed<'dark' | 'light'>(() =>
  style.sidebarDark() ? 'dark' : 'light',
);

/**
 * 三种宽度：浮层用抽屉宽度（不参与内容区宽度计算），折叠只留图标，
 * 其余用偏好里的展开宽度（拖拽中以预览值为准）。
 */
const siderWidth = computed(() => {
  if (props.overlay) return LAYOUT_DRAWER_WIDTH;
  if (collapsed.value) return LAYOUT_SIDEBAR_COLLAPSED_WIDTH;
  return draggingWidth.value ?? props.width;
});

/** 折叠入口的文案要说明"点了会变成什么"，而不是"现在是什么状态" */
const collapseLabel = computed(() =>
  layoutRuntime.t(
    collapsed.value ? 'header.expandMenu' : 'header.collapseMenu',
  ),
);
</script>

<template>
  <aside
    data-layout-region="sidebar"
    :class="cn(style.siderClass(), isDragging && 'transition-none')"
    :data-layout-sider-collapsed="collapsed ? 'true' : 'false'"
    :data-layout-sider-overlay="props.overlay ? 'true' : 'false'"
    :style="{ height: '100%', width: `${siderWidth}px` }"
  >
    <!--
      Logo：图标栏形态下品牌位在图标栏、顶栏带 Logo 的形态在顶栏，
      这两种情况由使用方把 `show-logo` 关掉，避免同一列重复占高。
    -->
    <div
      v-if="props.showLogo && (props.logo || props.title)"
      data-layout-logo="sidebar"
      :class="style.logoClass()"
      :style="LAYOUT_HEADER_ROW_STYLE"
    >
      <transition name="logo-fade" mode="out-in">
        <div
          v-if="collapsed"
          key="collapsed"
          class="flex items-center justify-center"
        >
          <img
            v-if="props.logo"
            :src="props.logo"
            :alt="props.title ?? ''"
            class="h-8 w-8 object-contain"
          />
          <Icon v-else icon="carbon:cube" class="text-2xl" />
        </div>
        <div
          v-else
          key="expanded"
          class="flex items-center justify-center gap-2.5 px-4"
        >
          <img
            v-if="props.logo"
            :src="props.logo"
            :alt="props.title ?? ''"
            class="h-8 w-8 object-contain"
          />
          <span
            class="truncate text-base font-semibold text-gray-800 dark:text-white"
          >
            {{ props.title }}
          </span>
        </div>
      </transition>
    </div>

    <!-- 菜单区的滚动容器：`min-h-0 flex-1` 让它拿满 Logo 之外的剩余高度 -->
    <Scrollbar
      root-class="min-h-0 flex-1 px-2 py-3"
      wrap-class="overflow-x-hidden"
    >
      <BasicMenu
        v-if="props.menus.length > 0"
        mode="inline"
        :collapsed="collapsed"
        :geek="Boolean(props.tone.geek)"
        :inline-indent="SIDEBAR_INLINE_INDENT"
        :keep-icon-slot="props.keepIconSlot"
        :menus="props.menus"
        :open-keys="props.openKeys"
        :selected-keys="props.selectedKeys"
        :theme="menuTheme"
        @select="emit('navigate', $event)"
        @update:open-keys="emit('update:openKeys', $event)"
      />
    </Scrollbar>

    <!--
      折叠入口：贴着这一列的底边。
      放在顶栏时，用户要点到右上角才收起"左边这一列"，动作和目标隔着整个屏幕；
      业界惯例也是把它做在侧栏底部的一条横杠上。
      浮层形态（抽屉 / 窄屏）不渲染 —— 那里没有"折叠"可言，开合由抽屉负责。
    -->
    <SidebarCollapsedButton
      v-if="!props.overlay"
      :label="collapseLabel"
      :open="!collapsed"
      :tone="props.tone"
      @click="emit('toggleCollapse')"
    />

    <!--
      拖拽条：盖在这一列右边框上的一根竖条，抬起把宽度交回使用方写偏好。
      折叠态与浮动态不给（前者只有图标列，后者宽度属于抽屉）。
    -->
    <div
      v-if="showDragHandle"
      data-layout-sidebar-drag
      :class="style.dragHandleClass()"
      role="separator"
      aria-orientation="vertical"
      @pointerdown="startDrag"
    ></div>
  </aside>
</template>

<style scoped>
.logo-fade-enter-active,
.logo-fade-leave-active {
  transition: opacity 0.2s ease;
}

.logo-fade-enter-from,
.logo-fade-leave-to {
  opacity: 0;
}
</style>
