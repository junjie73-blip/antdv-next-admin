import type {
  AttachmentCheck,
  AttachmentInput,
  Conversation,
  ImMessage,
} from '../../src/im/index';

import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  ConversationList,
  createImStore,
  createMemoryTransport,
  ImPanel,
  MESSAGE_BOTTOM_TOLERANCE_PX,
  MESSAGE_LIST_PADDING_PX,
  MESSAGE_ROW_ESTIMATE_PX,
  MESSAGE_ROW_GAP_PX,
  MESSAGE_VIRTUALIZE_THRESHOLD,
  MessageComposer,
  MessagePane,
  useIm,
} from '../../src/im/index';

/**
 * 组件层口径：四个组件都只画 `core/` 给它们的形状，所以测试也只验「渲染 + 回抛 + 滚动位置」。
 *
 * jsdom 没有布局引擎，`clientHeight` / `scrollHeight` 恒为 0，于是贴底、翻页、虚拟窗口
 * 这三件事在原生 jsdom 里根本无法判定。这里给四个几何量装一个**确定的假布局**，并且刻意让
 * 读数自洽 —— 全部由同一套公式算出来，不伪造"读数的先后顺序"：
 * - 行高一律取 `MESSAGE_ROW_ESTIMATE_PX`，与虚拟器的估算值同值，于是「实测」与「估算」
 *   不会给出两个总高，`data-total-size` 可以闭眼算；
 * - 滚动容器的 `scrollHeight` 由内容算出来：整表模式数渲染出来的行数，虚拟模式读列表容器
 *   自己那一层高度（就是 `totalSize`），两边走的是同一个式子；
 * - `scrollTop` 的赋值按浏览器语义夹在 `[0, scrollHeight - clientHeight]`，并**同步补发一个
 *   scroll 事件**。jsdom 里程序化赋值不发事件，而浏览器会发；不补这一刀，虚拟器内部的
 *   scrollOffset 永远停在 0，渲染出来的窗口跟"我们已经在底部"这件事对不上，测出来的东西是假的。
 *
 * 真实行高、真实滚动惯性仍然只能肉眼验收，这里测的是「组件拿到这些数字之后怎么做」。
 */

const ROW_PX = MESSAGE_ROW_ESTIMATE_PX;
const GAP_PX = MESSAGE_ROW_GAP_PX;
const PAD_PX = MESSAGE_LIST_PADDING_PX;
/** 可视窗口高度：比一行高、比整表矮，贴底与翻页两条分支才都有得走 */
const CLIENT_PX = 200;

const tops = new WeakMap<Element, number>();

function isViewport(el: HTMLElement): boolean {
  return el.dataset.slot === 'scroll-area-viewport';
}

/** n 行的内容总高：上下留白 + n × 行高 + (n − 1) × 间距，即 py-4 + gap-3 */
function contentSize(rows: number): number {
  return rows === 0 ? 0 : PAD_PX * 2 + rows * ROW_PX + (rows - 1) * GAP_PX;
}

function fakeLayout(): void {
  Object.defineProperties(HTMLElement.prototype, {
    clientHeight: {
      configurable: true,
      get(this: HTMLElement) {
        return isViewport(this) ? CLIENT_PX : 0;
      },
    },
    offsetHeight: {
      configurable: true,
      get(this: HTMLElement) {
        // 只有虚拟模式挂了 data-index 的行会被 measureElement 读到；整表模式的行喂不进虚拟器
        return this.dataset.index === null ? 0 : ROW_PX;
      },
    },
    scrollHeight: {
      configurable: true,
      get(this: HTMLElement) {
        if (!isViewport(this)) return this.offsetHeight;
        const list = this.querySelector('[data-message-list]');
        if (list === null) return 0;
        if (list.dataset.messageList === 'virtual') {
          return Number(list.dataset.totalSize) || 0;
        }
        return contentSize(list.children.length);
      },
    },
    scrollTop: {
      configurable: true,
      get(this: HTMLElement) {
        return tops.get(this) ?? 0;
      },
      set(this: HTMLElement, value: number) {
        const max = Math.max(0, this.scrollHeight - this.clientHeight);
        const next = Math.min(Math.max(value, 0), max);
        // 与浏览器一致：值没变就不发事件，所以"停在顶上重复滚"不会触发第二次翻页
        if ((tops.get(this) ?? 0) === next) return;
        tops.set(this, next);
        this.dispatchEvent(new Event('scroll'));
      },
    },
  });
}

beforeEach(fakeLayout);

/** 只改值不发事件等于用户没动过，所以滚动就是赋值 —— 事件由假布局自己补发 */
function scroll(el: Element, top: number): void {
  (el as HTMLElement).scrollTop = top;
}

/** 手工发一次 scroll：给"值本来就是 0"的短列表制造一次真实的滚动判定 */
function fireScroll(el: Element): void {
  el.dispatchEvent(new Event('scroll'));
}

function scrollTopOf(el: Element): number {
  return (el as HTMLElement).scrollTop;
}

function scrollHeightOf(el: Element): number {
  return (el as HTMLElement).scrollHeight;
}

/** 还能往下滚多少 —— 0 就是贴在底部 */
function bottomGap(el: Element): number {
  return scrollHeightOf(el) - scrollTopOf(el) - CLIENT_PX;
}

/** 浏览器允许的最大滚动值（假布局按同一口径夹过） */
function maxScroll(el: Element): number {
  return Math.max(0, scrollHeightOf(el) - CLIENT_PX);
}

function viewportOf(wrapper: ReturnType<typeof mount>): HTMLElement {
  return wrapper.get('[data-slot="scroll-area-viewport"]')
    .element as HTMLElement;
}

function listEl(wrapper: ReturnType<typeof mount>): HTMLElement {
  return wrapper.get('[data-message-list]').element as HTMLElement;
}

function rowsOf(wrapper: ReturnType<typeof mount>): number {
  return wrapper.findAll('[data-message-id]').length;
}

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

/** 同一天的连续消息：分隔条只出一条，行高与条数才好算 */
function day(n: number, at = 1_700_000_000_000): ImMessage[] {
  return Array.from({ length: n }, (_, index) =>
    message(
      `m${index + 1}`,
      at + index * 60_000,
      index % 2 === 0 ? undefined : { senderId: 'me' },
    ),
  );
}

const paneProps = { messages: day(3), selfId: 'me' };

