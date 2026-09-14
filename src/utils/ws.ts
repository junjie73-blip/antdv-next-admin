import { useWebSocket } from "@/composables/web/websocket";
import { useUserStore } from "@/stores/modules/user";
import { Icon } from "@iconify/vue";
import { notification } from "antdv-next";
import { h, ref, watch } from "vue";
import { forceLogout } from "./request/alova";
import { eventBus } from "./event";

// ==================== 类型 ====================
export interface NotificationItem {
  noticeId: string;
  title: string;
  content: string;
  noticeType: number;
  status: string;
  publishTime?: string | null;
  createdAt: string;
  isRead: 0 | 1;
}

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

// ==================== 事件名 ====================
export const WS_EVENTS = {
  NOTICE: "ws:notice",
  FORCE_LOGOUT: "ws:force-logout",
  OPEN: "ws:open",
  CLOSE: "ws:close",
  ERROR: "ws:error",
} as const;

// ==================== 模块级单例状态 ====================
type WsSocket = ReturnType<typeof useWebSocket>;

let socketInstance: WsSocket | null = null;
let currentToken: string | null = null;
let currentUrl = "";
let connecting = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

/** 全局共享的 notice ref（多个组件读到的是同一份） */
const sharedNotice = ref<NotificationItem | null>(null);

// ==================== 内部工具 ====================
function buildWsUrl(token: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}&type=notice`;
}

function transformNotice(item: any): NotificationItem {
  return {
    noticeId: item.noticeId,
    title: item.title,
    content: item.content || "",
    noticeType: item.noticeType,
    status: item.status,
    publishTime: item.publishTime || item.publish_time || null,
    createdAt: item.createdAt || item.created_at,
    isRead: (item.isRead ?? item.is_read ?? 0) as 0 | 1,
  };
}

function handleMessage(raw: unknown): void {
  let data: any;
  try {
    data = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (err) {
    console.warn("[WS] 消息解析失败", err);
    return;
  }

  // ---------- 站内通知 ----------
  if (data.type === "notice") {
    const notice = transformNotice(data.data);
    sharedNotice.value = notice;
    eventBus.emit(WS_EVENTS.NOTICE, notice);

    notification.open({
      title: "新通知",
      description: notice.title,
      icon: () =>
        h(Icon, {
          icon: noticeTypeConfig[notice.noticeType]?.icon || "carbon:notification",
          style: { color: "#108ee9" },
        }),
      placement: "bottomRight",
      duration: 3,
    });
    return;
  }

  // ---------- 强制下线（后端推的是 force-logout，注意短横线） ----------
  if (data.type === "force-logout") {
    const reason = data.data?.reason || "您已被管理员强制下线";
    notification.warning({
      message: "会话已失效",
      description: reason,
      placement: "bottomRight",
      duration: 5,
    });
    eventBus.emit(WS_EVENTS.FORCE_LOGOUT, data.data);
    forceLogout();
    return;
  }

  // ---------- 连接确认 ----------
  if (data.type === "connected") {
    console.log("[WS] connected:", data.data);
  }
}

function closeSocket(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socketInstance) {
    try {
      socketInstance.close();
    } catch {
      /* ignore */
    }
    socketInstance = null;
  }
}

/** 核心：根据 token 建立/复用连接 */
function ensureSocket(token: string): void {
  // token 为空（登出） → 关闭连接
  if (!token) {
    closeSocket();
    currentToken = null;
    currentUrl = "";
    return;
  }

  // token 未变且连接存活 → 复用
  if (socketInstance && currentToken === token) {
    return;
  }

  // 正在连接中 → 等它连完再说
  if (connecting) return;

  // token 变了 → 关旧开新
  closeSocket();

  connecting = true;
  currentToken = token;
  currentUrl = buildWsUrl(token);

  const socket = useWebSocket({
    url: () => currentUrl,
    autoConnect: false, // 手动控制连接时机
  });
  socketInstance = socket;

  socket.on("message", handleMessage);

  socket.on("open", () => {
    connecting = false;
    eventBus.emit(WS_EVENTS.OPEN);
    console.log("[WS] open");
  });

  socket.on("close", () => {
    connecting = false;
    eventBus.emit(WS_EVENTS.CLOSE);
    console.log("[WS] close");

    // token 未变 → 3 秒后重连
    if (currentToken === token) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (currentToken === token) {
          try {
            socket.connect();
          } catch (err) {
            console.warn("[WS] 重连失败", err);
          }
        }
      }, 3000);
    }
  });

  socket.on("error", (err) => {
    console.warn("[WS] error", err);
    eventBus.emit(WS_EVENTS.ERROR, err);
  });

  socket.connect();
}

// ==================== 对外 API ====================
/**
 * useWs —— 全局 WebSocket 单例
 *
 * 特点：
 * - 整应用只建立一条 WS 连接
 * - token 变化自动重连，登出自动断开
 * - 多个组件可同时通过 `onNotice` / `onForceLogout` 订阅
 * - `notice` 是全局共享 ref，多处读取一致
 */
export function useWs() {
  const userStore = useUserStore();

  // watch 只在第一次调用 useWs 时生效（后续调用复用同一个 watch）
  // 借助 eventBus 和模块级变量，避免重复 watch
  watch(
    () => userStore.token,
    (token) => ensureSocket(token || ""),
    { immediate: true },
  );

  return {
    /** 全局共享的最近一条通知（响应式） */
    notice: sharedNotice,

    /** 订阅通知，返回取消订阅函数 */
    onNotice(fn: (n: NotificationItem) => void) {
      eventBus.on(WS_EVENTS.NOTICE, fn);
      return () => eventBus.off(WS_EVENTS.NOTICE, fn);
    },

    /** 订阅强制下线 */
    onForceLogout(fn: (data?: any) => void) {
      eventBus.on(WS_EVENTS.FORCE_LOGOUT, fn);
      return () => eventBus.off(WS_EVENTS.FORCE_LOGOUT, fn);
    },

    /** 手动重连（一般用于网络恢复后） */
    reconnect() {
      if (!currentToken) return;
      closeSocket();
      ensureSocket(currentToken);
    },

    /** 手动断开（登出时） */
    disconnect() {
      closeSocket();
      currentToken = null;
      currentUrl = "";
    },
  };
}
