import type {
  Conversation,
  ImFrame,
  ImMessage,
  OutboxEntry,
} from '../../src/im/index';

import { describe, expect, it } from 'vitest';

import {
  appendOutbox,
  createImStore,
  createInitialState,
  historyCursor,
  markRead,
  mergeMessages,
  messagesToText,
  patchMessage,
  removeConversation,
  removeOutbox,
  renameMessage,
  selectConversationList,
  setUnread,
  sortMessages,
  upsertConversation,
} from '../../src/im/index';

/**
 * 测试口径：这一层是 IM 的正确性来源，所以测得比别的层厚。
 *
 * 三个必须被钉住的不变量（`core/store.ts` 的头注释里也写着）：
 * 1. 同 id 只有一条，后到的覆盖先到的，且**不许把已确认的状态降级回 pending**；
 * 2. 顺序是 `(createdAt, id)` 升序 —— 只比时间戳的话，服务端同毫秒批量落库就会"刷新一次顺序变一次"；
 * 3. 未读只有一种算法：`非自己发的` 且 `不是正在看的会话` 且 `调用方没关 countUnread`。
 *
 * 另外每条都顺手断言"没被改到的引用还是同一个"：reducer 若原地改对象，
 * 宿主的快照、Vue 的浅层 watch、以及"撤销上一次操作"这类功能会同时失效，而且不会报错，只会偶发。
 */

function message(
  id: string,
  createdAt: number,
  extra: Partial<ImMessage> = {},
): ImMessage {
  return {
    body: `正文 ${id}`,
    conversationId: 'c1',
    createdAt,
    id,
    kind: 'text',
    senderId: 'peer',
    ...extra,
  };
}

function conversation(
  id: string,
  extra: Partial<Conversation> = {},
): Conversation {
  return { id, kind: 'single', memberIds: ['me', id], unread: 0, ...extra };
}

function outbox(clientId: string, conversationId = 'c1'): OutboxEntry {
  const frame: ImFrame = {
    payload: {
      message: message(clientId, 1000, { conversationId, senderId: 'me' }),
    },
    type: 'send',
  };
  return { clientId, conversationId, frame, queuedAt: 1000 };
}

describe('消息去重与顺序', () => {
  it('同一 id 后到覆盖先到，绝不追加两条：服务端重发是常态，双条会让用户以为自己发了两遍', () => {
    const state = createInitialState({
      messages: [message('m1', 1000, { body: '第一版' })],
    });
    const next = mergeMessages(state, 'c1', [
      message('m1', 1000, { body: '第二版' }),
    ]);
    expect(next.messages.c1).toHaveLength(1);
    expect(next.messages.c1?.[0]?.body).toBe('第二版');
  });

  it('乱序到达的消息按 createdAt 归位：先收到新消息再补历史时，气泡不能倒着念', () => {
    const state = createInitialState({ messages: [message('m3', 3000)] });
    const next = mergeMessages(state, 'c1', [
      message('m1', 1000),
      message('m2', 2000),
    ]);
    expect(next.messages.c1?.map((item) => item.id)).toStrictEqual([
      'm1',
      'm2',
      'm3',
    ]);
  });

  it('同一毫秒的两条消息用 id 定序：只比时间戳的话，两次 merge 的输入顺序不同结果就不同', () => {
    const sameTime = [
      message('m2', 1000),
      message('m1', 1000),
      message('m3', 1000),
    ];
    expect(sortMessages(sameTime).map((item) => item.id)).toStrictEqual([
      'm1',
      'm2',
      'm3',
    ]);
    // 反过来喂一遍必须得到同一个顺序，这才是"稳定"
    expect(
      sortMessages([...sameTime].reverse()).map((item) => item.id),
    ).toStrictEqual(['m1', 'm2', 'm3']);
  });

  it('已确认的消息不会被历史里的 pending 投影降级：ack 刚落定又变回转圈是最刺眼的回退', () => {
    const sent = message('m1', 1000, { senderId: 'me', status: 'sent' });
    const state = createInitialState({ messages: [sent] });
    const stale = mergeMessages(state, 'c1', [
      message('m1', 1000, {
        body: '历史里的旧正文',
        senderId: 'me',
        status: 'pending',
      }),
    ]);
    expect(stale.messages.c1?.[0]?.status).toBe('sent');
    // 但其余字段以后者为准：覆盖本身是"对方带来了更完整的事实"
    expect(stale.messages.c1?.[0]?.body).toBe('历史里的旧正文');
  });

  it('merge 只换掉目标会话的引用，其他会话与旧状态对象保持原样：原地改会让宿主快照与浅层 watch 静默失效', () => {
    const other = mergeMessages(
      createInitialState({
        messages: [message('x1', 500, { conversationId: 'c2' })],
      }),
      'c1',
      [message('m1', 1000)],
    );
    const before = other.messages.c1;
    const after = mergeMessages(other, 'c1', [message('m2', 2000)]);
    expect(after).not.toBe(other);
    expect(after.messages.c1).not.toBe(before);
    expect(after.messages.c2).toBe(other.messages.c2);
    expect(before).toHaveLength(1);
  });

  it('merge 别的会话不会污染当前会话的消息表：多会话切换时"消息串会话"是能上事故单的错', () => {
    const state = createInitialState({
      messages: [message('m1', 1000, { conversationId: 'c2' })],
    });
    const next = mergeMessages(state, 'c1', [message('m2', 2000)]);
    expect(next.messages.c1?.map((item) => item.id)).toStrictEqual(['m2']);
    expect(next.messages.c2?.map((item) => item.id)).toStrictEqual(['m1']);
  });
});

