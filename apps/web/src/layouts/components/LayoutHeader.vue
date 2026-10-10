<script setup lang="tsx">
import type { MenuProps } from 'antdv-next';

import { computed, h, onUnmounted, ref } from 'vue';

import { LAYOUT_HEADER_ROW_STYLE } from '@antdv/layouts';
import { eventBus } from '@antdv/shared';
import { cn } from '@antdv/shared/cn';
import { Icon } from '@iconify/vue';
import { useMagicKeys, whenever } from '@vueuse/core';
import { Dropdown } from 'antdv-next';
import { useAppStore } from '~/stores/modules/app';
import { useUserStore } from '~/stores/modules/user';

import { useHeaderMenu } from '../composables/useHeaderMenu';
import { useShell } from '../composables/useLayout';
import { useVisibleWidgets } from '../widgets';
import AccountDrawer from './AccountDrawer.vue';
import HeaderMenu from './HeaderMenu.vue';
import LayoutBreadcrumb from './LayoutBreadcrumb.vue';
import MenuSearchModal from './MenuSearchModal.vue';
import SettingDrawer from './SettingDrawer/index.vue';

defineOptions({
  name: 'LayoutHeader',
});

/**
 * 顶栏内容完全由形态蓝图决定：
 * - `headerLead`：左边放面包屑（垂直 / 双列）还是放 Logo（水平 / 混合 / 侧边导航）
 * - `headerNavVisible`：要不要挂横向导航（混合形态只挂一级，水平形态挂整棵树）
 * - `sidebarVisible` / `overlaySidebar`：折叠按钮与抽屉按钮共用同一个位置
 *
 * 组件不再接收 `show-collapse-trigger`，也不写 `layout === 'xxx'` 分支。
 */
const appStore = useAppStore();
const userStore = useUserStore();
const { blueprint, overlaySidebar, regions } = useShell();
const showSetting = ref(false);
/** 顶栏搜索按钮与 Ctrl+K 都开这同一个弹层（以前指向一个从没渲染过的 `showNotification`，按了没反应） */
const showSearch = ref(false);
/**
 * 快捷键绑在外壳上，而不是绑在 `WidgetSearch` 里。
 *
 * 小部件是异步分包的：登录首屏之后还要等那一小块 chunk 落地并挂载，
 * `useMagicKeys` 的监听才存在。实测这段窗口足够咬到用例（按下 Ctrl+K 完全没有反应），
 * 对用户同样是"刚进系统时快捷键时灵时不灵"。绑定挪到这里，
 * 外壳一挂载就能用；`WidgetSearch` 只负责那颗按钮。
 */
const { ctrl_k, meta_k } = useMagicKeys();
whenever(
  () => Boolean(ctrl_k.value || meta_k.value),
  () => {
    showSearch.value = true;
  },
);
const accountDrawerRef = ref<InstanceType<typeof AccountDrawer> | null>(null);
const appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Next Admin';
const visibleWidgets = computed(() => useVisibleWidgets());
// ========== 配色：geek 风格强制深色 ==========
const isGeekStyle = computed(() => appStore.themeStyle === 'geek');
/** `auto` 要按当前实际明暗判断，直接比较 `theme` 字面量会在系统深色下失效 */
const isDarkMode = computed(
  () => appStore.resolvedTheme === 'dark' || isGeekStyle.value,
);
/** 顶部导航栏的主题跟随整体配色 */
const menuTheme = computed<'dark' | 'light'>(() =>
  appStore.darkHeader || isDarkMode.value ? 'dark' : 'light',
);

/** 顶栏左侧：侧栏（常驻或浮层）存在时才考虑给触发按钮 */
const hasSidebar = computed(
  () => regions.sidebarVisible.value || regions.navRailVisible.value,
);
/**
 * 常驻侧栏在场时，折叠按钮住在这一列的底部（见 `LayoutSidebar`），顶栏不再重复一个。
 * 另两种情况仍要顶栏入口：
 * - 浮层形态（窄屏 / 抽屉）：侧栏是抽屉，没有"底部折叠条"这个位置，开合只能从这里发起；
 * - 只剩图标栏、侧栏因为当前分区没有子菜单而让位：那一列根本不渲染，按钮也没地方住。
 */
