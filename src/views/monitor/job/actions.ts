import type { ActionItem } from '~/components/business/Table'

import type { JobRecord } from './types'

/** 任务行操作上下文 */
export interface JobActionContext {
  /** 立即执行 */
  onRun: (record: JobRecord) => void
  /** 编辑 */
  onEdit: (record: JobRecord) => void
  /** 删除（确认由 popConfirm 处理） */
  onDelete: (record: JobRecord) => void | Promise<void>
  /** 暂停 */
  onPause: (record: JobRecord) => void
  /** 恢复 */
  onResume: (record: JobRecord) => void | Promise<void>
}

/**
 * 生成任务行操作项
 * 保持无状态：副作用由 ctx 注入
 */
export function getJobActions(record: JobRecord, ctx: JobActionContext): ActionItem[] {
  return [
    {
      icon: 'bx:play-circle',
      label: '立即执行',
      onClick: () => ctx.onRun(record),
      auth: 'monitor:job:run',
    },
    {
      icon: 'ant-design:edit-outlined',
      label: '编辑',
      onClick: () => ctx.onEdit(record),
      auth: 'monitor:job:update',
    },
    {
      icon: 'bx:pause-circle',
      label: '暂停',
      // 只在启用状态时可暂停
      disabled: record.isPaused !== '1',
      auth: 'monitor:job:paused',
      onClick: () => ctx.onPause(record),
    },
    {
      icon: 'bx:play-circle',
      label: '恢复',
      disabled: record.isPaused === '1', // 或者别的条件，看后端语义
      onClick: () => ctx.onResume(record),
      auth: 'monitor:job:resume',
    },
    {
      label: '删除',
      icon: 'ant-design:delete-outlined',
      danger: true,
      auth: 'monitor:job:delete',
      popConfirm: {
        title: '删除任务',
        content: `确定删除「${record.jobName}」吗？`,
        confirm: () => ctx.onDelete(record),
      },
    },
  ]
}
