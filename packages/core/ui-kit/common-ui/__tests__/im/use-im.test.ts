import type {
  ImConnectionStatus,
  ImFrame,
  ImLimits,
  ImMessage,
  ImSeed,
  ImTransport,
  ImTransportEvent,
  UseImReturn,
} from '../../src/im/index';

import { effectScope, ref } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createImStore,
  FRAME_LOG_LIMIT,
  RECALLED_TEXT,
  useIm,
} from '../../src/im/index';

/**
 * 状态机的测试口径：**不碰计时器、不碰网络、时钟自己给**。
 *
 * `useIm` 是三层里唯一同时认识 reducer 与帧的地方，所以这里喂给它的 transport 是一个
 * 手写的假对象（`ImTransport` 契约只有「发/收/状态」三件事）：
 * - 下行帧直接给监听器，不经编解码 —— 解析路径已由 `transport.test.ts` 钉住，
 *   这里再叠一层会让「到底是状态机错了还是编解码错了」变成两难；
 * - `now()` 注入：撤回窗口、乐观消息时间戳、typing 节流都由它决定，
 *   于是「正好卡在窗口边界」这种用例是确定的而不是靠 `vi.waitFor` 等；
 * - 只有对端 typing 的自动清除真的需要超时，那一条用假计时器，其余全部用假时钟跨过窗口。
 *
 * 断言尽量写成"发出的帧序列"而不是"调了几次 send"：上行帧就是这一层的对外契约，
 * 宿主联调抓包看到的就是它。
 */

afterEach(() => {
  vi.useRealTimers();
});

function message(id: string, extra: Partial<ImMessage> = {}): ImMessage {
  return {
    body: `正文 ${id}`,
    conversationId: 'c1',
    createdAt: 1000,
    id,
    kind: 'text',
    senderId: 'peer',
    ...extra,
  };
}

function seeded(conversationId: string, messages: ImMessage[] = []): ImSeed {
  return {
    conversations: [
      {
        id: conversationId,
        kind: 'single',
        lastMessageAt: 900,
        memberIds: ['me', 'peer'],
        unread: 0,
      },
    ],
    messages,
  };
}

interface Harness {
  connectCalls: number;
  im: UseImReturn;
  sent: ImFrame[];
  /** 推进注入的时钟（撤回窗口、typing 节流靠它跨，不靠真等） */
  setNow: (value: number) => void;
  /** 模拟一条下行帧 */
  push: (frame: ImFrame) => void;
  /** 模拟传输诊断（坏帧、队列超限、socket 报错） */
  diagnose: (reason: string, raw?: string) => void;
  /** 模拟连接状态变化 */
  setStatus: (next: ImConnectionStatus) => void;
  transport: ImTransport;
}

function setup(
  input: {
    limits?: Partial<ImLimits>;
    now?: number;
    seed?: ImSeed;
    status?: ImConnectionStatus;
    userId?: (() => string) | string;
  } = {},
): Harness {
  let clockValue = input.now ?? 1_000_000;
  const sent: ImFrame[] = [];
  const status = ref<ImConnectionStatus>(input.status ?? 'OPEN');
  const listeners = new Set<(event: ImTransportEvent) => void>();
  let connectCalls = 0;

  function emit(event: ImTransportEvent): void {
    for (const listener of [...listeners]) listener(event);
  }

  const transport: ImTransport = {
    connect: () => {
      connectCalls += 1;
      status.value = 'OPEN';
      emit({ status: 'OPEN', type: 'connection' });
    },
    disconnect: () => {
      status.value = 'CLOSED';
      emit({ status: 'CLOSED', type: 'connection' });
    },
    on: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    send: (frame) => {
      sent.push(frame);
    },
    status,
  };

  const im = useIm({
    limits: input.limits,
    now: () => clockValue,
    store: createImStore(input.seed ?? {}),
    transport,
    userId: input.userId ?? 'me',
  });

  return {
    get connectCalls() {
      return connectCalls;
    },
    diagnose: (reason, raw = '') =>
      emit({ kind: 'frame.error', raw, reason, type: 'error' }),
    im,
    push: (frame) => emit({ frame, type: 'frame' }),
    sent,
    setNow: (value) => {
      clockValue = value;
    },
    setStatus: (next) => {
      status.value = next;
      emit({ status: next, type: 'connection' });
    },
    transport,
  };
}