describe('messagePane · 整表渲染', () => {
  it('100 条以内整表渲染：短列表上虚拟是负收益，可视窗口比总数还大只会反复增删同一批 DOM', () => {
    const wrapper = mount(MessagePane, { props: paneProps });
    expect(listEl(wrapper).dataset.messageList).toBe('static');
    // 3 条同一天消息 = 3 行消息；分隔条只在虚拟器的行数里，整表模式数的是消息条数
    expect(rowsOf(wrapper)).toBe(3);
    // 整表模式的行没有 data-index：喂给 measureElement 只会刷警告
    expect(wrapper.findAll('[data-index]')).toHaveLength(0);
    expect(wrapper.text()).toContain('正文 m1');
  });

  it('打开面板首帧就贴底：看到的是最新消息，而不是半年前的一页', () => {
    const wrapper = mount(MessagePane, { props: paneProps });
    const viewport = viewportOf(wrapper);
    // 假布局按浏览器语义夹过，所以"贴底"就是滚到最大可滚值
    expect(scrollTopOf(viewport)).toBe(maxScroll(viewport));
    expect(bottomGap(viewport)).toBe(0);
  });

  it('自己与对方分边、只有对方那条显示名字、只有我方那条显示状态与撤回入口', () => {
    const wrapper = mount(MessagePane, {
      props: {
        messages: [
          message('mine', 1_700_000_000_000, { senderId: 'me' }),
          message('theirs', 1_700_000_060_000),
        ],
        selfId: 'me',
      },
    });
    const mine = wrapper.get('[data-message-id="mine"]');
    const theirs = wrapper.get('[data-message-id="theirs"]');
    expect(mine.attributes('data-own')).toBe('true');
    expect(theirs.attributes('data-own')).toBe('false');
    expect(theirs.text()).toContain('peer');
    // 我方那行的名字位置是空的：senderName 只在对方那一侧渲染，正文本身当然还在
    expect(mine.text()).not.toContain('peer');
    expect(mine.find('[data-action="recall"]').exists()).toBe(true);
    expect(theirs.find('[data-action="recall"]').exists()).toBe(false);
    expect(mine.find('[data-message-status]').exists()).toBe(false);
  });

  it('系统消息居中且不参与撤回与状态那一套：它既不是自己发的也不是对方发的', () => {
    const wrapper = mount(MessagePane, {
      props: {
        messages: [
          message('sys', 1_700_000_000_000, {
            body: '有人加入了群聊',
            id: 'sys',
            kind: 'system',
          }),
        ],
        selfId: 'me',
      },
    });
    expect(wrapper.get('[data-message-kind="system"]').text()).toBe(
      '有人加入了群聊',
    );
    expect(wrapper.find('[data-action="recall"]').exists()).toBe(false);
  });

  it('状态图标与文案成对出现，失败才有重发入口：只有一个红点而没有"重发"按钮等于让用户干等', () => {
    const wrapper = mount(MessagePane, {
      props: {
        messages: [
          message('bad', 1_700_000_000_000, {
            senderId: 'me',
            status: 'failed',
          }),
        ],
        selfId: 'me',
      },
    });
    expect(wrapper.get('[data-message-status]').text()).toContain('发送失败');
    expect(wrapper.find('[data-action="retry"]').exists()).toBe(true);
    wrapper.get('[data-action="retry"]').trigger('click');
    expect(wrapper.emitted('retry')?.[0]?.[0]).toMatchObject({ id: 'bad' });
  });

  it('成员表给了才做 @ 高亮，没给时原样当普通文本：没有依据的 @xxx 不该凭空染色', () => {
    const members = [{ id: 'u1', name: '李雷' }];
    const withMembers = mount(MessagePane, {
      props: {
        members,
        messages: [message('m1', 1_700_000_000_000, { body: '@李雷 看下' })],
        selfId: 'me',
      },
    });
    expect(withMembers.get('[data-segment-type="mention"]').text()).toBe(
      '@李雷',
    );
    const without = mount(MessagePane, {
      props: {
        messages: [message('m1', 1_700_000_000_000, { body: '@李雷 看下' })],
        selfId: 'me',
      },
    });
    expect(without.find('[data-segment-type]').exists()).toBe(false);
    expect(without.text()).toContain('@李雷 看下');
  });

  it('贴底容差之内新消息仍跟随到底，恰好等于容差也算贴底：差 1px 再也不跟随是这一层最经典的故障', async () => {
    const wrapper = mount(MessagePane, { props: paneProps });
    const viewport = viewportOf(wrapper);
    // 距底正好 MESSAGE_BOTTOM_TOLERANCE_PX —— 判定用的是 `<=`，这一档必须仍然跟随
    scroll(viewport, maxScroll(viewport) - MESSAGE_BOTTOM_TOLERANCE_PX);
    expect(bottomGap(viewport)).toBe(MESSAGE_BOTTOM_TOLERANCE_PX);
    await wrapper.setProps({ messages: day(4) });
    await nextTick();
    expect(scrollTopOf(viewport)).toBe(maxScroll(viewport));
  });

  it('超出容差就不算贴底：刚滚过一页的用户不该被下一条消息拽下去', async () => {
    const wrapper = mount(MessagePane, {
      props: { messages: day(10), selfId: 'me' },
    });
    const viewport = viewportOf(wrapper);
    scroll(viewport, maxScroll(viewport) - MESSAGE_BOTTOM_TOLERANCE_PX - 1);
    await wrapper.setProps({ messages: day(11) });
    await nextTick();
    expect(scrollTopOf(viewport)).toBeLessThan(maxScroll(viewport));
  });

  it('已经上翻的用户不被新消息拽回底部：看历史时被抢位置，比漏一条消息更让人上火', async () => {
    const wrapper = mount(MessagePane, { props: paneProps });
    const viewport = viewportOf(wrapper);
    scroll(viewport, 0);
    await wrapper.setProps({ messages: day(4) });
    await nextTick();
    expect(scrollTopOf(viewport)).toBe(0);
  });

  it('一条状态变化（ack、撤回）不动视窗：否则一条 ack 就把用户从历史里拽回底部', async () => {
    const wrapper = mount(MessagePane, { props: paneProps });
    const viewport = viewportOf(wrapper);
    scroll(viewport, 0);
    const patched = day(3).map((item) => ({
      ...item,
      status: 'read' as const,
    }));
    await wrapper.setProps({ messages: patched });
    await nextTick();
    expect(scrollTopOf(viewport)).toBe(0);
    // 状态只挂在我方那条上：day(3) 里只有第 2 条是自己发的，其余两条 ack 无可显示
    expect(wrapper.findAll('[data-message-status]')).toHaveLength(1);
  });

  it('切会话等于重新打开面板：整表换掉时贴底归位', async () => {
    const wrapper = mount(MessagePane, { props: paneProps });
    const viewport = viewportOf(wrapper);
    scroll(viewport, 0);
    await wrapper.setProps({
      messages: day(2, 1_800_000_000_000).map((item) => ({
        ...item,
        conversationId: 'c2',
      })),
    });
    await nextTick();
    expect(scrollTopOf(viewport)).toBe(maxScroll(viewport));
  });

  it('上翻翻页前插历史不跳位：内容多出来多少，scrollTop 就补多少（行高 + 间距一起算）', async () => {
    const wrapper = mount(MessagePane, {
      props: { messages: day(10), selfId: 'me' },
    });
    const viewport = viewportOf(wrapper);
    scroll(viewport, 500);
    const at = 1_700_000_000_000;
    const older = Array.from({ length: 5 }, (_, index) =>
      message(`h${index + 1}`, at - (5 - index) * 60_000),
    );
    await wrapper.setProps({ messages: [...older, ...day(10)] });
    await nextTick();
    // 前插 5 行同一天消息：不新增分隔条，长出来的就是 5 × (行高 + 间距)
    expect(scrollTopOf(viewport)).toBe(500 + 5 * (ROW_PX + GAP_PX));
  });

  it('翻到顶才请求上一页，停在顶上重复滚动不连发：更早的消息在列表上方，`loadHistory` 带的是 before 游标', () => {
    const wrapper = mount(MessagePane, {
      props: { messages: day(10), selfId: 'me' },
    });
    const viewport = viewportOf(wrapper);
    // 打开面板落在底部：首帧那次程序化滚动不该发历史请求
    expect(bottomGap(viewport)).toBe(0);
    expect(wrapper.emitted('loadHistory')).toBeUndefined();
    // 半途上翻不算到顶
    scroll(viewport, maxScroll(viewport) - 100);
    expect(wrapper.emitted('loadHistory')).toBeUndefined();
    // 到顶 —— 这才是该发请求的那一刻
    scroll(viewport, 0);
    expect(wrapper.emitted('loadHistory')).toHaveLength(1);
    // 同值赋值不产生滚动事件，停在顶上重复抖滚轮不该连发第二页
    scroll(viewport, 0);
    expect(wrapper.emitted('loadHistory')).toHaveLength(1);
    // 24px 触顶档位内的小幅挪动也没离开过"顶"，同样不重复发
    scroll(viewport, 12);
    expect(wrapper.emitted('loadHistory')).toHaveLength(1);
    // 真的走开再回来才算一次新的到顶
    scroll(viewport, 600);
    scroll(viewport, 0);
    expect(wrapper.emitted('loadHistory')).toHaveLength(2);
  });

  it('短列表不翻页、在途时也不连发：scrollTop 天生是 0，没有"能不能再往上滚"这个条件就会刚打开就打一次请求', () => {
    const short = mount(MessagePane, {
      props: { messages: day(1), selfId: 'me' },
    });
    const shortViewport = viewportOf(short);
    // 内容比可视窗口还矮：maxScroll 是 0，只能手工造一次"滚动"来验 canScrollUp 那一半条件
    expect(maxScroll(shortViewport)).toBe(0);
    fireScroll(shortViewport);
    expect(short.emitted('loadHistory')).toBeUndefined();
    short.unmount();

    const wrapper = mount(MessagePane, {
      props: { loadingHistory: true, messages: day(10), selfId: 'me' },
    });
    const viewport = viewportOf(wrapper);
    scroll(viewport, 600);
    scroll(viewport, 0);
    expect(wrapper.emitted('loadHistory')).toBeUndefined();
  });

  it('宿主覆盖 virtualize-threshold 与 bottom-threshold：两个旋钮都是按实例给的，不是全局配置', async () => {
    const small = mount(MessagePane, {
      props: { messages: day(3), selfId: 'me', virtualizeThreshold: 2 },
    });
    expect(listEl(small).dataset.messageList).toBe('virtual');
    small.unmount();

    const loose = mount(MessagePane, {
      props: { bottomThreshold: 500, messages: day(10), selfId: 'me' },
    });
    const viewport = viewportOf(loose);
    // 距底 400px：默认 24 的容差里早就断开，被宿主放宽到 500 之后就该继续跟随
    scroll(viewport, maxScroll(viewport) - 400);
    await loose.setProps({ messages: day(11) });
    await nextTick();
    expect(scrollTopOf(viewport)).toBe(maxScroll(viewport));
  });

  it('空列表给可解释的空态而不是留白', () => {
    const wrapper = mount(MessagePane, {
      props: { emptyText: '打个招呼吧', messages: [], selfId: 'me' },
    });
    expect(wrapper.text()).toContain('打个招呼吧');
    expect(rowsOf(wrapper)).toBe(0);
  });

  it('附件走默认兜底渲染并回抛 openAttachment：预览大图与上传都归宿主', async () => {
    const withFile = message('f1', 1_700_000_000_000, {
      body: { attachments: [{ name: 'a.png', size: 12 }], text: '看图' },
      kind: 'file',
    });
    const wrapper = mount(MessagePane, {
      props: { messages: [withFile], selfId: 'me' },
    });
    expect(wrapper.get('[data-attachment-name]').text()).toContain('a.png');
    await wrapper.get('[data-attachment-name]').get('button').trigger('click');
    expect(wrapper.emitted('openAttachment')?.[0]?.[0]).toMatchObject({
      name: 'a.png',
    });
    expect(wrapper.emitted('openAttachment')?.[0]?.[1]).toMatchObject({
      id: 'f1',
    });
  });

  it('宿主接了 attachment 插槽就用宿主的，默认兜底让位', () => {
    const withFile = message('f1', 1_700_000_000_000, {
      body: { attachments: [{ name: 'a.png', size: 12 }], text: '看图' },
      kind: 'file',
    });
    const wrapper = mount(MessagePane, {
      props: { messages: [withFile], selfId: 'me' },
      slots: {
        attachment: `<template #default="s"><i data-host-attachment>{{ s.attachment.name }}</i></template>`,
      },
    });
    expect(wrapper.get('[data-host-attachment]').text()).toBe('a.png');
    expect(wrapper.find('[data-attachment-name]').exists()).toBe(false);
  });
});

