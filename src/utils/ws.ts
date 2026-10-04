import { Icon } from '@iconify/vue'
import { notification } from 'antdv-next'
import { h, ref, watch } from 'vue'

import { forceLogout } from '~/composables/web/request/fetcher'
import { useWebSocket as useWebSocketComposable } from '~/composables/web/websocket'
import { useUserStore } from '~/stores/modules/user'

import { eventBus } from './event'

// ==================== 类型 ====================
export interface NotificationItem {
  noticeId: string
  title: string
  content: string
  noticeType: number
  status: string
  publishTime?: string | null
  createdAt: string
  isRead: 0 | 1
  priority: number
  /** 消息来源：notice | workflow | report | system */
  source?: 'notice' | 'workflow' | 'report' | 'system'
  /** 工作流通知：跳转参数 */
  bizType?: string | null
  bizId?: string | null
  bizSource?: string | null
}

/** ⭐ 撤回消息载荷 */
export interface RevokePayload {
  noticeId: string
  at?: number
}

export interface UploadMergeMessage {
  taskId: string
  status: 'pending' | 'merging' | 'uploading' | 'completed' | 'failed'
  fileId?: string
  url?: string
  size?: number
  filename?: string
  errorMsg?: string
}

export type WsConnState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed'

export const noticeTypeConfig: Record<number, { label: string; icon: string; color: string; gradient: string }> = {
  1: {
    label: '通知',
    icon: 'carbon:notification',
    color: 'blue',
    gradient: 'from-blue-500 to-cyan-500',
  },
  2: {
    label: '公告',
    icon: 'carbon:megaphone',
    color: 'green',
    gradient: 'from-green-500 to-emerald-500',
  },
  3: {
    label: '提醒',
    icon: 'carbon:task',
    color: 'orange',
    gradient: 'from-amber-500 to-yellow-500',
  },
}

export const WS_EVENTS = {
  NOTICE: 'ws:notice',
  FORCE_LOGOUT: 'ws:force-logout',
  OPEN: 'ws:open',
  CLOSE: 'ws:close',
  ERROR: 'ws:error',
  REVOKE: 'ws:revoke',
  STATUS_CHANGE: 'ws:status-change',
  UPLOAD_MERGE: 'ws:upload-merge',
} as const

// ==================== 全局单例 ====================
type WsSocket = ReturnType<typeof useWebSocketComposable>

let socketApi: WsSocket | null = null
let currentToken: string | null = null
let currentUrl = ''

const sharedNotice = ref<NotificationItem | null>(null)
const sharedStatus = ref<WsConnState>('idle')

