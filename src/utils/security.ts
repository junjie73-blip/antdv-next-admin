/**
 * 安全防护模块统一导出
 *
 * 提供全面的安全防护能力：
 * - XSS 防护（输入过滤 + 输出转义 + DOMPurify）
 * - CSRF 防护（Token 生成/验证 + Double Submit Cookie）
 * - 安全指令（v-safe-html / v-escape）
 */

// CSRF 防护
export {
  createCsrfToken,
  generateCsrfToken,
  getCsrfToken,
  initCsrfProtection,
  useCsrf,
  validateCsrfToken,
  validateDoubleSubmit,
} from './csrf'

export type { CsrfConfig, CsrfResult, CsrfToken } from './csrf'

// XSS 防护
export {
  detectXss,
  escapeCss,
  escapeHtml,
  escapeJs,
  escapeUrl,
  purifyHtml,
  sanitizeInput,
  sanitizeUrl,
  smartEscape,
} from './xss'

export type { EscapeType, XssFilterOptions } from './xss'
