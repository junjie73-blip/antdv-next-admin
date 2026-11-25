import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  REALTIME_CHANNELS,
  type RealtimeEvent,
} from '../server/contracts/realtime';
import {
  getMockWsHub,
  makeRealtimeEvent,
  publishRealtime,
  type PeerLike,
} from '../server/utils/realtime/hub';

function peer(id: string, namespace = '/_ws'): PeerLike & {
  sent: unknown[];
  subscribed: string[];
  unsubscribed: string[];
} {
  const sent: unknown[] = [];
  const subscribed: string[] = [];
  const unsubscribed: string[] = [];
  return {
    id,
    namespace,
    sent,
    subscribed,
    unsubscribed,
    send(data: unknown) {
      sent.push(data);
    },
    subscribe(topic: string) {
      subscribed.push(topic);
    },
    unsubscribe(topic: string) {
      unsubscribed.push(topic);
    },
  };
}

describe('MockWsHub 连接管理', () => {
  beforeEach(() => getMockWsHub().clear());

  it('注册连接后默认订阅数据频道，并回吐连接信息', () => {
    const hub = getMockWsHub();
    const p = peer('c1');
    const info = hub.add(p);

    expect(info.id).toBe('c1');
    expect(info.channels).toEqual([REALTIME_CHANNELS.DATA]);
    expect(info.namespace).toBe('/_ws');
    expect(p.subscribed).toEqual([REALTIME_CHANNELS.DATA]);
    expect(hub.size).toBe(1);
  });

  it('同名连接重入会替换旧连接，不会遗留幽灵订阅', () => {
    const hub = getMockWsHub();
    const oldPeer = peer('same');
    const newPeer = peer('same');
    hub.add(oldPeer);
    hub.add(newPeer, [REALTIME_CHANNELS.AUDIT]);

    expect(hub.size).toBe(1);
    expect(oldPeer.unsubscribed).toContain(REALTIME_CHANNELS.DATA);
    expect(hub.get('same')?.channels).toEqual([REALTIME_CHANNELS.AUDIT]);
  });

  it('join/leave 只改变指定连接的频道', () => {
    const hub = getMockWsHub();
    const a = peer('a');
    const b = peer('b');
    hub.add(a);
    hub.add(b);

    expect(hub.join('a', REALTIME_CHANNELS.AUDIT)).toBe(true);
    expect(hub.join('a', REALTIME_CHANNELS.AUDIT)).toBe(false);
    expect(hub.get('a')?.channels).toEqual([
      REALTIME_CHANNELS.DATA,
      REALTIME_CHANNELS.AUDIT,
    ]);
    expect(hub.get('b')?.channels).toEqual([REALTIME_CHANNELS.DATA]);

    expect(hub.leave('a', REALTIME_CHANNELS.DATA)).toBe(true);
    expect(hub.leave('a', REALTIME_CHANNELS.DATA)).toBe(false);
  });

  it('remove 后连接不再可寻址，再次删除返回 false', () => {
    const hub = getMockWsHub();
    hub.add(peer('gone'));
    expect(hub.remove('gone')).toBe(true);
    expect(hub.has('gone')).toBe(false);
    expect(hub.remove('gone')).toBe(false);
  });
});

describe('MockWsHub 消息投递', () => {
  beforeEach(() => getMockWsHub().clear());

  it('CrossWS peer 的 send 在原型上时仍能广播送达', () => {
    class ProtoPeer {
      sent: unknown[] = [];
      constructor(readonly id: string) {}
      send(data: unknown) {
        this.sent.push(data);
      }
    }
    const hub = getMockWsHub();
    const p = new ProtoPeer('proto');
    hub.add(p as unknown as PeerLike);

    const event = makeRealtimeEvent('mock:proto', { ok: true });
    expect(hub.broadcast(event).delivered).toBe(1);
    expect(p.sent).toEqual([event]);
  });

  it('点对点发送只送到目标连接', () => {
    const hub = getMockWsHub();
    const a = peer('a');
    const b = peer('b');
    hub.add(a);
    hub.add(b);
    const event = makeRealtimeEvent('mock:ping', { n: 1 });

    expect(hub.send('a', event)).toBe(true);
    expect(hub.send('missing', event)).toBe(false);
    expect(a.sent).toEqual([event]);
    expect(b.sent).toEqual([]);
  });

  it('指定频道广播只命中订阅者，不指定则全员送达', () => {
    const hub = getMockWsHub();
    const dataPeer = peer('data');
    const auditPeer = peer('audit', '/_ws');
    hub.add(dataPeer);
    hub.add(auditPeer, [REALTIME_CHANNELS.AUDIT]);

    const auditEvent = makeRealtimeEvent(
      'mock:audit',
      { action: 'delete' },
      REALTIME_CHANNELS.AUDIT,
    );
    const result = hub.broadcast(auditEvent, REALTIME_CHANNELS.AUDIT);

    expect(result.delivered).toBe(1);
    expect(result.channel).toBe(REALTIME_CHANNELS.AUDIT);
    expect(auditPeer.sent).toEqual([auditEvent]);
    expect(dataPeer.sent).toEqual([]);

    const all = makeRealtimeEvent('mock:all', {});
    expect(hub.broadcast(all).delivered).toBe(2);
    expect(dataPeer.sent).toContain(all);
    expect(auditPeer.sent).toContain(all);
  });

  it('单个连接 send 抛错不中断广播', () => {
    const hub = getMockWsHub();
    const badPeer = peer('bad');
    badPeer.send = vi.fn(() => {
      throw new Error('socket closed');
    });
    const goodPeer = peer('good');
    hub.add(badPeer);
    hub.add(goodPeer);

    const event = makeRealtimeEvent('mock:event', {});
    expect(hub.broadcast(event).delivered).toBe(1);
    expect(goodPeer.sent).toEqual([event]);
  });

  it('publishRealtime 带出 traceId 与频道', () => {
    const hub = getMockWsHub();
    const p = peer('trace');
    hub.add(p, [REALTIME_CHANNELS.SYSTEM]);

    const result = publishRealtime(
      'mock:generated',
      { count: 2 },
      REALTIME_CHANNELS.SYSTEM,
      'trace-123',
    );

    expect(result.delivered).toBe(1);
    const event = result.event as RealtimeEvent<{ count: number }>;
    expect(event.type).toBe('mock:generated');
    expect(event.channel).toBe(REALTIME_CHANNELS.SYSTEM);
    expect(event.traceId).toBe('trace-123');
    expect(event.payload.count).toBe(2);
    expect(event.id).toBeTruthy();
    expect(Number.isNaN(Date.parse(event.at))).toBe(false);
  });
});
