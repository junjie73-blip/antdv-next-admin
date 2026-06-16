/**
 * 数据脱敏工具函数
 *
 * 用于在前端对敏感数据进行掩码处理展示。
 * 注意：前端脱敏仅用于 UI 展示，真正的脱敏应在服务端完成，
 * 前端永远不应该接收到明文敏感数据。
 */

/** 脱敏规则配置 */
export interface MaskingRule {
  /** 规则名称 */
  name: string
  /** 匹配模式（正则） */
  pattern: RegExp
  /** 脱敏处理函数 */
  maskFn: (match: string) => string
}

/**
 * 手机号脱敏：138****1234
 */
export function maskPhone(phone: string): string {
  if (!phone)
    return phone
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

/**
 * 邮箱脱敏：***@example.com
 */
export function maskEmail(email: string): string {
  if (!email)
    return email
  const [name, domain] = email.split('@')
  if (!domain)
    return email
  return `${'*'.repeat(Math.min(name.length, 3))}@${domain}`
}

/**
 * 身份证号脱敏：110***********1234
 */
export function maskIdCard(idCard: string): string {
  if (!idCard)
    return idCard
  return idCard.replace(/(.{6}).*(.{4})/, '$1***********$2')
}

/**
 * 银行卡号脱敏：6222 **** **** 1234
 */
export function maskBankCard(cardNo: string): string {
  if (!cardNo)
    return cardNo
  const cleaned = cardNo.replace(/\s/g, '')
  return cleaned.replace(/(\d{4})\d*(\d{4})/, '$1 **** **** $2')
}

/**
 * 地址脱敏：北京市朝阳区****路
 */
export function maskAddress(address: string): string {
  if (!address)
    return address
  if (address.length <= 6)
    return '***'
  return `${address.slice(0, 6)}****`
}

/**
 * 姓名脱敏：张*
 */
export function maskName(name: string): string {
  if (!name)
    return name
  if (name.length <= 1)
    return '*'
  return name[0] + '*'.repeat(name.length - 1)
}

/**
 * 通用脱敏：保留前后 n 位，中间用 * 替换
 */
export function maskGeneric(str: string, keepStart = 2, keepEnd = 2): string {
  if (!str)
    return str
  if (str.length <= keepStart + keepEnd)
    return '*'.repeat(str.length)
  const start = str.slice(0, keepStart)
  const end = str.slice(-keepEnd)
  return start + '*'.repeat(str.length - keepStart - keepEnd) + end
}

/** 预置脱敏规则库 */
export const MASKING_RULES: MaskingRule[] = [
  { name: '手机号', pattern: /^1\d{10}$/, maskFn: maskPhone },
  { name: '邮箱', pattern: /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/, maskFn: maskEmail },
  { name: '身份证号', pattern: /^\d{17}[\dX]$/i, maskFn: maskIdCard },
  { name: '银行卡号', pattern: /^\d{13,19}$/, maskFn: maskBankCard },
]