/** 只看某一类上行帧，断言时不必先过滤再担心漏了别的帧 */
function uplink(sent: ImFrame[], type: ImFrame['type']): ImFrame[] {
  return sent.filter((frame) => frame.type === type);
}

function payloadOf(frame: ImFrame | undefined): Record<string, unknown> {
  return (frame?.payload ?? {}) as unknown as Record<string, unknown>;
}

describe('连接与状态镜像', () => {
  it('初始状态取 transport 的当下值而不是写死 CLOSED：重连中的面板不该一上来就显示已断开', () => {
    const { im } = setup({ status: 'CONNECTING' });
    expect(im.status.value).toBe('CONNECTING');
    expect(im.connection.state.value).toBe('CONNECTING');
  });

  it('连接事件同步到 status，且 connection.state 就是同一个 ref：两处状态字面量各自漂移是顶栏徽章的经典故障', () => {
    const { im, setStatus } = setup({ status: 'CLOSED' });
    setStatus('CONNECTING');
    expect(im.status.value).toBe('CONNECTING');
    setStatus('OPEN');
    expect(im.status.value).toBe('OPEN');
    expect(im.connection.state).toBe(im.status);
  });

  it('connect / connection.reconnect 都落到 transport：自动退避归 transport 管，这里只留"用户点了重试"这一个入口', () => {
    // connectCalls 是 getter，必须整体拿着 harness 读：解构会把那一刻的值抄下来，之后永远是不变的 0
    const harness = setup({ status: 'CLOSED' });
    harness.im.connect();
    harness.im.connection.reconnect();
    expect(harness.connectCalls).toBe(2);
    expect(harness.im.status.value).toBe('OPEN');
  });

  it('诊断文案写进 error，并在下一条正常下行帧后清掉：坏帧提示长挂在会话上是误导', () => {
    const { diagnose, im, push } = setup();
    diagnose('JSON 解析失败');
    expect(im.error.value).toBe('JSON 解析失败');
    push({ payload: { message: message('m1') }, type: 'message' });
    expect(im.error.value).toBeUndefined();
  });

  it('ack 的失败原因是这条消息的而不是线路的：把"发送失败"写成"连接异常"会让用户去点重连', () => {
    const { im, push } = setup();
    im.openConversation('c1');
    push({ payload: { clientId: 'local-1', status: 'sent' }, type: 'ack' });
    expect(im.error.value).toBeUndefined();
  });

  it('pending 就是发件箱长度：断线时它是"有 N 条待发送"的唯一出处', () => {
    const { im, push } = setup();
    im.openConversation('c1');
    expect(im.connection.pending.value).toBe(0);
    im.sendMessage({ text: '在吗' });
    expect(im.connection.pending.value).toBe(1);
    push({ payload: { clientId: 'local-1', status: 'sent' }, type: 'ack' });
    expect(im.connection.pending.value).toBe(0);
  });
});