const persistentSidebar = computed(
  () => regions.sidebarVisible.value && !overlaySidebar.value,
);
const showSidebarTrigger = computed(
  () => hasSidebar.value && !persistentSidebar.value,
);
const headerNavVisible = computed(() => regions.headerNavVisible.value);
const headerLead = computed(() => blueprint.value.headerLead);

/** 按钮图标要反映"点了会变成什么"：浮层看抽屉开合，常驻看折叠态 */
const sidebarOpen = computed(() =>
  overlaySidebar.value ? appStore.sidebarOverlayOpen : !appStore.sidebarCollapsed,
);

function toggleSidebar(): void {
  if (overlaySidebar.value) {
    appStore.updateSetting({ sidebarOverlayOpen: !appStore.sidebarOverlayOpen });
    return;
  }
  appStore.toggles.sidebarCollapsed();
}

const { menuItems, selectedKeys, activeIndex, handleSelect } = useHeaderMenu();

/** HeaderMenu 只回传 key，导航逻辑在 composable 里统一处理 */
function onHeaderSelect(key: string) {
  handleSelect({ key });
}

const headerClassName = computed(() =>
  cn(
    // min-w-0 是关键：`.ant-layout` 是列向 flex，header 作为 flex item
    // 默认 min-width:auto，会被菜单的 min-content 撑到比视口还宽 ——
    // 表现是窄屏下右侧按钮被裁掉、横向菜单既不收缩也不滚动。
    // 高度不在这里写：`h-14` 会被 antd 的 `.ant-layout-header{height:64px}` 顶掉，
    // 统一由 `LAYOUT_HEADER_ROW_STYLE` 以 inline style 给出（见 @antdv/layouts 注释）。
    'flex min-w-0 items-center justify-between px-6',
    'flex-shrink-0 border-b shadow-sm',
    isGeekStyle.value
      ? 'border-[#1a1a1a] bg-[#0a0a0a] text-[#00ff88]'
      : isDarkMode.value
        ? 'border-gray-700 bg-gray-800 text-white'
        : 'border-gray-200 bg-white text-gray-800',
  ),
);

const triggerClassName = computed(() =>
  cn(
    'flex size-8  shrink-0 items-center justify-center rounded-lg',
    'transition-colors duration-200',
    isGeekStyle.value
      ? 'text-[#00ff88] hover:bg-[#00ff88]/10'
      : isDarkMode.value
        ? 'text-gray-300 hover:bg-gray-700'
        : 'text-gray-500 hover:bg-gray-100',
  ),
);

/**
 * 头像下拉是"个人中心"唯一的入口。
 *
 * 菜单里的「个人中心」已经标成 hidden（见 `apps/backend-mock/server/api/menus.get.ts`），
 * 导航不再占一格，但抽屉里要能直达两个页面，所以这里按 tab 分别给项：
 * `profile` → 个人主页，`settings` → 账户设置，都由 AccountDrawer 承载。
 */
const userDropdownItems: MenuProps['items'] = [
  {
    key: 'profile',
    label: '个人中心',
    icon: () => h(Icon, { icon: 'carbon:user-avatar' }),
  },
  {
    key: 'settings',
    label: '账户设置',
    icon: () => h(Icon, { icon: 'carbon:settings' }),
  },
  { type: 'divider' },
  {
    key: 'docs',
    label: '文档中心',
    icon: () => h(Icon, { icon: 'carbon:book' }),
  },
];
/** 需要额外事件的组件 */
function handleWidgetEvent(key: string) {
  if (key === 'preferences') showSetting.value = true;
  if (key === 'search') showSearch.value = true;
}
function handleUserMenuClick({ key }: { key: string }) {
  if (key === 'profile' || key === 'settings') {
    accountDrawerRef.value?.open(key === 'settings' ? 'settings' : 'center');
  } else if (key === 'docs') {
    window.open('https://junjie73-blip.github.io/antdv-next-admin/', '_blank');
  }
}

const timer = ref<NodeJS.Timeout>();

