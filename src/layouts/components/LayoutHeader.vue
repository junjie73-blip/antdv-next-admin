<script setup lang="tsx">
import type { BreadcrumbProps, MenuProps } from "antdv-next";

import { Icon } from "@iconify/vue";
import { Dropdown, Menu, notification } from "antdv-next";
import { computed, defineAsyncComponent, h, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";

import { useAppStore } from "~/stores/modules/app";
import { useRouteStore } from "~/stores/modules/route";
import { useUserStore } from "~/stores/modules/user";
import { eventBus } from "~/utils";
import { cn } from "~/utils/cn";

import { useBreadcrumb } from "../composables/useLayout";
import { useVisibleWidgets } from "../widgets";
import AccountDrawer from "./AccountDrawer.vue";
import SettingDrawer from "./SettingDrawer/index.vue";

defineProps<{
  collapsed?: boolean;
  horizontal?: boolean;
  mixed?: boolean;
  activeTopMenu?: string;
}>();

const emit = defineEmits<{
  toggleCollapsed: [];
  topMenuSelect: [key: string];
}>();

defineOptions({
  name: "LayoutHeader",
});

const router = useRouter();
const appStore = useAppStore();
const userStore = useUserStore();
const routeStore = useRouteStore();
const { breadcrumbs } = useBreadcrumb();
const showSetting = ref(false);
const showNotification = ref(false);
const accountDrawerRef = ref<InstanceType<typeof AccountDrawer> | null>(null);
const appTitle = import.meta.env.VITE_APP_TITLE || "Antdv Next Admin";
const visibleWidgets = computed(() => useVisibleWidgets());
// ========== 获取通知列表（头部小弹窗） ==========
const isGeekStyle = computed(() => appStore.themeStyle === "geek");
const isDarkMode = computed(() => appStore.themeMode === "dark" || isGeekStyle.value);

const headerClassName = computed(() =>
  cn(
    "h-14 px-6 flex items-center justify-between",
    "border-b shadow-sm flex-shrink-0",
    isGeekStyle.value
      ? "bg-[#0a0a0a] border-[#1a1a1a] text-[#00ff88]"
      : isDarkMode.value
        ? "bg-gray-800 border-gray-700 text-white"
        : "bg-white border-gray-200 text-gray-800",
  ),
);

const breadcrumbItems = computed<BreadcrumbProps["items"]>(() => {
  return breadcrumbs.value.map((item) => ({
    title: item.title,
    path: item.path,
  }));
});

const horizontalMenuItems = computed<MenuProps["items"]>(() => {
  const isHorizontal = appStore.layout === "horizontal";
  return (routeStore.menus || []).map((menu) => ({
    key: menu.path,
    icon: () => h(Icon, { icon: menu.icon || "carbon:folder", class: "text-lg" }),
    label: menu.title,
    children:
      isHorizontal && menu.children?.length
        ? menu.children.map((child) => ({
            key: `${menu.path}/${child.path}`,
            label: child.title,
          }))
        : undefined,
  }));
});

const userDropdownItems: MenuProps["items"] = [
  {
    key: "profile",
    label: "个人中心",
    icon: () => h(Icon, { icon: "carbon:user-avatar" }),
  },
  {
    key: "docs",
    label: "文档中心",
    icon: () => h(Icon, { icon: "carbon:book" }),
  },
];
/** 需要额外事件的组件 */
function handleWidgetEvent(key: string) {
  if (key === "preferences") showSetting.value = true;
  if (key === "search") showNotification.value = true;
}
function handleUserMenuClick({ key }: { key: string }) {
  if (key === "profile") {
    accountDrawerRef.value?.open("center");
  } else if (key === "docs") {
    window.open("https://junjie73-blip.github.io/antdv-next-admin/", "_blank");
  }
}

function handleBreadcrumbClick(path: string) {
  router.push(path);
}

function handleHorizontalMenuSelect({ key }: { key: string }) {
  if (key.startsWith("/")) {
    router.push(key);
  }
  emit("topMenuSelect", key);
}

const timer = ref<NodeJS.Timeout>();
onUnmounted(() => {
  clearInterval(timer.value);
  eventBus.clear();
});
</script>

<template>
  <header :class="headerClassName">
    <div class="flex flex-1 items-center gap-4">
      <!-- 垂直布局：面包屑 -->
      <template v-if="!horizontal && !mixed">
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

      <!-- 水平布局：Logo + 水平菜单 -->
      <template v-else-if="horizontal">
        <div class="flex items-center gap-2">
          <Icon icon="carbon:cube" class="text-ant-primary text-2xl" />
          <span class="text-ant-primary font-bold">
            {{ appTitle }}
          </span>
        </div>

        <Menu
          mode="horizontal"
          :items="horizontalMenuItems"
          :theme="isDarkMode ? 'dark' : 'light'"
          class="flex-1 border-none bg-transparent"
          @select="handleHorizontalMenuSelect"
        />
      </template>

      <!-- 混合布局：Logo + 水平菜单 -->
      <template v-else-if="mixed">
        <div class="flex items-center gap-2 border-r border-gray-200 pr-4 dark:border-gray-700">
          <Icon
            icon="carbon:cube"
            class="text-2xl"
            :class="isGeekStyle ? 'text-[#00ff88]' : 'text-ant-primary'"
          />
          <span class="font-bold" :class="isGeekStyle ? 'text-[#00ff88]' : 'text-ant-primary'">
            {{ appTitle }}
          </span>
        </div>

        <Menu
          mode="horizontal"
          :items="horizontalMenuItems"
          :theme="isDarkMode ? 'dark' : 'light'"
          :selected-keys="[activeTopMenu || '']"
          class="flex-1 border-none bg-transparent"
          @select="handleHorizontalMenuSelect"
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
            {{ userStore.username?.charAt(0)?.toUpperCase() || "U" }}
          </a-avatar>
          <span class="hidden text-sm text-gray-700 sm:inline dark:text-gray-200">
            {{ userStore.username || "用户" }}
          </span>
          <Icon icon="carbon:chevron-down" class="text-xs text-gray-400" />
        </div>
      </Dropdown>
    </div>

    <SettingDrawer v-model:visible="showSetting" />
    <AccountDrawer ref="accountDrawerRef" />
  </header>
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
