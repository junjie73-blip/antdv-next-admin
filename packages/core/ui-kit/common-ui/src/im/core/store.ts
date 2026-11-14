import type { Ref } from 'vue';

import type { Conversation, ImFrame, ImMessage } from './types';

import { ref } from 'vue';

/**
 * 会话表 / 消息表 / 发件箱的纯状态层。
 *
 * 分层位置：`core/` 第二层，只依赖 `types.ts`。不认识 vue 的响应式 API、不认识传输、不认识 DOM ——
 * 每个 reducer 都是 `(state, …) => newState`，返回新对象但尽量共享未变化的引用，
 * 这样单测可以直接拿 reducer 断言，不用先造一个 store，也不担心"测试改的是同一个对象"。
 *
 * 这一层不做什么：不发帧、不做定时器、不做节流、不决定未读文案。
 * 「一条消息该不该算未读」这类口径虽然落在这里（`mergeMessages`），
 * 但「当前打开的是哪个会话」由 `use-im.ts` 传进来，store 不自己维护 UI 焦点。
 *
 * 三条必须被测试钉住的口径：
 * 1. **消息按 id 去重**：同一 id 后到的覆盖先到的，绝不追加两条；
 * 2. **同 `createdAt` 用 id 做稳定次序**：否则服务端一次重发、一次刷新就会把顺序换一遍；
 * 3. **历史分页用 `before` 时间戳游标而不是 offset**：新消息插入会让 offset 错位重复。
 */

/** 发件箱条目：一条等待 ack 的上行帧 */
export interface OutboxEntry {
  /** 乐观消息的客户端 id，ack 用它对账 */
  clientId: string;
  conversationId: string;
  frame: ImFrame;
  /** 入队时间，仅用于展示与超时，不参与排序语义 */
  queuedAt: number;
}

export interface ImState {
  conversations: Record<string, Conversation>;
  /** 会话 id -> 按（createdAt, id）**升序**排好的消息 */
  messages: Record<string, ImMessage[]>;
  outbox: OutboxEntry[];
}

export interface ImSeed {
  conversations?: Conversation[];
  messages?: ImMessage[];
}

export function createInitialState(seed: ImSeed = {}): ImState {
  const conversations: Record<string, Conversation> = {};
  for (const conversation of seed.conversations ?? []) {
    conversations[conversation.id] = { ...conversation };
  }
  const messages: Record<string, ImMessage[]> = {};
  for (const message of seed.messages ?? []) {
    const list = messages[message.conversationId] ?? [];
    list.push(message);
    messages[message.conversationId] = list;
  }
  for (const [id, list] of Object.entries(messages)) {
    const sorted = sortMessages(list);
    messages[id] = sorted;
    const conversation = conversations[id];
    // 种子只给了消息没给会话时补一条，否则列表里会出现"有消息却没会话"的孤儿
    if (conversation === undefined) {
      const last = sorted.at(-1);
      conversations[id] = {
        id,
        kind: 'single',
        lastMessageAt: last?.createdAt,
        memberIds: dedupe(sorted.map((message) => message.senderId)),
        unread: 0,
      };
    }
  }
  return { conversations, messages, outbox: [] };
}

/**
 * 稳定排序：先 `createdAt`，同时间戳比 `id`。
 *
 * 为什么必须比 id：服务端批量落库时同一毫秒的消息很常见，
 * 而 `Array.prototype.sort` 在 V8 里虽然稳定，但两次 merge 的输入顺序不同，
 * 结果顺序就会不同 —— 用户看到的症状是"刷新一次顺序变一次"。
 */