describe('messagePane · 虚拟渲染', () => {
  /** 虚拟模式的贴底是 `nextTick` 里追的，先让首帧落地再断言窗口 */
  async function mountVirtual(count: number) {
    const wrapper = mount(MessagePane, {
      props: { messages: day(count), selfId: 'me' },
    });
    await nextTick();
    return wrapper;
  }

  /** 虚拟器写在 `style` 里的落点：直接读 DOM 属性，绕开 `attributes()` 的重载解析 */
  function translateY(el: Element): number {
    return Number(
      /translateY\(([\d.]+)px\)/.exec(el.getAttribute('style') ?? '')?.[1],
    );
  }

  function indexes(wrapper: ReturnType<typeof mount>): number[] {
    return wrapper
      .findAll('[data-index]')
      .map((row) => Number(row.element.dataset.index));
  }

  it('跨过阈值才虚拟：DOM 里只有窗口那几行，其余交给占位高度撑滚动条', async () => {
    const long = await mountVirtual(MESSAGE_VIRTUALIZE_THRESHOLD + 1);
    expect(listEl(long).dataset.messageList).toBe('virtual');
    const rendered = rowsOf(long);
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThanOrEqual(20);
    expect(rendered).toBeLessThan(MESSAGE_VIRTUALIZE_THRESHOLD + 1);
  });

  it('阈值是消息条数而不是行数：刚好等于阈值仍整表渲染，多一条才切坐标系', async () => {
    const atThreshold = mount(MessagePane, {
      props: { messages: day(MESSAGE_VIRTUALIZE_THRESHOLD), selfId: 'me' },
    });
    expect(listEl(atThreshold).dataset.messageList).toBe('static');
    atThreshold.unmount();
    const over = await mountVirtual(MESSAGE_VIRTUALIZE_THRESHOLD + 1);
    expect(listEl(over).dataset.messageList).toBe('virtual');
    // 行数（含分隔条）不该把短列表推进虚拟模式：101 条同一天消息只有 102 行
    expect(over.findAll('[data-message-id]').length).toBeLessThanOrEqual(20);
  });

  it('贴底时窗口停在尾部：最新消息在 DOM 里，最老的那几条根本不存在', async () => {
    const long = await mountVirtual(200);
    const viewport = viewportOf(long);
    expect(scrollTopOf(viewport)).toBe(maxScroll(viewport));
    expect(bottomGap(viewport)).toBe(0);
    expect(long.find('[data-message-id="m200"]').exists()).toBe(true);
    expect(long.find('[data-message-id="m1"]').exists()).toBe(false);
  });

  it('总高与整表渲染同式：paddingStart + Σ行 + (n−1)×gap + paddingEnd，且真的挂成容器高度', async () => {
    const long = await mountVirtual(101);
    // 101 条同一天消息 + 1 条分隔条 = 102 行
    const expected = contentSize(102);
    const list = listEl(long);
    expect(Number(list.dataset.totalSize)).toBe(expected);
    expect(list.style.height).toBe(`${expected}px`);
    expect(scrollHeightOf(viewportOf(long))).toBe(expected);
  });

  it('实测行高与估算同值时窗口不跳：每行 translateY 落在 行高+间距 的格点上', async () => {
    const long = await mountVirtual(200);
    const rows = long.findAll('[data-index]');
    expect(rows.length).toBeGreaterThan(1);
    const starts = rows.map((row) => translateY(row.element));
    expect(starts.at(-1)!).toBeGreaterThan(starts[0]!);
    for (let i = 1; i < starts.length; i += 1) {
      expect(starts[i]! - starts[i - 1]!).toBe(ROW_PX + GAP_PX);
    }
    for (const row of rows) {
      expect(row.classes().join(' ')).toContain('will-change-transform');
    }
  });

  it('上翻后窗口换成开头几行：第 0 行落在 paddingStart 那一格，不是 0', async () => {
    const long = await mountVirtual(200);
    scroll(viewportOf(long), 0);
    await nextTick();
    const rows = long.findAll('[data-index]');
    expect(rows.length).toBeGreaterThan(0);
    expect(indexes(long)[0]).toBe(0);
    expect(translateY(rows[0]!.element)).toBe(PAD_PX);
    expect(long.find('[data-message-id="m1"]').exists()).toBe(true);
  });

  it('overscan 让窗口比可视区多几行：滚动时不该露出空白', async () => {
    const long = await mountVirtual(200);
    const viewport = viewportOf(long);
    scroll(viewport, maxScroll(viewport) - CLIENT_PX);
    await nextTick();
    const rows = indexes(long);
    // 可视区 200px 只装得下两行多，DOM 里却有一整窗 + 上下 overscan
    expect(rows.length).toBeGreaterThan(
      Math.ceil(CLIENT_PX / (ROW_PX + GAP_PX)),
    );
    const starts = long
      .findAll('[data-index]')
      .map((row) => translateY(row.element));
    expect(Math.max(...starts) - Math.min(...starts)).toBeGreaterThanOrEqual(
      CLIENT_PX,
    );
  });

  it('贴底时来新消息，虚拟模式照样跟到底；已经上翻就不抢位置', async () => {
    const follower = await mountVirtual(200);
    const followerViewport = viewportOf(follower);
    await follower.setProps({ messages: day(201) });
    await nextTick();
    await nextTick();
    expect(follower.find('[data-message-id="m201"]').exists()).toBe(true);
    expect(bottomGap(followerViewport)).toBe(0);

    const watcher = await mountVirtual(200);
    const watcherViewport = viewportOf(watcher);
    scroll(watcherViewport, 3000);
    const before = scrollTopOf(watcherViewport);
    await watcher.setProps({ messages: day(201) });
    await nextTick();
    expect(scrollTopOf(watcherViewport)).toBe(before);
  });

  it('滚动位置由真实 scroll 事件维护：虚拟模式下贴底与否跟整表模式同一套判定', async () => {
    const long = await mountVirtual(200);
    const viewport = viewportOf(long);
    expect(bottomGap(viewport)).toBe(0);
    scroll(viewport, 100);
    expect(scrollTopOf(viewport)).toBe(100);
    expect(bottomGap(viewport)).toBeGreaterThan(MESSAGE_BOTTOM_TOLERANCE_PX);
  });

  /** 更早的一页：id 必须与现有表不重叠，否则"首条变了"这个前插信号根本判不出来 */
  function olderPage(n: number, at: number): ImMessage[] {
    return Array.from({ length: n }, (_, index) =>
      message(`o${index + 1}`, at + index * 60_000),
    );
  }

  it('虚拟模式的前插按消息 key 补回原位：anchorTo 锚到的是上沿那行，而那一行常常是分隔条', async () => {
    const long = await mountVirtual(200);
    const viewport = viewportOf(long);
    scroll(viewport, 2000);
    const sizeBefore = Number(listEl(long).dataset.totalSize);
    // 换出一整页（21 行：1 条分隔条 + 20 条消息），两种模式下的行数口径不能混
    await long.setProps({
      messages: [...olderPage(20, 1_600_000_000_000), ...day(200)],
    });
    await nextTick();
    expect(Number(listEl(long).dataset.totalSize)).toBe(
      sizeBefore + 21 * (ROW_PX + GAP_PX),
    );
    // 视窗上方多了 21 行 → 位置该往下挪 21 × (行高 + 间距)，用户眼前那条消息还在原处
    expect(scrollTopOf(viewport)).toBe(2000 + 21 * (ROW_PX + GAP_PX));
    // 锚点那条消息必须真的在窗口里：掉了就说明补的是个猜出来的数
    expect(long.find('[data-message-id="m22"]').exists()).toBe(true);
  });

  it('前插与追加落在同一次 flush 时也补位置，且不把上翻的用户拽回底部：判据是"上方多了行"而不是末条变了', async () => {
    const long = await mountVirtual(200);
    const viewport = viewportOf(long);
    scroll(viewport, 2000);
    // 翻页落地的同时对方又发了一条：`classifyChange` 会判成 append，只看它就漏掉了前插的 21 行
    await long.setProps({
      messages: [
        ...olderPage(20, 1_600_000_000_000),
        ...day(200),
        message('m201', 1_700_000_000_000 + 200 * 60_000),
      ],
    });
    await nextTick();
    expect(scrollTopOf(viewport)).toBe(2000 + 21 * (ROW_PX + GAP_PX));
    expect(bottomGap(viewport)).toBeGreaterThan(MESSAGE_BOTTOM_TOLERANCE_PX);
  });

  it('锚点那条消息已经不在表里时一律不动视窗：一边前插一边裁尾时，猜一个位置比不补更糟', async () => {
    const long = await mountVirtual(200);
    const viewport = viewportOf(long);
    scroll(viewport, 2000);
    // 同一批里"上面进来 30 条更早的、下面被裁掉 m1..m30"：锚点 m22 已经不在表里了
    await long.setProps({
      messages: [...olderPage(30, 1_600_000_000_000), ...day(200).slice(30)],
    });
    await nextTick();
    expect(scrollTopOf(viewport)).toBe(2000);
  });

  it('跨过阈值那一次坐标系整个换掉：贴底就回到底部，不抢正在上翻的用户的位置', async () => {
    const wrapper = mount(MessagePane, { props: paneProps });
    const viewport = viewportOf(wrapper);
    await wrapper.setProps({ messages: day(150) });
    await nextTick();
    expect(listEl(wrapper).dataset.messageList).toBe('virtual');
    expect(bottomGap(viewport)).toBeLessThanOrEqual(
      MESSAGE_BOTTOM_TOLERANCE_PX,
    );

    const other = await mountVirtual(150);
    const otherViewport = viewportOf(other);
    scroll(otherViewport, 80);
    // 只裁掉前面 60 条、末条不动 —— 跨阈值是"坐标系换掉"，不是"切会话"（后者由上面那条
    // '切会话等于重新打开面板' 专门管），所以这里绝不该把正在看历史的用户拽回底部
    await other.setProps({ messages: day(150).slice(60) });
    await nextTick();
    expect(listEl(other).dataset.messageList).toBe('static');
    expect(scrollTopOf(otherViewport)).toBe(80);
  });

  it('加载更早的消息的提示挂在滚动容器之外：它一进虚拟容器就会移动原点，翻页时整列表跳一格', async () => {
    const wrapper = mount(MessagePane, {
      props: { loadingHistory: true, messages: day(3), selfId: 'me' },
    });
    const hint = wrapper.get('[data-history-loading]');
    expect(hint.text()).toContain('正在加载');
    expect(
      wrapper
        .find('[data-slot="scroll-area-viewport"] [data-history-loading]')
        .exists(),
    ).toBe(false);
    await wrapper.setProps({ loadingHistory: false });
    expect(wrapper.find('[data-history-loading]').exists()).toBe(false);
  });

  it('卸载后不再改滚动位置：组件都没了还在写 scrollTop 就是漏了清理', async () => {
    const long = await mountVirtual(200);
    const viewport = viewportOf(long);
    long.unmount();
    expect(() => scroll(viewport, 42)).not.toThrow();
    expect(scrollTopOf(viewport)).toBe(42);
  });
});