describe('乐观发送', () => {
  it('发出去的那一条立刻上屏 pending、进发件箱、并带出一帧 send：三者缺一都会出现"看不见也没发出去"', () => {
    const { im, sent } = setup();
    im.openConversation('c1');
    const created = im.sendMessage({ text: '你好' });
    expect(created?.id).toBe('local-1');
    expect(created?.status).toBe('pending');
    expect(im.messages.value.map((item) => item.id)).toStrictEqual(['local-1']);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.type).toBe('send');
    expect(payloadOf(sent[0]).message).toMatchObject({
      id: 'local-1',
      text: '你好',
    });
  });

  it('乐观 id 计数器挂在实例上：两个会话框同时开着不该抢同一个序列，否则 ack 会认亲认错', () => {
    const a = setup();
    const b = setup();
    a.im.openConversation('c1');
    b.im.openConversation('c1');
    expect(a.im.sendMessage({ text: 'A' })?.id).toBe('local-1');
    expect(b.im.sendMessage({ text: 'B' })?.id).toBe('local-1');
    expect(a.im.sendMessage({ text: 'A2' })?.id).toBe('local-2');
  });

  it('没有当前会话又没传 conversationId：返回 undefined 并给可展示的文案，不发帧', () => {
    const { im, sent } = setup();
    expect(im.sendMessage({ text: '你好' })).toBeUndefined();
    expect(im.error.value).toContain('conversationId');
    expect(sent).toStrictEqual([]);
  });

  it('正文超限在本地就拦下：发出去被服务端拒，用户看到的是"消息凭空消失"', () => {
    const { im, sent } = setup({ limits: { maxMessageLength: 10 } });
    im.openConversation('c1');
    expect(im.sendMessage({ text: '十一个字-longest' })).toBeUndefined();
    expect(im.error.value).toContain('超过 10 字上限');
    expect(im.messages.value).toStrictEqual([]);
    expect(sent).toStrictEqual([]);
  });

  it('附件条数超限同样本地拦截，并把上限写进原因：宿主直接调 sendMessage 也躲不过这层兜底', () => {
    const { im, sent } = setup({ limits: { maxAttachmentsPerMessage: 2 } });
    im.openConversation('c1');
    const attachments = [
      { name: 'a.png', size: 1 },
      { name: 'b.png', size: 1 },
      { name: 'c.png', size: 1 },
    ];
    expect(im.sendMessage({ attachments, text: '' })).toBeUndefined();
    expect(im.error.value).toContain('最多 2 个附件');
    expect(sent).toStrictEqual([]);
  });

  it('只带附件不带正文：形态是 file、正文是结构化对象、text 投影字段干脆不存在', () => {
    const { im } = setup();
    im.openConversation('c1');
    const created = im.sendMessage({
      attachments: [{ name: 'a.png', size: 12 }],
      text: '',
    });
    expect(created?.kind).toBe('file');
    expect(created?.body).toStrictEqual({
      attachments: [{ name: 'a.png', size: 12 }],
      text: '',
    });
    expect(created?.text).toBeUndefined();
  });

  it('mentions / parentId / replyTo 原样带上，空 mentions 数组不留字段：字段在但为空会让服务端当成"@了所有人"', () => {
    const { im } = setup();
    im.openConversation('c1');
    const withMeta = im.sendMessage({
      mentions: ['peer'],
      parentId: 'm1',
      replyTo: { text: '引用' },
      text: '好的',
    });
    expect(withMeta?.mentions).toStrictEqual(['peer']);
    expect(withMeta?.parentId).toBe('m1');
    expect(withMeta?.replyTo).toStrictEqual({ text: '引用' });
    const empty = im.sendMessage({ mentions: [], text: '再一条' });
    expect(empty?.mentions).toBeUndefined();
  });

  it('对一个全新会话发消息会自动建会话：否则宿主"新建会话发第一句"这条路径会把消息写进没有归属的桶', () => {
    const { im } = setup();
    im.sendMessage({ conversationId: 'brand-new', text: '第一句' });
    expect(im.store.state.value.conversations['brand-new']).toMatchObject({
      id: 'brand-new',
    });
    expect(im.store.messagesOf('brand-new')).toHaveLength(1);
  });

  it('发往未打开的会话不涨未读：自己发的消息挂红点是最先被用户投诉的那种错', () => {
    const { im } = setup({ seed: seeded('c1') });
    im.sendMessage({ conversationId: 'c1', text: '你好' });
    expect(im.store.state.value.conversations.c1?.unread).toBe(0);
    expect(im.activeConversationId.value).toBeUndefined();
  });

  it('userId 传函数时每帧现取：切账号后 token 换了但 senderId 还写着旧人，是排查成本最高的一类脏数据', () => {
    let account = 'me';
    const { im } = setup({ userId: () => account });
    im.openConversation('c1');
    expect(im.sendMessage({ text: '旧账号' })?.senderId).toBe('me');
    account = 'me-2';
    expect(im.sendMessage({ text: '新账号' })?.senderId).toBe('me-2');
  });
});

