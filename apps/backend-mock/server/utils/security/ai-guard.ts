/**
 * AI 场景安全网关（纯逻辑层）。
 *
 * 覆盖：提示词注入检测、敏感信息识别/脱敏、输出审核、风险分级与限流判定。
 * 不依赖 Nitro / pinia，接口层与单测共用同一份判定，避免"页面显示已拦截、实际放行"。
 */

import { maskText, type MaskPolicyLike } from './masking';

export type AiRiskLevel = 'critical' | 'high' | 'low' | 'medium';
export type AiGuardAction = 'audit' | 'block' | 'mask' | 'pass';

export interface AiPolicyLike {
  action: AiGuardAction;
  enabled: boolean;
  key: string;
  threshold: number;
}

export interface AiGuardResult {
  action: AiGuardAction;
  categories: string[];
  level: AiRiskLevel;
  maskedPrompt: string;
  reasons: string[];
  score: number;
}

interface Detection {
  category: string;
  pattern: RegExp;
  reason: string;
  weight: number;
}

const PROMPT_INJECTION: Detection[] = [
  {
    category: '提示词注入',
    pattern: /(忽略|无视|忘记| disregard)/i,
    reason: '检测到要求忽略既有指令的表述',
    weight: 70,
  },
  {
    category: '提示词注入',
    pattern: /(之前|上面|系统|所有).{0,8}(指令|提示|规则|prompt)/i,
    reason: '检测到试图覆盖系统提示词的表述',
    weight: 60,
  },
  {
    category: '提示词泄露',
    pattern: /(system\s*prompt|系统提示词|提示词内容)/i,
    reason: '检测到索取系统提示词的表述',
    weight: 75,
  },
  {
    category: '越权试探',
    pattern: /(jailbreak|dan\s*mode|developer\s*mode|无限制模式|开发者模式)/i,
    reason: '检测到绕过安全限制的请求',
    weight: 80,
  },
  {
    category: '越权试探',
    pattern: /(扮演|roleplay).{0,16}(管理员|admin|无限制|不受约束)/i,
    reason: '检测到模拟高权限角色的请求',
    weight: 65,
  },
];

const OUTPUT_RISK: Detection[] = [
  {
    category: '密钥泄露',
    pattern: /(?:sk|ak)-[A-Za-z0-9_-]{8,}/,
    reason: '输出中包含疑似 API 密钥',
    weight: 90,
  },
  {
    category: '输出注入',
    pattern: /<\s*script\b|javascript:|onerror\s*=/i,
    reason: '输出中包含可执行脚本片段',
    weight: 85,
  },
];

function policyOf(policies: AiPolicyLike[], key: string): AiPolicyLike | undefined {
  return policies.find((policy) => policy.key === key);
}

export function levelOfScore(score: number): AiRiskLevel {
  if (score >= 90) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/** 对提示词做风险判定；返回结果同时给出脱敏后的可审计文本 */
export function assessPrompt(
  prompt: string,
  aiPolicies: AiPolicyLike[],
  maskPolicies: MaskPolicyLike[],
): AiGuardResult {
  const text = String(prompt ?? '');
  const categories: string[] = [];
  const reasons: string[] = [];
  let score = 0;

  for (const rule of PROMPT_INJECTION) {
    if (!rule.pattern.test(text)) continue;
    score = Math.min(100, score + rule.weight);
    categories.push(rule.category);
    reasons.push(rule.reason);
  }

  const masked = maskText(text, maskPolicies);
  if (masked.categories.length) {
    categories.push(...masked.categories);
    reasons.push(`输入中包含敏感信息：${masked.categories.join('、')}`);
    score = Math.min(100, score + masked.categories.length * 30);
  }

  const injection = policyOf(aiPolicies, 'prompt_injection');
  const sensitive = policyOf(aiPolicies, 'sensitive_prompt');
  let action: AiGuardAction = 'pass';

  if (injection?.enabled && categories.some((c) => c !== '手机号' && c !== '邮箱') && score >= injection.threshold) {
    action = injection.action === 'mask' ? 'mask' : 'block';
  } else if (sensitive?.enabled && masked.categories.length && score >= sensitive.threshold) {
    action = sensitive.action === 'block' ? 'block' : 'mask';
  }

  return {
    action,
    categories: [...new Set(categories)],
    level: levelOfScore(score),
    maskedPrompt: masked.text,
    reasons: [...new Set(reasons)],
    score,
  };
}

/** 输出审核：命中密钥/脚本时按策略阻断或改写，返回可安全展示的文本 */
export function moderateOutput(
  output: string,
  aiPolicies: AiPolicyLike[],
  maskPolicies: MaskPolicyLike[],
): { categories: string[]; level: AiRiskLevel; text: string } {
  const text = String(output ?? '');
  const categories: string[] = [];
  let score = 0;
  for (const rule of OUTPUT_RISK) {
    if (!rule.pattern.test(text)) continue;
    categories.push(rule.category);
    score = Math.min(100, score + rule.weight);
  }
  const masked = maskText(text, maskPolicies);
  if (masked.categories.length) {
    categories.push(...masked.categories);
    score = Math.min(100, score + masked.categories.length * 20);
  }
  const policy = policyOf(aiPolicies, 'output_moderation');
  if (!categories.length || !policy?.enabled) {
    return { categories, level: levelOfScore(score), text };
  }
  if (policy.action === 'block') {
    return {
      categories: [...new Set(categories)],
      level: levelOfScore(score),
      text: '输出未通过安全审核，已阻断展示。请调整提问后重试。',
    };
  }
  const safe = masked.text.replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '[已移除脚本]');
  return {
    categories: [...new Set(categories)],
    level: levelOfScore(score),
    text: safe,
  };
}

/** 简易滑动窗口限流判定：仅用于 Mock 演示，真实网关应替换为 Redis/网关限流 */
export function isRateLimited(
  history: number[],
  now: number,
  limit: number,
  windowMs = 60_000,
): boolean {
  if (!Number.isFinite(limit) || limit <= 0) return false;
  const cutoff = now - windowMs;
  return history.filter((at) => at > cutoff).length >= limit;
}
