import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'

import { cn } from '~/utils/cn'

import type { LogItem, NoticeBrief } from './types'

import { LOG_STATUS_COLOR_MAP, LOG_STATUS_LABEL_MAP, NOTICE_PRIORITY_MAP, NOTICE_TYPE_MAP } from './constants'

/* ============================================================
 * 通知列表项
 * ============================================================
 * 设计：
 *  - 默认白底（暗色深灰底）
 *  - hover 按优先级变色：紧急=红 / 重要=橙 / 普通=蓝
 *  - 未读有左侧色条 + 标题加粗 + 红点
 *  - 置顶有蓝色徽标
 */

export interface NoticeRenderOptions {
  onClick?: (item: NoticeBrief) => void
}

export function renderNoticeItem(item: NoticeBrief, options: NoticeRenderOptions = {}) {
  const priority = NOTICE_PRIORITY_MAP[item.priority] ?? NOTICE_PRIORITY_MAP[0]!
  const typeConf = NOTICE_TYPE_MAP[item.noticeType] ?? NOTICE_TYPE_MAP[1]!

  const isUnread = item.isRead === 0
  const isUrgent = item.priority >= 2
  const isImportant = item.priority === 1

  // ⭐ hover 颜色按优先级
  const hoverClass = isUrgent
    ? [
        'hover:bg-red-50 hover:border-red-200',
        'hover:shadow-[0_2px_8px_-2px_rgba(220,38,38,0.15)]',
        'dark:hover:bg-red-950/30 dark:hover:border-red-900',
        'dark:hover:shadow-[0_2px_8px_-2px_rgba(220,38,38,0.25)]',
      ]
    : isImportant
      ? [
          'hover:bg-amber-50 hover:border-amber-200',
          'hover:shadow-[0_2px_8px_-2px_rgba(217,119,6,0.15)]',
          'dark:hover:bg-amber-950/25 dark:hover:border-amber-900',
          'dark:hover:shadow-[0_2px_8px_-2px_rgba(217,119,6,0.25)]',
        ]
      : [
          'hover:bg-blue-50 hover:border-blue-200',
          'hover:shadow-[0_2px_8px_-2px_rgba(59,130,246,0.15)]',
          'dark:hover:bg-blue-950/25 dark:hover:border-blue-900',
          'dark:hover:shadow-[0_2px_8px_-2px_rgba(59,130,246,0.25)]',
        ]

  return (
    <div
      onClick={() => options.onClick?.(item)}
      class={cn(
        'notice-item group relative flex cursor-pointer items-center gap-3',
        'rounded-lg px-3 py-2.5',
        'border border-transparent',
        'transition-all duration-200 ease-out',
        'bg-white dark:bg-slate-900/60',
        'active:scale-[0.995]',
        hoverClass,
      )}
    >
      {/* 左侧类型色条（仅未读） */}
      <span
        class="absolute top-1/2 left-0 h-5 w-[2px] -translate-y-1/2 rounded-r-full"
        style={{
          backgroundColor: isUnread ? typeConf.color : 'transparent',
        }}
      />

      {/* 类型图标 */}
      <div
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105"
        style={{
          backgroundColor: `${typeConf.color}18`,
          color: typeConf.color,
        }}
      >
        <Icon icon={typeConf.icon} class="text-[15px]" />
      </div>

      {/* 主内容 */}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          {item.isTop === 1 && (
            <span
              class="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-px text-[10px] leading-4 font-medium"
              style={{
                backgroundColor: 'rgba(59,130,246,0.14)',
                color: '#3B82F6',
              }}
            >
              <Icon icon="carbon:arrow-up" class="text-[9px]" />
              置顶
            </span>
          )}

          <span
            class={cn(
              'truncate text-[13px] leading-5',
              isUnread ? 'font-medium text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400',
            )}
            title={item.title}
          >
            {item.title}
          </span>

          {isUnread && <span class="ml-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />}
        </div>

        <div class="mt-1 flex items-center gap-2 text-[11px] leading-4">
          <span
            class="inline-flex items-center rounded px-1.5 py-px font-medium"
            style={{
              backgroundColor: priority.bg,
              color: priority.color,
            }}
          >
            {priority.label}
          </span>
          <span class="text-slate-400 dark:text-slate-500">{dayjs(item.publishTime).fromNow()}</span>
        </div>
      </div>

      <Icon
        icon="carbon:chevron-right"
        class="shrink-0 text-base text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400"
      />
    </div>
  )
}

/* ============================================================
 * 操作日志列表项
 * ============================================================
 * 参考通知项设计：
 *  - 白底 + 圆角 + hover 变色（成功=绿 / 失败=红）
 *  - 左侧状态色条（仅失败时显示）
 *  - 图标 + 用户名 + 操作描述 + 时间
 */

export interface LogRenderOptions {
  onClick?: (item: LogItem) => void
}

export function renderLogItem(item: LogItem, options: LogRenderOptions = {}) {
  const style = LOG_STATUS_COLOR_MAP[item.status] ?? LOG_STATUS_COLOR_MAP['0']!
  const label = LOG_STATUS_LABEL_MAP[item.status] ?? '未知'
  const isSuccess = item.status === '1'

  // ⭐ hover 颜色按状态
  const hoverClass = isSuccess
    ? [
        'hover:bg-emerald-50 hover:border-emerald-200',
        'hover:shadow-[0_2px_8px_-2px_rgba(16,185,129,0.15)]',
        'dark:hover:bg-emerald-950/25 dark:hover:border-emerald-900',
        'dark:hover:shadow-[0_2px_8px_-2px_rgba(16,185,129,0.25)]',
      ]
    : [
        'hover:bg-rose-50 hover:border-rose-200',
        'hover:shadow-[0_2px_8px_-2px_rgba(244,63,94,0.15)]',
        'dark:hover:bg-rose-950/25 dark:hover:border-rose-900',
        'dark:hover:shadow-[0_2px_8px_-2px_rgba(244,63,94,0.25)]',
      ]

  return (
    <div
      onClick={() => options.onClick?.(item)}
      class={cn(
        'log-item group relative flex cursor-pointer items-center gap-3',
        'rounded-lg px-3 py-2.5',
        'border border-transparent',
        'transition-all duration-200 ease-out',
        'bg-white dark:bg-slate-900/60',
        'active:scale-[0.995]',
        hoverClass,
      )}
    >
      {/* 左侧状态色条（仅失败时显示） */}
      <span
        class="absolute top-1/2 left-0 h-5 w-[2px] -translate-y-1/2 rounded-r-full"
        style={{
          backgroundColor: isSuccess ? 'transparent' : style.color,
        }}
      />

      {/* 状态图标 */}
      <div
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105"
        style={{
          backgroundColor: style.bg,
          color: style.color,
        }}
      >
        <Icon icon={isSuccess ? 'carbon:checkmark' : 'carbon:close'} class="text-[15px]" />
      </div>

      {/* 主内容 */}
      <div class="min-w-0 flex-1">
        {/* 第一行：用户名 */}
        <div class="flex items-center gap-1.5">
          <span
            class={cn('truncate text-[13px] font-medium leading-5', 'text-slate-800 dark:text-slate-100')}
            title={item.username}
          >
            {item.username || '系统'}
          </span>
        </div>

        {/* 第二行：状态 + 操作描述 */}
        <div class="mt-1 flex items-center gap-2 text-[11px] leading-4">
          <span
            class="inline-flex items-center rounded px-1.5 py-px font-medium"
            style={{
              backgroundColor: style.bg,
              color: style.color,
            }}
          >
            {label}
          </span>
          <span class="truncate text-slate-500 dark:text-slate-400" title={item.operation}>
            {item.operation}
          </span>
        </div>
      </div>

      {/* 右侧时间 */}
      <span class="shrink-0 text-[11px] text-slate-400 tabular-nums dark:text-slate-500">
        {dayjs(item.created_at).fromNow()}
      </span>
    </div>
  )
}
