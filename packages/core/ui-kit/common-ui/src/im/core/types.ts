import type { Ref } from 'vue';

/**
 * `core/` 的词汇表：整个包只认这里的形状。
 *
 * 分层位置：纯数据契约层，不含任何行为，也不认识 `@antdv/shadcn-ui`。
 * 它只 `import type { Ref } from 'vue'` —— 传输层的连接状态必须是响应式的，
 * 而"响应式"属于框架无关的观测语义，不代表这层可以碰组件；
 * 一旦这里出现 `defineComponent` / DOM / socket 相关类型，就说明有东西放错了层。
 *
 * 这一层不做什么：不做校验、不做默认值、不做序列化 ——
 * 归一化在 `attachment.ts` / `mention.ts`，状态迁移在 `store.ts` / `use-im.ts`。
 */

/** 消息形态：只这四类，新增形态要同时想清楚"渲染归谁"，否则应走宿主自定义 slot */
export type MessageKind = 'file' | 'image' | 'system' | 'text';

/** 发送状态机：pending → sent → read；网络失败 → failed →（retry）→ pending */
export type MessageStatus = 'failed' | 'pending' | 'read' | 'received' | 'sent';

/** 在线状态：与服务端 presence 帧同词表，不做同义映射，避免两套枚举漂移 */
export type Presence = 'away' | 'busy' | 'offline' | 'online';

/**
 * 会话形态。`group` / `single` 分开而不是 boolean，
 * 因为后面一定会长出第三种（广播频道），那时改枚举比改布尔语义安全。
 */
export type ConversationKind = 'group' | 'single';

/**
 * 附件元信息。
 *
 * `url` 是「已经可展示的绝对地址」；只有 `raw`（宿主传进来的 File）时不许组件自己造 blob URL，
 * 必须走 `configureIm({ createObjectUrl })` 注入，理由见 `core/attachment.ts`。
 */
export interface Attachment {
  /** 服务端或宿主存储里的稳定地址 */
  url?: string;
  /** 展示名 */
  name: string;
  /** 字节数 */
  size: number;
  /** MIME，缺失时只按扩展名推断，不猜类型 */
  type?: string;
}

/** 一条消息 */
export interface ImMessage {
  id: string;
  conversationId: string;
  senderId: string;
  createdAt: number;
  kind: MessageKind;
  /** 结构化正文：文本消息放 string，文件/图片放附件 */
  body: string | { attachments?: Attachment[]; text?: string };
  /** 纯文本投影，列表摘要与无障碍朗读用它，不要求等于 body */
  text?: string;
  status?: MessageStatus;
  /** 被 @ 的成员 id */
  mentions?: string[];
  /** 回复/线程：父消息 id */
  parentId?: string;
  /** 回复预览（标题级信息，渲染时不用再回查父消息） */
  replyTo?: { body?: string; senderId?: string; text?: string };
}

/** 一个会话 */
export interface Conversation {
  id: string;
  kind: ConversationKind;
  /** 群成员；单聊就是 [{自己}, {对方}] */
  memberIds: string[];
  title?: string;
  /** 最后一条消息时间：列表排序与时间显示都用它，缺省时回落到消息表 */
  lastMessageAt?: number;
  unread: number;
}

/** 协议帧类型：本包认识的服务器/客户端消息只有这些 */
export type ImFrameType =
  | 'ack'
  | 'history'
  | 'message'
  | 'presence'
  | 'read'
  | 'recall'
  | 'send'
  | 'typing';

export type ImDirection = 'down' | 'up';

/** 下行 `message` 帧的 payload：一条完整消息 */
export interface MessageFramePayload {
  message: ImMessage;
}

/**
 * 历史帧：`before` 是**游标**（上一页最早一条的 createdAt），不是 offset。
 * 用 offset 分页时，中间只要有人发消息，下一页就会重复或漏一条。
 * 方向复用同一类型：请求带 `before`/`limit` 不带 `messages`，响应带 `messages`。
 */
export interface HistoryFramePayload {
  before?: number;
  conversationId: string;
  hasMore?: boolean;
  limit?: number;
  messages?: ImMessage[];
}

/** 下行 `ack` 帧：服务端对某条乐观消息的处置 */
export interface AckFramePayload {
  /** 客户端乐观 id */
  clientId: string;
  /** 服务端规范 id，缺省表示不换 id */
  serverId?: string;
  status: Extract<MessageStatus, 'failed' | 'read' | 'sent'>;
  reason?: string;
}

