import type {
  ImConnectionStatus,
  ImFrame,
  ImFrameType,
  ImTransport,
  ImTransportEvent,
} from './types';

import { ref, watch } from 'vue';

import { useWebSocket } from '@antdv/request/websocket';

/**
 * 传输适配层：把「连接」翻译成「ImFrame 流」。
 *
 * 分层位置：`core/` 第三层，是本包**唯一**允许接触实时通信的地方，而且只做适配 ——
 * socket 由 `@antdv/request/websocket` 的 `useWebSocket` 创建与管理（心跳、退避重连、事件派发都在那儿），
 * 本文件不 `new` 任何 socket。这条归属红线不是为了形式：两处各起一个心跳与重连，
 * 线上表现是"互相打断的重连风暴"，排查成本极高。
 *
 * 这一层不做什么：不改业务状态（store 的事）、不做乐观 UI、不决定消息顺序、不弹提示。
 * 它只保证：帧编得出去、解得回来、解不回来时给一条可诊断的 `frame.error` 事件而不是抛崩。
 */

// ==================== 默认参数与其理由 ====================

/**
 * 心跳 25s / 超时 5s。
 * 25s：常见网关与 LB 的空闲断开阈值是 30s，留 5s 余量；
 * 5s：覆盖弱网下一次往返的 p99 再翻倍，再小就会在地铁上把活连接判成死的。
 */
export const SOCKET_HEARTBEAT = { interval: 25_000, timeout: 5000 };

/**
 * 重连：无限重试，退避 1s 起、倍率 2、封顶 30s。
 * IM 掉线属于可用性问题而不是业务错误，所以不给"重试 N 次就放弃"；
 * 封顶 30s 是防止服务端整体重启时全量客户端同步重试把它打第二次。
 */
export const SOCKET_RECONNECT = {
  delayMultiplier: 2,
  interval: 1000,
  maxDelay: 30_000,
  retries: -1,
};

/** 断线队列上限：补发上千条积压消息只会砸出错乱的上下文，到上限丢最旧的并报诊断 */
export const OFFLINE_QUEUE_LIMIT = 200;

/** 心跳内容；不是 `ImFrame`，由 `decodeFrame` 当控制帧吞掉，不进业务流 */
export const HEARTBEAT_PING = JSON.stringify({ type: 'ping' });

// ==================== 帧编解码 ====================

export type FrameDecodeResult =
  | { detail: string; kind: 'error'; raw: string }
  | { detail: string; kind: 'ignored'; raw: string }
  | { frame: ImFrame; kind: 'frame' };

const KNOWN_TYPES = new Set<string>([
  'ack',
  'history',
  'message',
  'presence',
  'read',
  'recall',
  'send',
  'typing',
]);

/**
 * 每种帧 payload 的必填字段。
 * 只挡「字段名写错 / 少包一层」这类联调最常见的问题，不做完整 schema 校验 ——
 * 真正的契约在服务端，这里校验越严格，服务端加一个可选字段就越容易把客户端打成"坏帧"。
 */
const REQUIRED_PAYLOAD_FIELDS: Record<ImFrameType, readonly string[]> = {
  ack: ['clientId', 'status'],
  // `messages` 不列进必填：历史是双向帧，上行的翻页请求只带游标
  history: ['conversationId'],
  message: ['message'],
  presence: ['presence', 'userId'],
  read: ['userId'],
  recall: ['conversationId', 'messageId'],
  send: ['message'],
  typing: ['conversationId', 'typing', 'userId'],
};

export function encodeFrame(frame: ImFrame): string {
  return JSON.stringify(frame);
}

/**
 * 把一行 wire 数据解成 `ImFrame`。
 *
 * 单独导出并保证纯函数：坏 JSON、空行、数组根节点、未知 type、缺字段这五种脏数据
 * 都能在完全不碰网络的前提下被测到，这是本包单测不连真 socket 也能覆盖解析路径的原因。
 */
