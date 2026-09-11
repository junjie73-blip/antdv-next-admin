import { useWebSocket } from "@/composables/web/websocket";
import { useUserStore } from "@/stores/modules/user";
import { Icon } from "@iconify/vue";
import { notification } from "antdv-next";
import { computed, h, ref, unref } from "vue";
import { forceLogout } from "./request/alova";
export interface NotificationItem {
  noticeId: string;
  title: string;
  content: string;
  noticeType: number; // 1-通知，2-公告，3-提醒
  status: string; // '0'-草稿 '1'-发布
  publishTime?: string;
  createdAt: string;
  isRead: 0 | 1;
}
// 通知类型映射
export const noticeTypeConfig: Record<
  number,
  { label: string; icon: string; color: string; gradient: string }
> = {
  1: {
    label: "通知",
    icon: "carbon:notification",
    color: "blue",
    gradient: "from-blue-500 to-cyan-500",
  },
  2: {
    label: "公告",
    icon: "carbon:megaphone",
    color: "green",
    gradient: "from-green-500 to-emerald-500",
  },
  3: {
    label: "提醒",
    icon: "carbon:task",
    color: "orange",
    gradient: "from-amber-500 to-yellow-500",
  },
};
export function useWs() {
  const notice = ref<NotificationItem | null>(null);
  const userStore = useUserStore();
  const wsUrl = computed(() => {
    const token = userStore.token;
    if (!token) return "";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}&type=notice`;
  });

  const socket = useWebSocket({
    url: () => unref(wsUrl),
    autoConnect: true,
  });
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
  socket.connect();
  socket.on("message", (message) => {
    const _message = JSON.parse(message as string);
    console.log(_message, "_message");
    if (_message.type === "notice") {
      notice.value = transformNotice(_message.data);
      notification.open({
        title: "新通知",
        description: notice.value.title,
        icon: () =>
          h(Icon, {
            icon: noticeTypeConfig[notice.value?.noticeType || 1]?.icon || "carbon:notification",
            style: { color: "#108ee9" },
          }),
        placement: "bottomRight",
        duration: 3,
      });
    } else if (_message.type === "forceLogout") {
      notice.value = null;
      notification.open({
        title: "会话过期",
        description: "您的会话已过期，请重新登录。",
        type: "warning",
        placement: "bottomRight",
        duration: 3,
      });
      forceLogout();
    }
  });
  socket.on("error", (error) => {
    console.warn("Invalid WebSocket message:", error);
  });
  return {
    notice,
  };
}
