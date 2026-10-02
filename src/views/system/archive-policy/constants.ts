import { cn } from '~/utils'

export const containerClassName = cn('space-y-4')
export const cardClassName = cn(
  'shadow-sm rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900',
)

export const TABLE_LABEL: Record<string, string> = {
  sys_audit_log: '审计日志',
  sys_login_log: '登录日志',
  sys_notice_send_log: '通知发送日志',
  sys_job_log: '定时任务日志',
  sys_message: '消息中心',
  sys_audit_daily: '审计日报',
  sys_login_daily: '登录日报',
  sys_cache_operation_log: '缓存操作日志',
  sys_slow_query_log: '慢查询日志',
}