describe('ack 落定与重发', () => {
  it('ack sent 把 pending 变 sent 并出队：状态不落地，用户会以为一直在转圈', () => {
    const { im, push } = setup();
    im.openConversation('c1');
    im.sendMessage({ text: '你好' });
    push({ payload: { clientId: 'local-1', status: 'sent' }, type: 'ack' });
    expect(im.messages.value[0]).toMatchObject({
      id: 'local-1',
      status: 'sent',
    });
    expect(im.store.state.value.outbox).toStrictEqual([]);
  });

  it('ack 带 serverId 时换成服务端 id 且仍只有一条：引用与回复按 id 找人，不换 id 就会指向空', () => {
    const { im, push } = setup();
    im.openConversation('c1');
    im.sendMessage({ text: '你好' });
    push({
      payload: { clientId: 'local-1', serverId: 'srv-9', status: 'sent' },
      type: 'ack',
    });
    expect(im.messages.value.map((item) => item.id)).toStrictEqual(['srv-9']);
    expect(im.store.state.value.outbox).toStrictEqual([]);
  });

  it('ack failed 转失败态并把原因留在 error：重发入口只有看得见失败才找得到', () => {
    const { im, push } = setup();
    im.openConversation('c1');
    im.sendMessage({ text: '你好' });
    push({
      payload: {
        clientId: 'local-1',
        reason: '服务端拒绝：命中敏感词',
        status: 'failed',
      },
      type: 'ack',
    });
    expect(im.messages.value[0]?.status).toBe('failed');
    expect(im.error.value).toBe('服务端拒绝：命中敏感词');
  });

  it('对不认识的 clientId 的 ack 既不新增消息也不报错：服务端重启后的迟到 ack 不该在界面留下痕迹', () => {
    const { im, push } = setup({ seed: seeded('c1') });
    im.openConversation('c1');
    push({ payload: { clientId: 'ghost', status: 'sent' }, type: 'ack' });
    expect(im.messages.value).toStrictEqual([]);
    expect(im.error.value).toBeUndefined();
  });

  /**
   * 线路是否好了，一条落定的 ack 就是证据 —— 哪怕它是"上一台消息的重发成功"。
   * 旧实现只在非 ack 帧上清诊断，症状是用户点了重发、气泡已经变成"已发送"，
   * 头顶那条"发送失败"还挂着，直到下一段对话来了才消失。
   */
  it('重发成功回来的 ack 一并清掉失败诊断：气泡已落定还挂着"发送失败"会赶用户去点重连', () => {
    const { im, push } = setup();
    im.openConversation('c1');
    im.sendMessage({ text: '你好' });
    push({
      payload: { clientId: 'local-1', reason: '线路抖动', status: 'failed' },
      type: 'ack',
    });
    expect(im.error.value).toBe('线路抖动');

    expect(im.retry('local-1')).toStrictEqual({ ok: true });
    push({
      payload: { clientId: 'local-1', serverId: 'srv-1', status: 'sent' },
      type: 'ack',
    });
    expect(im.messages.value[0]).toMatchObject({ id: 'srv-1', status: 'sent' });
    expect(im.error.value).toBeUndefined();
  });

  it('retry 重新上发件箱并发帧，四种前置条件各给一条原因：只说"发不出去"等于没给线索', () => {
    const { im, push, sent } = setup();
    im.openConversation('c1');
    im.sendMessage({ text: '你好' });
    push({ payload: { clientId: 'local-1', status: 'failed' }, type: 'ack' });

    expect(im.retry('不存在')).toEqual({
      ok: false,
      reason: '要重发的消息不存在',
    });
    expect(im.retry('local-1', 'c2')).toEqual({
      ok: false,
      reason: '消息不属于该会话',
    });
    push({ payload: { clientId: 'local-1', status: 'sent' }, type: 'ack' });
    expect(im.retry('local-1').reason).toBe('只有发送失败的消息可以重发');

    push({ payload: { clientId: 'local-1', status: 'failed' }, type: 'ack' });
    const before = sent.length;
    expect(im.retry('local-1')).toStrictEqual({ ok: true });
    expect(im.messages.value[0]).toMatchObject({
      id: 'local-1',
      status: 'pending',
    });
    expect(im.store.state.value.outbox).toHaveLength(1);
    expect(sent.slice(before).map((frame) => frame.type)).toStrictEqual([
      'send',
    ]);
  });
});

