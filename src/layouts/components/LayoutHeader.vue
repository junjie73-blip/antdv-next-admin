<script setup lang="tsx">
import { Icon } from "@iconify/vue";
import { Badge, Dropdown, Menu, Modal, notification, Popover } from "antdv-next";
import dayjs from "dayjs";
import { computed, h, onMounted, onUnmounted, ref, unref, watch } from "vue";
import { useRouter } from "vue-router";

import AccountDrawer from "./AccountDrawer.vue";
import SettingDrawer from "./SettingDrawer.vue";
import { useBreadcrumb } from "../composables/useLayout";

import type { BreadcrumbProps, MenuProps } from "antdv-next";

import { getNoticeUnreadCount } from "@/api";
import { useAppStore } from "@/stores/modules/app";
import { useRouteStore } from "@/stores/modules/route";
import { useUserStore } from "@/stores/modules/user";
import { eventBus, http } from "@/utils";
import { cn } from "@/utils/cn";
import { noticeTypeConfig, type NotificationItem, useWebSocket, WS_EVENTS } from "@/utils/ws";

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
const unreadCount = ref(0);
const showAllNotificationsModal = ref(false);
const showSetting = ref(false);
const showNotification = ref(false);
const accountDrawerRef = ref<InstanceType<typeof AccountDrawer> | null>(null);
const appTitle = import.meta.env.VITE_APP_TITLE || "Antdv Next Admin";

const notifications = ref<NotificationItem[]>([]);

const allNotifications = ref<NotificationItem[]>([]); // 全部通知弹窗数据
const totalNotifications = ref(0);
const { notice } = useWebSocket();

// ========== 获取通知列表（头部小弹窗） ==========
async function fetchRecentNotifications() {
  try {
    const { data } = (await http
      .Get("/notice/my", { params: { pageNum: 1, pageSize: 10 } })
      .send(true)) as any;
    console.log(data, "data");
    if (data && data.list) {
      notifications.value = data.list.map(transformNotice);
      unreadCount.value = data.list.filter((n: any) => n.isRead === false || n.isRead === 0).length;
    }
  } catch (e) {
    console.warn("获取通知失败:", e);
  }
}

// 转换通知数据为前端格式
function transformNotice(item: any): NotificationItem {
  return {
    noticeId: item.noticeId,
    title: item.title,
    content: item.content || "",
    noticeType: item.noticeType,
    status: item.status,
    publishTime: item.publishTime || item.publish_time || null, // 兼容
    createdAt: item.createdAt || item.created_at,
    isRead: item.isRead ?? item.is_read ?? false, // 兼容
  };
}
function handleViewAllNotifications() {
  router.push("/message/my");
}

async function markAsRead(noticeId: string) {
  try {
    await http.Put(`/notice/${noticeId}/read`);
    // 更新本地状态
    notifications.value = notifications.value.map((n) =>
      n.noticeId === noticeId ? { ...n, isRead: 1 } : n,
    );
    allNotifications.value = allNotifications.value.map((n) =>
      n.noticeId === noticeId ? { ...n, isRead: 1 } : n,
    );
    unreadCount.value = Math.max(0, unreadCount.value - 1);
  } catch (e) {
    console.warn("标记已读失败:", e);
  }
}

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
  { type: "divider" },
  {
    key: "logout",
    label: "退出登录",
    icon: () => h(Icon, { icon: "carbon:logout" }),
    danger: true,
  },
];

