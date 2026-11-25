/**
 * POST /_mock/realtime/broadcast — 从服务端向 WebSocket 连接广播事件
 *
 * body: { type: string, payload?: unknown, channel?: 'mock:data'|'mock:audit'|'mock:system' }
 * 用于前端联调"后端数据变更 → 页面实时刷新"的场景。
 */
import { defineHandler } from 'nitro';
import { readBody } from 'nitro/h3';
import { z } from 'zod';

import { ApiCode } from '../../../contracts/codes';
import {
  REALTIME_CHANNELS,
  type RealtimeChannel,
} from '../../../contracts/realtime';
import { bizError, success } from '../../../utils/response';
import {
  getMockWsHub,
  makeRealtimeEvent,
  publishRealtime,
} from '../../../utils/realtime/hub';

const broadcastSchema = z
  .object({
    type: z.string().min(1).max(80),
    payload: z.unknown().optional(),
    channel: z.nativeEnum(REALTIME_CHANNELS).optional(),
    /** 仅发给单个连接（用于点对点联调） */
    clientId: z.string().min(1).optional(),
    traceId: z.string().max(128).optional(),
  })
  .strict();

export default defineHandler(async (event) => {
  const parsed = broadcastSchema.safeParse((await readBody(event)) ?? {});
  if (!parsed.success) {
    return bizError(
      ApiCode.BAD_REQUEST,
      `参数校验失败：${parsed.error.issues[0]?.path.join('.') || 'body'} ${parsed.error.issues[0]?.message ?? ''}`.trim(),
    );
  }

  const input = parsed.data;
  const channel = (input.channel ?? REALTIME_CHANNELS.DATA) as RealtimeChannel;
  const message = makeRealtimeEvent(
    input.type,
    input.payload ?? {},
    channel,
    input.traceId,
  );

  if (input.clientId) {
    const hub = getMockWsHub();
    const delivered = hub.send(input.clientId, message);
    return success({
      delivered: delivered ? 1 : 0,
      channel,
      event: message,
    });
  }

  return success(publishRealtime(input.type, input.payload ?? {}, channel, input.traceId));
});
