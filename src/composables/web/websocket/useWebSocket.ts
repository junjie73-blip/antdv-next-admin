import { computed, ref, shallowRef } from "vue";

import { DEFAULT_HEARTBEAT_CONFIG, DEFAULT_RECONNECT_CONFIG } from "./constants";
import { EventManager } from "./EventManager";
import { HeartbeatManager } from "./HeartbeatManager";
import { ReconnectManager } from "./ReconnectManager";
import { WebSocketStateManager } from "./WebSocketStateManager";
import { WebSocketEventType, WebSocketState } from "./types";

export interface UseWebSocketOptions {
  /** 每次连接时调用，可返回最新 URL（token 变化后重连会用新 URL） */
  url: () => string | URL;
  protocols?: string[] | string;
  /** 是否在创建时自动连接，默认 false */
  autoConnect?: boolean;
  /** @deprecated 已去除 onScopeDispose 自动断开，此参数仅为兼容保留 */
  autoDisconnect?: boolean;
  heartbeat?: {
    interval: number;
    message?: string | (() => string);
    timeout?: number;
    pongMessage?: string;
  };
  reconnect?: {
    /** 最大重试次数；<=0 表示无限（推荐用 -1） */
    retries: number;
    /** 基础延迟（ms） */
    interval: number;
    /** 退避倍数，默认 2 */
    delayMultiplier?: number;
    /** 最大延迟，默认 30000 */
    maxDelay?: number;
    /** 达到最大重试次数时回调（无限重试时不会触发） */
    onFailed?: () => void;
  };
}

/** 兼容 vueuse 风格的字符串状态 */
export type WsStatusString = "OPEN" | "CONNECTING" | "CLOSED";

