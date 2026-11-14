import type { Ref } from 'vue';

import type {
  ImFrame,
  ImMessage,
  ImTransport,
  ImTransportEvent,
} from '../../src/im/index';

import { nextTick } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import {
  createMemoryTransport,
  createSendQueue,
  createSocketTransport,
  decodeFrame,
  encodeFrame,
  HEARTBEAT_PING,
  OFFLINE_QUEUE_LIMIT,
  SOCKET_HEARTBEAT,
  SOCKET_RECONNECT,
} from '../../src/im/index';

/**
 * 测试口径：**一次都不许碰真连接**。
 *
 * 本包不创建任何 socket（实时通信归 `@antdv/request`），所以这里也不允许出现那种字面量：
 * - 帧编解码是纯函数，脏数据能直接喂进去；
 * - `createMemoryTransport` 走的是同一套 encode/decode 与 `createSendQueue`，
 *   在这里测通的补发顺序，换到真 socket 上不会因为"假传输更宽松"而失真；
 * - `createSocketTransport` 用 `vi.mock` 把 `useWebSocket` 换成假对象，
 *   只验装配（默认退避与心跳参数、连上先补发、坏帧转诊断事件），不验连接本身。
 */

interface FakeSocket {
  connect: () => void;
  disconnect: () => void;
  emitTest: (event: string, raw: string) => void;
  isConnected: { value: boolean };
  on: (event: string, handler: (raw: string) => void) => void;
  rawSent: string[];
  send: (raw: string) => void;
  status: Ref<'CLOSED' | 'CONNECTING' | 'OPEN'>;
}

const socketHarness = vi.hoisted(() => ({
  calls: [] as unknown[],
  fakes: [] as unknown[],
}));

vi.mock('@antdv/request/websocket', async () => {
  const { computed, ref } = await import('vue');
  return {
    useWebSocket: (options: {
      heartbeat?: unknown;
      url: () => string | URL;
    }) => {
      const status = ref<'CLOSED' | 'CONNECTING' | 'OPEN'>('CLOSED');
      const handlers = new Map<string, Set<(raw: string) => void>>();
      const rawSent: string[] = [];
      const fire = (event: string, raw: string): void => {
        for (const handler of [...(handlers.get(event) ?? [])]) handler(raw);
      };
      const socket: FakeSocket & { options: unknown } = {
        connect: () => {
          status.value = 'OPEN';
          fire('open', '');
        },
        disconnect: () => {
          status.value = 'CLOSED';
          fire('close', '');
        },
        emitTest: fire,
        isConnected: computed(() => status.value === 'OPEN'),
        on: (event, handler) => {
          const set = handlers.get(event) ?? new Set();
          set.add(handler);
          handlers.set(event, set);
        },
        options,
        rawSent,
        send: (raw) => {
          rawSent.push(raw);
        },
        status,
      };
      socketHarness.calls.push(options);
      socketHarness.fakes.push(socket);
      return socket;
    },
  };
});

function lastSocket(): FakeSocket {
  return socketHarness.fakes.at(-1) as FakeSocket;
}

function lastOptions<T>(): T {
  return socketHarness.calls.at(-1) as T;
}

/** 收集 transport 抛出的事件，断言只看真正落到界面的那部分 */
function record(transport: ImTransport): ImTransportEvent[] {
  const events: ImTransportEvent[] = [];
  transport.on((event) => events.push(event));
  return events;
}

const testMessage: ImMessage = {
  body: '你好',
  conversationId: 'c1',
  createdAt: 1000,
  id: 'm1',
  kind: 'text',
  senderId: 'peer',
};

const messageFrame: ImFrame = {
  payload: { message: testMessage },
  type: 'message',
};

function recallFrame(messageId: string): ImFrame {
  return { payload: { conversationId: 'c1', messageId }, type: 'recall' };
}

function sentIds(frames: ImFrame[]): string[] {
  return frames.map((frame) =>
    frame.type === 'recall' ? frame.payload.messageId : frame.type,
  );
}