describe('messageComposer', () => {
  function composer(
    options: {
      limits?: Record<string, number>;
      modelValue?: string;
      props?: Record<string, unknown>;
    } = {},
  ) {
    return mount(MessageComposer, {
      props: {
        limits: { maxMessageLength: 5, ...options.limits },
        modelValue: options.modelValue ?? '',
        ...options.props,
      },
    });
  }

  it('超限三重拦截：计数变红、按钮禁用、原因就地显示，而不是发出去让服务端拒', async () => {
    // 6 个字符对 5 字上限：计数与那句原因都从这 1 的差额里来
    const wrapper = composer({ modelValue: '六个字太长了' });
    expect(wrapper.get('[data-composer-count]').text()).toContain('6/5');
    expect(
      wrapper.get('[data-action="send"]').attributes('disabled'),
    ).toBeDefined();
    await wrapper.get('[data-action="send"]').trigger('click');
    expect(wrapper.emitted('send')).toBeUndefined();
    expect(wrapper.get('[data-composer-block]').text()).toContain('超过 5 字');
  });

  it('enter 发送并清空草稿，Shift+Enter 交给原生换行：判错一个就是中文用户的日常误发', async () => {
    const wrapper = composer({ modelValue: '你好' });
    await wrapper
      .get('[data-composer-input]')
      .trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('send')?.[0]).toStrictEqual([
      { attachments: [], mentions: [], text: '你好' },
    ]);
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toStrictEqual(['']);
    await wrapper.setProps({ modelValue: '第二句' });
    // 手工派发才拿得到事件对象本身：`trigger` 只回一个 nextTick，而这里要验的正是"没 preventDefault"
    const shiftEnter = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
      shiftKey: true,
    });
    wrapper.get('[data-composer-input]').element.dispatchEvent(shiftEnter);
    await nextTick();
    expect(shiftEnter.defaultPrevented).toBe(false);
    expect(wrapper.emitted('send')).toHaveLength(1);
  });

  it('关掉 enterToSend 后 Enter 只换行，Ctrl+Enter 才发：客服场景误发代价高', async () => {
    const wrapper = composer({
      modelValue: '你好',
      props: { enterToSend: false },
    });
    await wrapper
      .get('[data-composer-input]')
      .trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('send')).toBeUndefined();
    await wrapper
      .get('[data-composer-input]')
      .trigger('keydown', { ctrlKey: true, key: 'Enter' });
    expect(wrapper.emitted('send')).toHaveLength(1);
  });

  it('输入法组合中的 Enter 不发送：只看 isComposing 不够，Safari 会在 compositionend 之后补一个 keydown', async () => {
    const wrapper = composer({ modelValue: '你好' });
    const area = wrapper.get('[data-composer-input]');
    await area.trigger('keydown', { isComposing: true, key: 'Enter' });
    expect(wrapper.emitted('send')).toBeUndefined();
    await area.trigger('compositionstart');
    await area.trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('send')).toBeUndefined();
    await area.trigger('compositionend');
    await area.trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('send')).toHaveLength(1);
  });

  it('没有可选会话时禁用发送并给原因，而不是让用户点了没反应', async () => {
    const wrapper = composer({ modelValue: '你好', props: { active: false } });
    expect(
      wrapper.get('[data-action="send"]').attributes('disabled'),
    ).toBeDefined();
    await wrapper.get('[data-action="send"]').trigger('click');
    expect(wrapper.get('[data-composer-block]').text()).toBe('还没有选择会话');
  });

  it('空正文但有已通过校验的附件算一条合法消息；正文与附件都空就不许发', async () => {
    const wrapper = composer();
    const vm = wrapper.vm as unknown as {
      addFiles: (inputs: AttachmentInput[]) => AttachmentCheck[];
    };
    vm.addFiles([{ name: 'a.png', size: 1000, type: 'image/png' }]);
    await nextTick();
    expect(wrapper.emitted('send')).toBeUndefined();
    await wrapper.get('[data-action="send"]').trigger('click');
    expect(wrapper.emitted('send')?.[0]).toStrictEqual([
      {
        attachments: [{ name: 'a.png', size: 1000, type: 'image/png' }],
        mentions: [],
        text: '',
      },
    ]);
  });

  it('附件在本地按 limits 准入，被拒的原地列出原因并可移除：上传成功失败由宿主决定，本包不碰网络', async () => {
    const wrapper = composer({ limits: { maxAttachmentSizeMb: 1 } });
    const vm = wrapper.vm as unknown as {
      addFiles: (inputs: AttachmentInput[]) => AttachmentCheck[];
    };
    const rejected = vm.addFiles([
      { name: '/tmp/ok.png', size: 1000, type: 'image/png' },
      { name: 'big.png', size: 2_000_000, type: 'image/png' },
    ]);
    await nextTick();
    expect(rejected.map((item) => item.attachment.name)).toStrictEqual([
      'big.png',
    ]);
    const cards = wrapper.findAll('[data-slot="im-composer"] [data-state]');
    expect(cards.map((card) => card.attributes('data-state'))).toStrictEqual([
      'idle',
      'error',
    ]);
    expect(cards[1]!.text()).toContain('超过 1MB 上限');
    await cards[1]!.get('[data-action="remove"]').trigger('click');
    expect(wrapper.findAll('[data-state]')).toHaveLength(1);
    await wrapper.get('[data-action="send"]').trigger('click');
    expect(wrapper.emitted('send')?.[0]).toStrictEqual([
      {
        attachments: [{ name: 'ok.png', size: 1000, type: 'image/png' }],
        mentions: [],
        text: '',
      },
    ]);
  });

  it('一条消息的附件数有上限，超出的部分就地说明：静默丢掉用户选的附件最难解释', async () => {
    const wrapper = composer({ limits: { maxAttachmentsPerMessage: 1 } });
    const vm = wrapper.vm as unknown as {
      addFiles: (inputs: AttachmentInput[]) => AttachmentCheck[];
    };
    vm.addFiles([
      { name: 'a.png', size: 10, type: 'image/png' },
      { name: 'b.png', size: 10, type: 'image/png' },
    ]);
    await nextTick();
    expect(wrapper.findAll('[data-state]')).toHaveLength(1);
    expect(wrapper.get('[data-composer-block]').text()).toContain(
      '最多 1 个附件',
    );
  });

  it('没注入 createObjectUrl 就不自己造 blob URL：界面少一张缩略图，远好过稳定泄漏', async () => {
    // 带上 source：不带的话两半都只会因为"没有原始对象"而没预览，测的就不是 createObjectUrl 了
    const inputs: AttachmentInput[] = [
      { name: 'a.png', size: 10, source: { size: 10 }, type: 'image/png' },
    ];
    const wrapper = composer();
    (
      wrapper.vm as unknown as {
        addFiles: (items: AttachmentInput[]) => AttachmentCheck[];
      }
    ).addFiles(inputs);
    await nextTick();
    expect(wrapper.find('[data-attachment-preview]').exists()).toBe(false);
    wrapper.unmount();

    const seen: unknown[] = [];
    const withUrl = mount(MessageComposer, {
      props: {
        createObjectUrl: (source: unknown) => {
          seen.push(source);
          return 'blob:from-host';
        },
        limits: { maxMessageLength: 5 },
        modelValue: '',
      },
    });
    (
      withUrl.vm as unknown as {
        addFiles: (items: AttachmentInput[]) => AttachmentCheck[];
      }
    ).addFiles(inputs);
    await nextTick();
    expect(withUrl.get('[data-attachment-preview]').attributes('src')).toBe(
      'blob:from-host',
    );
    // 递给宿主的必须是那个原始对象：本包不读 File API，只把它原样交还给握有 File 的宿主
    expect(seen).toStrictEqual([{ size: 10 }]);
  });

  it('typing 上行在界面层再节流一次：宿主可能直接绑 textarea，而不经过 useIm', async () => {
    let nowValue = 5000;
    const wrapper = composer();
    (
      wrapper.vm as unknown as { configureNow: (next?: () => number) => void }
    ).configureNow(() => nowValue);
    const area = wrapper.get('[data-composer-input]');
    await area.trigger('input');
    await area.trigger('input');
    expect(wrapper.emitted('typing')).toHaveLength(1);
    nowValue = 5000 + 2000;
    await area.trigger('input');
    expect(wrapper.emitted('typing')).toHaveLength(2);
  });

  it('throttleTyping: false 时完全不发 typing：关掉通知是宿主的决定', async () => {
    const wrapper = composer({ props: { throttleTyping: false } });
    await wrapper.get('[data-composer-input]').trigger('input');
    expect(wrapper.emitted('typing')).toBeUndefined();
  });

  it('光标处敲 @ 打开候选面板，宿主选定后只替换过滤串并带上 mentions', async () => {
    const wrapper = mount(MessageComposer, {
      props: {
        limits: { maxMessageLength: 20 },
        members: [{ id: 'u1', name: '王 小 二' }],
        modelValue: '@王',
      },
      slots: {
        mention: `<template #default="s"><div data-mention-panel><span data-mention-query>{{ s.query }}</span><button data-mention-pick @click="s.insert('王 小 二')">选</button></div></template>`,
      },
    });
    const area = wrapper.get('[data-composer-input]')
      .element as HTMLTextAreaElement;
    Object.defineProperty(area, 'selectionStart', {
      configurable: true,
      get: () => 2,
    });
    await wrapper.get('[data-composer-input]').trigger('input');
    expect(wrapper.get('[data-mention-query]').text()).toBe('王');
    await wrapper.get('[data-mention-pick]').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toStrictEqual([
      '@王 小 二 ',
    ]);
    await wrapper.setProps({ modelValue: '@王 小 二 帮我看下' });
    await wrapper.get('[data-action="send"]').trigger('click');
    expect(wrapper.emitted('send')?.[0]?.[0]).toMatchObject({
      mentions: ['u1'],
    });
  });

  it('粘贴多行时面板不跟着弹出来：过滤串里有换行说明这个 @ 已经打完了', async () => {
    const wrapper = mount(MessageComposer, {
      props: {
        limits: { maxMessageLength: 20 },
        members: [{ id: 'u1', name: '李雷' }],
        modelValue: '@李\n下一行',
      },
      slots: {
        mention: `<template #default><i data-mention-panel>面板</i></template>`,
      },
    });
    const area = wrapper.get('[data-composer-input]')
      .element as HTMLTextAreaElement;
    Object.defineProperty(area, 'selectionStart', {
      configurable: true,
      get: () => 4,
    });
    await wrapper.get('[data-composer-input]').trigger('input');
    expect(wrapper.find('[data-mention-panel]').exists()).toBe(false);
    Object.defineProperty(area, 'selectionStart', {
      configurable: true,
      get: () => 2,
    });
    await wrapper.get('[data-composer-input]').trigger('input');
    expect(wrapper.find('[data-mention-panel]').exists()).toBe(true);
  });

  it('成员表没给时 @ 按钮禁用：没有候选人名单的 @ 只会让用户白点一次', () => {
    const wrapper = composer();
    expect(
      wrapper.get('[data-action="mention"]').attributes('disabled'),
    ).toBeDefined();
    wrapper.unmount();
    const withMembers = mount(MessageComposer, {
      props: {
        limits: { maxMessageLength: 5 },
        members: [{ id: 'u1', name: '李雷' }],
        modelValue: '',
      },
    });
    expect(
      withMembers.get('[data-action="mention"]').attributes('disabled'),
    ).toBeUndefined();
  });
});

