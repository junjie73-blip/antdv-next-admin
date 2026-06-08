/**
 * XSS（跨站脚本攻击）防护工具
 *
 * 防御策略：
 * 1. 输入过滤：对用户输入进行白名单/黑名单校验
 * 2. 输出转义：HTML 实体编码、URL 编码、JS 转义
 * 3. DOMPurify：使用成熟的 HTML 清理库（推荐）
 * 4. CSP 配合：Content-Security-Policy 作为纵深防御
 *
 * 使用场景：
 * - 用户输入的表单数据
 * - URL 参数处理
 * - 动态渲染的 HTML 内容
 * - 第三方数据展示
 */

// ==================== 类型定义 ====================

/** XSS 过滤选项 */
export interface XssFilterOptions {
  /** 是否允许 HTML 标签（默认 false） */
  allowHtml?: boolean
  /** 允许的 HTML 标签白名单 */
  allowedTags?: string[]
  /** 禁止的属性黑名单 */
  forbiddenAttrs?: string[]
  /** 是否移除 script 标签（默认 true） */
  stripScript?: boolean
  /** 是否移除事件处理器（默认 true） */
  stripEventHandlers?: boolean
  /** 最大输入长度（防止 DOS） */
  maxLength?: number
  /** 是否允许 URL（默认 true） */
  allowUrl?: boolean
  /** 允许的 URL 协议 */
  urlProtocols?: string[]
}

/** XSS 转义类型 */
export type EscapeType = 'html' | 'url' | 'js' | 'css' | 'attr'

// ==================== 默认配置 ====================

const DEFAULT_OPTIONS: Required<XssFilterOptions> = {
  allowHtml: false,
  allowedTags: [],
  forbiddenAttrs: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  stripScript: true,
  stripEventHandlers: true,
  maxLength: 10000,
  allowUrl: true,
  urlProtocols: ['http', 'https', 'mailto', 'tel'],
}

// ==================== 危险模式检测 ====================

/** 常见的 XSS 攻击模式 */
const XSS_PATTERNS = [
  // Script 注入
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  // 事件处理器
  /\bon\w+\s*=/gi,
  // javascript: 协议
  /javascript\s*:/gi,
  // vbscript: 协议
  /vbscript\s*:/gi,
  // data: URI (可包含脚本)
  /data:\s*text\/html/gi,
  // 表达式注入
  /expression\s*\(/gi,
  // URL 中的 JavaScript
  /[\s"']javascript\s*:/gi,
  // SVG 脚本
  /<svg[\s\S]*?>[\s\S]*?<\/svg>/gi,
  // iframe 注入
  /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
  // object/embed 标签
  /<(object|embed)[\s\S]*?>[\s\S]*?<\/\1>/gi,
  // meta refresh 重定向
  /<meta[^>]+http-equiv\s*=\s*["']?refresh/i,
  // base 标签劫持
  /<base[^>]+href/gi,
]

/**
 * 检测字符串是否包含潜在的 XSS 攻击代码
 *
 * @param input - 待检测的字符串
 * @returns 是否检测到危险内容
 */
export function detectXss(input: string): boolean {
  if (!input || typeof input !== 'string')
    return false

  // 快速检查长度限制
  if (input.length > DEFAULT_OPTIONS.maxLength) {
    console.warn('[XSS] 输入超过最大长度限制:', input.length)
    return true
  }

  // 检查危险模式
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) {
      console.warn('[XSS] 检测到潜在攻击模式:', pattern.source)
      return true
    }
  }

  return false
}

// ==================== 输出转义函数 ====================

/**
 * HTML 实体编码 — 用于插入到 HTML 内容中
 *
 * 示例：
 * escapeHtml('<script>alert(1)</script>')
 * → '&lt;script&gt;alert(1)&lt;/script&gt;'
 */
export function escapeHtml(str: string): string {
  if (!str)
    return ''

  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  }

  return String(str).replace(/[&<>"'`=/]/g, char => htmlEscapeMap[char] ?? char)
}

/**
 * URL 编码 — 用于插入到 href/src 属性中
 *
 * 攻击向量：<a href="javascript:alert(1)">
 */
export function escapeUrl(url: string): string {
  if (!url)
    return ''

  // 检测危险的协议
  const dangerousProtocols = ['javascript:', 'vbscript:', 'data:text/html']
  const lowerUrl = url.toLowerCase().trim()

  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      console.warn('[XSS] 检测到危险 URL 协议:', protocol)
      return '#unsafe-url'
    }
  }

  // 编码特殊字符
  return encodeURI(url)
}

/**
 * JavaScript 字符串转义 — 用于插入到 <script> 或 onclick 中
 *
 * 攻击向量："; alert(1); //
 */