/** 下行 `presence` 帧 */
export interface PresenceFramePayload {
  presence: Presence;
  userId: string;
}

/** 下行 `read` 帧：对方把某会话（或某条消息）读到了哪里 */
export interface ReadFramePayload {
  conversationId?: string;
  messageId?: string;
  userId: string;
}

/** 下行 `typing` 帧 */
export interface TypingFramePayload {
  conversationId: string;
  typing: boolean;
  userId: string;
}

/** 下行 `recall` 帧 */
export interface RecallFramePayload {
  conversationId: string;
  messageId: string;
}

export interface SendFramePayload {
  message: ImMessage;
}

/**
 * 按方向列出每种帧的 payload。
 *
 * `history` / `read` / `recall` / `typing` 双向共用同一形状（请求带游标、响应带消息），
 * 所以不写条件类型 —— 给它们加方向分支只会让调用方多写一次 `Extract`。
 * 单向的三类用 `never` 卡住：发一个 `ack` 帧上行是协议错误，应该在类型层就编译不过。
 */
export interface FrameByDirection<T extends ImDirection> {
  ack: T extends 'down' ? AckFramePayload : never;
  history: HistoryFramePayload;
  message: T extends 'down' ? MessageFramePayload : never;
  presence: T extends 'down' ? PresenceFramePayload : never;
  read: ReadFramePayload;
  recall: RecallFramePayload;
  send: T extends 'up' ? SendFramePayload : never;
  typing: TypingFramePayload;
}

export type ImFrameOf<T extends ImFrameType, D extends ImDirection = 'down'> = {
  payload: FrameByDirection<D>[T];
  type: T;
};

/**
 * 协议帧的联合类型。
 *
 * `send` 只上行、`ack` 只下行，其余四类双向 —— 这里刻意写成**带方向的联合**而不是
 * `{ type: ImFrameType; payload: unknown }`：`use-im.ts` 与 transport 的回调里到处在 switch，
 * 收窄到具体 payload 是它能不能不写 `as` 的前提（仓库硬约束里就有「禁止 any」）。
 */
export type ImFrame =
  | ImFrameOf<'ack', 'down'>
  | ImFrameOf<'history', 'down'>
  | ImFrameOf<'history', 'up'>
  | ImFrameOf<'message', 'down'>
  | ImFrameOf<'presence', 'down'>
  | ImFrameOf<'read', 'down'>
  | ImFrameOf<'read', 'up'>
  | ImFrameOf<'recall', 'down'>
  | ImFrameOf<'recall', 'up'>
  | ImFrameOf<'send', 'up'>
  | ImFrameOf<'typing', 'down'>
  | ImFrameOf<'typing', 'up'>;

/** 连接状态：与 `@antdv/request` 的字面量状态对齐，本包不发明第三套词表 */
export type ImConnectionStatus = 'CLOSED' | 'CONNECTING' | 'OPEN';

/**
 * 传输层对外抛的事件。
 *
 * 为什么把坏帧当成事件而不是异常：服务端灰度期间吐半截 JSON、发错协议版本是常态，
 * 一条 `frame.error` 让界面显示"连接异常"就够了；抛出去会把整条消息流打断，
 * 用户看到的是"IM 挂了"而不是"有一条消息没解析出来"。
 */
export type ImTransportEvent =
  | { frame: ImFrame; type: 'frame' }
  | {
      kind: 'frame.error' | 'frame.ignored';
      reason: string;
      raw: string;
      type: 'error';
    }
  | { status: ImConnectionStatus; type: 'connection' };

/**
 * 传输契约。
 *
 * 之所以由本包定义而不是直接把 `useWebSocket` 的返回值交给上层：`use-im.ts` 只想要
 * 「发帧 / 收帧 / 连接状态」三件事，socket 的 open/close/心跳/退避细节全部挡在 `transport.ts` 里，
 * 单测才能用 memory transport 把网络整条换掉 —— 这也是仓库红线「实时通信只住在 `@antdv/request`」
 * 能成立的前提：包内其他任何一层都不该知道 socket 长什么样。
 */
export interface ImTransport {
  connect: () => void;
  disconnect: () => void;
  /** 取消订阅用返回的函数，不暴露 `off(event, handler)`：调用方不该记住事件名与回调的配对 */
  on: (listener: (event: ImTransportEvent) => void) => () => void;
  send: (frame: ImFrame) => void;
  status: Ref<ImConnectionStatus>;
}
