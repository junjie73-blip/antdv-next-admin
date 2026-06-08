/**
 * 全局指令注册中心
 *
 * 安全指令：
 * - v-safe-html: 安全渲染 HTML（XSS 防护）
 * - v-escape: 自动转义文本内容（防注入）
 * - v-permission: 权限控制
 */

// 权限控制指令
export { vPermission } from './permission/export'

export * from './permission/types'
// 安全防护指令
export { escapeDirective, safeHtmlDirective } from '@/utils/xss'