describe('未读口径', () => {
  it('只有「非自己发的」且「不是正在看的会话」才 +1：少任一条件就多一个假红点', () => {
    const base = createInitialState({
      conversations: [conversation('c1'), conversation('c2')],
    });
    const next = mergeMessages(
      base,
      'c2',
      [message('m1', 1000, { conversationId: 'c2' })],
      {
        activeConversationId: 'c1',
        selfId: 'me',
      },
    );
    expect(next.conversations.c2?.unread).toBe(1);
    expect(next.conversations.c1?.unread).toBe(0);
  });

  it('正在看的会话收到消息不计未读：看着聊天窗还被标未读，用户会以为软件坏了', () => {
    const base = createInitialState({ conversations: [conversation('c1')] });
    const next = mergeMessages(base, 'c1', [message('m1', 1000)], {
      activeConversationId: 'c1',
      selfId: 'me',
    });
    expect(next.conversations.c1?.unread).toBe(0);
  });

  it('自己发的消息永远不计未读，哪怕没打开那个会话', () => {
    const base = createInitialState({ conversations: [conversation('c1')] });
    const next = mergeMessages(
      base,
      'c1',
      [message('m1', 1000, { senderId: 'me' })],
      {
        selfId: 'me',
      },
    );
    expect(next.conversations.c1?.unread).toBe(0);
  });

  it('历史页合并只算条数不算未读：翻页刷红点是能上事故单的，而且最难解释', () => {
    const base = createInitialState({
      conversations: [conversation('c1')],
      messages: [message('m5', 5000)],
    });
    const page = [
      message('m1', 1000),
      message('m2', 2000),
      message('m3', 3000),
    ];
    const counted = mergeMessages(base, 'c1', page, { selfId: 'me' });
    expect(counted.conversations.c1?.unread).toBe(3);
    // 同一个入参只差 `countUnread`：这个选项必须真的有用，不能靠调用方顺带少传别的字段兜住
    const notCounted = mergeMessages(base, 'c1', page, {
      countUnread: false,
      selfId: 'me',
    });
    expect(notCounted.conversations.c1?.unread).toBe(0);
    expect(notCounted.messages.c1).toHaveLength(4);
  });

  it('关未读但没关会话摘要时仍刷新 lastMessageAt：两个开关各管各的，联动就会漏', () => {
    const base = createInitialState({
      conversations: [conversation('c1', { lastMessageAt: 9000 })],
      messages: [message('m9', 9000)],
    });
    const next = mergeMessages(base, 'c1', [message('m1', 1000)], {
      countUnread: false,
    });
    expect(next.conversations.c1?.unread).toBe(0);
    // 表里最新的还是 9_000 那条：历史页更旧，不该把会话时间往前推
    expect(next.conversations.c1?.lastMessageAt).toBe(9000);
  });

  it('touchConversation: false 时既不碰未读也不碰摘要时间：翻到很久以前不该把会话顶到列表最前', () => {
    const base = createInitialState({
      conversations: [conversation('c1', { lastMessageAt: 9000, unread: 7 })],
      messages: [message('m9', 9000)],
    });
    const next = mergeMessages(base, 'c1', [message('m1', 1000)], {
      activeConversationId: 'other',
      selfId: 'me',
      touchConversation: false,
    });
    expect(next.conversations.c1).toBe(base.conversations.c1);
    expect(next.conversations.c1?.unread).toBe(7);
    expect(next.messages.c1).toHaveLength(2);
  });

  it('setUnread 用服务端的权威值覆盖，负数归零：负数会渲染成"-3 条未读"', () => {
    const base = createInitialState({
      conversations: [conversation('c1', { unread: 9 })],
    });
    expect(setUnread(base, 'c1', 3).conversations.c1?.unread).toBe(3);
    expect(setUnread(base, 'c1', -5).conversations.c1?.unread).toBe(0);
  });

  it('setUnread 与 markRead 对不认识的会话返回同一个对象：不给界面凭空造会话', () => {
    const base = createInitialState({ conversations: [conversation('c1')] });
    expect(setUnread(base, 'ghost', 5)).toBe(base);
    expect(markRead(base, 'ghost')).toBe(base);
  });

  it('markRead 清零未读并把收到的消息升到已读，自己发的不动：自己的 read 只能来自对方的 read 帧', () => {
    const base = createInitialState({
      conversations: [conversation('c1', { unread: 4 })],
      messages: [
        message('m1', 1000, { status: 'received' }),
        message('m2', 2000, { senderId: 'me', status: 'sent' }),
      ],
    });
    const next = markRead(base, 'c1');
    expect(next.conversations.c1?.unread).toBe(0);
    expect(next.messages.c1?.map((item) => item.status)).toStrictEqual([
      'read',
      'sent',
    ]);
  });

  it('markRead 之后重复调用不再产生新状态对象以外的副作用：红点已清就不该再发一轮上行帧', () => {
    const base = createInitialState({
      conversations: [conversation('c1', { unread: 2 })],
      messages: [message('m1', 1000, { status: 'received' })],
    });
    const once = markRead(base, 'c1');
    const twice = markRead(once, 'c1');
    expect(twice.conversations.c1?.unread).toBe(0);
    expect(twice.messages.c1?.[0]?.status).toBe('read');
  });
});

