/**
 * 日志记录 Composable（内存模式）
 *
 * 功能：
 * - 操作日志：按钮点击、路由跳转、API 请求等
 * - 登录日志：登录成功/失败、登出等
 * - 可通过 .env 配置开关，开发环境默认关闭
 *
 * 设计原则：
 * - 日志仅保存在内存中，页面刷新后自动清空
 * - 生产环境可通过 API 上报至服务端持久化
 */

import { computed, ref } from 'vue'
import { useUserStore } from '@/stores/modules/user'

// ==================== 类型定义 ====================

/** 日志级别 */
export type LogLevel = 'info' | 'warn' | 'error' | 'success'

/** 操作类型 */
export type OperationType
  = | 'click'
    | 'navigate'
    | 'submit'
    | 'api'
    | 'download'
    | 'upload'
    | 'login'
    | 'logout'
    | 'delete'
    | 'edit'
    | 'create'
    | 'search'
    | 'export'
    | 'import'
    | 'custom'

/** 登录结果 */
export type LoginResult = 'success' | 'failure' | 'logout' | 'timeout'

/** 基础日志条目 */
export interface BaseLogEntry {
  id: string
  timestamp: number
  time: string
  level: LogLevel
}

/** 操作日志条目 */
export interface OperationLogEntry extends BaseLogEntry {
  type: 'operation'
  operation: OperationType
  description: string
  username: string
  path: string
  pageTitle?: string
  extra?: Record<string, unknown>
  userAgent: string
}

/** 登录日志条目 */
export interface LoginLogEntry extends BaseLogEntry {
  type: 'login'
  result: LoginResult
  username: string
  browser?: string
  os?: string
  reason?: string
  userAgent: string
}

export type LogEntry = OperationLogEntry | LoginLogEntry

// ==================== 内存存储 ====================

const operationLogs = ref<OperationLogEntry[]>([])
const loginLogs = ref<LoginLogEntry[]>([])

// ==================== 工具函数 ====================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function parseUA(ua: string) {
  const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/?(\d+)?/)
  const osMatch = ua.match(/\((Windows NT|Mac OS X|Linux|Android|iOS)[^)]*\)/)
  return {
    browser: browserMatch ? `${browserMatch[1]} ${browserMatch[2] || ''}`.trim() : 'Unknown',
    os: osMatch ? osMatch[1].replace(/_/g, '.') : 'Unknown',
  }
}

// ==================== 核心 Composable ====================

export function useLogger() {
  const userStore = useUserStore()
  const enabled = import.meta.env.VITE_ENABLE_LOGGING === 'true'
  const shouldLogRoute = import.meta.env.VITE_LOG_ROUTE_CHANGE !== 'false'
  const username = computed(() => userStore.userInfo?.username || 'anonymous')

  /** 控制台输出（带颜色前缀） */
  function print(level: LogLevel, tag: string, msg: string, data?: unknown) {
    if (!enabled)
      return
    const styles: Record<LogLevel, string> = {
      info: 'color:#3b82f6;font-weight:bold',
      warn: 'color:#f59e0b;font-weight:bold',
      error: 'color:#ef4444;font-weight:bold',
      success: 'color:#10b981;font-weight:bold',
    }
    console.log(`%c[${tag}]%c [${formatTime(Date.now())}] ${msg}`, styles[level], 'color:#6b7280', data ?? '')
  }

  /** 记录操作日志 */
  function logOperation(operation: OperationType, description: string, extra?: Record<string, unknown>): OperationLogEntry | null {
    if (!enabled)
      return null

    const entry: OperationLogEntry = {
      id: generateId(),
      timestamp: Date.now(),
      time: formatTime(Date.now()),
      level: 'info',
      type: 'operation',
      operation,
      description,
      username: username.value,
      path: location.pathname,
      pageTitle: document.title,
      extra,
      userAgent: navigator.userAgent,
    }

    operationLogs.value.push(entry)
    print('info', '操作', `[${operation}] ${description}`, extra)
    return entry
  }

  /** 记录登录日志 */
  function logLogin(result: LoginResult, user: string, reason?: string): LoginLogEntry | null {
    if (!enabled)
      return null

    const labels: Record<LoginResult, string> = { success: '登录成功', failure: '登录失败', logout: '用户登出', timeout: '登录超时' }
    const levels: Record<LoginResult, LogLevel> = { success: 'success', failure: 'error', logout: 'info', timeout: 'warn' }
    const { browser, os } = parseUA(navigator.userAgent)

    const entry: LoginLogEntry = {
      id: generateId(),
      timestamp: Date.now(),
      time: formatTime(Date.now()),
      level: levels[result],
      type: 'login',
      result,
      username: user,
      browser,
      os,
      reason,
      userAgent: navigator.userAgent,
    }

    loginLogs.value.push(entry)
    print(levels[result], '登录', `${labels[result]} - ${user}`, reason ? { reason } : undefined)
    return entry
  }

  /** 记录路由跳转 */
  function logRouteChange(from: string, to: string, toTitle?: string): OperationLogEntry | null {
    if (!enabled || !shouldLogRoute)
      return null
    return logOperation('navigate', `页面跳转: ${from} → ${to}`, { toTitle })
  }

  // ==================== 查询 & 管理 ====================

  function getOperationLogs(limit?: number) {
    return limit ? operationLogs.value.slice(-limit) : [...operationLogs.value]
  }

  function getLoginLogs(limit?: number) {
    return limit ? loginLogs.value.slice(-limit) : [...loginLogs.value]
  }

  function clearLogs() {
    operationLogs.value = []
    loginLogs.value = []
  }

  function getLogSummary() {
    const opStats: Record<string, number> = {}
    operationLogs.value.forEach((log) => { opStats[log.operation] = (opStats[log.operation] || 0) + 1 })

    const loginStats = { success: 0, failure: 0, logout: 0, timeout: 0 }
    loginLogs.value.forEach((log) => { loginStats[log.result]++ })

    return {
      totalOperations: operationLogs.value.length,
      totalLogins: loginLogs.value.length,
      operationStats,
      loginStats,
    }
  }

  // 快捷方法
  const info = (msg: string, data?: unknown) => print('info', '日志', msg, data)
  const warn = (msg: string, data?: unknown) => print('warn', '日志', msg, data)
  const error = (msg: string, data?: unknown) => print('error', '日志', msg, data)
  const success = (msg: string, data?: unknown) => print('success', '日志', msg, data)

  return {
    enabled,
    logOperation,
    logLogin,
    logRouteChange,
    getOperationLogs,
    getLoginLogs,
    getLogSummary,
    clearLogs,
    info,
    warn,
    error,
    success,
  }
}
