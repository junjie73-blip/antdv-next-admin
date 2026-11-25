/**
 * 运行时 KV 契约
 *
 * KV 是 Mock 配置的持久化真源：接口返回值、延迟、停用开关、缓存策略与任务历史
 * 都写在这里，改完立即生效。所有键集中登记，避免各处裸写字符串导致互相覆盖。
 *
 * 与 `utils/store.ts`（面板的进程内状态 + .mock-state.json）的关系：
 * - store 负责清单/命中统计/请求日志；
 * - KV 负责"可被外部修改且需持久化"的运行参数；
 * - 两者不共享键空间，runtime 先读 KV 覆盖，再回落到 store。
 */

import { z } from 'zod';

/** useKV 的挂载前缀，对应 nitro.config.ts 的 kv.mock */
export const MOCK_KV_BASE = 'mock';

export const MOCK_KV_KEYS = {
  /** 全局运行参数 */
  GLOBAL: 'config/global',
  /** 缓存策略表 */
  CACHE_POLICIES: 'config/cache-policies',
  /** 任务执行历史 */
  TASK_HISTORY: 'tasks/history',
  /** 最近一次定时生成的样例数据 */
  GENERATED: 'generated/latest',
  /** 最近一次数据刷新的统计 */
  REFRESHED: 'refreshed/latest',
} as const;

/** 单接口覆盖项：写入后下一次请求立即生效，无需重启 */
export const routeOverrideSchema = z
  .object({
    /** 形如 `GET /system/user/list`，与清单 key 一致 */
    routeKey: z.string().min(1).max(200),
    /** false = 立即停用该接口（返回 503） */
    enabled: z.boolean().optional(),
    /** 人为延迟，0~10000ms，用于前端 loading / 超时态联调 */
    delayMs: z.number().int().min(0).max(10_000).optional(),
    /** 覆盖业务码；缺省沿用 handler 自身结果 */
    statusCode: z.number().int().min(100).max(599).optional(),
    /** 覆盖响应 data（任意 JSON 值，原样进入信封） */
    response: z.unknown().optional(),
    /** 运维备注 */
    note: z.string().max(500).optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export type RouteOverride = z.infer<typeof routeOverrideSchema>;

/** 全局参数：默认延迟对所有未单独覆盖的接口生效 */
export const globalMockConfigSchema = z
  .object({
    defaultDelayMs: z.number().int().min(0).max(10_000).default(0),
    /** 是否启用 KV 覆盖读取（关掉可一键回到纯 handler 行为） */
    overridesEnabled: z.boolean().default(true),
    updatedAt: z.string().optional(),
  })
  .strict();

export type GlobalMockConfig = z.infer<typeof globalMockConfigSchema>;

export const DEFAULT_GLOBAL_MOCK_CONFIG: GlobalMockConfig = {
  defaultDelayMs: 0,
  overridesEnabled: true,
};

/** 缓存策略：允许运行时改 TTL 与 key 规则，无需改代码 */
export const cachePolicySchema = z
  .object({
    /** 策略名，例如 `dict:list` */
    name: z.string().min(1).max(80),
    /** 缓存秒数（允许小数以支撑亚秒级 TTL），0 = 不缓存 */
    maxAge: z.number().min(0).max(86_400).default(60),
    /** stale-while-revalidate：过期先返旧值再后台刷新 */
    swr: z.boolean().default(false),
    /** 自定义缓存键模板，支持 `{field}` 占位符；缺省按参数哈希 */
    keyTemplate: z.string().max(200).optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export type CachePolicy = z.infer<typeof cachePolicySchema>;

/** 把 `GET /a/b` 编成安全的 KV 键片段 */
export function routeOverrideKey(routeKey: string): string {
  return `overrides/${encodeURIComponent(routeKey)}`;
}

/** 任务历史单条记录 */
export interface TaskHistoryEntry {
  name: string;
  at: string;
  durationMs: number;
  ok: boolean;
  result?: unknown;
  error?: string;
  /** 由 cron 触发还是手动触发 */
  source: 'schedule' | 'manual';
}