describe('单条消息的局部更新', () => {
  it('patchMessage 改不存在的 id 返回原对象：一次误点不许悄悄新增一条消息', () => {
    const state = createInitialState({ messages: [message('m1', 1000)] });
    expect(patchMessage(state, 'c1', 'ghost', { status: 'read' })).toBe(state);
    expect(patchMessage(state, 'c9', 'm1', { status: 'read' })).toBe(state);
  });

  it('patchMessage 不许改 id：能改 id 就等于允许把两条消息合并成一条', () => {
    const state = createInitialState({ messages: [message('m1', 1000)] });
    const next = patchMessage(state, 'c1', 'm1', {
      body: '新正文',
      id: 'm9',
    } as Partial<ImMessage>);
    expect(next.messages.c1?.[0]?.id).toBe('m1');
    expect(next.messages.c1?.[0]?.body).toBe('新正文');
    expect(next.messages.c1).toHaveLength(1);
  });

  it('patchMessage 只换那一条的引用，列表其余元素保持原样：整表重建会让每一行都重新渲染', () => {
    const state = createInitialState({
      messages: [message('m1', 1000), message('m2', 2000)],
    });
    const next = patchMessage(state, 'c1', 'm2', { status: 'read' });
    expect(next.messages.c1?.[0]).toBe(state.messages.c1?.[0]);
    expect(next.messages.c1?.[1]).not.toBe(state.messages.c1?.[1]);
  });

  it('renameMessage 换 id 后仍按 (createdAt, id) 有序：ack 换服务端 id 时顺序跳动会被读成"消息插队"', () => {
    const state = createInitialState({
      messages: [message('local-1', 1000), message('m0', 900)],
    });
    const next = renameMessage(state, 'c1', 'local-1', 'srv-9');
    expect(next.messages.c1?.map((item) => item.id)).toStrictEqual([
      'm0',
      'srv-9',
    ]);
    expect(next.messages.c1?.[1]?.createdAt).toBe(1000);
  });

  it('renameMessage 对同名与未知 id 都不产生新状态：换 id 失败必须悄无声息地不失败', () => {
    const state = createInitialState({ messages: [message('m1', 1000)] });
    expect(renameMessage(state, 'c1', 'm1', 'm1')).toBe(state);
    expect(renameMessage(state, 'c1', 'ghost', 'm9')).toBe(state);
  });
});