describe('收消息、未读与已读回执', () => {
  it('未打开的会话收到消息 +1 未读，且不回已读回执：人在别的会话里，不该假装读过', () => {
    const { im, push, sent } = setup({ seed: seeded('c1') });
    im.openConversation('other');
    push({ payload: { message: message('m1') }, type: 'message' });
    expect(im.store.state.value.conversations.c1?.unread).toBe(1);
    expect(uplink(sent, 'read')).toStrictEqual([]);
  });

  it('正在看的会话收到消息：不挂红点、就地标已读，并回一条带 messageId 的上行 read 帧', () => {
    const { im, push, sent } = setup({ seed: seeded('c1') });
    im.openConversation('c1');
    push({ payload: { message: message('m1') }, type: 'message' });
    expect(im.store.state.value.conversations.c1?.unread).toBe(0);
    const receipt = uplink(sent, 'read');
    expect(receipt).toHaveLength(1);
    expect(receipt[0]?.payload).toStrictEqual({
      conversationId: 'c1',
      messageId: 'm1',
      userId: 'me',
    });
  });

  it('服务端 echo 回来的自己的消息不回执：给自己发已读会让对端的已读计数翻倍', () => {
    const { im, push, sent } = setup();
    im.openConversation('c1');
    im.sendMessage({ text: '你好' });
    const before = sent.length;
    push({
      payload: { message: message('local-1', { senderId: 'me' }) },
      type: 'message',
    });
    expect(uplink(sent.slice(before), 'read')).toStrictEqual([]);
  });

  it('打开一个有未读的会话：清红点并上行一帧 read（不带 messageId）', () => {
    const { im, sent } = setup();
    im.store.state.value = {
      ...im.store.state.value,
      conversations: {
        c1: { id: 'c1', kind: 'single', memberIds: ['me'], unread: 3 },
      },
    };
    im.openConversation('c1');
    expect(im.store.state.value.conversations.c1?.unread).toBe(0);
    expect(uplink(sent, 'read')).toHaveLength(1);
    expect(uplink(sent, 'read')[0]?.payload).not.toHaveProperty('messageId');
  });

  it('打开一个本来就没未读的会话不白发帧：来回点会话不该刷出一条条空回执', () => {
    const { im, sent } = setup({ seed: seeded('c1') });
    im.openConversation('c1');
    im.markRead('c1');
    expect(uplink(sent, 'read')).toStrictEqual([]);
  });

  it('下行 read 只把我发的消息升到 read，忽略自己的与他人消息的：对方的已读不能改我的气泡以外的东西', () => {
    const { im, push } = setup();
    im.openConversation('c1');
    im.sendMessage({ text: '你好' });
    push({ payload: { clientId: 'local-1', status: 'sent' }, type: 'ack' });
    // 自己收到的 read 帧（userId 是自己）无效
    push({ payload: { conversationId: 'c1', userId: 'me' }, type: 'read' });
    expect(im.messages.value[0]?.status).toBe('sent');
    // 点名另一条消息的 read 帧不该改到我这条
    push({
      payload: { conversationId: 'c1', messageId: '别的', userId: 'peer' },
      type: 'read',
    });
    expect(im.messages.value[0]?.status).toBe('sent');
    push({ payload: { conversationId: 'c1', userId: 'peer' }, type: 'read' });
    expect(im.messages.value[0]?.status).toBe('read');
  });

  it('上行 send 帧从服务端 echo 回来时不入队、不重复入表：否则一次回声就是两条气泡', () => {
    const { im, push, sent } = setup({ seed: seeded('c1') });
    im.openConversation('c1');
    const before = sent.length;
    push({
      payload: { message: message('m1', { senderId: 'me' }) },
      type: 'send',
    });
    expect(im.messages.value).toStrictEqual([]);
    expect(sent).toHaveLength(before);
  });
});

