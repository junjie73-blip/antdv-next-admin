/**
 * Mock WebSocket 连接中心
 *
 * 纯 TypeScript 实现，不依赖 Nitro 运行时，因此可在 Vitest 里直接构造 peer 测试。
 * 实际 CrossWS peer 通过结构化接口 `PeerLike` 接入（只需要 id / send / subscribe）。
 *
 * 单例挂在 globalThis 上：Nitro 构建会把路由、任务、插件拆进不同 chunk，模块级
 * 变量可能被复制；用 well-known symbol 才能保证 HTTP 控制端点与任务广播看到的是
 * 同一份连接表。
 */

import { randomUUID } from 'node:crypto';

import {
  DEFAULT_REALTIME_CHANNEL,
  REALTIME_CHANNELS,
  type BroadcastResult,
  type RealtimeChannel,
  type RealtimeClientInfo,
  type RealtimeEvent,
} from '../../contracts/realtime';

/** CrossWS Peer 的最小结构（不引入 crossws 类型依赖，便于测试替身） */
export interface PeerLike {
  id: string;
  namespace?: string;
  send(data: unknown): void;
  subscribe?(topic: string): void;
  unsubscribe?(topic: string): void;
}

interface HubClient {
  /** 必须保存原始 peer 引用：CrossWS 的 send/subscribe 在原型上，展开对象会丢掉它们 */
  peer: PeerLike;
  namespace?: string;
  connectedAt: number;
  channels: Set<RealtimeChannel>;
}

const HUB_SYMBOL = Symbol.for('antdv.backend-mock.ws-hub');

function isChannel(value: unknown): value is RealtimeChannel {
  return Object.values(REALTIME_CHANNELS).includes(value as RealtimeChannel);
}

/** 构造一条标准事件（id / 时间戳集中生成，业务侧只给 type + payload） */
export function makeRealtimeEvent<T>(
  type: string,
  payload: T,
  channel: RealtimeChannel = DEFAULT_REALTIME_CHANNEL,
  traceId?: string,
  options: { id?: string; at?: string } = {},
): RealtimeEvent<T> {
  return {
    id: options.id ?? randomUUID(),
    type,
    channel,
    at: options.at ?? new Date().toISOString(),
    payload,
    ...(traceId ? { traceId } : {}),
  };
}

export class MockWsHub {
  private readonly clients = new Map<string, HubClient>();

  /** 注册连接；默认订阅数据频道，可按需传初始频道列表 */
  add(
    peer: PeerLike,
    channels: readonly RealtimeChannel[] = [DEFAULT_REALTIME_CHANNEL],
  ): RealtimeClientInfo {
    const client: HubClient = {
      peer,
      namespace: peer.namespace ?? '/_ws',
      connectedAt: Date.now(),
      channels: new Set(channels.filter(isChannel)),
    };
    // 同名连接重入：先摘掉旧连接，避免 Map 覆盖后旧 peer 再也收不到消息却留在订阅里
    if (this.clients.has(peer.id)) this.remove(peer.id);
    this.clients.set(peer.id, client);
    for (const channel of client.channels) client.peer.subscribe?.(channel);
    return this.info(client);
  }

  /** 连接断开；CrossWS 的 close 钩子调用 */
  remove(id: string): boolean {
    const client = this.clients.get(id);
    if (!client) return false;
    for (const channel of client.channels) client.peer.unsubscribe?.(channel);
    return this.clients.delete(id);
  }

  get(id: string): RealtimeClientInfo | undefined {
    const client = this.clients.get(id);
    return client ? this.info(client) : undefined;
  }

  has(id: string): boolean {
    return this.clients.has(id);
  }

  get size(): number {
    return this.clients.size;
  }

  /** 订阅频道；返回是否发生变化 */
  join(id: string, channel: RealtimeChannel): boolean {
    const client = this.clients.get(id);
    if (!client || !isChannel(channel) || client.channels.has(channel))
      return false;
    client.channels.add(channel);
    client.peer.subscribe?.(channel);
    return true;
  }

  /** 退订频道；不能退掉最后一个频道，保证连接始终能收到系统消息 */
  leave(id: string, channel: RealtimeChannel): boolean {
    const client = this.clients.get(id);
    if (!client || !client.channels.has(channel)) return false;
    client.channels.delete(channel);
    client.peer.unsubscribe?.(channel);
    return true;
  }

  /** 点对点发送；返回是否送达 */
  send<T>(id: string, event: RealtimeEvent<T>): boolean {
    const client = this.clients.get(id);
    if (!client) return false;
    client.peer.send(event);
    return true;
  }

  /**
   * 广播：指定频道则只发给订阅该频道的连接，不指定则发给全部连接。
   * 单个连接发送失败不影响其余连接（网络断开是常态）。
   */
  broadcast<T>(
    event: RealtimeEvent<T>,
    channel?: RealtimeChannel,
  ): BroadcastResult {
    let delivered = 0;
    for (const client of this.clients.values()) {
      if (channel && !client.channels.has(channel)) continue;
      try {
        client.peer.send(event);
        delivered += 1;
      } catch {
        // 失效连接由 close 钩子清理，这里不抛错中断广播
      }
    }
    return {
      delivered,
      ...(channel ? { channel } : {}),
      event,
    };
  }

  list(): RealtimeClientInfo[] {
    return [...this.clients.values()].map((client) => this.info(client));
  }

  /** 仅单测使用：清空连接表 */
  clear(): void {
    for (const id of [...this.clients.keys()]) this.remove(id);
  }

  private info(client: HubClient): RealtimeClientInfo {
    return {
      id: client.peer.id,
      namespace: client.namespace ?? client.peer.namespace ?? '/_ws',
      connectedAt: new Date(client.connectedAt).toISOString(),
      channels: [...client.channels],
    };
  }
}

/** 进程内唯一连接中心 */
export function getMockWsHub(): MockWsHub {
  const globalRef = globalThis as unknown as Record<symbol, MockWsHub | undefined>;
  globalRef[HUB_SYMBOL] ??= new MockWsHub();
  return globalRef[HUB_SYMBOL] as MockWsHub;
}

/** 业务侧广播快捷方法：任务、控制端点统一走这里 */
export function publishRealtime<T>(
  type: string,
  payload: T,
  channel: RealtimeChannel = DEFAULT_REALTIME_CHANNEL,
  traceId?: string,
): BroadcastResult {
  return getMockWsHub().broadcast(
    makeRealtimeEvent(type, payload, channel, traceId),
    channel,
  );
}