describe('发件箱与删会话', () => {
  it('appendOutbox 按 clientId 去重：重试不该堆出两条待发', () => {
    const state = createInitialState();
    const once = appendOutbox(state, outbox('local-1'));
    const twice = appendOutbox(once, outbox('local-1'));
    expect(twice.outbox).toHaveLength(1);
    expect(twice.outbox).toBe(once.outbox);
  });

  it('removeOutbox 命中才换引用，未命中返回原对象：pending 数不该因为一次空 ack 而抖动', () => {
    const state = appendOutbox(createInitialState(), outbox('local-1'));
    expect(removeOutbox(state, 'ghost')).toBe(state);
    const next = removeOutbox(state, 'local-1');
    expect(next.outbox).toHaveLength(0);
    expect(next).not.toBe(state);
  });

  it('removeConversation 连带清掉消息与发件箱：留下孤儿数据，下次回放就会重复上屏', () => {
    let state = createInitialState({
      conversations: [conversation('c1'), conversation('c2')],
      messages: [
        message('m1', 1000),
        message('m2', 2000, { conversationId: 'c2' }),
      ],
    });
    state = appendOutbox(state, outbox('local-1', 'c1'));
    state = appendOutbox(state, outbox('local-2', 'c2'));
    const next = removeConversation(state, 'c1');
    expect(next.conversations.c1).toBeUndefined();
    expect(next.messages.c1).toBeUndefined();
    expect(next.outbox.map((entry) => entry.clientId)).toStrictEqual([
      'local-2',
    ]);
    expect(next.messages.c2).toBe(state.messages.c2);
  });
});

describe('历史游标与会话列表', () => {
  it('historyCursor 取已加载消息最早一条的 createdAt：用 offset 翻页时中间有人发消息就会重复或漏一条', () => {
    const state = createInitialState({
      messages: [message('m1', 1000), message('m2', 2000), message('m3', 3000)],
    });
    expect(historyCursor(state, 'c1')).toBe(1000);
    const afterPrepend = mergeMessages(state, 'c1', [message('m0', 500)]);
    expect(historyCursor(afterPrepend, 'c1')).toBe(500);
  });

  it('空会话的游标是 undefined 而不是 0：带个 0 等于把所有历史判成"更早"，第一页就翻不到东西', () => {
    expect(historyCursor(createInitialState(), 'c1')).toBeUndefined();
  });

  it('selectConversationList 按最后一条消息时间倒序，时间相同按 id 兜底：否则两个同秒会话会来回跳', () => {
    const state = createInitialState({
      conversations: [
        conversation('c1', { lastMessageAt: 1000 }),
        conversation('c2', { lastMessageAt: 3000 }),
        conversation('c3', { lastMessageAt: 3000 }),
      ],
    });
    expect(selectConversationList(state).map((item) => item.id)).toStrictEqual([
      'c2',
      'c3',
      'c1',
    ]);
  });

  it('会话摘要时间落后于消息表时以消息表为准，未读数原样带出：服务端只推消息不推会话摘要很常见', () => {
    const state = createInitialState({
      conversations: [conversation('c1', { lastMessageAt: 1000, unread: 5 })],
      messages: [message('m1', 8000)],
    });
    const [first] = selectConversationList(state);
    expect(first?.lastMessageAt).toBe(8000);
    expect(first?.unread).toBe(5);
    // 排序用的键不写回原状态：列表每次现算，宿主才能安全缓存原对象
    expect(state.conversations.c1?.lastMessageAt).toBe(1000);
  });

  it('没有任何消息也没有时间的会话排在最后，且 lastMessageAt 保持 undefined：空会话不该显示成 1970 年', () => {
    const state = createInitialState({
      conversations: [
        conversation('empty'),
        conversation('c1', { lastMessageAt: 1000 }),
      ],
    });
    const list = selectConversationList(state);
    expect(list.map((item) => item.id)).toStrictEqual(['c1', 'empty']);
    expect(list[1]?.lastMessageAt).toBeUndefined();
  });
});