export function sortMessages(messages: readonly ImMessage[]): ImMessage[] {
  return [...messages].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** 会话插入或更新；只给局部字段时与已有会话浅合并，不要求调用方先读旧值 */
export function upsertConversation(
  state: ImState,
  conversation: Partial<Conversation> & Pick<Conversation, 'id'>,
): ImState {
  const previous = state.conversations[conversation.id];
  const next: Conversation = previous
    ? { ...previous, ...conversation }
    : {
        kind: 'single',
        memberIds: [],
        unread: 0,
        ...conversation,
        // `id` 放最后：它是唯一不许被默认值或局部字段"覆盖成别的"的字段
        id: conversation.id,
      };
  return {
    ...state,
    conversations: { ...state.conversations, [next.id]: next },
  };
}

export interface MergeMessagesOptions {
  /** 默认 true；`history` 帧必须传 false —— 翻旧消息不该把未读红点翻出来 */
  countUnread?: boolean;
  /** 自己是谁：自己发的消息永远不增加未读 */
  selfId?: string;
  /** 当前打开的会话：与合并的会话相同时不增加未读 */
  activeConversationId?: string;
  /** 默认 true；`retry` 把本地乐观消息放回时不该顺带动未读数 */
  touchConversation?: boolean;
}

/**
 * 合并消息（去重 + 稳定序 + 未读数）。
 *
 * 未读口径写在代码里而不是写在注释里：
 * `非自己发的` **且** `当前会话未读（即这次合并的不是正打开的那个会话）` 才 +1，
 * 两个条件少一个就会分别导致"自己给自己计未读"和"正在看的会话永远挂着红点"。
 */
export function mergeMessages(
  state: ImState,
  conversationId: string,
  incoming: readonly ImMessage[],
  options: MergeMessagesOptions = {},
): ImState {
  const existing = state.messages[conversationId] ?? [];
  const byId = new Map<string, ImMessage>();
  for (const message of existing) byId.set(message.id, message);

  let addedUnread = 0;
  // `countUnread: false` 必须真的不计未读：这个选项在类型里承诺了"翻页不刷红点"，
  // 只靠调用方顺带传 `touchConversation: false` 来间接兜住太脆 ——
  // 少传一个字段就会把整页历史算成未读，而这是用户最先发现、也最难解释的那种错。
  const counting = options.countUnread !== false;
  for (const message of incoming) {
    const known = byId.get(message.id);
    if (known === undefined) {
      const countable =
        counting &&
        message.senderId !== options.selfId &&
        conversationId !== options.activeConversationId;
      if (countable) addedUnread += 1;
      byId.set(message.id, message);
      continue;
    }
    // 已存在：只在"对方带来了更完整的事实"时覆盖，且不允许把已确认的消息降级回 pending
    byId.set(message.id, preferMessage(known, message));
  }

  const merged = sortMessages([...byId.values()]);
  const next: ImState = {
    ...state,
    messages: { ...state.messages, [conversationId]: merged },
  };
  if (options.touchConversation === false) return next;

  const last = merged.at(-1);
  const conversation = next.conversations[conversationId];
  const unread = (conversation?.unread ?? 0) + addedUnread;
  return upsertConversation(next, {
    id: conversationId,
    lastMessageAt: last?.createdAt ?? conversation?.lastMessageAt,
    unread,
  });
}

/**
 * 两条同 id 消息谁说了算：整体以后者为准，但**不许把已确认的消息降级回 pending**。
 *
 * 这条保护来自真实竞态：服务端 ack 已经落定 `sent`，紧接着一次 history 拉取
 * 仍带着本地那条 pending 的投影，直接覆盖会让界面上的"已发送"退回转圈。
 */
function preferMessage(known: ImMessage, incoming: ImMessage): ImMessage {
  const downgraded =
    incoming.status === 'pending' &&
    known.status !== undefined &&
    known.status !== 'pending';
  return downgraded
    ? { ...incoming, status: known.status }
    : { ...known, ...incoming };
}

/** 直接设定未读数（服务端下发的权威值），与 `mergeMessages` 的增量口径互不干扰 */
export function setUnread(
  state: ImState,
  conversationId: string,
  unread: number,
): ImState {
  const conversation = state.conversations[conversationId];
  if (conversation === undefined) return state;
  return upsertConversation(state, {
    id: conversationId,
    unread: Math.max(0, unread),
  });
}

/** 把会话标记为已读：清零未读，并把该会话里"收到的"消息置为 read */
export function markRead(state: ImState, conversationId: string): ImState {
  const conversation = state.conversations[conversationId];
  if (conversation === undefined) return state;
  const list = state.messages[conversationId] ?? [];
  const next: ImState = {
    ...state,
    messages: {
      ...state.messages,
      [conversationId]: list.map((message) =>
        // 自己发的消息不叫"已读"，它的 read 只能来自对方的 read 帧
        message.status === 'received'
          ? { ...message, status: 'read' as const }
          : message,
      ),
    },
  };
  return upsertConversation(next, { id: conversationId, unread: 0 });
}

/** 局部改一条消息：状态流转、撤回、附件回填都走这里，避免调用方整表重建 */
export function patchMessage(
  state: ImState,
  conversationId: string,
  messageId: string,
  patch: Partial<ImMessage>,
): ImState {
  const list = state.messages[conversationId];
  if (list === undefined) return state;
  const index = list.findIndex((message) => message.id === messageId);
  if (index === -1) return state;
  const nextList = [...list];
  nextList[index] = { ...list[index]!, ...patch, id: messageId };
  return {
    ...state,
    messages: { ...state.messages, [conversationId]: nextList },
  };
}

/**
 * 换消息 id：服务端 `ack` 带来规范 id 时用本地 id 换成服务端 id。
 *
 * 为什么不直接在 `patchMessage` 里支持改 id：那会让"局部更新"这个动作悄悄改掉索引本身，
 * 调用方一旦写错就把两条消息合并成一条。单列一个 reducer，代价是多一个名字，收益是误用不了。
 */
export function renameMessage(
  state: ImState,
  conversationId: string,
  fromId: string,
  toId: string,
): ImState {
  const list = state.messages[conversationId];
  if (list === undefined || fromId === toId) return state;
  const index = list.findIndex((message) => message.id === fromId);
  if (index === -1) return state;
  const nextList = [...list];
  nextList[index] = { ...list[index]!, id: toId };
  return {
    ...state,
    messages: { ...state.messages, [conversationId]: sortMessages(nextList) },
  };
}

/** 入队待发/待确认的帧：同样按 clientId 去重，重试不会堆出两条 */
export function appendOutbox(state: ImState, entry: OutboxEntry): ImState {
  if (state.outbox.some((item) => item.clientId === entry.clientId))
    return state;
  return { ...state, outbox: [...state.outbox, entry] };
}

/** ack 回来后出队 */
export function removeOutbox(state: ImState, clientId: string): ImState {
  const outbox = state.outbox.filter((entry) => entry.clientId !== clientId);
  return outbox.length === state.outbox.length ? state : { ...state, outbox };
}

/** 删会话：连带它的消息与尚未确认的发件箱条目，避免留下无法展示的孤儿数据 */
export function removeConversation(
  state: ImState,
  conversationId: string,
): ImState {
  const conversations = { ...state.conversations };
  const messages = { ...state.messages };
  delete conversations[conversationId];
  delete messages[conversationId];
  return {
    ...state,
    conversations,
    messages,
    outbox: state.outbox.filter(
      (entry) => entry.conversationId !== conversationId,
    ),
  };
}

/**
 * 历史页的游标：已加载消息里最早一条的 `createdAt`。
 * 空表返回 `undefined`，表示首次请求不带游标。
 */
export function historyCursor(
  state: ImState,
  conversationId: string,
): number | undefined {
  return (state.messages[conversationId] ?? []).at(0)?.createdAt;
}

export function messagesOf(
  state: ImState,
  conversationId: string | undefined,
): ImMessage[] {
  return conversationId === undefined
    ? []
    : (state.messages[conversationId] ?? []);
}

/**
 * 会话列表：按最后一条消息时间倒序，时间相同按 id 升序兜底。
 *
 * 兜底那一条是为了"两个会话同一秒收到消息"时列表不来回跳动；
 * 排序不影响 unread，所以已读未读的数不受这里影响。
 */
export function selectConversationList(state: ImState): Conversation[] {
  return Object.values(state.conversations)
    .map((conversation) => {
      const last = (state.messages[conversation.id] ?? []).at(-1);
      // 消息表比会话表上的时间新时以消息为准：服务端可能只推消息不推会话摘要
      return {
        ...conversation,
        lastMessageAt:
          Math.max(conversation.lastMessageAt ?? 0, last?.createdAt ?? 0) ||
          undefined,
      };
    })
    .sort((a, b) => {
      const at = a.lastMessageAt ?? 0;
      const bt = b.lastMessageAt ?? 0;
      if (at !== bt) return bt - at;
      return a.id < b.id ? -1 : 1;
    });
}

export function messagesToText(message: ImMessage): string {
  if (typeof message.body === 'string') return message.body;
  return message.body.text ?? '';
}

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)];
}

