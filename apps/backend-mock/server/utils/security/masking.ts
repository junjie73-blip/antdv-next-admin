/**
 * 服务端数据脱敏（安全中心策略驱动）。
 *
 * 原则：
 * - 前端只拿脱敏后的数据，明文不进响应、不进审计、不进日志；
 * - 凭据类字段（password/token/secret/authorization 等）无条件整体打码，不受开关影响；
 * - PII 按策略表逐条启用，策略关闭时审计仍记录命中类别但不改内容（用于评估风险）；
 * - 纯函数、无副作用，便于单测钉住行为。
 */

export type MaskType =
  | 'apikey'
  | 'bankcard'
  | 'email'
  | 'generic'
  | 'idcard'
  | 'name'
  | 'phone';

export interface MaskPolicyLike {
  enabled: boolean;
  field: string;
  keepEnd: number;
  keepStart: number;
  type: MaskType;
}

/** 凭据字段：任何策略下都不允许以明文出现在审计/日志/响应里 */
const CREDENTIAL_KEY_RE =
  /(authorization|cookie|credential|passwd|password|secret|token|api[-_]?key)/i;

const TYPE_PATTERNS: Record<Exclude<MaskType, 'generic' | 'name'>, RegExp> = {
  apikey: /(?:sk|ak)-[A-Za-z0-9_-]{8,}/g,
  bankcard: /\d{13,19}/g,
  email: /[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+/g,
  idcard: /\d{17}[\dXx]/g,
  phone: /1[3-9]\d{9}/g,
};

const TYPE_LABELS: Record<MaskType, string> = {
  apikey: '密钥',
  bankcard: '银行卡',
  email: '邮箱',
  generic: '通用字段',
  idcard: '身份证',
  name: '姓名',
  phone: '手机号',
};

/** 保留前后各 n 位，中间打码；短串整体打码 */
export function maskByType(
  value: string,
  type: MaskType,
  keepStart = 2,
  keepEnd = 2,
): string {
  if (!value) return value;
  if (type === 'name') return value.length <= 1 ? '*' : `${value[0]}*`;
  if (type === 'apikey') return `sk-****${value.slice(-4)}`;
  if (type === 'generic')
    return value.length <= keepStart + keepEnd
      ? '*'.repeat(value.length)
      : `${value.slice(0, keepStart)}${'*'.repeat(Math.max(1, value.length - keepStart - keepEnd))}${value.slice(-keepEnd)}`;
  if (type === 'phone' && /^1\d{10}$/.test(value))
    return `${value.slice(0, 3)}****${value.slice(-4)}`;
  if (type === 'email') {
    const [local, domain] = value.split('@');
    return domain
      ? `${'*'.repeat(Math.min(local?.length ?? 1, 3))}@${domain}`
      : '***';
  }
  if (type === 'idcard')
    return `${value.slice(0, 6)}***********${value.slice(-4)}`;
  if (type === 'bankcard')
    return `${value.slice(0, 4)} **** **** ${value.slice(-4)}`;
  return maskByType(value, 'generic', keepStart, keepEnd);
}

/** 对文本按策略脱敏，返回脱敏结果与命中的类别（用于风险分级） */
export function maskText(
  text: string,
  policies: MaskPolicyLike[],
): { categories: string[]; text: string } {
  let result = String(text ?? '');
  const categories: string[] = [];
  for (const policy of policies) {
    if (!policy.enabled || policy.type === 'generic' || policy.type === 'name')
      continue;
    const pattern = TYPE_PATTERNS[policy.type];
    if (!pattern.test(result)) continue;
    pattern.lastIndex = 0;
    categories.push(TYPE_LABELS[policy.type]);
    result = result.replace(pattern, (match) =>
      maskByType(match, policy.type, policy.keepStart, policy.keepEnd),
    );
  }
  // 凭据始终打码，即使策略表未登记对应类型
  const secretPattern = TYPE_PATTERNS.apikey;
  if (secretPattern.test(result)) {
    secretPattern.lastIndex = 0;
    if (!categories.includes('密钥')) categories.push('密钥');
    result = result.replace(secretPattern, (match) =>
      maskByType(match, 'apikey'),
    );
  }
  return { categories, text: result };
}

/**
 * 结构化对象脱敏：凭据键整体打码；字符串值按策略脱敏；数组与嵌套对象递归处理。
 * 设 depth 上限与长度上限，避免超大/超深请求体拖垮审计写入。
 */
export function sanitizePayload(
  value: unknown,
  policies: MaskPolicyLike[],
  depth = 0,
): unknown {
  if (value === null || value === undefined) return null;
  if (depth > 4) return '[truncated]';
  if (Array.isArray(value))
    return value
      .slice(0, 30)
      .map((item) => sanitizePayload(item, policies, depth + 1));
  if (typeof value !== 'object') {
    if (typeof value !== 'string') return value;
    const clipped = value.length > 500 ? `${value.slice(0, 500)}…` : value;
    return maskText(clipped, policies).text;
  }

  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (CREDENTIAL_KEY_RE.test(key)) {
      output[key] = '******';
      continue;
    }
    output[key] = sanitizePayload(raw, policies, depth + 1);
  }
  return output;
}

/** 把脱敏后的对象序列化成审计详情（稳定字段顺序，便于比对） */
export function stringifyPayload(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}
