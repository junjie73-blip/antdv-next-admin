import type { ImFrame, ImTransport } from '../../src/im/index';

import { afterEach, describe, expect, it } from 'vitest';

import {
  configureIm,
  createConfiguredIm,
  createImStore,
  createMemoryTransport,
  DEFAULT_LIMITS,
  getImRuntime,
  resetImRuntime,
  useIm,
} from '../../src/im/index';

/**
 * 宿主注入点的测试口径：这一层是本包唯一认识"运行时全局态"的地方。
 *
 * 两条必须钉住的规矩：
 * 1. `configureIm` 是**增量叠加**，且 `limits` 逐字段合并 —— 宿主分散在几个模块里各配一档是常态；
 * 2. `createConfiguredIm` 的 transport 回落顺序是「显式参数 > 运行时实例 > 运行时工厂 > url > 内存」，
 *    默认必须落内存：**出错形态应该是"消息没发出去"，而不是"连上了不该连的环境"**。
 *
 * 每个用例结束都 `resetImRuntime()`：全局态漏清会让后面的文件拿到前一个用例的配置，
 * 那种失败只在整仓一起跑时出现。
 */

afterEach(() => {
  resetImRuntime();
});

describe('运行时配置', () => {
  it('没配置时就是出厂值，且各字段都是 undefined：不配也能跑通整套链路', () => {
    const runtime = getImRuntime();
    expect(runtime.limits).toStrictEqual(DEFAULT_LIMITS);
    expect(runtime.createObjectUrl).toBeUndefined();
    expect(runtime.now).toBeUndefined();
    expect(runtime.transport).toBeUndefined();
    expect(runtime.url).toBeUndefined();
    expect(runtime.userId).toBeUndefined();
  });

  it('limits 两次调用逐字段叠加而不是清零：后一次配置不该把前一次的覆盖回默认值', () => {
    configureIm({ limits: { maxMessageLength: 10 } });
    configureIm({ limits: { typingThrottleMs: 50 } });
    expect(getImRuntime().limits).toMatchObject({
      historyPageSize: DEFAULT_LIMITS.historyPageSize,
      maxMessageLength: 10,
      typingThrottleMs: 50,
    });
  });

  it('运行时限额一路传到状态机：configureIm({ limits }) 不只是给输入区看，超长正文由 sendMessage 拦下', () => {
    configureIm({ limits: { maxMessageLength: 6 }, userId: 'me' });
    const { im } = createConfiguredIm({
      seed: {
        conversations: [
          { id: 'c1', kind: 'single', memberIds: ['me'], unread: 0 },
        ],
      },
    });
    im.openConversation('c1');
    expect(im.sendMessage({ text: '七个字太长了吧' })).toBeUndefined();
    expect(im.error.value).toContain('超过 6 字上限');
    expect(im.sendMessage({ text: '六个字太长了' })?.text).toBe('六个字太长了');
  });

  it('撤回窗口同样吃运行时限额：改小了就当场拦住，不用真等两分钟', () => {
    let clock = 7_000_000;
    configureIm({
      limits: { recallWindowMs: 0 },
      now: () => clock,
      userId: 'me',
    });
    const { im } = createConfiguredIm({
      seed: {
        conversations: [
          { id: 'c1', kind: 'single', memberIds: ['me'], unread: 0 },
        ],
      },
    });
    im.openConversation('c1');
    const sent = im.sendMessage({ text: '撤回我' });
    expect(sent?.createdAt).toBe(7_000_000);
    // 窗口为 0：只要时钟往前走一格就超窗，判定读的是注入的 now()
    clock += 1;
    expect(im.recall(sent!.id)).toMatchObject({
      ok: false,
      reason: '已超过撤回时限（0 分钟）',
    });
  });

  it('其余字段是整体替换：transport 与 userId 留着旧的没意义', () => {
    configureIm({ userId: 'a' });
    configureIm({ userId: 'b' });
    expect(getImRuntime().userId).toBe('b');
  });

  it('getImRuntime 给的是深一档的副本：宿主改返回值不该隔空改掉全局运行时', () => {
    configureIm({ limits: { maxMessageLength: 10 } });
    const snapshot = getImRuntime();
    snapshot.limits.maxMessageLength = 999;
    expect(getImRuntime().limits.maxMessageLength).toBe(10);
  });

  it('resetImRuntime 回到出厂：单测与多实例宿主靠它隔离全局态', () => {
    configureIm({ limits: { maxMessageLength: 10 }, userId: 'someone' });
    resetImRuntime();
    const runtime = getImRuntime();
    expect(runtime.limits).toStrictEqual(DEFAULT_LIMITS);
    expect(runtime.userId).toBeUndefined();
  });
});