describe('帧编解码', () => {
  it('八种帧 encode→decode 往返一致：中间层不该丢字段，丢了就是"消息收到了但界面没有"', () => {
    const frames: ImFrame[] = [
      messageFrame,
      {
        payload: { clientId: 'local-1', serverId: 'srv-1', status: 'sent' },
        type: 'ack',
      },
      {
        payload: {
          conversationId: 'c1',
          hasMore: true,
          messages: [testMessage],
        },
        type: 'history',
      },
      {
        payload: { before: 900, conversationId: 'c1', limit: 30 },
        type: 'history',
      },
      { payload: { presence: 'online', userId: 'u1' }, type: 'presence' },
      { payload: { conversationId: 'c1', userId: 'u1' }, type: 'read' },
      { payload: { conversationId: 'c1', messageId: 'm1' }, type: 'recall' },
      {
        payload: { conversationId: 'c1', typing: true, userId: 'u1' },
        type: 'typing',
      },
      { payload: { message: testMessage }, type: 'send' },
    ];
    for (const frame of frames) {
      const result = decodeFrame(encodeFrame(frame));
      expect(result.kind, JSON.stringify(frame)).toBe('frame');
      if (result.kind === 'frame') expect(result.frame).toStrictEqual(frame);
    }
  });

  it('二进制帧判定为 error 并说明协议约定：服务端一上压缩，客户端要能说清是协议问题而不是"消息丢了"', () => {
    const result = decodeFrame(new Uint8Array([1, 2, 3]).buffer);
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.detail).toContain('UTF-8 JSON');
      // 二进制内容不进日志：raw 只留一个占位，否则诊断面板会被一串字节撑爆
      expect(result.raw).toBe('[binary]');
    }
  });

  it('空帧与心跳包算忽略而不是错误：保活每 25 秒一个，报错误就是天天弹提示', () => {
    expect(decodeFrame('').kind).toBe('ignored');
    expect(decodeFrame('   ').kind).toBe('ignored');
    expect(decodeFrame('{"type":"ping"}').kind).toBe('ignored');
    expect(decodeFrame('{"type":"pong"}').kind).toBe('ignored');
    // 心跳内容由本包发出，必须正好落进"忽略"这一支，否则每次心跳都刷一条坏帧
    expect(decodeFrame(HEARTBEAT_PING).kind).toBe('ignored');
  });

  it('半截 JSON 只把前 120 字符写进原因、前 512 字符留作 raw：整包脏数据进日志会撑爆诊断', () => {
    const huge = `{"type":"message","payload":${'x'.repeat(2000)}}`;
    const result = decodeFrame(huge.slice(0, -1));
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.detail).toContain('JSON 解析失败');
      expect(result.detail.length).toBeLessThan(200);
      expect(result.raw.length).toBeLessThanOrEqual(512);
    }
  });

  it('根节点是数组、null 或字符串时拒绝：JSON.parse 出来的不一定是对象，直接取 type 会崩', () => {
    expect(decodeFrame('[1,2,3]')).toMatchObject({
      detail: '帧根节点必须是对象',
      kind: 'error',
    });
    expect(decodeFrame('null')).toMatchObject({ kind: 'error' });
    expect(decodeFrame('"字符串"')).toMatchObject({ kind: 'error' });
  });

  it('缺 type 或 type 不是字符串时拒绝：服务端字段名写错是联调最常见的问题', () => {
    expect(decodeFrame('{}')).toMatchObject({
      detail: '缺少字符串 type 字段',
      kind: 'error',
    });
    expect(decodeFrame('{"type":123}')).toMatchObject({ kind: 'error' });
  });

  it('未知帧类型是 error 并列出认识的类型：灰度期服务端先发新帧，报错文案要能直接定位', () => {
    const result = decodeFrame('{"payload":{},"type":"reaction"}');
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.detail).toContain('reaction');
      expect(result.detail).toContain('ack');
    }
  });

  it('缺 payload 与缺必填字段分别报错，并点名缺了哪几个：只说"帧不合法"等于没给线索', () => {
    expect(decodeFrame('{"type":"message"}')).toMatchObject({
      detail: 'message 帧缺少 payload 对象',
      kind: 'error',
    });
    expect(decodeFrame('{"payload":{},"type":"ack"}')).toMatchObject({
      detail: 'ack 帧 payload 缺少必填字段：clientId, status',
      kind: 'error',
    });
    expect(
      decodeFrame('{"payload":{"userId":"u1"},"type":"presence"}'),
    ).toMatchObject({
      detail: 'presence 帧 payload 缺少必填字段：presence',
      kind: 'error',
    });
  });

  it('history 上行只带游标也算合法：messages 只在响应里必填是设计，写进必填就会把翻页打成坏帧', () => {
    expect(
      decodeFrame(
        '{"payload":{"before":900,"conversationId":"c1","limit":30},"type":"history"}',
      ).kind,
    ).toBe('frame');
  });

  it('payload 里多出来的字段原样带出：服务端加一个可选字段不该把客户端打成坏帧', () => {
    const result = decodeFrame(
      '{"payload":{"message":{"a":1},"xVersion":"2026-11"},"type":"message"}',
    );
    expect(result).toStrictEqual({
      frame: {
        payload: { message: { a: 1 }, xVersion: '2026-11' },
        type: 'message',
      },
      kind: 'frame',
    });
  });

  it('前后空白不影响解析：网关常在包尾补换行', () => {
    expect(decodeFrame(`\n ${encodeFrame(messageFrame)} \t`).kind).toBe(
      'frame',
    );
  });
});

