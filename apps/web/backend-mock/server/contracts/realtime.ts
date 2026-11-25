/**
 * 实时推送契约（WebSocket）
 *
 * 服务端只发一种消息形状 `RealtimeEvent`，客户端按 `type` 分发；频道用于隔离
 * 业务域（数据变更 / 审计 / 系统事件），避免所有连接收到同一条广播。
 * 该文件不依赖 Nitro 运行时，可在单测里直接导入。
 */

import { z } from 'zod';

/** 内置频道；新增频道必须登记在这里，禁止 handler 里写裸字符串 */
export const REALTIME_CHANNELS = {
  DATA: 'mock:data',
  AUDIT: 'mock:audit',
  SYSTEM: 'mock:system',
} as const;

export type RealtimeChannel =
  (typeof REALTIME_CHANNELS)[keyof typeof REALTIME_CHANNELS];

export const DEFAULT_REALTIME_CHANNEL: RealtimeChannel =
  REALTIME_CHANNELS.DATA;

/** 服务端 → 客户端的统一事件包装 */
export interface RealtimeEvent<T = unknown> {
  /** 事件唯一 id（便于前端去重） */
  id: string;
  /** 事件类型，形如 `mock:data-generated` */
  type: string;
  channel: RealtimeChannel;
  /** ISO 8601 时间戳 */
  at: string;
  payload: T;
  /** 关联的链路号（由 HTTP 控制端点带进来时可追踪） */
  traceId?: string;
}

/** 客户端 → 服务端的命令协议 */
export const realtimeCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('subscribe'),
    channel: z.nativeEnum(REALTIME_CHANNELS),
  }),
  z.object({
    type: z.literal('unsubscribe'),
    channel: z.nativeEnum(REALTIME_CHANNELS),
  }),
  z.object({ type: z.literal('ping') }),
  z.object({
    type: z.literal('broadcast'),
    channel: z.nativeEnum(REALTIME_CHANNELS).optional(),
    event: z.object({
      type: z.string().min(1).max(80),
      payload: z.unknown().optional(),
    }),
  }),
]);

export type RealtimeCommand = z.infer<typeof realtimeCommandSchema>;

/** 连接信息（控制端点返回给面板） */
export interface RealtimeClientInfo {
  id: string;
  namespace: string;
  connectedAt: string;
  channels: RealtimeChannel[];
}

/** 广播结果 */
export interface BroadcastResult {
  /** 实际送达的连接数 */
  delivered: number;
  /** 命中的频道（空表示广播给全部连接） */
  channel?: RealtimeChannel;
  event: RealtimeEvent;
}