describe('createConfiguredIm 的 transport 回落', () => {
  it('什么都不配时落内存 transport，且 store/im 是同一套：默认不联网', () => {
    const configured = createConfiguredIm();
    const memory = configured.transport as ReturnType<
      typeof createMemoryTransport
    >;
    expect(memory.emitFrame).toBeTypeOf('function');
    expect(memory.sentFrames()).toStrictEqual([]);
    expect(configured.im.store).toBe(configured.store);
    expect(configured.im.transport).toBe(configured.transport);
    expect(configured.im.status.value).toBe('CLOSED');
  });

  it('运行时给实例就复用（全局一条连接），给工厂就每次一套：两条心跳互相打断是排查成本最高的线上故障', () => {
    const shared = createMemoryTransport();
    configureIm({ transport: shared });
    expect(createConfiguredIm().transport).toBe(shared);
    expect(createConfiguredIm().transport).toBe(shared);
    resetImRuntime();
    let created = 0;
    configureIm({
      transport: () => {
        created += 1;
        return createMemoryTransport();
      },
    });
    createConfiguredIm();
    createConfiguredIm();
    expect(created).toBe(2);
  });

  it('显式 options.transport 压过运行时配置：单测要能拿到纯本地实例而不动全局', () => {
    configureIm({ transport: createMemoryTransport() });
    const local: ImTransport = createMemoryTransport();
    expect(createConfiguredIm({ transport: local }).transport).toBe(local);
  });

  it('运行时的 limits 会注入 composable，而 useIm 的显式 options 仍然压过它：优先级只有「显式 > 运行时 > 出厂」一条链', () => {
    configureIm({ limits: { maxMessageLength: 10 } });
    const { im, transport } = createConfiguredIm({
      seed: {
        conversations: [
          { id: 'c1', kind: 'single', memberIds: ['me'], unread: 0 },
        ],
      },
    });
    transport.connect();
    im.openConversation('c1');
    // 输入区与状态机必须吃同一份上限：否则宿主改了配置，界面照样放行而 sendMessage 偷偷丢消息
    expect(im.sendMessage({ text: 'x'.repeat(20) })).toBeUndefined();
    expect(im.error.value).toContain('超过 10 字上限');
    // 直接调 `useIm` 的宿主（多租户、SSR 探针）传了自己的 limits 就以它为准，
    // 运行时只是 `createConfiguredIm` 的兜底 —— 这条链不存在"两处叠加说不清"
    const own = useIm({
      limits: { maxMessageLength: 100 },
      store: createImStore(),
      transport: createMemoryTransport(),
      userId: 'me',
    });
    expect(
      own.sendMessage({ conversationId: 'c9', text: 'x'.repeat(20) })?.text,
    ).toBe('x'.repeat(20));
  });

  it('宿主没配 userId 时回落成空串而不是崩：状态机仍然完整可用', () => {
    const { im, transport } = createConfiguredIm({
      seed: {
        conversations: [
          { id: 'c1', kind: 'single', memberIds: ['c1'], unread: 0 },
        ],
      },
    });
    transport.connect();
    im.openConversation('c1');
    expect(im.sendMessage({ text: '你好' })?.senderId).toBe('');
    // `sentFrames` 是内存 transport 的调试口，公共契约 `ImTransport` 上没有，按上面那条同样的方式收窄
    const memory = transport as ReturnType<typeof createMemoryTransport>;
    const frame = memory.sentFrames().at(-1) as Extract<
      ImFrame,
      { type: 'send' }
    >;
    expect(frame.payload.message.senderId).toBe('');
  });

  it('注入的 now() 一路传到状态机：撤回窗口与乐观消息时间戳都由它决定，测试因此完全确定', () => {
    configureIm({ now: () => 7_000_000, userId: 'me' });
    const { im } = createConfiguredIm({
      seed: {
        conversations: [
          { id: 'c1', kind: 'single', memberIds: ['me'], unread: 0 },
        ],
      },
    });
    im.openConversation('c1');
    expect(im.sendMessage({ text: '你好' })?.createdAt).toBe(7_000_000);
  });

  it('seed 一路传到 store 并参与会话列表：演示页给一批种子就能跑通整条链路', () => {
    const { im } = createConfiguredIm({
      seed: {
        conversations: [
          {
            id: 'c1',
            kind: 'group',
            memberIds: ['me', 'peer'],
            title: '项目群',
            unread: 2,
          },
        ],
        messages: [
          {
            body: '早',
            conversationId: 'c1',
            createdAt: 500,
            id: 'm1',
            kind: 'text',
            senderId: 'peer',
          },
        ],
      },
    });
    expect(im.conversations.value.map((item) => item.id)).toStrictEqual(['c1']);
    im.openConversation('c1');
    expect(im.messages.value.map((item) => item.id)).toStrictEqual(['m1']);
    expect(im.store.state.value.conversations.c1?.unread).toBe(0);
  });
});
