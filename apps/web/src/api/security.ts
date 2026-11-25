import { del, get, post } from './request';

// ======================== 安全评分 ========================

/** 安全评分概览 */
export function getSecurityScore() {
  return get<{
    totalScore: number;
    dimensions: {
      name: string;
      score: number;
      status: 'critical' | 'excellent' | 'good' | 'warning';
    }[];
    trend: { date: string; score: number }[];
    aiCalls?: SecurityOperations;
  }>('/security/score');
}

// ======================== 安全事件 ========================

/** 安全事件列表（分页） */
export function getSecurityEvents(params?: Record<string, unknown>) {
  return get<{
    list: SecurityEvent[];
    total: number;
  }>('/security/events/list', params);
}

// ======================== 安全统计 ========================

/** 安全统计概览（图表数据） */
export function getSecurityStats() {
  return get<{
    threatDistribution: { name: string; value: number }[];
    attackSources: { region: string; value: number }[];
    dailyEvents: { date: string; count: number }[];
    responseTime: { date: string; avgMs: number }[];
    aiThreats?: { name: string; value: number }[];
  }>('/security/stats');
}

// ======================== 实时告警 ========================

/** 告警列表 */
export function getAlertList(params?: Record<string, unknown>) {
  return get<{ list: AlertItem[]; total: number }>(
    '/security/alerts/list',
    params,
  );
}

/** 处置告警 */
export function handleAlert(alertId: string, action: string) {
  return post<void>(`/security/alerts/${alertId}/handle`, { action });
}

// ======================== 全链路审计 ========================

/** 审计台账（响应内容已由服务端脱敏） */
export function getAuditList(params?: Record<string, unknown>) {
  return get<{ list: AuditRecord[]; total: number }>(
    '/security/audit/list',
    params,
  );
}

/** 审计 / AI 调用运营指标 */
export function getAuditStats() {
  return get<SecurityOperations>('/security/audit/stats');
}

// ======================== 脱敏策略 ========================

export function getMaskPolicyList() {
  return get<MaskPolicy[]>('/security/mask-policy/list');
}

export function saveMaskPolicy(data: Record<string, unknown>) {
  return post<MaskPolicy>('/security/mask-policy/save', data);
}

export function deleteMaskPolicy(id: number) {
  return del<void>(`/security/mask-policy/${id}`);
}

// ======================== AI 安全 ========================

export function getAiPolicyList() {
  return get<AiPolicy[]>('/security/ai-policy/list');
}

export function saveAiPolicy(data: Record<string, unknown>) {
  return post<AiPolicy>('/security/ai-policy/save', data);
}

export function deleteAiPolicy(id: number) {
  return del<void>(`/security/ai-policy/${id}`);
}

export function getAiCallList(params?: Record<string, unknown>) {
  return get<{ list: AiCallRecord[]; total: number }>(
    '/security/ai-calls/list',
    params,
  );
}

/** 安全策略演练：只判定、不写审计 */
export function previewSecurityGuard(
  text: string,
  mode: 'output' | 'prompt' = 'prompt',
) {
  return post<GuardPreviewResult>('/security/guard/preview', { mode, text });
}

// ======================== 接口类型 ========================

/** 安全事件级别 */
export type SecurityEventLevel = 'critical' | 'high' | 'low' | 'medium';

/** 安全事件类型 */
export type SecurityEventType =
  | 'attack_attempt'
  | 'login_anomaly'
  | 'permission_change'
  | 'sensitive_operation';

/** 安全事件状态 */
export type SecurityEventStatus = 'dismissed' | 'handled' | 'pending';

/** 安全事件记录 */
export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  level: SecurityEventLevel;
  title: string;
  description: string;
  sourceIp: string;
  location: string;
  createdAt: string;
  status: SecurityEventStatus;
}

/** 告警项 */
export interface AlertItem {
  id: string;
  level: SecurityEventLevel;
  message: string;
  source: string;
  timestamp: string;
  actions: string[];
}

/** 风险等级（审计 / AI 调用共用） */
export type SecurityRiskLevel = 'critical' | 'high' | 'low' | 'medium';

/** 全链路审计记录 */
export interface AuditRecord {
  action: string;
  actor: string;
  createdAt: string;
  detail: string;
  id: string;
  ip: string;
  method: string;
  path: string;
  result: 'denied' | 'error' | 'success';
  risk: SecurityRiskLevel;
  traceId: string;
}

/** 数据脱敏策略 */
export interface MaskPolicy {
  enabled: boolean;
  field: string;
  id: number;
  keepEnd: number;
  keepStart: number;
  scope: string;
  type:
    | 'apikey'
    | 'bankcard'
    | 'email'
    | 'generic'
    | 'idcard'
    | 'name'
    | 'phone';
  updatedAt: string;
}

/** AI 安全策略 */
export interface AiPolicy {
  action: 'audit' | 'block' | 'mask' | 'pass';
  description: string;
  enabled: boolean;
  id: number;
  key: string;
  name: string;
  threshold: number;
  updatedAt: string;
}

/** AI 调用审计 */
export interface AiCallRecord {
  action: 'audit' | 'block' | 'mask' | 'pass';
  actor: string;
  categories: string[];
  createdAt: string;
  id: string;
  level: SecurityRiskLevel;
  prompt: string;
  traceId: string;
}

/** 安全运营汇总 */
export interface SecurityOperations {
  aiBlocked: number;
  aiHighRisk: number;
  aiMasked: number;
  aiTotal: number;
  auditDenied: number;
  auditError: number;
  auditTotal: number;
}

/** 策略演练结果 */
export interface GuardPreviewResult {
  action: 'audit' | 'block' | 'mask' | 'pass';
  categories: string[];
  level: SecurityRiskLevel;
  maskedPrompt?: string;
  reasons?: string[];
  score?: number;
  text?: string;
}
