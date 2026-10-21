<script setup lang="ts">
import type { MenuKey } from '@antdv/types';

import type { HeaderLead, LayoutNavConfig, LayoutTone } from '../../layout';

import { computed } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';
import { BasicMenu } from '@antdv/menu-ui';

import { useLayoutStyle } from '../../hooks/use-layout';
import { LAYOUT_HEADER_ROW_STYLE, layoutRuntime } from '../../layout';
import SidebarCollapsedButton from '../widgets/sidebar-collapsed-button/index.vue';

defineOptions({ name: 'LayoutHeader' });

/**
 * 顶栏内容完全由形态蓝图决定（`lead` 就是蓝图的 `headerLead`）：
 * - `breadcrumb`：左侧给面包屑（垂直 / 双列），Logo 让位；
 * - `logo`：左侧是品牌位 + 可选的横向导航（水平 / 混合 / 侧边导航）。
 *
 * 组件不接收 `show-collapse-trigger` 之外的形态开关，也不写 `layout === 'xxx'` 分支。
 * 工具区与用户区是插槽：小部件、头像下拉、抽屉这些都带业务依赖，留在使用方。
 *
 * 品牌位的取值顺序是「插槽 → `logo` 图片 → 默认立方体」，产品名从 `sm` 档起才出现。
 * 窄屏下这一行只剩图标：文字让位给侧栏触发按钮和右侧用户区，
 * 但品牌不能整块消失（水平 / 混合 / 侧边导航是顶栏带 Logo 的形态，侧栏那一列在窄屏会变成抽屉）。
 */
const props = withDefaults(
  defineProps<{
    /** 品牌图标（宿主打包进来的资源路径）；没给时退回默认立方体 */
    logo?: string;
    lead?: HeaderLead;
    /** 横向导航：`menus` 为空时整块不渲染 */
    nav?: LayoutNavConfig;
    showSidebarTrigger?: boolean;
    sidebarOpen?: boolean;
    title?: string;
    tone?: LayoutTone;
  }>(),
  {
    logo: undefined,
    lead: 'breadcrumb',
    nav: undefined,
    showSidebarTrigger: false,
    sidebarOpen: true,
    title: undefined,
    tone: () => ({}),
  },
);

const emit = defineEmits<{
  navigate: [key: MenuKey];
  toggleSidebar: [];
}>();

const style = useLayoutStyle(() => props.tone);

const menuTheme = computed<'dark' | 'light'>(() =>
  style.headerDark() ? 'dark' : 'light',
);

const navMenus = computed(() => props.nav?.menus ?? []);
const showNav = computed(
  () => props.lead === 'logo' && navMenus.value.length > 0,
);

/** 触发按钮的图标要反映"点了会变成什么"：浮层看抽屉开合，常驻看折叠态 */
const triggerLabel = computed(() =>
  layoutRuntime.t(
    props.sidebarOpen ? 'header.collapseMenu' : 'header.expandMenu',
  ),
);
</script>

<template>
  <header
    data-layout-region="header"
    :class="style.headerClass()"
    :style="LAYOUT_HEADER_ROW_STYLE"
  >
    <div class="flex min-w-0 flex-1 items-center gap-2 md:gap-4">
      <!-- 侧栏触发：只在"侧栏不在场"的形态里出现（浮层抽屉 / 只剩图标栏） -->
      <SidebarCollapsedButton
        v-if="props.showSidebarTrigger"
        variant="icon"
        :label="triggerLabel"
        :open="props.sidebarOpen"
        :tone="props.tone"
        @click="emit('toggleSidebar')"
      />

      <!-- 面包屑形态（垂直 / 双列）：标题区给面包屑 -->
      <slot name="breadcrumb" v-if="props.lead === 'breadcrumb'"></slot>

      <!-- Logo 形态（水平 / 侧边导航 / 混合）：品牌位 + 可选的横向导航 -->
      <template v-else>
        <div
          data-layout-logo="header"
          class="flex shrink-0 items-center gap-2"
          :class="
            showNav ? 'border-r border-gray-200 pr-4 dark:border-gray-700' : ''
          "
        >
          <!--
            品牌位可整体替换（`#logo` 插槽），默认给"真 Logo 图 + 产品名"。
            产品名在窄屏（< 640px）只留图标：那几十像素要给侧栏触发按钮和用户区，
            但 Logo 图本身必须画出来 —— 以前这里只有一颗通用立方体，
            窄屏下标题又被 `sm:` 藏掉，整站品牌位等于消失。
          -->
          <slot name="logo">
            <img
              v-if="props.logo"
              :alt="props.title ?? ''"
              :src="props.logo"
              class="h-7 w-7 shrink-0 object-contain"
              data-layout-logo-image="header"
            />
            <Icon
              v-else
              icon="carbon:cube"
              class="shrink-0 text-2xl"
              :class="props.tone.geek ? 'text-[#00ff88]' : 'text-primary'"
            />
            <span
              class="hidden font-bold sm:inline"
              :class="props.tone.geek ? 'text-[#00ff88]' : 'text-primary'"
            >
              {{ props.title }}
            </span>
          </slot>
        </div>

        <!--
          `data-layout-region="header-nav"` 挂在这一层而不是菜单根节点上：
          巡检用例要问的是"顶栏里那条导航占多大位置"，箭头、渐隐都算它的一部分。
        -->
        <div
          v-if="showNav"
          data-layout-region="header-nav"
          class="flex min-w-0 flex-1 items-center gap-1"
          :style="LAYOUT_HEADER_ROW_STYLE"
        >
          <BasicMenu
            mode="horizontal"
            :active-key="props.nav?.activeKey"
            :geek="Boolean(props.tone.geek)"
            :max-depth="props.nav?.maxDepth"
            :menus="navMenus"
            :scrollable="props.nav?.scrollable !== false"
            :selected-keys="props.nav?.selectedKeys ?? []"
            :theme="menuTheme"
            :with-children="props.nav?.withChildren"
            @select="emit('navigate', $event)"
          />
        </div>
      </template>
    </div>

    <!--
      右侧工具区 + 用户区。
      外面那一圈 rounded-xl 的胶囊容器是"小部件条"的既有观感，迁移前就无条件存在，
      这里保持一致（内容有没有都由使用方的插槽决定）。
    -->
    <div class="flex min-w-0 shrink-0 items-center gap-2 md:gap-3">
      <div
        class="flex items-center gap-0.5 rounded-xl bg-white px-0.5 py-0.5 shadow-lg shadow-gray-300/40 dark:bg-gray-800 dark:shadow-black/40"
      >
        <div class="flex shrink-0 items-center gap-1">
          <slot name="tools"></slot>
        </div>
      </div>
      <slot name="user"></slot>
    </div>
  </header>
</template>