function handleLogout() {
  Modal.confirm({
    title: "退出登录",
    content: "确定要退出当前账号吗？",
    okText: "确定",
    cancelText: "取消",
    centered: true,
    onOk: () => {
      userStore.logout();
    },
  });
}
function handleUserMenuClick({ key }: { key: string }) {
  if (key === "logout") {
    handleLogout();
  } else if (key === "profile") {
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

watch(notice, () => {
  notifications.value.unshift(unref(notice as any));
  unreadCount.value += 1;
  if (showAllNotificationsModal.value) {
    allNotifications.value.unshift(unref(notice as any));
    totalNotifications.value += 1;
  }
});
async function loadUnread() {
  try {
    unreadCount.value = await getNoticeUnreadCount();
  } catch {
    // 静默失败
  }
}
function handleNotificationClick(item: NotificationItem) {
  if (item.isRead === 0) {
    markAsRead(item.noticeId);
  }
  showNotification.value = false;
}
const timer = ref<NodeJS.Timeout>();
onMounted(() => {
  fetchRecentNotifications();
  timer.value = setInterval(loadUnread, 60_000);
});
eventBus.on(WS_EVENTS.FORCE_LOGOUT, () => {
  fetchRecentNotifications();
  loadUnread();
});
eventBus.on(WS_EVENTS.UPLOAD_MERGE, (data: any) => {
  if (data.status === "completed") {
    notification.success({
      title: "文件上传合并成功",
      description: `文件 ${data.fileName} 已成功上传合并`,
      placement: "bottomRight",
    });
  } else {
    notification.error({
      title: "文件上传合并失败",
      description: `文件 ${data.filename} 已合并失败，失败原因：${data.errorMsg}`,
      placement: "bottomRight",
    });
  }
});

onUnmounted(() => {
  clearInterval(timer.value);
  eventBus.clear();
});
</script>

<template>
  <header :class="headerClassName">
    <div class="flex items-center gap-4 flex-1">
      <!-- 垂直布局：面包屑 -->
      <template v-if="!horizontal && !mixed">
        <a-breadcrumb
          v-if="appStore.showBreadcrumb"
          class="hidden md:flex items-center"
          :items="breadcrumbItems"
        >
          <template #separator>
            <Icon icon="carbon:chevron-right" class="text-xs opacity-50" />
          </template>
          <template #titleRender="{ item, index }">
            <span
              class="inline-flex items-center gap-1.5 cursor-pointer"
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
          <Icon icon="carbon:cube" class="text-2xl text-ant-primary" />
          <span class="font-bold text-ant-primary">
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
        <div class="flex items-center gap-2 pr-4 border-r border-gray-200 dark:border-gray-700">
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
        class="flex items-center gap-0.5 px-0.5 py-0.5 rounded-xl bg-white dark:bg-gray-800 shadow-lg shadow-gray-300/40 dark:shadow-black/40"
      >
        <!-- 通知中心 -->
        <Popover v-model:open="showNotification" trigger="click" placement="bottomRight">
          <template #content>
            <div class="w-[380px] overflow-hidden rounded-xl">
              <div class="max-h-[360px] overflow-y-auto bg-white dark:bg-gray-900">
                <a-empty v-if="notifications.length === 0" description="暂无通知" class="!py-10" />

                <div
                  v-for="item in notifications"
                  v-else
                  :key="item.noticeId"
                  class="group flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                  :class="{
                    'bg-blue-50/60 dark:bg-blue-900/10': !item.isRead,
                  }"
                  @click="handleNotificationClick(item)"
                >
                  <div
                    class="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0 bg-gradient-to-br"
                    :class="
                      noticeTypeConfig[item.noticeType]?.gradient || 'from-slate-500 to-slate-400'
                    "
                  >
                    <Icon
                      :icon="noticeTypeConfig[item.noticeType]?.icon || 'carbon:notification'"
                      class="text-base"
                    />
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {{ item.title }}
                      </span>
                      <span class="text-[11px] text-gray-400 flex-shrink-0">
                        {{ dayjs(item.publishTime || item.createdAt).fromNow() }}
                      </span>
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {{ item.content }}
                    </p>
                  </div>

                  <div
                    v-if="!item.isRead"
                    class="w-1.5 h-1.5 mt-3 rounded-full bg-blue-500 flex-shrink-0"
                  />
                </div>
              </div>

              <div
                class="py-2.5 text-center border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/60"
              >
                <a
                  class="text-xs text-indigo-500 hover:text-indigo-600 cursor-pointer font-medium"
                  @click="handleViewAllNotifications"
                >
                  查看全部通知
                </a>
              </div>
            </div>
          </template>

          <!-- 图标按钮：hover 变蓝 + 背景高亮 -->
          <a-button
            type="text"
            class="group !w-8 !h-8 !p-0 !rounded-lg !text-gray-500 hover:!text-blue-500 hover:!bg-blue-50 dark:hover:!bg-blue-900/20 transition-all duration-200"
          >
            <Badge :count="unreadCount" size="small" :offset="[-4, 4]" :overflow-count="99">
              <Icon
                icon="carbon:notification"
                class="text-lg transition-transform duration-200 group-hover:scale-110"
              />
            </Badge>
          </a-button>
        </Popover>

        <!-- 系统设置 -->
        <a-button
          type="text"
          class="group !w-8 !h-8 !p-0 !rounded-lg !text-gray-500 hover:!text-blue-500 hover:!bg-blue-50 dark:hover:!bg-blue-900/20 transition-all duration-200"
          @click="showSetting = true"
        >
          <Icon
            icon="carbon:settings"
            class="text-lg transition-transform duration-200 group-hover:rotate-90"
          />
        </a-button>
      </div>
      <Dropdown
        :menu="{ items: userDropdownItems, onClick: handleUserMenuClick }"
        placement="bottomRight"
      >
        <div
          class="flex items-center gap-2 pl-1 pr-2 py-0.5 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <a-avatar :size="28" :src="userStore.avatar" class="bg-ant-primary">
            {{ userStore.username?.charAt(0)?.toUpperCase() || "U" }}
          </a-avatar>
          <span class="text-sm hidden sm:inline text-gray-700 dark:text-gray-200">
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
