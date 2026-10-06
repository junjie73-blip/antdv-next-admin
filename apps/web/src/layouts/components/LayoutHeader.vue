<script setup lang="tsx">
import type { BreadcrumbProps, MenuProps } from 'antdv-next';

import { computed, defineAsyncComponent, h, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Icon } from '@iconify/vue';
import { Dropdown } from 'antdv-next';
import { useAppStore } from '~/stores/modules/app';
import { useUserStore } from '~/stores/modules/user';
import { eventBus } from '~/utils';
import { cn } from '~/utils/cn';

import { useHeaderMenu } from '../composables/useHeaderMenu';
import { useBreadcrumb } from '../composables/useLayout';
import { useVisibleWidgets } from '../widgets';
import AccountDrawer from './AccountDrawer.vue';
import HeaderMenu from './HeaderMenu.vue';
import SettingDrawer from './SettingDrawer/index.vue';

defineOptions({
  name: 'LayoutHeader',
});

const props = defineProps<{
  /** 显示侧边栏折叠触发按钮（水平布局没有侧边栏，故不显示） */
  showCollapseTrigger?: boolean;
}>();

const router = useRouter();
const appStore = useAppStore();
const userStore = useUserStore();
const { breadcrumbs } = useBreadcrumb();
const unreadCount = ref(0);
const showSetting = ref(false);
const showNotification = ref(false);
const accountDrawerRef = ref<InstanceType<typeof AccountDrawer> | null>(null);
const appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Next Admin';
const visibleWidgets = computed(() => useVisibleWidgets());
// ========== 获取通知列表（头部小弹窗） ==========
const isGeekStyle = computed(() => appStore.themeStyle === 'geek');
const isDarkMode = computed(
  () => appStore.themeMode === 'dark' || isGeekStyle.value,
);
/** 顶部导航栏的主题跟随整体配色 */
const menuTheme = computed<'dark' | 'light'>(() =>
  appStore.darkHeader || isDarkMode.value ? 'dark' : 'light',
);

const isHorizontal = computed(() => appStore.layout === 'horizontal');
const isMixed = computed(() => appStore.layout === 'mixed');

const { menuItems, selectedKeys, activeIndex, handleSelect } = useHeaderMenu();

/** HeaderMenu 只回传 key，导航逻辑在 composable 里统一处理 */
function onHeaderSelect(key: string) {
  handleSelect({ key });
}

const headerClassName = computed(() =>
  cn(
    'flex h-14 items-center justify-between px-6',
    'flex-shrink-0 border-b shadow-sm',
    isGeekStyle.value
      ? 'border-[#1a1a1a] bg-[#0a0a0a] text-[#00ff88]'
      : isDarkMode.value
        ? 'border-gray-700 bg-gray-800 text-white'
        : 'border-gray-200 bg-white text-gray-800',
  ),
);

const breadcrumbItems = computed<BreadcrumbProps['items']>(() => {
  return breadcrumbs.value.map((item) => ({
    title: item.title,
    path: item.path,
  }));
});

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

const userDropdownItems: MenuProps['items'] = [
  {
    key: 'profile',
    label: '个人中心',
    icon: () => h(Icon, { icon: 'carbon:user-avatar' }),
  },
  {
    key: 'docs',
    label: '文档中心',
    icon: () => h(Icon, { icon: 'carbon:book' }),
  },
];
/** 需要额外事件的组件 */
function handleWidgetEvent(key: string) {
  if (key === 'preferences') showSetting.value = true;
  if (key === 'search') showNotification.value = true;
}
function handleUserMenuClick({ key }: { key: string }) {
  if (key === 'profile') {
    accountDrawerRef.value?.open('center');
  } else if (key === 'docs') {
    window.open('https://junjie73-blip.github.io/antdv-next-admin/', '_blank');
  }
}

function handleBreadcrumbClick(path: string) {
  router.push(path);
}

const timer = ref<NodeJS.Timeout>();

onUnmounted(() => {
  clearInterval(timer.value);
  eventBus.clear();
});
</script>

<template>
  <a-layout-header :class="headerClassName">
    <div class="flex min-w-0 flex-1 items-center gap-4">
      <!-- 折叠侧边栏：垂直 / 混合布局都有侧边栏，水平布局没有 -->
      <button
        v-if="props.showCollapseTrigger"
        type="button"
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-black/6 dark:hover:bg-white/10"
        :aria-label="appStore.sidebarCollapsed ? '展开菜单' : '收起菜单'"
        @click="appStore.toggles.sidebarCollapsed()"
      >
        <Icon
          :icon="
            appStore.sidebarCollapsed
              ? 'carbon:side-panel-right-show'
              : 'carbon:side-panel-left-show'
          "
          class="text-lg"
        />
      </button>

      <!-- 垂直布局：面包屑 -->
      <template v-if="!isHorizontal && !isMixed">
        <a-breadcrumb
          v-if="appStore.showBreadcrumb"
          class="hidden items-center md:flex"
          :items="breadcrumbItems"
        >
          <template #separator>
            <Icon icon="carbon:chevron-right" class="text-xs opacity-50" />
          </template>
          <template #titleRender="{ item, index }">
            <span
              class="inline-flex cursor-pointer items-center gap-1.5"
              @click="handleBreadcrumbClick(item.path!)"
            >
              <Icon
                :icon="
                  index === 0 ? 'carbon:home' : breadcrumbs[index - 1]?.icon as string || 'carbon:folder'
                "
                class="text-sm"
              />
              <span>{{ item.title }}</span>
            </span>
          </template>
        </a-breadcrumb>
      </template>

      <!-- 水平 / 混合布局：Logo + 横向导航栏（溢出可滚动） -->
      <template v-else>
        <div
          class="flex shrink-0 items-center gap-2"
          :class="
            isMixed ? 'border-r border-gray-200 pr-4 dark:border-gray-700' : ''
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

    <div class="flex items-center gap-3">
      <div
        class="flex items-center gap-0.5 rounded-xl bg-white px-0.5 py-0.5 shadow-lg shadow-gray-300/40 dark:bg-gray-800 dark:shadow-black/40"
      >
        <div class="flex shrink-0 items-center gap-1">
          <component
            :is="defineAsyncComponent(meta.component as never)"
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
    <AccountDrawer ref="accountDrawerRef" />
  </a-layout-header>
</template>

<style scoped>
:deep(.ant-breadcrumb-separator) {
  display: flex;
  justify-content: center;
  align-items: center;
}
/* Popover 内边距归零，让内部面板自己控制圆角和间距 */
:global(.ant-popover-inner) {
  padding: 0 !important;
}

/* 面包屑分隔符垂直居中 */
:deep(.ant-breadcrumb-separator) {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