describe('断线队列', () => {
  it('flush 严格按入队顺序补发：A 比 B 先发却后到，用户读到的上下文就颠倒了', () => {
    const queue = createSendQueue();
    for (const id of ['a', 'b', 'c']) queue.enqueue(recallFrame(id));
    expect(queue.size()).toBe(3);
    const order: string[] = [];
    const flushed = queue.flush((frame) => {
      if (frame.type === 'recall') order.push(frame.payload.messageId);
    });
    expect(order).toStrictEqual(['a', 'b', 'c']);
    expect(flushed).toHaveLength(3);
    expect(queue.size()).toBe(0);
  });

  it('flush 期间新入队的帧排到下一轮：补发与实时发送互相打乱是极难复现的那类 bug', () => {
    const queue = createSendQueue();
    queue.enqueue(recallFrame('first'));
    const order: string[] = [];
    const wire = (frame: ImFrame) => {
      if (frame.type === 'recall') {
        order.push(frame.payload.messageId);
        // 补发过程中用户又点了一条
        queue.enqueue(recallFrame('late'));
      }
    };
    queue.flush(wire);
    expect(order).toStrictEqual(['first']);
    expect(queue.size()).toBe(1);
    queue.flush(wire);
    expect(order).toStrictEqual(['first', 'late']);
  });

  it('超过上限丢最旧并返回可展示的原因：积压上千条只会砸出错乱的上下文，还吃内存', () => {
    const queue = createSendQueue(2);
    expect(queue.enqueue(recallFrame('m1'))).toBeUndefined();
    expect(queue.enqueue(recallFrame('m2'))).toBeUndefined();
    expect(queue.enqueue(recallFrame('m3'))).toContain('丢弃最旧');
    expect(queue.size()).toBe(2);
    expect(sentIds(queue.snapshot())).toStrictEqual(['m2', 'm3']);
    // 出厂上限本身就是产品口径：太小会静默丢消息，太大会砸垮服务端
    expect(OFFLINE_QUEUE_LIMIT).toBe(200);
  });

  it('snapshot 是副本：调试面板拿到的数组不该能改坏待发队列', () => {
    const queue = createSendQueue();
    queue.enqueue(recallFrame('m1'));
    const copy = queue.snapshot();
    copy.pop();
    expect(queue.size()).toBe(1);
  });
});

