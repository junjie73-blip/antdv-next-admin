import dayjs from 'dayjs'

import type { TodoFilterKey, TodoRecord } from './types'

/**
 * 判断待办是否已逾期
 * 规则：未完成 且 有截止时间 且 截止时间早于当前时间
 */
export function isOverdue(item: TodoRecord): boolean {
  return item.status === '0' && !!item.dueTime && new Date(item.dueTime as string) < new Date()
}

/** 截止时间展示信息 */
export interface DueTimeInfo {
  text: string
  overdue: boolean
  urgent: boolean
}

/**
 * 计算截止时间的展示信息
 * - 已完成：仅显示日期，不判断逾期/紧急
 * - 未完成：判断是否逾期（早于当前），是否紧急（24h 内）
 */
export function getDueTimeInfo(item: TodoRecord): DueTimeInfo | null {
  if (!item.dueTime) return null

  const due = dayjs(item.dueTime)
  const now = dayjs()

  if (item.status === '1') {
    return { text: due.format('MM-DD HH:mm'), urgent: false, overdue: false }
  }

  const overdue = due.isBefore(now)
  const soon = !overdue && due.diff(now, 'hour') < 24
  return { text: due.format('MM-DD HH:mm'), overdue, urgent: soon }
}

/**
 * 按过滤条件筛选待办
 */
export function filterTodos(list: TodoRecord[], filter: TodoFilterKey): TodoRecord[] {
  const now = new Date()

  return list.filter((t) => {
    switch (filter) {
      case 'uncompleted':
        return t.status === '0'
      case 'completed':
        return t.status === '1'
      case 'overdue':
        return t.status === '0' && !!t.dueTime && new Date(t.dueTime) < now
      case 'all':
      default:
        return true
    }
  })
}

/**
 * 把待办记录转成表单值（编辑回填）
 */
export function todoToFormValues(item: TodoRecord) {
  return {
    title: item.title,
    content: item.content ?? '',
    priority: item.priority,
    dueTime: item.dueTime ? new Date(item.dueTime) : null,
    groupId: item.groupId ?? undefined, // ⭐ 新增
  }
}