export function escapeJs(str: string): string {
  if (!str)
    return ''

  const jsEscapeMap: Record<string, string> = {
    '\\': '\\\\',
    '\'': '\\\'',
    '"': '\\"',
    '\n': '\\n',
    '\r': '\\r',
    '\t': '\\t',
    '\0': '\\0',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029',
  }

  // 先转义反斜杠，再转义其他字符
  let escaped = String(str).replace(/\\/, '\\\\')
  escaped = escaped.replace(/['"\n\r\t\0\u2028\u2029]/g, char => jsEscapeMap[char] ?? char)

  return escaped
}

/**
 * CSS 转义 — 用于插入到 style 属性中
 *
 * 攻击向量：background: url("javascript:...")
 */
export function escapeCss(value: string): string {
  if (!value)
    return ''

  // 移除表达式和 URL
  const sanitized = value
    .replace(/expression\s*\(/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/behavior\s*:/gi, '')
    .replace(/-moz-binding\s*:/gi, '')

  // 编码特殊字符
  return sanitized.replace(/[^\w\-\s#%.!]/g, match =>
    `\\${match.charCodeAt(0).toString(16).padStart(2, '0')}`)
}

/**
 * HTML 属性值转义 — 用于插入到任意属性中
 *
 * 综合了 HTML 和 JS 转义
 */
export function escapeAttr(value: string): string {
  return escapeHtml(escapeJs(value))
}

/**
 * 智能转义 — 根据上下文自动选择转义方式
 *
 * @param value - 要转义的值
 * @param context - 转义的上下文环境
 * @returns 转义后的安全字符串
 */
export function smartEscape(value: string, context: EscapeType = 'html'): string {
  switch (context) {
    case 'html':
      return escapeHtml(value)
    case 'url':
      return escapeUrl(value)
    case 'js':
      return escapeJs(value)
    case 'css':
      return escapeCss(value)
    case 'attr':
      return escapeAttr(value)
    default:
      return escapeHtml(value)
  }
}

// ==================== 输入过滤函数 ====================

/**
 * 过滤用户输入 — 移除或转义危险内容
 *
 * @param input - 用户输入的原始字符串
 * @param options - 过滤选项
 * @returns 安全的字符串
 */
export function sanitizeInput(input: string, options: XssFilterOptions = {}): string {
  if (!input)
    return ''

  const opts = { ...DEFAULT_OPTIONS, ...options }

  // 长度截断
  let result = input.slice(0, opts.maxLength)

  // 如果不允许 HTML，直接转义所有标签
  if (!opts.allowHtml) {
    result = escapeHtml(result)
  }
  else {
    // 移除 script 标签
    if (opts.stripScript) {
      result = result.replace(/<script[\s\S]*?<\/script>/gi, '')
    }

    // 移除事件处理器
    if (opts.stripEventHandlers) {
      result = result.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
      result = result.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '')
    }
  }

  // 移除空字节（Null Byte 注入）
  result = result.replace(/\0/g, '')

  return result.trim()
}

/**
 * 过滤 URL 参数 — 确保 URL 安全
 *
 * @param url - 用户提供的 URL
 * @param allowRelative - 是否允许相对路径（默认 false）
 * @returns 安全的 URL 或空字符串
 */
export function sanitizeUrl(url: string, allowRelative = false): string {
  if (!url)
    return ''

  const trimmed = url.trim()

  // 检查协议白名单
  const safeProtocols = DEFAULT_OPTIONS.urlProtocols

  try {
    const parsed = new URL(trimmed)

    // 只允许安全协议
    if (!safeProtocols.includes(parsed.protocol.replace(':', ''))) {
      console.warn('[XSS] 不安全的 URL 协议:', parsed.protocol)
      return ''
    }

    return parsed.href
  }
  catch {
    // URL 解析失败，可能是相对路径
    if (allowRelative && /^[\w\-./]+$/.test(trimmed)) {
      return trimmed
    }

    return ''
  }
}

// ==================== DOMPurify 集成（可选）====================

/**
 * 使用深度 HTML 清理
 *
 * 当前使用内置的 sanitizeInput 进行清理。
 * 如需更强的 HTML 清理能力，可安装 dompurify：pnpm add dompurify
 */
export async function purifyHtml(dirty: string, options?: XssFilterOptions): Promise<string> {
  // 使用内置过滤器进行安全清理
  return sanitizeInput(dirty, options)
}

// ==================== Vue 指令 ====================

/** v-safe-html 指令的 binding value 类型 */
interface SafeHtmlBindingValue {
  content: string
}

/** v-safe-html 指令的 binding 类型 */
interface SafeHtmlBinding {
  value: string | (SafeHtmlBindingValue & Partial<XssFilterOptions>)
}

/** v-escape 指令的 binding 类型 */
interface EscapeBinding {
  value: string
  arg?: EscapeType
}

/**
 * v-safe-html 指令 — 安全地渲染用户提供的 HTML 内容
 *
 * 使用方式：
 * <div v-safe-html="userContent"></div>
 * <div v-safe-html="{ content: userContent, allowHtml: true }"></div>
 */
export const safeHtmlDirective = {
  mounted(el: HTMLElement, binding: SafeHtmlBinding): void {
    const rawValue = typeof binding.value === 'string'
      ? binding.value
      : binding.value.content

    const options = typeof binding.value === 'object' ? binding.value : {}

    el.innerHTML = sanitizeInput(rawValue, options)
  },

  updated(el: HTMLElement, binding: SafeHtmlBinding): void {
    const rawValue = typeof binding.value === 'string'
      ? binding.value
      : binding.value.content

    const options = typeof binding.value === 'object' ? binding.value : {}

    el.innerHTML = sanitizeInput(rawValue, options)
  },
}

/**
 * v-escape 指令 — 自动转义文本内容
 *
 * 使用方式：
 * <span v-escape="userInput"></span>
 * <span v-escape:url="url"></span>
 */
export const escapeDirective = {
  mounted(el: HTMLElement, binding: EscapeBinding): void {
    const context = binding.arg || 'html'
    el.textContent = smartEscape(binding.value, context)
  },

  updated(el: HTMLElement, binding: EscapeBinding): void {
    const context = binding.arg || 'html'
    el.textContent = smartEscape(binding.value, context)
  },
}
