/**
 * Mock 任务注册表（真值源）
 *
 * nitro.config.ts 的 tasks/scheduledTasks 与运行时 HTTP 清单端点都引用这份定义，
 * 避免"配置里写了、面板看不到"或反之。任务实现位于 server/tasks/mock/*.ts，
 * Nitro v3 按目录扫描，文件名即任务名（层级用 `:` 连接）。
 */

/** 调度默认关闭：快照/测试期间不希望后台任务改 KV 造成非确定性 */
export const SCHEDULER_ENABLE_ENV = 'MOCK_SCHEDULER_ENABLED';

/** 任务名先独立成常量，避免 `MockTaskName` 反向依赖 `MOCK_TASKS` 造成循环推断 */
export const MOCK_TASK_NAMES = [
  'mock:generate',
  'mock:refresh',
  'mock:cleanup',
] as const;

export type MockTaskName = (typeof MOCK_TASK_NAMES)[number];

export interface MockTaskDescriptor {
  name: MockTaskName;
  description: string;
  /** 默认 cron，仅作文档展示；实际调度在 nitro.config.ts */
  cron: string;
  /** 是否默认纳入定时调度 */
  scheduled: boolean;
}

export const MOCK_TASKS: readonly MockTaskDescriptor[] = [
  {
    name: 'mock:generate',
    description: '生成指定条数的样例 Mock 数据并写入 KV，同时推送实时事件',
    cron: '0 * * * *',
    scheduled: true,
  },
  {
    name: 'mock:refresh',
    description: '刷新热点只读数据的缓存快照并推送变更通知',
    cron: '*/5 * * * *',
    scheduled: true,
  },
  {
    name: 'mock:cleanup',
    description: '清理过期 KV 条目、截断任务历史、回收过期缓存',
    cron: '*/10 * * * *',
    scheduled: true,
  },
];

/** Nitro 调度器注入的 payload：带 scheduledTime 即视为 cron 触发 */
export function isScheduledPayload(payload: unknown): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'scheduledTime' in payload &&
    typeof (payload as { scheduledTime: unknown }).scheduledTime === 'number'
  );
}

/** 任务执行结果（HTTP 端点与单测共用） */
export interface MockTaskResult {
  ok: boolean;
  name: string;
  at: string;
  durationMs: number;
  source: 'schedule' | 'manual';
  result?: unknown;
  error?: string;
}
