import type { ComputedRef, Ref } from 'vue';

import type { ImLimits } from './limits';
import type { ImStore } from './store';
import type {
  Attachment,
  Conversation,
  ImConnectionStatus,
  ImFrame,
  ImMessage,
  ImTransport,
  MessageKind,
  Presence,
} from './types';

import {
  computed,
  getCurrentScope,
  onScopeDispose,
  ref,
  shallowRef,
} from 'vue';

import { withLimits } from './limits';
import {
  appendOutbox,
  createImStore,
  historyCursor,
  markRead as markReadReducer,
  mergeMessages,
  patchMessage,
  removeConversation as removeConversationReducer,
  removeOutbox,
  renameMessage,
  selectConversationList,
  upsertConversation,
} from './store';

/**
 * IM 的对外状态机：把 store（数据）与 transport（线路）接成一件能用的事。
 *
 * 分层位置：`core/` 顶层，本包里唯一同时认识「reducer」和「帧」的地方 ——
 * 状态迁移规则（乐观发送、ack 落定、撤回窗口、typing 节流）只写在这一个文件里，
 * 组件与宿主都不许各自复制一份，否则同一个"已发送"会出现两套判定。
 *
 * 这一层不做什么：不渲染、不读 DOM、不发提示、不 import 宿主的东西。
 * 失败与诊断只写进 `error` 并作为事件留给宿主 —— 本包连 `@antdv/popup-ui` 都不依赖，
 * 就是为了把"用会话内红条还是全局通知"的决定权留在外面。
 *
 * 三个必须被测试钉住的时序口径：
 * 1. **乐观发送**：`sendMessage` 立刻上屏（`pending`），`ack` 才转 `sent`/`read`，失败转 `failed` 且可 `retry`；
 * 2. **typing 节流**：默认 2s 内对同一会话不重复发上行帧；对端的 typing 靠超时自动清除；
 * 3. **撤回时间窗**：默认 2 分钟，判定用注入的 `now()`，所以测试里跨窗是确定的，不用真等两分钟。
 */

/** 撤回后的占位文本：本地撤回与下行 `recall` 帧共用同一字面量，界面才不会一半有字一半空 */
export const RECALLED_TEXT = '该消息已撤回';

/** 帧日志的环形上限：演示页挂一整天不能把内存吃光，只保留最近若干帧供调试面板回看 */
export const FRAME_LOG_LIMIT = 50;

export interface UseImOptions {
  limits?: Partial<ImLimits>;
  /** 时钟注入点：单测与 SSR 一定要传，撤回窗口与消息时间戳都由它决定 */
  now?: () => number;
  /** 不传则内部建一套空 store */
  store?: ImStore;
  transport: ImTransport;
  /** 当前登录人：允许函数形式，因为宿主的登录态会变（切账号、token 刷新） */
  userId: (() => string) | string;
}

export interface SendMessageInput {
  /** 不传则用当前打开的会话 */
  conversationId?: string;
  /** 文本正文；带附件时作为附件的说明文字 */
  text?: string;
  attachments?: Attachment[];
  /** 显式指定被 @ 的人；不传时由输入区算好带进来 */
  mentions?: string[];
  parentId?: string;
  replyTo?: ImMessage['replyTo'];
  /** 覆盖形态：只带附件不带文本时仍算 `file`/`image`，渲染走附件区 */
  kind?: MessageKind;
}

/** 命令式动作的结果：`ok` 之外必须带可展示的 `reason`，否则宿主只能自己猜为什么没发出去 */
export interface ImActionOutcome {
  ok: boolean;
  reason?: string;
}

export interface ImConnection {
  /** 自己发出但还没落定的消息数（发件箱长度）：断线时它就是"待发送"条数 */
  pending: ComputedRef<number>;
  /** 手动重连：自动退避归 transport 管，这里只留"用户点了重试"这一个入口 */
  reconnect: () => void;
  state: Ref<ImConnectionStatus>;
}

