import type { MockRequestLog } from '~/api/mock'
import type { ActionItem } from '~/components/business/Table'

import type { MockRouteRow } from './types'

/**
 * 行操作副作用由 index.vue 注入，本文件保持无状态：
 * 不 import store、不发请求、不弹 message。
 */
export interface RouteActionContext {
  onDelete: (record: MockRouteRow) => void
  onEdit: (record: MockRouteRow) => void
  onFilterLogs: (record: MockRouteRow) => void
  onRuntime: (record: MockRouteRow) => void
  onToggleDisabled: (record: MockRouteRow, disabled: boolean) => void
}

export interface LogActionContext {
  onDetail: (record: MockRequestLog) => void
  onReplay: (record: MockRequestLog) => void
}

function isDisabledRoute(record: MockRouteRow): boolean {
  return record.effective?.disabled === true
}

/** 接口清单行操作 */
export function getRouteActions(
  record: MockRouteRow,
  ctx: RouteActionContext,
): ActionItem[] {
  const disabled = isDisabledRoute(record)
  const generated = record.source === 'generated'

  return [
    {
      label: '运行时',
      icon: 'ant-design:dashboard-outlined',
      onClick: () => ctx.onRuntime(record),
    },
    {
      label: disabled ? '启用' : '停用',
      icon: disabled
        ? 'ant-design:play-circle-outlined'
        : 'ant-design:pause-circle-outlined',
      danger: !disabled,
      popConfirm: {
        title: disabled ? '确认启用该接口' : '确认停用该接口',
        content: disabled
          ? `「${record.path}」将恢复正常的 Mock 响应`
          : `「${record.path}」将返回 404 信封，用于验证前端的接口异常分支`,
        confirm: () => ctx.onToggleDisabled(record, !disabled),
      },
    },
    {
      label: '编辑',
      icon: 'ant-design:edit-outlined',
      ifShow: generated,
      onClick: () => ctx.onEdit(record),
    },
    {
      label: '看命中',
      icon: 'ant-design:history-outlined',
      onClick: () => ctx.onFilterLogs(record),
    },
    {
      label: '删除',
      icon: 'ant-design:delete-outlined',
      danger: true,
      ifShow: generated,
      popConfirm: {
        title: '确认删除该自定义接口',
        content: `将移除 mock/generated/${record.id}.ts 与对应的运行时配置，源码接口请在 mock/ 目录内修改`,
        confirm: () => ctx.onDelete(record),
      },
    },
  ]
}

/** 命中日志行操作 */
export function getLogActions(
  record: MockRequestLog,
  ctx: LogActionContext,
): ActionItem[] {
  return [
    {
      label: '详情',
      icon: 'ant-design:file-search-outlined',
      onClick: () => ctx.onDetail(record),
    },
    {
      label: '重放',
      icon: 'ant-design:reload-outlined',
      onClick: () => ctx.onReplay(record),
    },
  ]
}