describe('memory transport（假实现必须守同一份契约）', () => {
  it('connect 广播 OPEN，send 的上行帧被默认服务端回成 message 下行帧：演示页要"发出去就看得见"', () => {
    const transport = createMemoryTransport();
    const events = record(transport);
    transport.connect();
    expect(transport.status.value).toBe('OPEN');
    transport.send({ payload: { message: testMessage }, type: 'send' });
    expect(events[0]).toStrictEqual({ status: 'OPEN', type: 'connection' });
    expect(events.at(-1)).toStrictEqual({ frame: messageFrame, type: 'frame' });
    expect(transport.sentFrames()).toHaveLength(1);
  });

  it('断线期间的帧在连上时按序补发且不重复：重复 flush 就是把消息发两遍', () => {
    const transport = createMemoryTransport();
    transport.send(recallFrame('m1'));
    transport.send(recallFrame('m2'));
    expect(transport.sentFrames()).toStrictEqual([]);
    transport.connect();
    expect(sentIds(transport.sentFrames())).toStrictEqual(['m1', 'm2']);
    // 再 connect 一次（幂等）不该重放
    transport.connect();
    expect(transport.sentFrames()).toHaveLength(2);
    expect(transport.status.value).toBe('OPEN');
  });

  it('disconnect 之后又 send 只是重新排队，不会假装发出去了：离线发送必须看得见"没出去"', () => {
    const transport = createMemoryTransport();
    transport.connect();
    transport.disconnect();
    expect(transport.status.value).toBe('CLOSED');
    transport.send(recallFrame('m9'));
    expect(transport.sentFrames()).toHaveLength(0);
    transport.connect();
    expect(transport.sentFrames()).toHaveLength(1);
  });

  it('下行脏帧走 error 事件而不是抛异常：一条坏消息不该打断整个消息流', () => {
    const transport = createMemoryTransport();
    const events = record(transport);
    transport.connect();
    transport.emitFrame({ payload: {}, type: 'typing' } as unknown as ImFrame);
    const last = events.at(-1);
    expect(last?.type).toBe('error');
    if (last?.type === 'error')
      expect(last.reason).toContain('typing 帧 payload 缺少必填字段');
  });

  it('emitDiagnostic 与取消订阅：卸载后还在收帧的 transport 会把状态写进已销毁的组件', () => {
    const transport = createMemoryTransport();
    const events = record(transport);
    transport.emitDiagnostic('队列超限', 'raw-快照');
    expect(events[0]).toMatchObject({
      kind: 'frame.error',
      raw: 'raw-快照',
      type: 'error',
    });
    const unsubscribe = transport.on(() => {
      throw new Error('退订之后不该再被调用');
    });
    unsubscribe();
    expect(() => transport.emitFrame(messageFrame)).not.toThrow();
  });

  it('自定义 server 能接管上行帧：演示页要造"对方不回话"的剧本，靠的就是这个口子', () => {
    const seen: string[] = [];
    const transport = createMemoryTransport({
      server: (frame, emit) => {
        seen.push(frame.type);
        if (frame.type === 'send')
          emit({ payload: { clientId: 'x', status: 'sent' }, type: 'ack' });
      },
    });
    transport.connect();
    transport.send({ payload: { message: testMessage }, type: 'send' });
    expect(seen).toStrictEqual(['send']);
    expect(transport.sentFrames()).toHaveLength(1);
  });
});