export function decodeFrame(raw: unknown): FrameDecodeResult {
  if (typeof raw !== 'string') {
    return {
      detail: `不支持二进制帧（${raw instanceof Blob ? 'Blob' : 'ArrayBuffer'}），协议约定 UTF-8 JSON`,
      kind: 'error',
      raw: '[binary]',
    };
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { detail: '空帧（服务端保活包），已忽略', kind: 'ignored', raw };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      detail: `JSON 解析失败，前 120 字符：${trimmed.slice(0, 120)}`,
      kind: 'error',
      raw: trimmed.slice(0, 512),
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      detail: '帧根节点必须是对象',
      kind: 'error',
      raw: trimmed.slice(0, 512),
    };
  }
  const type = parsed.type;
  if (typeof type !== 'string') {
    return {
      detail: '缺少字符串 type 字段',
      kind: 'error',
      raw: trimmed.slice(0, 512),
    };
  }
  // 心跳 ping/pong 会回到业务通道，这里当控制帧吞掉；不吞的话每次心跳都刷一条"坏帧"
  if (type === 'ping' || type === 'pong') {
    return {
      detail: `控制帧 ${type}`,
      kind: 'ignored',
      raw: trimmed.slice(0, 64),
    };
  }
  if (!KNOWN_TYPES.has(type)) {
    return {
      detail: `未知帧类型 ${type}，本包只认 ${[...KNOWN_TYPES].join('/')}`,
      kind: 'error',
      raw: trimmed.slice(0, 512),
    };
  }
  const payload = parsed.payload;
  if (!isPlainObject(payload)) {
    return {
      detail: `${type} 帧缺少 payload 对象`,
      kind: 'error',
      raw: trimmed.slice(0, 512),
    };
  }
  const missing = REQUIRED_PAYLOAD_FIELDS[type as ImFrameType].filter(
    (field) => payload[field] === undefined,
  );
  if (missing.length > 0) {
    return {
      detail: `${type} 帧 payload 缺少必填字段：${missing.join(', ')}`,
      kind: 'error',
      raw: trimmed.slice(0, 512),
    };
  }
  return { frame: { payload, type } as unknown as ImFrame, kind: 'frame' };
}

// ==================== 断线队列（两种 transport 共用） ====================

export interface SendQueue {
  enqueue: (frame: ImFrame) => string | undefined;
  flush: (wire: (frame: ImFrame) => void) => ImFrame[];
  size: () => number;
  snapshot: () => ImFrame[];
}

/**
 * 待发队列：断线期间的帧在这里排队，连上后按原顺序补发。
 *
 * 必须是 FIFO —— A 比 B 先发却后到，用户读到的上下文就颠倒了；
 * flush 期间新 enqueue 的帧继续排队而不是插到队首，避免补发与实时发送互相打乱。
 */
export function createSendQueue(limit = OFFLINE_QUEUE_LIMIT): SendQueue {
  const items: ImFrame[] = [];
  return {
    enqueue: (frame) => {
      items.push(frame);
      if (items.length <= limit) return undefined;
      const dropped = items.shift();
      return `断线队列超过 ${limit} 条，丢弃最旧的一条 ${dropped?.type ?? '未知'} 帧`;
    },
    flush: (wire) => {
      const sending = items.splice(0);
      for (const frame of sending) wire(frame);
      return sending;
    },
    size: () => items.length,
    snapshot: () => [...items],
  };
}

// ==================== socket transport ====================

export interface SocketTransportOptions {
  /** 每次连接时求值：token 轮换后重连自然带上新地址 */
  url: () => string | URL;
  heartbeat?: { interval?: number; timeout?: number };
  protocols?: string | string[];
  reconnect?: {
    delayMultiplier?: number;
    interval?: number;
    maxDelay?: number;
    retries?: number;
  };
}

export interface SocketTransport extends ImTransport {
  /** 断线期间积压的待发帧数，界面可据此显示"有 N 条消息待发送" */
  pending: () => number;
}

/**
 * 真实 socket 传输。
 *
 * 与 `useWebSocket` 的分工：它管连接（心跳、退避重连、事件派发），
 * 这里补它没有的三件事：帧格式校验、断线排队、把连接状态收敛成本包的 `ImTransportEvent`。
 */
export function createSocketTransport(
  options: SocketTransportOptions,
): SocketTransport {
  const status = ref<ImConnectionStatus>('CLOSED');
  const queue = createSendQueue();
  const listeners = new Set<(event: ImTransportEvent) => void>();

  const ws = useWebSocket({
    heartbeat: {
      interval: options.heartbeat?.interval ?? SOCKET_HEARTBEAT.interval,
      message: HEARTBEAT_PING,
      timeout: options.heartbeat?.timeout ?? SOCKET_HEARTBEAT.timeout,
      // 不传 pongMessage：`useWebSocket` 是在 JSON.parse 之后与字符串比较的，
      // 服务端回的通常是对象而不是 JSON 字符串，匹配不上反而漏判；控制帧统一由 decodeFrame 吞。
    },
    protocols: options.protocols,
    reconnect: {
      delayMultiplier:
        options.reconnect?.delayMultiplier ?? SOCKET_RECONNECT.delayMultiplier,
      interval: options.reconnect?.interval ?? SOCKET_RECONNECT.interval,
      maxDelay: options.reconnect?.maxDelay ?? SOCKET_RECONNECT.maxDelay,
      retries: options.reconnect?.retries ?? SOCKET_RECONNECT.retries,
    },
    url: options.url,
  });

  // status 用可写 ref 承接而不是直接把 ws.status 交出去：
  // `ImTransport.status` 声明成 `Ref<…>`，两种实现要在类型上完全同形，
  // 免得消费方拿到一个不能赋给 Ref 的 ComputedRef 而被迫到处加类型断言。
  const stopStatusSync = watch(
    ws.status,
    (value) => {
      status.value = value;
      emit({ status: value, type: 'connection' });
    },
    { immediate: true },
  );

  ws.on('open', () => {
    // 先补发再交给上层：上层在 connected 时通常要拉历史，
    // 若把积压消息排在历史之后，界面会出现"旧消息后来插"的顺序错乱。
    queue.flush((frame) => ws.send(encodeFrame(frame)));
  });

  ws.on('message', (raw) => {
    const result = decodeFrame(raw);
    if (result.kind === 'frame') {
      emit({ frame: result.frame, type: 'frame' });
      return;
    }
    if (result.kind === 'ignored') return;
    emit({
      kind: 'frame.error',
      raw: result.raw,
      reason: result.detail,
      type: 'error',
    });
  });

  ws.on('error', () => {
    // error 不等于断开：紧随其后的 close 才是终态，这里不重复改 status
    emit({
      kind: 'frame.error',
      raw: '',
      reason: 'socket 报错，等待重连',
      type: 'error',
    });
  });

  function emit(event: ImTransportEvent): void {
    // 复制一份再遍历：监听者在回调里退订是常见写法，直接遍历 Set 会跳过下一个监听者
    for (const listener of [...listeners]) listener(event);
  }

  return {
    connect: () => ws.connect(),
    disconnect: () => {
      stopStatusSync();
      ws.disconnect();
    },
    on: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    pending: queue.size,
    send: (frame) => {
      if (ws.isConnected.value) {
        ws.send(encodeFrame(frame));
        return;
      }
      const overflow = queue.enqueue(frame);
      if (overflow !== undefined) {
        emit({ kind: 'frame.error', raw: '', reason: overflow, type: 'error' });
      }
    },
    status,
  };
}

