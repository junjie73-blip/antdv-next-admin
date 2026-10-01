import { computed, ref } from 'vue'

import type { NotificationItem, RevokePayload } from '~/utils/ws'

import {
  getMyNoticeList,
  getNoticeUnreadCount as getUnreadCount,
  markAllNoticeRead,
  markNoticeRead,
} from '~/api/notice'
import { useWebSocket } from '~/utils/ws'

/** 消息来源 */
type NoticeSource = 'notice' | 'workflow' | 'report' | 'system'

/** 统一消息结构（列表页用） */
export interface NoticeRecord {
  noticeId: string
  noticeType: number
  source?: NoticeSource
  title: string
  content: string
  isRead: 0 | 1
  priority: number
  publishTime: string | null
  bizType?: string | null
  bizId?: string | null
  bizSource?: string | null
}

/* ============================================================
 * 全局单例状态（跨组件共享）
 * ============================================================ */
const list = ref<NoticeRecord[]>([])
const unreadCount = ref(0)
const loading = ref(false)

let initialized = false

/* ============================================================
 * 数据转换
 * ============================================================ */
function transformItem(raw: any): NoticeRecord {
  return {
    noticeId: raw.noticeId ?? raw.notice_id,
    noticeType: raw.noticeType ?? raw.notice_type ?? 1,
    source: (raw.source as NoticeSource) ?? 'notice',
    title: raw.title,
    content: raw.content ?? '',
    isRead: (raw.isRead ?? raw.is_read ?? 0) as 0 | 1,
    priority: raw.priority ?? 0,
    publishTime: raw.publishTime ?? raw.publish_time ?? null,
    bizType: raw.bizType ?? raw.biz_type ?? null,
    bizId: raw.bizId ?? raw.biz_id ?? null,
    bizSource: raw.bizSource ?? raw.biz_source ?? null,
  }
}

/* ============================================================
 * 主 Hook
 * ============================================================ */
export function useNotice() {
  // 首次调用时初始化 WS 监听
  if (!initialized) {
    initialized = true
    initWsListener()
    void refreshUnreadCount()
  }

  /* ============================================================
   * WS 监听：新增 + 撤回
   * ============================================================ */
  function initWsListener() {
    const ws = useWebSocket()

    // ── 新通知：列表头部插入 ──
    ws.onNotice((item: NotificationItem) => {
      const record = transformItem(item)

      // 去重（可能重复推送）
      if (list.value.some((n) => n.noticeId === record.noticeId)) return

      list.value.unshift(record)
      if (list.value.length > 20) list.value.pop()
      unreadCount.value++
    })

    // ── ⭐ 通知撤回：从列表移除 ──
    ws.onRevoke(({ noticeId }: RevokePayload) => {
      const index = list.value.findIndex((n) => n.noticeId === noticeId)
      if (index === -1) return

      const removed = list.value[index]!
      list.value.splice(index, 1)

      // 若撤回的是未读消息，未读数 -1
      if (removed.isRead === 0) {
        unreadCount.value = Math.max(0, unreadCount.value - 1)
      }
    })
  }

  /* ============================================================
   * 加载列表
   * ============================================================ */
  async function loadList(params?: { pageNum?: number; pageSize?: number }) {
    loading.value = true
    try {
      const res = await getMyNoticeList({
        pageNum: params?.pageNum ?? 1,
        pageSize: params?.pageSize ?? 10,
      })
      list.value = ((res as any)?.list ?? []).map(transformItem)
      return list.value
    } finally {
      loading.value = false
    }
  }

  /* ============================================================
   * 未读数
   * ============================================================ */
  async function refreshUnreadCount() {
    try {
      const res = await getUnreadCount()
      unreadCount.value = (res as any)?.total ?? 0
    } catch {
      /* 静默失败 */
    }
  }

  /* ============================================================
   * 单条已读（乐观更新）
   * ============================================================ */
  async function read(item: NoticeRecord | NotificationItem) {
    if (item.isRead === 1) return

    const oldValue = item.isRead
    item.isRead = 1
    unreadCount.value = Math.max(0, unreadCount.value - 1)

    try {
      await markNoticeRead(item.noticeId)
    } catch (err) {
      item.isRead = oldValue
      unreadCount.value++
      throw err
    }
  }

  /* ============================================================
   * 全部已读（乐观更新）
   * ============================================================ */
  async function readAll(params?: { source?: string; noticeType?: number }) {
    if (unreadCount.value === 0) return

    const oldCount = unreadCount.value
    const oldList = list.value.map((i) => ({ ...i }))

    unreadCount.value = 0
    list.value.forEach((i) => (i.isRead = 1))

    try {
      await markAllNoticeRead(params)
    } catch (err) {
      unreadCount.value = oldCount
      list.value = oldList
      throw err
    }
  }

  /* ============================================================
   * 本地移除（用户手动删除 / 撤回兜底）
   * ============================================================ */
  function removeLocal(noticeId: string) {
    const index = list.value.findIndex((n) => n.noticeId === noticeId)
    if (index === -1) return
    const removed = list.value[index]!
    list.value.splice(index, 1)
    if (removed.isRead === 0) {
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
  }

  return {
    list,
    unreadCount,
    loading,
    hasUnread: computed(() => unreadCount.value > 0),
    loadList,
    refreshUnreadCount,
    read,
    readAll,
    removeLocal,
  }
}