describe('种子与响应式外壳', () => {
  it('只有消息没有会话的种子会补一条会话，成员去重、时间取最后一条：否则列表里出现"有消息没会话"的孤儿', () => {
    const state = createInitialState({
      messages: [
        message('m1', 1000),
        message('m2', 2000, { senderId: 'me' }),
        message('m3', 3000, { senderId: 'peer' }),
      ],
    });
    expect(state.conversations.c1).toMatchObject({
      id: 'c1',
      kind: 'single',
      lastMessageAt: 3000,
      memberIds: ['peer', 'me'],
      unread: 0,
    });
    expect(state.messages.c1?.map((item) => item.id)).toStrictEqual([
      'm1',
      'm2',
      'm3',
    ]);
  });

  it('upsertConversation 只给局部字段时与旧值浅合并，且 id 不许被覆盖：调用方不该被迫先读旧值', () => {
    const state = createInitialState({
      conversations: [
        conversation('c1', { kind: 'group', title: '老项目群', unread: 3 }),
      ],
    });
    const next = upsertConversation(state, { id: 'c1', unread: 0 });
    expect(next.conversations.c1).toStrictEqual({
      id: 'c1',
      kind: 'group',
      memberIds: ['me', 'c1'],
      title: '老项目群',
      unread: 0,
    });
    // 新会话给全默认值，缺 kind / memberIds / unread 会让后面每一处都要 `?? 0`
    expect(
      upsertConversation(createInitialState(), { id: 'c9' }).conversations.c9,
    ).toMatchObject({
      kind: 'single',
      memberIds: [],
      unread: 0,
    });
  });

  it('createImStore.commit 整体替换 state 引用，reset 回到干净种子：原地改会让浅层消费者拿不到更新', () => {
    const store = createImStore({ conversations: [conversation('c1')] });
    const before = store.state.value;
    const after = store.commit(mergeMessages, 'c1', [message('m1', 1000)], {
      selfId: 'me',
    });
    expect(store.state.value).toBe(after);
    expect(after).not.toBe(before);
    expect(store.messagesOf('c1')).toHaveLength(1);
    expect(store.outboxSize()).toBe(0);
    store.commit(appendOutbox, outbox('local-1'));
    expect(store.outboxSize()).toBe(1);
    store.reset();
    expect(store.state.value.conversations.c1).toBeUndefined();
    expect(store.messagesOf(undefined)).toStrictEqual([]);
  });

  it('messagesToText 兼容纯文本与附件正文，缺 text 给空串：列表摘要与无障碍朗读不能被 undefined 打断', () => {
    expect(messagesToText(message('m1', 1000, { body: '你好' }))).toBe('你好');
    expect(
      messagesToText(
        message('m2', 2000, {
          body: { attachments: [], text: '带附件的说明' },
        }),
      ),
    ).toBe('带附件的说明');
    expect(messagesToText(message('m3', 3000, { body: {} }))).toBe('');
  });

  it('messagesOf 读的是当前状态而不是建 store 时的快照：宿主缓存了旧数组就会看到空面板', () => {
    const store = createImStore();
    expect(store.messagesOf('c1')).toStrictEqual([]);
    store.commit(mergeMessages, 'c1', [message('m1', 1000)]);
    expect(store.messagesOf('c1').map((item) => item.id)).toStrictEqual(['m1']);
  });
});