describe('撤回窗口', () => {
  it('窗口边界按"恰好等于"算还在期内：判定用注入的 now()，所以这一条是确定的而不是运气', () => {
    const { im, setNow, sent } = setup({ limits: { recallWindowMs: 120_000 } });
    im.openConversation('c1');
    im.sendMessage({ text: '你好' });
    setNow(1_000_000 + 120_000);
    expect(im.recall('local-1')).toStrictEqual({ ok: true });
    expect(uplink(sent, 'recall')).toHaveLength(1);
  });

  it('超过窗口 1 毫秒就拒绝，原因带上分钟数：文案要能解释"为什么刚才还能撤"', () => {
    const { im, setNow, sent } = setup({ limits: { recallWindowMs: 120_000 } });
    im.openConversation('c1');
    im.sendMessage({ text: '你好' });
    setNow(1_000_000 + 120_001);
    expect(im.recall('local-1')).toEqual({
      ok: false,
      reason: '已超过撤回时限（2 分钟）',
    });
    expect(uplink(sent, 'recall')).toStrictEqual([]);
  });

  it('四种不可撤回各给一条原因：不存在 / 不属于该会话 / 系统消息 / 不是自己发的', () => {
    const { im } = setup({
      seed: seeded('c1', [
        message('peer-1'),
        message('sys', { body: '系统提示', id: 'sys', kind: 'system' }),
      ]),
    });
    im.openConversation('c1');
    expect(im.recall('没有这条').reason).toBe('要撤回的消息不存在');
    expect(im.recall('peer-1', 'c2').reason).toBe('消息不属于该会话');
    expect(im.recall('sys').reason).toBe('系统消息不能撤回');
    expect(im.recall('peer-1').reason).toBe('只能撤回自己发送的消息');
  });

  it('撤回后保留 id 与时间、正文换成占位：顺序不跳，别人对它的引用也还指得到', () => {
    const { im, push } = setup({ seed: seeded('c1', [message('peer-1')]) });
    im.openConversation('c1');
    im.sendMessage({ text: '你好' });
    push({
      payload: { clientId: 'local-1', serverId: 'srv-1', status: 'sent' },
      type: 'ack',
    });
    const before = im.messages.value[1];
    expect(im.recall('srv-1').ok).toBe(true);
    const after = im.messages.value[1];
    expect(after).toMatchObject({
      body: RECALLED_TEXT,
      id: 'srv-1',
      kind: 'system',
      text: RECALLED_TEXT,
    });
    expect(after?.createdAt).toBe(before?.createdAt);
    expect(after?.status).toBeUndefined();
    expect(im.messages.value.map((item) => item.id)).toStrictEqual([
      'peer-1',
      'srv-1',
    ]);
  });

  it('下行 recall 帧走同一套占位：本地撤回与远端撤回在界面上必须长得一样', () => {
    const { im, push } = setup({ seed: seeded('c1', [message('peer-1')]) });
    im.openConversation('c1');
    push({
      payload: { conversationId: 'c1', messageId: 'peer-1' },
      type: 'recall',
    });
    expect(im.messages.value[0]).toMatchObject({
      body: RECALLED_TEXT,
      id: 'peer-1',
      kind: 'system',
    });
  });
});

describe('typing 的双向节流', () => {
  it('上行按会话分桶节流：连续敲字只发一帧，跨过窗口才发第二帧', () => {
    const { im, sent, setNow } = setup({ limits: { typingThrottleMs: 2000 } });
    im.openConversation('c1');
    im.typing();
    im.typing();
    setNow(1_000_000 + 1999);
    im.typing();
    expect(uplink(sent, 'typing')).toHaveLength(1);
    setNow(1_000_000 + 2000);
    im.typing();
    expect(uplink(sent, 'typing')).toHaveLength(2);
    expect(uplink(sent, 'typing')[0]?.payload).toStrictEqual({
      conversationId: 'c1',
      typing: true,
      userId: 'me',
    });
  });

  it('节流桶是会话而不是全局：切会话继续打字必须立刻让对方知道', () => {
    const { im, sent } = setup();
    im.openConversation('c1');
    im.typing();
    im.typing('c2');
    expect(
      uplink(sent, 'typing').map((frame) => payloadOf(frame).conversationId),
    ).toStrictEqual(['c1', 'c2']);
  });

  it('没有当前会话时 typing 直接忽略：面板还没打开就发帧，服务端会收到无主的 typing', () => {
    const { im, sent } = setup();
    im.typing();
    expect(sent).toStrictEqual([]);
  });

  it('对端 typing: true 上屏、typing: false 收起，自己的 typing 帧忽略', () => {
    const { im, push } = setup();
    push({
      payload: { conversationId: 'c1', typing: true, userId: 'peer' },
      type: 'typing',
    });
    expect(im.typingPeers.value.c1).toStrictEqual(['peer']);
    push({
      payload: { conversationId: 'c1', typing: true, userId: 'peer' },
      type: 'typing',
    });
    expect(im.typingPeers.value.c1).toStrictEqual(['peer']);
    push({
      payload: { conversationId: 'c1', typing: true, userId: 'me' },
      type: 'typing',
    });
    expect(im.typingPeers.value.c1).toStrictEqual(['peer']);
    push({
      payload: { conversationId: 'c1', typing: false, userId: 'peer' },
      type: 'typing',
    });
    expect(im.typingPeers.value.c1).toStrictEqual([]);
  });

  it('对端突然断网时靠超时自动清除：没有人再发 typing: false，"某某正在输入"不能永远挂着', () => {
    vi.useFakeTimers();
    const { im, push } = setup({ limits: { typingTimeoutMs: 50 } });
    push({
      payload: { conversationId: 'c1', typing: true, userId: 'peer' },
      type: 'typing',
    });
    expect(im.typingPeers.value.c1).toStrictEqual(['peer']);
    vi.advanceTimersByTime(49);
    expect(im.typingPeers.value.c1).toStrictEqual(['peer']);
    vi.advanceTimersByTime(1);
    expect(im.typingPeers.value.c1).toStrictEqual([]);
  });

  it('对端在我输入的同一刻发来消息就收起"正在输入"：继续转圈会被读成"他没看到我这条"', () => {
    const { im, push } = setup({ limits: { typingTimeoutMs: 6000 } });
    push({
      payload: { conversationId: 'c1', typing: true, userId: 'peer' },
      type: 'typing',
    });
    push({
      payload: { message: message('m1', { senderId: 'peer' }) },
      type: 'message',
    });
    expect(im.typingPeers.value.c1).toStrictEqual([]);
  });
});