// ==================== memory transport ====================

export interface MemoryTransportOptions {
  /**
   * 可编程的本地服务端：收到上行帧后用 `emit` 回下行帧。
   * 缺省实现只把 `send` 原样回成 `message`，够跑通"发出去就看得见"。
   */
  server?: (frame: ImFrame, emit: (frame: ImFrame) => void) => void;
}

export interface MemoryTransport extends ImTransport {
  /** 不经服务端直接造一条下行帧：演示页做"对方正在输入"这类本地剧本用 */
  emitFrame: (frame: ImFrame) => void;
  /** 诊断通道，与 socket 版语义一致 */
  emitDiagnostic: (reason: string, raw?: string) => void;
  /** 本端已发出的帧，单测断言与调试面板用 */
  sentFrames: () => ImFrame[];
}

/**
 * 纯本地回环传输：单测与演示页用它，永远不碰网络。
 *
 * 它不是"socket 的近似"，而是同一契约的另一种实现：断线排队与 flush 复用 `createSendQueue`，
 * 出帧也走一遍 `encodeFrame` → `decodeFrame`。所以在这里测通的用例，
 * 换到真 socket 上不会因为"假传输更宽松"而失真 —— 这是本包敢用假传输做回归的理由。
 */
export function createMemoryTransport(
  options: MemoryTransportOptions = {},
): MemoryTransport {
  const status = ref<ImConnectionStatus>('CLOSED');
  const queue = createSendQueue();
  const listeners = new Set<(event: ImTransportEvent) => void>();
  const sent: ImFrame[] = [];
  const server = options.server ?? defaultServer;

  function emit(event: ImTransportEvent): void {
    for (const listener of [...listeners]) listener(event);
  }

  /** 下行帧投递：与 socket 版同样先过一遍编解码，脏数据在这里同样会变成 frame.error */
  function deliver(frame: ImFrame): void {
    const result = decodeFrame(encodeFrame(frame));
    if (result.kind === 'frame') {
      emit({ frame: result.frame, type: 'frame' });
      return;
    }
    emit({
      kind: result.kind === 'ignored' ? 'frame.ignored' : 'frame.error',
      raw: result.raw,
      reason: result.detail,
      type: 'error',
    });
  }

  function open(): void {
    if (status.value === 'OPEN') return;
    status.value = 'OPEN';
    emit({ status: 'OPEN', type: 'connection' });
    queue.flush((frame) => {
      sent.push(frame);
      server(frame, deliver);
    });
  }

  return {
    connect: open,
    disconnect: () => {
      status.value = 'CLOSED';
      emit({ status: 'CLOSED', type: 'connection' });
    },
    emitDiagnostic: (reason, raw = '') =>
      emit({ kind: 'frame.error', raw, reason, type: 'error' }),
    emitFrame: deliver,
    on: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    sentFrames: () => [...sent],
    send: (frame) => {
      if (status.value !== 'OPEN') {
        queue.enqueue(frame);
        return;
      }
      sent.push(frame);
      server(frame, deliver);
    },
    status,
  };
}

function defaultServer(frame: ImFrame, emit: (frame: ImFrame) => void): void {
  if (frame.type !== 'send') return;
  emit({ payload: { message: frame.payload.message }, type: 'message' });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