// ==================== 响应式外壳 ====================

/**
 * 把纯 reducer 包一层响应式外壳。
 *
 * 为什么还要这层而不是让组件直接调 reducer：视图要的是"改了自动刷新"，
 * 而 reducer 是 `(state, …) => state`。这层只做两件事 —— 持有一个 `Ref<ImState>`、
 * 把 reducer 的返回值整体替换回去。它刻意不含任何业务分支，也刻意**不派生 computed**：
 * 派生（会话排序、当前消息列表）留给 `use-im.ts`，这样同一套 reducer 既能被 Vue 组件用，
 * 也能被单测、Node 脚本、未来的服务端校验原样复用。
 */
export interface ImStore {
  /** 取某会话的消息（升序） */
  messagesOf: (conversationId: string | undefined) => ImMessage[];
  /** 会话列表（按最后一条消息时间倒序）；每次调用现算，调用方自己决定要不要缓存 */
  conversationList: () => Conversation[];
  /** 发件箱条目数，界面显示"N 条待发送"用 */
  outboxSize: () => number;
  /** 原始状态：给需要自己派生的宿主（虚拟列表、搜索） */
  state: Ref<ImState>;
  /** 提交一个 reducer 的结果并返回新状态，方便链式断言 */
  commit: <Args extends unknown[]>(
    reducer: (state: ImState, ...args: Args) => ImState,
    ...args: Args
  ) => ImState;
  /** 直接替换状态：`reset` 与单测夹具用 */
  replace: (state: ImState) => void;
  reset: (seed?: ImSeed) => void;
}

export function createImStore(seed: ImSeed = {}): ImStore {
  const state = ref(createInitialState(seed)) as Ref<ImState>;

  return {
    commit: (reducer, ...args) => {
      // 整体替换而不是原地改：Vue 的响应式靠引用变化触发，原地改会让浅层消费者拿不到更新
      state.value = (
        reducer as (state: ImState, ...rest: unknown[]) => ImState
      )(state.value, ...args);
      return state.value;
    },
    conversationList: () => selectConversationList(state.value),
    messagesOf: (conversationId) => messagesOf(state.value, conversationId),
    outboxSize: () => state.value.outbox.length,
    replace: (next) => {
      state.value = next;
    },
    reset: (nextSeed) => {
      state.value = createInitialState(nextSeed ?? {});
    },
    state,
  };
}