describe('历史分页', () => {
  it('游标用已加载最早一条的 createdAt 而不是 offset：翻页请求带的 before 决定了会不会重复或漏一条', () => {
    const { im, sent } = setup({
      seed: seeded('c1', [
        message('m2', { createdAt: 900 }),
        message('m1', { createdAt: 500 }),
      ]),
    });
    im.openConversation('c1');
    expect(im.loadHistory('c1')).toBe(true);
    expect(payloadOf(uplink(sent, 'history')[0])).toStrictEqual({
      before: 500,
      conversationId: 'c1',
      limit: 30,
    });
  });

  it('空会话的游标是 undefined 而不是 0：带 0 等于把全部历史判成"更早"，第一页就翻不到东西', () => {
    const { im, sent } = setup({ seed: seeded('c1') });
    im.loadHistory('c1');
    expect(payloadOf(uplink(sent, 'history')[0]).before).toBeUndefined();
  });

  it('在途时第二次请求直接 false：滚轮抖一下就连发五页同样的请求是最常见的自我 DDoS', () => {
    const { im, sent } = setup({ seed: seeded('c1', [message('m1')]) });
    im.openConversation('c1');
    expect(im.loadHistory('c1')).toBe(true);
    expect(im.loadHistory('c1')).toBe(false);
    expect(uplink(sent, 'history')).toHaveLength(1);
    expect(im.loadingHistory.value.c1).toBe(true);
  });

  it('历史页响应：在途归位、消息前插、不涨未读也不动会话摘要时间：翻旧消息刷红点/会话跳到最前都在这条路上', () => {
    const { im, push } = setup({
      seed: seeded('c1', [message('m1', { createdAt: 900 })]),
    });
    im.openConversation('c1');
    im.store.state.value = {
      ...im.store.state.value,
      conversations: {
        c1: {
          id: 'c1',
          kind: 'single',
          lastMessageAt: 900,
          memberIds: ['me'],
          unread: 2,
        },
      },
    };
    im.loadHistory('c1');
    push({
      payload: {
        conversationId: 'c1',
        hasMore: false,
        messages: [message('old-1', { createdAt: 100 })],
      },
      type: 'history',
    });
    expect(im.loadingHistory.value.c1).toBe(false);
    expect(im.messages.value.map((item) => item.id)).toStrictEqual([
      'old-1',
      'm1',
    ]);
    expect(im.store.state.value.conversations.c1).toMatchObject({
      lastMessageAt: 900,
      unread: 2,
    });
  });

  it('响应里没带 messages 也不报错，在途照样归位：空页是合法回答，卡在 loading 会让翻页按钮永远点不动', () => {
    const { im, push } = setup({ seed: seeded('c1', [message('m1')]) });
    im.openConversation('c1');
    im.loadHistory('c1');
    push({
      payload: { conversationId: 'c1', hasMore: false },
      type: 'history',
    });
    expect(im.loadingHistory.value.c1).toBe(false);
  });

  it('没有当前会话时返回 false 且不发帧：没有对象的分页请求只能让服务端猜', () => {
    const { im, sent } = setup();
    expect(im.loadHistory()).toBe(false);
    expect(sent).toStrictEqual([]);
  });

  it('宿主可以按次覆盖每页条数，默认走 limits.historyPageSize：弱网与桌面端的分页粒度本来就不一样', () => {
    const { im, push, sent } = setup({ limits: { historyPageSize: 7 } });
    im.openConversation('c1');
    im.loadHistory('c1');
    // 上一响应先归位，否则第二次请求会被在途守卫挡掉（那条口径另有用例）
    push({ payload: { conversationId: 'c1', messages: [] }, type: 'history' });
    im.loadHistory('c1', 999);
    expect(
      uplink(sent, 'history').map((frame) => payloadOf(frame).limit),
    ).toStrictEqual([7, 999]);
  });
});