onUnmounted(() => {
  clearInterval(timer.value);
  eventBus.clear();
});
</script>

<template>
  <a-layout-header
    data-layout-region="header"
    :class="headerClassName"
    :style="LAYOUT_HEADER_ROW_STYLE"
  >
    <div class="flex min-w-0 flex-1 items-center gap-4">
      <!-- 侧栏触发：只在"侧栏不在场"的形态里出现（浮层抽屉 / 只剩图标栏） -->
      <button
        v-if="showSidebarTrigger"
        type="button"
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-black/6 dark:hover:bg-white/10"
        :aria-label="sidebarOpen ? '收起菜单' : '展开菜单'"
        @click="toggleSidebar"
      >
        <Icon
          :icon="
            sidebarOpen
              ? 'carbon:side-panel-close'
              : 'carbon:side-panel-open'
          "
          class="text-lg"
        />
      </button>

      <!-- 面包屑形态（垂直 / 双列）：标题区给面包屑 -->
      <LayoutBreadcrumb v-if="headerLead === 'breadcrumb'" />

      <!-- Logo 形态（水平 / 混合 / 侧边导航）：品牌位 + 可选的横向导航 -->
      <template v-else>
        <div
          data-layout-logo="header"
          class="flex shrink-0 items-center gap-2"
          :class="
            headerNavVisible
              ? 'border-r border-gray-200 pr-4 dark:border-gray-700'
              : ''
          "
        >
          <Icon
            icon="carbon:cube"
            class="text-2xl"
            :class="isGeekStyle ? 'text-[#00ff88]' : 'text-ant-primary'"
          />
          <span
            class="hidden font-bold sm:inline"
            :class="isGeekStyle ? 'text-[#00ff88]' : 'text-ant-primary'"
          >
            {{ appTitle }}
          </span>
        </div>

        <HeaderMenu
          v-if="headerNavVisible"
          :items="menuItems"
          :selected-keys="selectedKeys"
          :active-index="activeIndex"
          :theme="menuTheme"
          :scrollable="appStore.headerMenuScroll"
          :geek="isGeekStyle"
          @select="onHeaderSelect"
        />
      </template>
    </div>

    <div class="flex min-w-0 shrink-0 items-center gap-3">
      <div
        class="flex items-center gap-0.5 rounded-xl bg-white px-0.5 py-0.5 shadow-lg shadow-gray-300/40 dark:bg-gray-800 dark:shadow-black/40"
      >
        <div class="flex shrink-0 items-center gap-1">
          <component
            :is="meta.component"
            v-for="meta in visibleWidgets"
            :key="meta.key"
            v-motion
            :initial="{ opacity: 0, y: -6 }"
            :enter="{
              opacity: 1,
              y: 0,
              transition: { duration: 220, delay: 40 },
            }"
            :hovered="{ scale: 1.08 }"
            :tapped="{ scale: 0.94 }"
            @open="handleWidgetEvent(meta.key)"
          />
        </div>
      </div>
      <Dropdown
        :menu="{ items: userDropdownItems, onClick: handleUserMenuClick }"
        placement="bottomRight"
      >
        <div
          class="flex cursor-pointer items-center gap-2 rounded-xl py-0.5 pr-2 pl-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <a-avatar :size="28" :src="userStore.avatar" class="bg-ant-primary">
            {{ userStore.username?.charAt(0)?.toUpperCase() || 'U' }}
          </a-avatar>
          <span
            class="hidden text-sm text-gray-700 sm:inline dark:text-gray-200"
          >
            {{ userStore.username || '用户' }}
          </span>
          <Icon icon="carbon:chevron-down" class="text-xs text-gray-400" />
        </div>
      </Dropdown>
    </div>

    <SettingDrawer v-model:visible="showSetting" />
    <MenuSearchModal v-model:open="showSearch" />
    <AccountDrawer ref="accountDrawerRef" />
  </a-layout-header>
</template>

<style scoped>
/* Popover 内边距归零，让内部面板自己控制圆角和间距 */
:global(.ant-popover-inner) {
  padding: 0 !important;
}
</style>