describe('conversationList', () => {
  const conversations: Conversation[] = [
    {
      id: 'c1',
      kind: 'single',
      lastMessageAt: 1_700_000_000_000,
      memberIds: ['peer'],
      title: '张三',
      unread: 2,
    },
    {
      id: 'c2',
      kind: 'group',
      lastMessageAt: 1_700_000_100_000,
      memberIds: ['p2', 'me'],
      unread: 0,
    },
    {
      id: 'c3',
      kind: 'single',
      lastMessageAt: 1_700_000_200_000,
      memberIds: ['peer'],
      unread: 140,
    },
  ];

  it('按传进来的顺序画，不自己再排一遍：排序口径住在 reducer，写两遍就会打架', () => {
    const wrapper = mount(ConversationList, { props: { conversations } });
    expect(
      wrapper
        .findAll('[data-conversation-id]')
        .map((row) => row.attributes('data-conversation-id')),
    ).toStrictEqual(['c1', 'c2', 'c3']);
    wrapper.get('[data-conversation-id="c1"]').trigger('click');
    expect(wrapper.emitted('select')?.[0]).toStrictEqual(['c1']);
  });

  it('当前项只加高亮类并标 data-current：配色走 token，组件不自己写颜色', () => {
    const wrapper = mount(ConversationList, {
      props: { conversations, currentId: 'c2' },
    });
    expect(
      wrapper.get('[data-conversation-id="c2"]').attributes('data-current'),
    ).toBe('true');
    expect(
      wrapper.get('[data-conversation-id="c1"]').attributes('data-current'),
    ).toBe('false');
  });

  it('未读超过 99 折叠成 99+，并换一档视觉：红点变宽会把标题挤走', () => {
    const wrapper = mount(ConversationList, { props: { conversations } });
    expect(wrapper.get('[data-conversation-id="c1"]').text()).toContain('2');
    expect(wrapper.get('[data-conversation-id="c3"]').text()).toContain('99+');
  });

  it('没未读时才看在线状态：一个红点和一枚绿点同时挂在一个会话上是互相矛盾的陈述', () => {
    // 两个会话的头像人物都在线：c1 有未读所以只该有红点，c2 没未读才轮到那枚绿点
    const wrapper = mount(ConversationList, {
      props: { conversations, presences: { p2: 'online', peer: 'online' } },
    });
    expect(
      wrapper
        .find('[data-conversation-id="c2"] [data-presence="online"]')
        .exists(),
    ).toBe(true);
    expect(wrapper.find('[data-presence]').exists()).toBe(true);
    expect(
      wrapper.find('[data-conversation-id="c1"] [data-presence]').exists(),
    ).toBe(false);
  });

  /**
   * 真实宿主的 `memberIds` 与服务端会话表同形：`[我, 对方]`。
   * 只按下标取第一个就会把头像与那枚在线圆点挂到自己身上 —— 圆点永远不亮，
   * 而上面的用例用的夹具恰好把对方写在第一位，所以包内全绿、页面上看不见。
   */
  it('给了 selfId 时头像与在线圆点取"第一个不是自己的成员"：宿主按服务端顺序给成员表是常态', () => {
    const peersFirstReversed: Conversation[] = [
      {
        id: 'c1',
        kind: 'single',
        lastMessageAt: 1,
        memberIds: ['me', 'peer'],
        title: '李珊',
        unread: 0,
      },
    ];
    const withSelf = mount(ConversationList, {
      props: {
        conversations: peersFirstReversed,
        presences: { peer: 'online' },
        selfId: 'me',
      },
    });
    expect(
      withSelf
        .find('[data-conversation-id="c1"] [data-presence="online"]')
        .exists(),
    ).toBe(true);
    withSelf.unmount();
    // 没给 selfId 时保持旧约定：谁排第一显示谁，不破坏已经把手排在前面的宿主
    const withoutSelf = mount(ConversationList, {
      props: {
        conversations: peersFirstReversed,
        presences: { peer: 'online' },
      },
    });
    expect(withoutSelf.find('[data-presence]').exists()).toBe(false);
  });

  it('群聊没标题时用"群聊"而不是裸 id；titleOf 覆盖一切：显示什么由宿主决定，组件不猜', () => {
    const wrapper = mount(ConversationList, { props: { conversations } });
    expect(wrapper.get('[data-conversation-id="c2"]').text()).toContain('群聊');
    expect(wrapper.get('[data-conversation-id="c3"]').text()).toContain('c3');
    wrapper.unmount();
    const titled = mount(ConversationList, {
      props: { conversations, titleOf: (c: Conversation) => `会话 ${c.id}` },
    });
    expect(titled.get('[data-conversation-id="c2"]').text()).toContain(
      '会话 c2',
    );
  });

  it('头像地址由宿主给，没给就退化成名字首字：包不知道宿主的文件存哪', () => {
    const wrapper = mount(ConversationList, {
      props: {
        avatarOf: (id: string) => `https://cdn/${id}.png`,
        conversations,
      },
    });
    expect(
      wrapper.get('[data-conversation-id="c1"] img').attributes('src'),
    ).toBe('https://cdn/peer.png');
    wrapper.unmount();
    const fallback = mount(ConversationList, { props: { conversations } });
    expect(fallback.get('[data-conversation-id="c1"]').text()).toContain('张');
  });

  it('空列表与加载中各说各的：加载中还喊"还没有会话"就是骗用户', () => {
    const empty = mount(ConversationList, {
      props: { conversations: [], emptyText: '先去联系人里发起' },
    });
    expect(empty.text()).toContain('先去联系人里发起');
    empty.unmount();
    const loading = mount(ConversationList, {
      props: { conversations: [], loading: true },
    });
    expect(loading.text()).toContain('加载中');
    expect(loading.text()).not.toContain('还没有会话');
  });

  it('摘要由组合层算好传进来，缺省就留空而不是显示 undefined：列表项不认识消息表', () => {
    const wrapper = mount(ConversationList, {
      props: { conversations, summaries: { c1: '今天下午三点开会' } },
    });
    expect(wrapper.get('[data-conversation-id="c1"]').text()).toContain(
      '今天下午三点开会',
    );
    expect(wrapper.get('[data-conversation-id="c2"]').text()).not.toContain(
      'undefined',
    );
  });
});