// ==================== 工具 ====================
function buildWsUrl(token: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}&type=notice`
}

function setStatus(s: WsConnState): void {
  if (sharedStatus.value === s) return
  sharedStatus.value = s
  eventBus.emit(WS_EVENTS.STATUS_CHANGE, s)
}

function transformNotice(item: any): NotificationItem {
  return {
    noticeId: item.noticeId ?? item.notice_id,
    title: item.title,
    content: item.content || '',
    noticeType: item.noticeType ?? item.notice_type ?? 1,
    status: item.status ?? '1',
    publishTime: item.publishTime || item.publish_time || null,
    createdAt: item.createdAt || item.created_at || new Date().toISOString(),
    isRead: (item.isRead ?? item.is_read ?? 0) as 0 | 1,
    priority: item.priority || 0,
    source: item.source ?? 'notice',
    bizType: item.bizType ?? item.biz_type ?? null,
    bizId: item.bizId ?? item.biz_id ?? null,
    bizSource: item.bizSource ?? item.biz_source ?? null,
  }
}

/**
 * ⭐ 从撤回载荷中提取 noticeId（兼容多种结构）
 */
function extractRevokeId(payload: any): string | null {
  if (!payload) return null
  if (typeof payload === 'string') return payload
  return payload.noticeId ?? payload.notice_id ?? null
}

function handleMessage(raw: unknown): void {
  let data: any
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch (err) {
    console.warn('[WS] 消息解析失败', err)
    return
  }

  /* ============================================================
   * 通知推送（notice:push / workflow:notify 统一入口）
   * ============================================================ */
  if (data.type === 'notice:push' || data.type === 'workflow:notify' || data.type === 'report:notify') {
    const notice = transformNotice(data.data)
    sharedNotice.value = notice
    eventBus.emit(WS_EVENTS.NOTICE, notice)

    notification.open({
      title: `新${noticeTypeConfig[notice.noticeType]?.label || '通知'}`,
      description: notice.title,
      icon: h(Icon, {
        icon: noticeTypeConfig[notice.noticeType]?.icon || 'carbon:notification',
        style: { color: '#108ee9' },
      }),
      placement: 'bottomRight',
      duration: 3,
    })
    return
  }

  /* ============================================================
   * ⭐ 通知撤回
   * ============================================================
   * 处理：
   *  1. 若撤回的正是当前共享的 sharedNotice → 清空
   *  2. 广播给所有订阅方（useNotice 会移除列表项）
   */
  if (data.type === 'notice:revoke') {
    const noticeId = extractRevokeId(data.data)
    if (!noticeId) {
      console.warn('[WS] notice:revoke 缺少 noticeId', data.data)
      return
    }

    // 撤回的是当前展示的共享通知 → 清空
    if (sharedNotice.value?.noticeId === noticeId) {
      sharedNotice.value = null
    }

    const payload: RevokePayload = {
      noticeId,
      at: data.data?.at ?? data.timestamp ?? Date.now(),
    }

    eventBus.emit(WS_EVENTS.REVOKE, payload)
    return
  }

  /* ============================================================
   * 强制下线
   * ============================================================ */
  if (data.type === 'force-logout') {
    const reason = data.data?.reason || '您已被管理员强制下线'
    notification.warning({
      title: '会话已失效',
      description: reason,
      placement: 'bottomRight',
      duration: 5,
    })
    eventBus.emit(WS_EVENTS.FORCE_LOGOUT, data.data)
    forceLogout()
    return
  }

  /* ============================================================
   * 文件上传合并
   * ============================================================ */
  if (data.type === 'upload:merge') {
    const payload = data.data as UploadMergeMessage
    if (!payload?.taskId) {
      console.warn('[WS] upload:merge 缺少 taskId', payload)
      return
    }
    eventBus.emit(WS_EVENTS.UPLOAD_MERGE, payload)
    return
  }

  /* ============================================================
   * 连接确认
   * ============================================================ */
  if (data.type === 'connected') {
    console.log('[WS] connected:', data.data)
  }
}

// ==================== 连接管理 ====================
function destroySocket(): void {
  if (!socketApi) return
  try {
    socketApi.disconnect()
  } catch {
    /* ignore */
  }
  socketApi = null
}

function createSocket(token: string): void {
  destroySocket()

  currentToken = token
  currentUrl = buildWsUrl(token)

  socketApi = useWebSocketComposable({
    url: () => currentUrl,
    autoConnect: false,
    reconnect: {
      retries: -1,
      interval: 2000,
      delayMultiplier: 2,
      maxDelay: 30000,
    },
  })

  socketApi.on('message', handleMessage)

  socketApi.on('open', () => {
    setStatus('connected')
    eventBus.emit(WS_EVENTS.OPEN)
    console.log('[WS] open')
  })

  socketApi.on('close', () => {
    if (currentToken === token) {
      setStatus('reconnecting')
    } else {
      setStatus('closed')
    }
    eventBus.emit(WS_EVENTS.CLOSE)
  })

  socketApi.on('error', (err) => {
    console.warn('[WS] error', err)
    eventBus.emit(WS_EVENTS.ERROR, err)
  })

  socketApi.connect()
}

function ensureSocket(token: string): void {
  if (!token) {
    destroySocket()
    currentToken = null
    currentUrl = ''
    setStatus('idle')
    return
  }

  if (socketApi && currentToken === token && socketApi.isConnected.value) {
    return
  }

  if (socketApi && currentToken === token && !socketApi.isConnected.value) {
    try {
      socketApi.connect()
      return
    } catch {
      /* fallthrough to recreate */
    }
  }

  createSocket(token)
}

// ==================== 全局注册（一次） ====================
let watchRegistered = false

export function useWebSocket() {
  const userStore = useUserStore()

  if (!watchRegistered) {
    watchRegistered = true

    watch(
      () => userStore.token,
      (token) => ensureSocket(token || ''),
      { immediate: true },
    )
  }

  return {
    /** 全局共享的最近一条通知 */
    notice: sharedNotice,

    /** 全局连接状态 */
    status: sharedStatus,

    onNotice(fn: (n: NotificationItem) => void) {
      eventBus.on(WS_EVENTS.NOTICE, fn)
      return () => eventBus.off(WS_EVENTS.NOTICE, fn)
    },

    /* ============================================================
     * ⭐ 通知撤回订阅
     * ============================================================
     * 使用示例：
     *   const off = ws.onRevoke(({ noticeId }) => {
     *     list.value = list.value.filter((n) => n.noticeId !== noticeId);
     *   });
     *   onUnmounted(off);
     */
    onRevoke(fn: (payload: RevokePayload) => void) {
      eventBus.on(WS_EVENTS.REVOKE, fn)
      return () => eventBus.off(WS_EVENTS.REVOKE, fn)
    },

    onForceLogout(fn: (data?: any) => void) {
      eventBus.on(WS_EVENTS.FORCE_LOGOUT, fn)
      return () => eventBus.off(WS_EVENTS.FORCE_LOGOUT, fn)
    },

    onStatusChange(fn: (s: WsConnState) => void) {
      eventBus.on(WS_EVENTS.STATUS_CHANGE, fn)
      return () => eventBus.off(WS_EVENTS.STATUS_CHANGE, fn)
    },

    onUploadMerge(fn: (data: UploadMergeMessage) => void) {
      eventBus.on(WS_EVENTS.UPLOAD_MERGE, fn)
      return () => eventBus.off(WS_EVENTS.UPLOAD_MERGE, fn)
    },

    /** 手动重连 */
    reconnect() {
      if (!currentToken) return
      destroySocket()
      createSocket(currentToken)
    },

    /** 手动断开（登出） */
    disconnect() {
      destroySocket()
      currentToken = null
      currentUrl = ''
      setStatus('idle')
    },
  }
}