export interface UseImReturn {
  /** 对端 userId -> 在线状态 */
  presences: Ref<Record<string, Presence>>;
  /** 历史请求是否在途，按会话分桶；面板据此决定要不要再发一次翻页 */
  loadingHistory: Ref<Record<string, boolean>>;
  /** 正在输入的 userId，按会话分桶，超时自动清除 */
  typingPeers: Ref<Record<string, string[]>>;
  /** 最近 N 条协议帧（上下行都记），演示页与问题复现用 */
  frames: Ref<ImFrame[]>;
  connection: ImConnection;
  conversations: ComputedRef<Conversation[]>;
  /** 最近一次传输诊断（坏帧、队列超限、socket 报错），文案可直接展示 */
  error: Ref<string | undefined>;
  /** 当前会话的消息，升序 */
  messages: ComputedRef<ImMessage[]>;
  /** 连接状态字面量：顶栏徽章直接绑，不需要知道 transport 是谁 */
  status: Ref<ImConnectionStatus>;
  store: ImStore;
  transport: ImTransport;
  activeConversationId: Ref<string | undefined>;
  connect: () => void;
  loadHistory: (conversationId?: string, limit?: number) => boolean;
  markRead: (conversationId?: string) => void;
  /** 切换当前会话；传 `undefined` 回落到列表第一项。切过去即视为已读 */
  openConversation: (conversationId: string | undefined) => void;
  recall: (messageId: string, conversationId?: string) => ImActionOutcome;
  removeConversation: (conversationId: string) => void;
  retry: (messageId: string, conversationId?: string) => ImActionOutcome;
  sendMessage: (input: SendMessageInput) => ImMessage | undefined;
  /** 本端"正在输入"：内部按 `typingThrottleMs` 节流 */
  typing: (conversationId?: string) => void;
}

