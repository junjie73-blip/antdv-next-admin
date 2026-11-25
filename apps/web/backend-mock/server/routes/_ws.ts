/**
 * WebSocket 入口：`ws(s)://host/_ws`
 *
 * Nitro v3 的 WebSocket 走 CrossWS，路由文件与普通路由同构；`defineWebSocketHandler`
 * 从 `nitro` 显式导入（v3 已移除自动导入）。连接表不放在模块变量里，统一由
 * `getMockWsHub()` 托管，任务与 HTTP 控制端点才能广播到同一批连接。
 *
 * 客户端协议见 docs/RUNTIME_CAPABILITIES.md：
 *   ->  { "type": "subscribe", "channel": "mock:audit" }
 *   <-  { "id": "...", "type": "mock:data-generated", "channel": "mock:data",
 *         "at": "...", "payload": { ... } }
 */

import { defineWebSocketHandler } from 'nitro';

import {
  DEFAULT_REALTIME_CHANNEL,
  REALTIME_CHANNELS,
  realtimeCommandSchema,
} from '../contracts/realtime';
import {
  getMockWsHub,
  makeRealtimeEvent,
  type PeerLike,
} from '../utils/realtime/hub';

/** 默认订阅数据 + 系统频道，审计频道按需订阅（避免无关连接收到敏感事件） */
const INITIAL_CHANNELS = [
  DEFAULT_REALTIME_CHANNEL,
  REALTIME_CHANNELS.SYSTEM,
] as const;

export default defineWebSocketHandler({
  upgrade(request) {
    const url = new URL(request.url);
    const traceId = url.searchParams.get('traceId') ?? undefined;
    return { context: { traceId } };
  },

  open(peer) {
    const hub = getMockWsHub();
    const traceId = (peer.context.traceId as string | undefined) ?? undefined;
    const info = hub.add(peer as unknown as PeerLike, INITIAL_CHANNELS);
    peer.send(
      makeRealtimeEvent(
        'mock:connected',
        { client: info },
        REALTIME_CHANNELS.SYSTEM,
        traceId,
      ),
    );
    hub.broadcast(
      makeRealtimeEvent(
        'mock:client-joined',
        { id: peer.id, total: hub.size },
        REALTIME_CHANNELS.SYSTEM,
      ),
      REALTIME_CHANNELS.SYSTEM,
    );
  },

  message(peer, message) {
    const hub = getMockWsHub();
    const traceId = (peer.context.traceId as string | undefined) ?? undefined;
    let raw: unknown;
    try {
      raw = message.json();
    } catch {
      raw = message.text();
    }
    const parsed = realtimeCommandSchema.safeParse(raw);
    if (!parsed.success) {
      peer.send(
        makeRealtimeEvent(
          'mock:error',
          { message: '无法识别的 WebSocket 命令', issues: parsed.error.issues },
          REALTIME_CHANNELS.SYSTEM,
          traceId,
        ),
      );
      return;
    }

    const command = parsed.data;
    switch (command.type) {
      case 'subscribe': {
        const changed = hub.join(peer.id, command.channel);
        peer.send(
          makeRealtimeEvent(
            'mock:subscribed',
            { channel: command.channel, changed },
            REALTIME_CHANNELS.SYSTEM,
            traceId,
          ),
        );
        break;
      }
      case 'unsubscribe': {
        const changed = hub.leave(peer.id, command.channel);
        peer.send(
          makeRealtimeEvent(
            'mock:unsubscribed',
            { channel: command.channel, changed },
            REALTIME_CHANNELS.SYSTEM,
            traceId,
          ),
        );
        break;
      }
      case 'ping':
        peer.send(
          makeRealtimeEvent('mock:pong', { at: Date.now() }, REALTIME_CHANNELS.SYSTEM, traceId),
        );
        break;
      case 'broadcast': {
        const channel = command.channel ?? DEFAULT_REALTIME_CHANNEL;
        const result = hub.broadcast(
          makeRealtimeEvent(
            command.event.type,
            command.event.payload ?? {},
            channel,
            traceId,
          ),
          channel,
        );
        // 发布者也在连接表里，回执让它知道实际送达数
        peer.send(
          makeRealtimeEvent(
            'mock:broadcast-result',
            { delivered: result.delivered, channel },
            REALTIME_CHANNELS.SYSTEM,
            traceId,
          ),
        );
        break;
      }
    }
  },

  close(peer) {
    const hub = getMockWsHub();
    hub.remove(peer.id);
    hub.broadcast(
      makeRealtimeEvent(
        'mock:client-left',
        { id: peer.id, total: hub.size },
        REALTIME_CHANNELS.SYSTEM,
      ),
      REALTIME_CHANNELS.SYSTEM,
    );
  },

  error(peer, error) {
    const hub = getMockWsHub();
    hub.send(
      peer.id,
      makeRealtimeEvent(
        'mock:error',
        { message: error instanceof Error ? error.message : String(error) },
        REALTIME_CHANNELS.SYSTEM,
      ),
    );
  },
});