describe('会话切换、日志与作用域', () => {
  it('openConversation(undefined) 落到列表第一项（按最后一条时间倒序）：关掉的会话不该停在"未选择"', () => {
    const { im } = setup({
      seed: {
        conversations: [
          {
            id: 'old',
            kind: 'single',
            lastMessageAt: 1,
            memberIds: ['me'],
            unread: 0,
          },
          {
            id: 'new',
            kind: 'single',
            lastMessageAt: 900,
            memberIds: ['me'],
            unread: 0,
          },
        ],
      },
    });
    im.openConversation(undefined);
    expect(im.activeConversationId.value).toBe('new');
  });

  it('删会话连带清消息与发件箱，并把当前会话落到别处：留下孤儿数据的回放会重复上屏', () => {
    const { im } = setup({ seed: seeded('c1', [message('m1')]) });
    im.store.state.value = {
      ...im.store.state.value,
      conversations: {
        ...im.store.state.value.conversations,
        c2: {
          id: 'c2',
          kind: 'single',
          lastMessageAt: 2000,
          memberIds: ['me'],
          unread: 0,
        },
      },
    };
    im.openConversation('c1');
    im.sendMessage({ text: '还没发出去' });
    im.removeConversation('c1');
    expect(im.store.messagesOf('c1')).toStrictEqual([]);
    expect(im.store.state.value.conversations.c1).toBeUndefined();
    expect(im.store.state.value.outbox).toStrictEqual([]);
    expect(im.activeConversationId.value).toBe('c2');
  });

  it('帧日志只留最近 FRAME_LOG_LIMIT 条：演示页挂一整天不能把内存吃光', () => {
    const { im, push } = setup({ seed: seeded('c1') });
    for (let index = 0; index < FRAME_LOG_LIMIT + 10; index += 1) {
      push({
        payload: { message: message(`m${index}`, { conversationId: 'other' }) },
        type: 'message',
      });
    }
    expect(im.frames.value).toHaveLength(FRAME_LOG_LIMIT);
    expect(payloadOf(im.frames.value[0])).toMatchObject({
      message: { id: 'm10' },
    });
    expect(payloadOf(im.frames.value.at(-1))).toMatchObject({
      message: { id: `m${FRAME_LOG_LIMIT + 9}` },
    });
  });

  it('presence 帧按 userId 覆盖而不是追加：一个人离线又上线只该有一条状态', () => {
    const { im, push } = setup();
    push({ payload: { presence: 'online', userId: 'peer' }, type: 'presence' });
    expect(im.presences.value).toStrictEqual({ peer: 'online' });
    push({
      payload: { presence: 'offline', userId: 'peer' },
      type: 'presence',
    });
    expect(im.presences.value).toStrictEqual({ peer: 'offline' });
  });

  it('effectScope 停止后不再改状态：组件卸载后还在写 store，就是把数据写进已销毁的实例', () => {
    // 这里不复用 setup 的 transport：那上面还挂着第一个 useIm，退订与否分不清是谁的作用
    const sent: ImFrame[] = [];
    const listeners = new Set<(event: ImTransportEvent) => void>();
    const transport: ImTransport = {
      connect: () => {},
      disconnect: () => {},
      on: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      send: (frame) => {
        sent.push(frame);
      },
      status: ref<ImConnectionStatus>('OPEN'),
    };
    const scope = effectScope();
    let im: undefined | UseImReturn;
    scope.run(() => {
      im = useIm({
        now: () => 1_000_000,
        store: createImStore(seeded('c1')),
        transport,
        userId: 'me',
      });
    });
    scope.stop();
    for (const listener of [...listeners]) {
      listener({
        frame: { payload: { message: message('m1') }, type: 'message' },
        type: 'frame',
      });
    }
    expect(listeners.size).toBe(0);
    expect(im?.store.messagesOf('c1')).toStrictEqual([]);
    expect(sent).toStrictEqual([]);
  });
});