describe('socket transport（只测装配，真连接归 @antdv/request）', () => {
  it('默认参数把心跳与退避交给 request：两处各起一套重连，线上表现是互相打断的重连风暴', () => {
    const transport = createSocketTransport({
      url: () => 'wss://example.invalid/im',
    });
    const options = lastOptions<{
      heartbeat: { interval: number; message: string; timeout: number };
      reconnect: Record<string, number>;
    }>();
    expect(options.heartbeat).toStrictEqual({
      interval: SOCKET_HEARTBEAT.interval,
      message: HEARTBEAT_PING,
      timeout: SOCKET_HEARTBEAT.timeout,
    });
    expect(options.reconnect).toStrictEqual(SOCKET_RECONNECT);
    // 封顶 30s：服务端整体重启时全量客户端同步重试会把它打第二次
    expect(options.reconnect.maxDelay).toBe(30_000);
    // 无限重试：IM 掉线是可用性问题，不该"重试三次就放弃"
    expect(options.reconnect.retries).toBe(-1);
    transport.disconnect();
  });

  it('宿主覆盖心跳与退避时逐项生效，未覆盖的仍用出厂值：弱网环境与自建网关要的正是这两个旋钮', () => {
    createSocketTransport({
      heartbeat: { interval: 1000 },
      reconnect: { maxDelay: 5000 },
      url: () => 'wss://example.invalid/im',
    });
    const options = lastOptions<{
      heartbeat: { interval: number; message: string; timeout: number };
      reconnect: { interval: number; maxDelay: number };
    }>();
    expect(options.heartbeat).toStrictEqual({
      interval: 1000,
      message: HEARTBEAT_PING,
      timeout: SOCKET_HEARTBEAT.timeout,
    });
    expect(options.reconnect).toStrictEqual({
      delayMultiplier: SOCKET_RECONNECT.delayMultiplier,
      interval: SOCKET_RECONNECT.interval,
      maxDelay: 5000,
      retries: SOCKET_RECONNECT.retries,
    });
  });

  it('连上时先补发积压帧：把积压排在历史之后就会出现"旧消息后来插"', () => {
    const transport = createSocketTransport({
      url: () => 'wss://example.invalid/im',
    });
    const socket = lastSocket();
    transport.send(recallFrame('queued'));
    expect(socket.rawSent).toStrictEqual([]);
    expect(transport.pending()).toBe(1);
    transport.connect();
    expect(socket.rawSent).toHaveLength(1);
    expect(JSON.parse(socket.rawSent[0] ?? '{}')).toMatchObject({
      type: 'recall',
    });
    expect(transport.pending()).toBe(0);
  });

  it('在线时直发、连接状态同步到 transport.status：顶栏那个"已连接"徽章绑的就是它', async () => {
    const transport = createSocketTransport({
      url: () => 'wss://example.invalid/im',
    });
    const socket = lastSocket();
    const events = record(transport);
    transport.connect();
    // transport 的 status 由 watch 同步（不是同步赋值），要等一次 flush
    await nextTick();
    expect(transport.status.value).toBe('OPEN');
    transport.send(messageFrame);
    expect(socket.rawSent).toHaveLength(1);
    // 只有一条：建 transport 时那次 `immediate` 的 CLOSED 广播发生在订阅之前
    expect(events.filter((event) => event.type === 'connection')).toStrictEqual(
      [{ status: 'OPEN', type: 'connection' }],
    );
  });

  it('收到好帧抛 frame、收到坏帧抛 frame.error、socket 报错只报诊断：坏帧不能异常退出', () => {
    const transport = createSocketTransport({
      url: () => 'wss://example.invalid/im',
    });
    const socket = lastSocket();
    const events = record(transport);
    socket.emitTest('message', encodeFrame(messageFrame));
    socket.emitTest('message', '{"payload":{},"type":"ack"}');
    socket.emitTest('message', '{"type":"ping"}');
    socket.emitTest('error', '');
    expect(events.map((event) => event.type)).toStrictEqual([
      'frame',
      'error',
      'error',
    ]);
    expect(events[1]).toMatchObject({ kind: 'frame.error' });
    // 心跳包被吞掉：它既不是 frame 也不该刷成坏帧
    // error 不等于断开：紧随其后的 close 才是终态，这里只报诊断不改状态
    expect(events[2]).toMatchObject({ kind: 'frame.error', raw: '' });
    expect(transport.status.value).toBe('CLOSED');
  });

  it('disconnect 之后停止状态同步：组件卸载后还在刷连接事件，就是把状态写进已销毁的实例', async () => {
    const transport = createSocketTransport({
      url: () => 'wss://example.invalid/im',
    });
    const socket = lastSocket();
    transport.connect();
    await nextTick();
    expect(transport.status.value).toBe('OPEN');
    transport.disconnect();
    socket.status.value = 'CONNECTING';
    expect(transport.status.value).toBe('OPEN');
  });

  it('url 是函数而不是字符串：token 轮换后的重连必须带上新地址', () => {
    let current = 'wss://example.invalid/im?t=1';
    createSocketTransport({ url: () => current });
    const options = lastOptions<{ url: () => string }>();
    current = 'wss://example.invalid/im?t=2';
    expect(options.url()).toBe('wss://example.invalid/im?t=2');
  });
});