export function useWebSocket(options: UseWebSocketOptions) {
  const { url: urlGetter, protocols, autoConnect = false, heartbeat, reconnect } = options;

  // ==================== 管理器 ====================
  const stateManager = new WebSocketStateManager();
  const eventManager = new EventManager();

  const reconnectManager = new ReconnectManager({
    enabled: !!reconnect,
    interval: reconnect?.interval ?? DEFAULT_RECONNECT_CONFIG.interval,
    maxAttempts: reconnect?.retries ?? DEFAULT_RECONNECT_CONFIG.maxAttempts,
    delayMultiplier: reconnect?.delayMultiplier ?? DEFAULT_RECONNECT_CONFIG.delayMultiplier,
    maxDelay: reconnect?.maxDelay ?? DEFAULT_RECONNECT_CONFIG.maxDelay,
  });

  const heartbeatManager = new HeartbeatManager(
    {
      interval: heartbeat?.interval ?? DEFAULT_HEARTBEAT_CONFIG.interval,
      timeout: heartbeat?.timeout ?? DEFAULT_HEARTBEAT_CONFIG.timeout,
      message: heartbeat?.message ?? DEFAULT_HEARTBEAT_CONFIG.message,
    },
    (msg) => sendRaw(msg),
  );

  // ==================== 响应式状态 ====================
  const data = ref<string | ArrayBuffer | Blob | null>(null);
  const ws = shallowRef<WebSocket | null>(null);

  const isConnected = computed(() => stateManager.isConnected());
  const isConnecting = computed(() => stateManager.isConnecting());
  const isError = computed(() => stateManager.isError());

  const status = computed<WsStatusString>(() => {
    const s = stateManager.getState();
    if (s === WebSocketState.Connected) return "OPEN";
    if (s === WebSocketState.Connecting) return "CONNECTING";
    return "CLOSED";
  });

  // ==================== 内部标志 ====================
  /** 用户主动关闭 → 不触发自动重连 */
  let manuallyClosed = false;

  // ==================== 核心操作 ====================
  function sendRaw(msg: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    const socket = stateManager.getWebSocket();
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(msg as any);
    } else {
      console.warn("[WS] send failed: socket not open");
    }
  }

  function send(msg: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    sendRaw(msg);
  }

  /** 断开并清除底层 socket（不会触碰 manuallyClosed） */
  function cleanupSocket(): void {
    const socket = stateManager.getWebSocket();
    if (!socket) return;

    // ⭐ 先摘监听，避免 close 触发 onclose → 递归重连
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;

    try {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, "client cleanup");
      }
    } catch {
      /* ignore */
    }

    stateManager.setWebSocket(null);
    ws.value = null;
  }

  function stopAllTimers(): void {
    heartbeatManager.stop();
    reconnectManager.stop();
  }

  /** 打开连接（幂等：已连接/连接中直接返回） */
  function open(): void {
    manuallyClosed = false;

    const current = stateManager.getWebSocket();
    if (
      current &&
      (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    // 解析 URL
    let urlStr: string;
    try {
      const raw = urlGetter();
      urlStr = raw instanceof URL ? raw.toString() : String(raw);
    } catch (err) {
      console.error("[WS] invalid url", err);
      stateManager.setState(WebSocketState.Error);
      eventManager.emit(WebSocketEventType.StateChange, WebSocketState.Error);
      eventManager.emit(WebSocketEventType.Error, err as Event);
      return;
    }

    stateManager.setState(WebSocketState.Connecting);
    eventManager.emit(WebSocketEventType.StateChange, WebSocketState.Connecting);

    // 创建原生 WebSocket
    let socket: WebSocket;
    try {
      socket = protocols ? new WebSocket(urlStr, protocols) : new WebSocket(urlStr);
    } catch (err) {
      console.error("[WS] new WebSocket failed", err);
      stateManager.setState(WebSocketState.Error);
      eventManager.emit(WebSocketEventType.StateChange, WebSocketState.Error);
      eventManager.emit(WebSocketEventType.Error, err as Event);
      scheduleReconnect();
      return;
    }

    ws.value = socket;
    stateManager.setWebSocket(socket);

    // ---------------- onopen ----------------
    socket.onopen = (ev) => {
      // 连上就重置重连计数
      reconnectManager.reset();

      stateManager.setState(WebSocketState.Connected);
      eventManager.emit(WebSocketEventType.StateChange, WebSocketState.Connected);
      eventManager.emit(WebSocketEventType.Open, ev);

      if (heartbeat) {
        heartbeatManager.start();
      }
    };

    // ---------------- onmessage ----------------
    socket.onmessage = (ev) => {
      // ⭐ 不用 watch(ref) 派发，直接事件派发，避免内容相同时丢失
      data.value = ev.data;

      // 心跳 pong 拦截
      if (heartbeat?.pongMessage) {
        try {
          const parsed = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
          if (parsed === heartbeat.pongMessage) {
            heartbeatManager.onPong();
            return;
          }
        } catch {
          // 非 JSON，忽略
        }
      }

      eventManager.emit(WebSocketEventType.Message, ev.data);
    };

    // ---------------- onerror ----------------
    socket.onerror = (ev) => {
      stateManager.setState(WebSocketState.Error);
      eventManager.emit(WebSocketEventType.StateChange, WebSocketState.Error);
      eventManager.emit(WebSocketEventType.Error, ev);
      // 不在 error 里重连，等 onclose 统一处理
    };

    // ---------------- onclose ----------------
    socket.onclose = (ev) => {
      heartbeatManager.stop();

      stateManager.setState(WebSocketState.Disconnected);
      eventManager.emit(WebSocketEventType.StateChange, WebSocketState.Disconnected);
      eventManager.emit(WebSocketEventType.Close, ev);

      ws.value = null;
      stateManager.setWebSocket(null);

      // 用户主动关闭 → 不重连
      if (manuallyClosed) return;

      // 允许自动重连
      if (!reconnectManager.isEnabled()) return;

      scheduleReconnect();
    };
  }

  /** 安排重连（start 内部会判断次数上限并调用 onFailed） */
  function scheduleReconnect(): void {
    reconnectManager.start();
  }

  /** 主动断开（用户级操作），不触发自动重连 */
  function disconnect(): void {
    manuallyClosed = true;
    stopAllTimers();
    cleanupSocket();
    stateManager.setState(WebSocketState.Disconnected);
    eventManager.emit(WebSocketEventType.StateChange, WebSocketState.Disconnected);
  }

  // ==================== 心跳超时 → 关闭（触发自动重连） ====================
  heartbeatManager.setTimeoutCallback(() => {
    console.warn("[WS] heartbeat timeout, closing for reconnect");
    const socket = stateManager.getWebSocket();
    if (!socket) return;
    try {
      // 4000 是自定义码，不是正常关闭 → onclose 会走重连分支
      socket.close(4000, "heartbeat timeout");
    } catch {
      /* ignore */
    }
  });

  // ==================== 重连回调 ====================
  reconnectManager.setReconnectCallback(() => {
    if (manuallyClosed) return;
    open();
  });

  reconnectManager.setMaxAttemptsReachedCallback(() => {
    console.warn("[WS] max reconnect attempts reached");
    reconnect?.onFailed?.();
  });

  // ==================== 自动连接 ====================
  if (autoConnect) {
    open();
  }

  // ==================== 事件 API ====================
  function on<T = unknown>(
    eventType: "open" | "close" | "error" | "message" | "stateChange",
    callback: (data: T) => void,
  ): () => void {
    return eventManager.on(eventType as WebSocketEventType, callback as any);
  }

  function once<T = unknown>(
    eventType: "open" | "close" | "error" | "message" | "stateChange",
    callback: (data: T) => void,
  ): () => void {
    return eventManager.once(eventType as WebSocketEventType, callback as any);
  }

  function off(
    eventType: "open" | "close" | "error" | "message" | "stateChange",
    callback?: (data: unknown) => void,
  ): void {
    eventManager.off(eventType as WebSocketEventType, callback as any);
  }

  function emit<T = unknown>(
    eventType: "open" | "close" | "error" | "message" | "stateChange",
    payload?: T,
  ): void {
    eventManager.emit(eventType as WebSocketEventType, payload as any);
  }

  return {
    // 响应式状态
    isConnected,
    isConnecting,
    isError,
    status,
    data,
    ws,

    // 操作
    connect: open,
    open,
    disconnect,
    /** 别名，语义更清晰 */
    close: disconnect,
    send,

    // 事件
    on,
    once,
    off,
    emit,
  };
}