export function useIm(options: UseImOptions): UseImReturn {
  const limits = withLimits(options.limits);
  const now = options.now ?? (() => Date.now());
  const store = options.store ?? createImStore();
  const { transport } = options;

  const status = ref<ImConnectionStatus>(transport.status.value);
  const error = ref<string>();
  const frames = ref<ImFrame[]>([]);
  const presences = ref<Record<string, Presence>>({});
  const typingPeers = ref<Record<string, string[]>>({});
  const loadingHistory = ref<Record<string, boolean>>({});
  const activeConversationId = shallowRef<string>();

  function selfId(): string {
    return typeof options.userId === 'function'
      ? options.userId()
      : options.userId;
  }

  // 乐观消息 id 的计数器挂在实例上而不是模块级：全局计数器会让每个单测拿到的 id
  // 取决于此前跑过几个用例，断言就变成"跟着测试顺序漂移"的那种脆测试。
  let sequence = 0;
  const typingSentAt = new Map<string, number>();
  const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const conversations = computed(() =>
    selectConversationList(store.state.value),
  );
  const messages = computed(() => store.messagesOf(activeConversationId.value));

  const unsubscribe = transport.on((event) => {
    if (event.type === 'connection') {
      status.value = event.status;
      return;
    }
    if (event.type === 'error') {
      error.value = event.reason;
      return;
    }
    if (event.frame.type === 'ack' && event.frame.payload.status === 'failed') {
      // ack 带回来的失败原因是这条消息的失败原因；其余帧到达说明线路本身是好的，清掉旧诊断
      error.value = event.frame.payload.reason;
    } else {
      // 分支条件曾经是 `event.frame.type !== 'ack'`，于是"重发成功后回来的那条 ack"不清诊断：
      // 用户点了重发、消息已经发出去了，头顶还挂着"发送失败"—— 那是最容易把人赶去点重连的一条陈旧提示。
      error.value = undefined;
    }
    applyFrame(event.frame);
  });

  function logFrame(frame: ImFrame): void {
    frames.value = [...frames.value, frame].slice(-FRAME_LOG_LIMIT);
  }

  function applyFrame(frame: ImFrame): void {
    logFrame(frame);
    switch (frame.type) {
      case 'ack': {
        const { clientId, serverId, status: next } = frame.payload;
        const message = findMessage(clientId);
        if (message === undefined) return;
        store.commit(patchMessage, message.conversationId, clientId, {
          status: next,
        });
        if (serverId !== undefined && serverId !== clientId) {
          // 服务端换规范 id：先改 id 再出队，否则按 id 找消息的渲染（引用、回复）会指向空
          store.commit(
            renameMessage,
            message.conversationId,
            clientId,
            serverId,
          );
        }
        store.commit(removeOutbox, clientId);
        return;
      }
      case 'history': {
        const { conversationId, messages: page } = frame.payload;
        // 历史页一律 `countUnread: false`：翻旧消息不该把红点翻出来（未读口径见 store.ts）
        store.commit(mergeMessages, conversationId, page ?? [], {
          activeConversationId: activeConversationId.value,
          countUnread: false,
          selfId: selfId(),
          // 也不许动 lastMessageAt：否则翻到很久以前会让会话在列表里跳到最前面
          touchConversation: false,
        });
        setLoading(conversationId, false);
        return;
      }
      case 'message': {
        const { message } = frame.payload;
        store.commit(mergeMessages, message.conversationId, [message], {
          activeConversationId: activeConversationId.value,
          countUnread: true,
          selfId: selfId(),
        });
        // 正在看的会话不挂红点：收到即已读，回执由上行 `read` 帧给出去。
        // 自己那条（服务端 echo）不回执 —— 给自己发已读没有意义，还会让对方看到重复的 read。
        if (message.conversationId === activeConversationId.value) {
          markReadInternal(
            message.conversationId,
            message.senderId === selfId() ? undefined : message.id,
          );
        }
        // 对端在我输入的同一刻发来消息，界面上该收起"正在输入"而不是继续转
        clearPeerTyping(message.conversationId, message.senderId);
        return;
      }
      case 'presence': {
        presences.value = {
          ...presences.value,
          [frame.payload.userId]: frame.payload.presence,
        };
        return;
      }
      case 'read': {
        const { conversationId, messageId, userId } = frame.payload;
        // 下行 read 的语义是"对方读到了我发的消息"，所以只动我自己的那些
        const target = conversationId ?? activeConversationId.value;
        if (target === undefined || userId === selfId()) return;
        for (const message of store.messagesOf(target)) {
          if (message.senderId !== selfId()) continue;
          if (messageId !== undefined && message.id !== messageId) continue;
          if (message.status === undefined || message.status === 'read')
            continue;
          store.commit(patchMessage, target, message.id, { status: 'read' });
        }
        return;
      }
      case 'recall': {
        const { conversationId, messageId } = frame.payload;
        store.commit(patchMessage, conversationId, messageId, recalledPatch());
        return;
      }
      case 'send': {
        // 上行帧不会从 transport 回来；服务端若 echo 回来就按普通消息忽略，不做二次入队
        return;
      }
      case 'typing': {
        const { conversationId, typing: on, userId } = frame.payload;
        if (userId === selfId()) return;
        if (on) setPeerTyping(conversationId, userId);
        else clearPeerTyping(conversationId, userId);
        return;
      }
    }
  }

  /** 跨会话找一条消息：ack 与 retry 都只有 id，而 id 不带会话信息 */
  function findMessage(id: string): ImMessage | undefined {
    for (const list of Object.values(store.state.value.messages)) {
      const found = list.find((message) => message.id === id);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  function buildFrame(message: ImMessage): ImFrame {
    return { payload: { message }, type: 'send' };
  }

  function sendMessage(input: SendMessageInput): ImMessage | undefined {
    const conversationId = input.conversationId ?? activeConversationId.value;
    if (conversationId === undefined) {
      error.value = '没有当前会话，sendMessage 需要显式传 conversationId';
      return undefined;
    }
    const text = input.text ?? '';
    if (text.length > limits.maxMessageLength) {
      // 输入区本该提前禁用发送；这里再兜一层，因为宿主也可能从别处直接调 sendMessage
      error.value = `正文 ${text.length} 字，超过 ${limits.maxMessageLength} 字上限`;
      return undefined;
    }
    const attachments = input.attachments ?? [];
    if (attachments.length > limits.maxAttachmentsPerMessage) {
      error.value = `一条消息最多 ${limits.maxAttachmentsPerMessage} 个附件`;
      return undefined;
    }

    sequence += 1;
    const message: ImMessage = {
      body: attachments.length > 0 ? { attachments, text } : text,
      conversationId,
      createdAt: now(),
      id: `local-${sequence}`,
      kind: input.kind ?? (attachments.length > 0 ? 'file' : 'text'),
      senderId: selfId(),
      status: 'pending',
    };
    if (text !== '') message.text = text;
    if (input.mentions !== undefined && input.mentions.length > 0) {
      message.mentions = [...input.mentions];
    }
    if (input.parentId !== undefined) message.parentId = input.parentId;
    if (input.replyTo !== undefined) message.replyTo = input.replyTo;

    // 会话可能还没进表（宿主直接对一个全新会话发消息）
    if (store.state.value.conversations[conversationId] === undefined) {
      store.commit(upsertConversation, {
        id: conversationId,
        memberIds: [selfId()],
      });
    }
    // 自己发的消息永远不算未读，也不因为发出而改变别的会话的顺序
    store.commit(mergeMessages, conversationId, [message], {
      activeConversationId: conversationId,
      countUnread: false,
      selfId: selfId(),
    });

    const frame = buildFrame(message);
    store.commit(appendOutbox, {
      clientId: message.id,
      conversationId: message.conversationId,
      frame,
      queuedAt: now(),
    });
    transport.send(frame);
    logFrame(frame);
    return message;
  }

  function retry(messageId: string, conversationId?: string): ImActionOutcome {
    const message = findMessage(messageId);
    if (message === undefined)
      return { ok: false, reason: '要重发的消息不存在' };
    if (
      conversationId !== undefined &&
      message.conversationId !== conversationId
    ) {
      return { ok: false, reason: '消息不属于该会话' };
    }
    if (message.status !== 'failed')
      return { ok: false, reason: '只有发送失败的消息可以重发' };
    const pending: ImMessage = { ...message, status: 'pending' };
    store.commit(patchMessage, pending.conversationId, pending.id, {
      status: 'pending',
    });
    const frame = buildFrame(pending);
    store.commit(appendOutbox, {
      clientId: pending.id,
      conversationId: pending.conversationId,
      frame,
      queuedAt: now(),
    });
    transport.send(frame);
    return { ok: true };
  }

  function recall(messageId: string, conversationId?: string): ImActionOutcome {
    const message = findMessage(messageId);
    if (message === undefined)
      return { ok: false, reason: '要撤回的消息不存在' };
    if (
      conversationId !== undefined &&
      message.conversationId !== conversationId
    ) {
      return { ok: false, reason: '消息不属于该会话' };
    }
    if (message.kind === 'system')
      return { ok: false, reason: '系统消息不能撤回' };
    if (message.senderId !== selfId())
      return { ok: false, reason: '只能撤回自己发送的消息' };
    const elapsed = now() - message.createdAt;
    if (elapsed > limits.recallWindowMs) {
      return {
        ok: false,
        reason: `已超过撤回时限（${Math.round(limits.recallWindowMs / 60_000)} 分钟）`,
      };
    }
    store.commit(
      patchMessage,
      message.conversationId,
      message.id,
      recalledPatch(),
    );
    const frame: ImFrame = {
      payload: {
        conversationId: message.conversationId,
        messageId: message.id,
      },
      type: 'recall',
    };
    transport.send(frame);
    logFrame(frame);
    return { ok: true };
  }

  /**
   * 标记已读，并按需给出上行回执。
   *
   * `messageId` 只在「正在看的会话刚收到别人一条消息」时传。那一刻 `mergeMessages` 不计未读，
   * `unread` 恒为 0 —— 若只按未读判"有没有事可做"，回执会被整批吞掉，
   * 症状是对方气泡永远停在已送达，除非我先切走再切回来。
   * 反过来，打开一个本来就没有未读的会话不该白发一帧。
   */
  function markReadInternal(conversationId: string, messageId?: string): void {
    const conversation = store.state.value.conversations[conversationId];
    if (conversation === undefined) return;
    const hadUnread = conversation.unread > 0;
    // 未读为 0 也要落一次 reducer：`received` 得变成 `read`，否则状态图标一直停在未读
    store.commit(markReadReducer, conversationId);
    if (!hadUnread && messageId === undefined) return;
    const frame: ImFrame = {
      payload: {
        ...(messageId === undefined ? {} : { messageId }),
        conversationId,
        userId: selfId(),
      },
      type: 'read',
    };
    transport.send(frame);
    logFrame(frame);
  }

  function typing(conversationId?: string): void {
    const target = conversationId ?? activeConversationId.value;
    if (target === undefined) return;
    const at = now();
    const last = typingSentAt.get(target);
    // 节流：默认 2s 内的重复输入直接丢弃。连续敲字每秒发两三帧，
    // 服务端与对端都只会被淹掉，而"正在输入"这个提示本身只需要出现一次。
    if (last !== undefined && at - last < limits.typingThrottleMs) return;
    typingSentAt.set(target, at);
    const frame: ImFrame = {
      payload: { conversationId: target, typing: true, userId: selfId() },
      type: 'typing',
    };
    transport.send(frame);
    logFrame(frame);
  }

  function loadHistory(conversationId?: string, limit?: number): boolean {
    const target = conversationId ?? activeConversationId.value;
    if (target === undefined) return false;
    // 在途就忽略：翻页由滚动到底触发，抖一下就能连发五页同样的请求
    if (loadingHistory.value[target] === true) return false;
    setLoading(target, true);
    const frame: ImFrame = {
      payload: {
        before: historyCursor(store.state.value, target),
        conversationId: target,
        limit: limit ?? limits.historyPageSize,
      },
      type: 'history',
    };
    transport.send(frame);
    logFrame(frame);
    return true;
  }

  function openConversation(conversationId: string | undefined): void {
    activeConversationId.value = conversationId ?? conversations.value[0]?.id;
    if (activeConversationId.value !== undefined)
      markRead(activeConversationId.value);
  }

  function markRead(conversationId?: string): void {
    const target = conversationId ?? activeConversationId.value;
    if (target === undefined) return;
    markReadInternal(target);
  }

  function setPeerTyping(conversationId: string, userId: string): void {
    const current = typingPeers.value[conversationId] ?? [];
    if (!current.includes(userId)) {
      typingPeers.value = {
        ...typingPeers.value,
        [conversationId]: [...current, userId],
      };
    }
    const key = `${conversationId}:${userId}`;
    const previous = typingTimers.get(key);
    if (previous !== undefined) clearTimeout(previous);
    // 超时自动清除：对端关页面或断网时不会有人再发 `typing: false`，
    // 没有这一层，"某某正在输入"会永远挂在界面上。
    typingTimers.set(
      key,
      setTimeout(
        () => clearPeerTyping(conversationId, userId),
        limits.typingTimeoutMs,
      ),
    );
  }

  function clearPeerTyping(conversationId: string, userId: string): void {
    const key = `${conversationId}:${userId}`;
    const timer = typingTimers.get(key);
    if (timer !== undefined) {
      clearTimeout(timer);
      typingTimers.delete(key);
    }
    const current = typingPeers.value[conversationId];
    if (current === undefined || !current.includes(userId)) return;
    typingPeers.value = {
      ...typingPeers.value,
      [conversationId]: current.filter((id) => id !== userId),
    };
  }

  function setLoading(conversationId: string, value: boolean): void {
    loadingHistory.value = { ...loadingHistory.value, [conversationId]: value };
  }

  /** 手动释放：没有组件作用域时（单测、Node）由宿主调用 */
  function dispose(): void {
    unsubscribe();
    for (const timer of typingTimers.values()) clearTimeout(timer);
    typingTimers.clear();
  }

  // `onScopeDispose` 在作用域外调用会告警并且什么都不注册，所以先探测
  if (getCurrentScope()) onScopeDispose(dispose);

  return {
    activeConversationId,
    connect: () => transport.connect(),
    connection: {
      pending: computed(() => store.outboxSize()),
      reconnect: () => transport.connect(),
      state: status,
    },
    conversations,
    error,
    frames,
    loadHistory,
    loadingHistory,
    markRead,
    messages,
    openConversation,
    presences,
    recall,
    removeConversation: (conversationId) => {
      store.commit(removeConversationReducer, conversationId);
      if (activeConversationId.value === conversationId)
        openConversation(undefined);
    },
    retry,
    sendMessage,
    status,
    store,
    transport,
    typing,
    typingPeers,
  };
}

function recalledPatch(): Partial<ImMessage> {
  // 保留 id 与 createdAt：顺序不能因为撤回而跳动，其它消息对它的引用也还指向这个 id
  return {
    body: RECALLED_TEXT,
    kind: 'system',
    status: undefined,
    text: RECALLED_TEXT,
  };
}
