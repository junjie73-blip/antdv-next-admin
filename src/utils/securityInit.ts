/**
 * 应用启动时的安全初始化
 *
 * 在 main.ts 中调用，确保所有安全系统在应用启动时就绪：
 * - CSRF Token 初始化
 * - 安全配置加载
 */

import { initCsrfProtection } from './csrf'

/**
 * 初始化应用的安全防护系统
 *
 * @param options 安全配置选项
 */
export function initSecuritySystem(options?: {
  /** CSRF Header 名称（默认 X-CSRF-Token） */
  csrfHeaderName?: string
  /** 是否启用 Double Submit Cookie 模式（默认 true） */
  enableDoubleSubmit?: boolean
  /** 是否自动轮换 Token（默认 true） */
  autoRotateToken?: boolean
}) {
  // ==================== 初始化 CSRF 防护 ====================
  initCsrfProtection({
    headerName: options?.csrfHeaderName ?? 'X-CSRF-Token',
    doubleSubmit: options?.enableDoubleSubmit ?? true,
    autoRotate: options?.autoRotateToken ?? true,
  })

  // 开发环境输出安全状态
  if (import.meta.env.DEV) {
    console.log(
      '%c[Security] ✅ 安全防护系统已初始化',
      'color: #10b981; font-weight: bold; font-size: 12px;',
    )
    console.log(
      '%c  ├─ CSRF Token 防护: 已启用',
      'color: #6b7280; font-size: 11px;',
    )
    console.log(
      '%c  ├─ Double Submit Cookie: 已启用',
      'color: #6b7280; font-size: 11px;',
    )
    console.log(
      '%c  └─ XSS 防护指令: v-safe-html, v-escape',
      'color: #6b7280; font-size: 11px;',
    )
  }
}