describe('imPanel', () => {
  function panel(
    messages: Record<string, ImMessage[]>,
    options: { userId?: string } = {},
  ) {
    const transport = createMemoryTransport({
      server: (frame, emit) => {
        if (frame.type !== 'send') return;
        emit({
          payload: { clientId: frame.payload.message.id, status: 'sent' },
          type: 'ack',
        });
      },
    });
    const seed = {
      conversations: [
        {
          id: 'c1',
          kind: 'single' as const,
          lastMessageAt: 1_700_000_000_000,
          memberIds: ['u1', 'me'],
          unread: 2,
        },
        {
          id: 'c2',
          kind: 'single' as const,
          lastMessageAt: 1_600_000_000_000,
          memberIds: ['u2', 'me'],
          unread: 0,
        },
      ],
    };
    const store = createImStore(seed);
    for (const [conversationId, list] of Object.entries(messages)) {
      for (const item of list) {
        store.commit((state) => ({
          ...state,
          messages: { ...state.messages, [conversationId]: [item] },
        }));
      }
    }
    const im = useIm({ store, transport, userId: options.userId ?? 'me' });
    return {
      im,
      store,
      transport,
      wrapper: mount(ImPanel, {
        props: { im, selfId: options.userId ?? 'me' },
      }),
    };
  }

  it('三栏装配：会话列表、消息流、输入区各归各位，标题取会话名', async () => {
    const { transport, wrapper } = panel({
      c1: [message('m1', 1_700_000_000_000)],
    });
    transport.connect();
    await nextTick();
    expect(wrapper.find('[data-slot="im-panel"]').exists()).toBe(true);
    expect(
      wrapper
        .find('[data-panel-aside] [data-slot="im-conversation-list"]')
        .exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-panel-main] [data-slot="im-message-pane"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-panel-main] [data-slot="im-composer"]').exists(),
    ).toBe(true);
    wrapper.get('[data-conversation-id="c1"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-panel-title]').text()).toBe('c1');
    expect(wrapper.text()).toContain('正文 m1');
  });

  it('摘要由消息表算给列表：列表项不认识消息表，组合层负责压成一行字', async () => {
    const { transport, wrapper } = panel({
      c1: [message('m1', 1_700_000_000_000)],
    });
    transport.connect();
    await nextTick();
    expect(wrapper.get('[data-conversation-id="c1"]').text()).toContain(
      '正文 m1',
    );
  });

  it('点会话即清红点：正在看的会话不该还挂着一个数字', async () => {
    const { transport, wrapper } = panel({});
    transport.connect();
    await nextTick();
    expect(wrapper.get('[data-conversation-id="c1"]').text()).toContain('2');
    wrapper.get('[data-conversation-id="c1"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-unread-count]').exists()).toBe(false);
  });

  it('草稿按会话分桶：切走再切回来，没发出去的字还在', async () => {
    const { transport, wrapper } = panel({});
    transport.connect();
    await nextTick();
    wrapper.get('[data-conversation-id="c1"]').trigger('click');
    await flushPromises();
    await wrapper
      .findComponent(MessageComposer)
      .vm.$emit('update:modelValue', '没写完');
    await nextTick();
    wrapper.get('[data-conversation-id="c2"]').trigger('click');
    await flushPromises();
    expect(
      (wrapper.get('[data-composer-input]').element as HTMLTextAreaElement)
        .value,
    ).toBe('');
    wrapper.get('[data-conversation-id="c1"]').trigger('click');
    await flushPromises();
    expect(
      (wrapper.get('[data-composer-input]').element as HTMLTextAreaElement)
        .value,
    ).toBe('没写完');
  });

  it('发出即清草稿，并把乐观消息画进消息流', async () => {
    const { transport, wrapper } = panel({});
    transport.connect();
    await nextTick();
    wrapper.get('[data-conversation-id="c1"]').trigger('click');
    await flushPromises();
    await wrapper
      .findComponent(MessageComposer)
      .vm.$emit('update:modelValue', '你好');
    await nextTick();
    await wrapper
      .findComponent(MessageComposer)
      .vm.$emit('send', { attachments: [], mentions: [], text: '你好' });
    await flushPromises();
    expect(
      wrapper
        .findAll('[data-message-id]')
        .map((row) => row.attributes('data-message-id')),
    ).toContain('local-1');
    expect(
      (wrapper.get('[data-composer-input]').element as HTMLTextAreaElement)
        .value,
    ).toBe('');
  });

  it('离线时计数显示"有 N 条待发送"，补发后归零：断线时不告诉用户还有几条没出去，他就会以为都发了', async () => {
    const { im, transport, wrapper } = panel({});
    im.openConversation('c1');
    await nextTick();
    im.sendMessage({ text: '离线发的' });
    await nextTick();
    expect(wrapper.get('[data-pending-count]').text()).toContain('1 条待发送');
    // 切会话不清这个数：待发送是全局 outbox，只有重连补发并被服务端 ack 才归零
    wrapper.get('[data-conversation-id="c2"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-pending-count]').text()).toContain('1 条待发送');
    transport.connect();
    await flushPromises();
    await nextTick();
    expect(wrapper.find('[data-pending-count]').exists()).toBe(false);
  });

  it('连接状态徽章跟着 transport 走：顶栏那个"已连接"绑的就是它', async () => {
    const { transport, wrapper } = panel({});
    expect(wrapper.get('[data-connection-state]').text()).toBe('已断开');
    transport.connect();
    await nextTick();
    expect(wrapper.get('[data-connection-state]').text()).toBe('已连接');
    transport.disconnect();
    await nextTick();
    expect(wrapper.get('[data-connection-state]').text()).toBe('已断开');
  });

  it('坏帧诊断就地显示成一条可关的红条，而不是弹 toast：用哪种通知是宿主的决定', async () => {
    const { transport, wrapper } = panel({});
    transport.connect();
    await nextTick();
    transport.emitDiagnostic('服务端灰度期间吐了半截 JSON');
    await nextTick();
    expect(wrapper.get('[data-panel-error]').text()).toContain('半截 JSON');
    await wrapper.get('[data-action="dismiss-error"]').trigger('click');
    expect(wrapper.find('[data-panel-error]').exists()).toBe(false);
    // 同一句话只让关一次
    transport.emitDiagnostic('服务端灰度期间吐了半截 JSON');
    await nextTick();
    expect(wrapper.find('[data-panel-error]').exists()).toBe(false);
    transport.emitDiagnostic('另一条诊断');
    await nextTick();
    expect(wrapper.get('[data-panel-error]').text()).toContain('另一条诊断');
  });

  it('上翻到顶由面板直接调 loadHistory，并把在途状态传给消息流：面板不自己算游标', async () => {
    const { im, transport, wrapper } = panel({
      c1: [message('m1', 1_700_000_000_000)],
    });
    // 先连上：断线时 `transport.send` 只排队、不进 sentFrames，那会让这条测成"没发请求"
    transport.connect();
    im.openConversation('c1');
    await nextTick();
    const historyFrames = transport
      .sentFrames()
      .filter((frame) => frame.type === 'history');
    expect(historyFrames).toHaveLength(0);
    // 在途提示是"结果"而不是"前置条件"：没翻页就不该先挂一条正在加载
    expect(wrapper.find('[data-history-loading]').exists()).toBe(false);
    await wrapper.findComponent(MessagePane).vm.$emit('loadHistory');
    expect(
      transport.sentFrames().filter((frame) => frame.type === 'history'),
    ).toHaveLength(1);
    expect(im.loadingHistory.value.c1).toBe(true);
    await nextTick();
    expect(wrapper.get('[data-history-loading]').text()).toContain('正在加载');
  });

  it('对端正在输入时提示由 useIm 的状态给，名字走 nameOf：谁在输入是状态机的事，怎么显示是界面的事', async () => {
    const { transport, wrapper } = panel({});
    transport.connect();
    await nextTick();
    transport.emitFrame({
      payload: { conversationId: 'c1', typing: true, userId: 'u1' },
      type: 'typing',
    });
    await nextTick();
    expect(wrapper.find('[data-typing]').exists()).toBe(false);
    wrapper.get('[data-conversation-id="c1"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-typing]').text()).toContain('正在输入');
  });

  it('撤回与重发从消息流一路传到状态机：面板只做转发，不自己判断能不能撤', async () => {
    const { im, transport, wrapper } = panel({});
    transport.connect();
    await nextTick();
    im.openConversation('c1');
    await nextTick();
    im.sendMessage({ text: '撤回我' });
    await flushPromises();
    await wrapper
      .findComponent(MessagePane)
      .vm.$emit('recall', { id: 'local-1' } as ImMessage);
    expect(im.messages.value[0]).toMatchObject({
      body: '该消息已撤回',
      kind: 'system',
    });
    await wrapper
      .findComponent(MessagePane)
      .vm.$emit('retry', { id: 'local-1' } as ImMessage);
    expect(im.messages.value[0]?.status).toBeUndefined();
  });
});
