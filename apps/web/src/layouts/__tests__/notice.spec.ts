import { describe, expect, it } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { createPinia, setActivePinia } from 'pinia';

import {
  countUnread,
  mapNotice,
  mapNoticeList,
  NOTICE_TYPE_LABELS,
} from '../widgets/notice';
import WidgetNotice from '../widgets/WidgetNotice.vue';

/**
 * 顶栏铃铛的数据层测试。
 *
 * 这个模块存在的全部理由就是"以前它不存在"：组件直接按另一套字段名读响应，
 * 于是列表恒空、角标恒为 0，而接口一直是 200。这里把三类契约钉住：
 * 信封形态、已读语义、字段别名。
 */

describe('mapNoticeList：响应形态', () => {
  const raw = { id: 1, title: '系统升级维护通知', status: 0, sendTime: 'x' };

  it('信封 { code, data: { list } }', () => {
    expect(mapNoticeList({ code: 200, data: { list: [raw] } })).toHaveLength(1);
  });

  it('已解包的 { list }', () => {
    expect(mapNoticeList({ list: [raw] })).toHaveLength(1);
  });

  it('直接给数组', () => {
    expect(mapNoticeList([raw])).toHaveLength(1);
  });

  it('信封里没有 list 字段时给空数组，而不是抛错（顶栏不能因为接口形状变了就崩）', () => {
    expect(mapNoticeList({ code: 200, data: null })).toEqual([]);
    expect(mapNoticeList({ code: 200, message: 'ok' })).toEqual([]);
  });

  it('脏数据不进列表：null / 非数组 / 数组里的非对象项', () => {
    expect(mapNoticeList(null)).toEqual([]);
    expect(mapNoticeList('nope')).toEqual([]);
    expect(mapNoticeList({ list: 'nope' })).toEqual([]);
    expect(mapNoticeList([null, 1, 'x', raw])).toHaveLength(1);
  });
});

describe('mapNotice：字段别名与已读语义', () => {
  it('status 0 是未读、1 是已读（与通知管理页同一套语义）', () => {
    expect(mapNotice({ id: 1, status: 0 }).read).toBe(false);
    expect(mapNotice({ id: 1, status: 1 }).read).toBe(true);
    expect(mapNotice({ id: 1, status: '1' }).read).toBe(true);
  });

  it('没有 status 时退回布尔 isRead（历史契约）', () => {
    expect(mapNotice({ id: 1, isRead: true }).read).toBe(true);
    expect(mapNotice({ id: 1, isRead: false }).read).toBe(false);
    // 两个都没有才算未读
    expect(mapNotice({ id: 1 }).read).toBe(false);
  });

  it('id 支持字符串与 noticeId 别名，取不到给 -1', () => {
    expect(mapNotice({ id: '12' }).id).toBe(12);
    expect(mapNotice({ noticeId: 7 }).id).toBe(7);
    expect(mapNotice({}).id).toBe(-1);
  });

  it('类型取 type，退回 noticeType，再退回 1（通知）', () => {
    expect(mapNotice({ type: 2 }).type).toBe(2);
    expect(mapNotice({ noticeType: 3 }).type).toBe(3);
    expect(mapNotice({}).type).toBe(1);
    expect(NOTICE_TYPE_LABELS[mapNotice({ type: 9 }).type]).toBeUndefined();
  });

  it('优先级只接受 0 / 1 / 2，其余归为普通', () => {
    expect(mapNotice({ priority: 2 }).priority).toBe(2);
    for (const value of [-1, 3, Number.NaN, 'x', undefined]) {
      expect(mapNotice({ priority: value as unknown }).priority).toBe(0);
    }
  });

  it('时间按 sendTime → publishTime → createdAt 取值，缺省为空串', () => {
    expect(mapNotice({ sendTime: 'a' }).sendTime).toBe('a');
    expect(mapNotice({ publishTime: 'b' }).sendTime).toBe('b');
    expect(mapNotice({ createdAt: 'c' }).sendTime).toBe('c');
    expect(mapNotice({}).sendTime).toBe('');
  });

  it('标题缺省给占位，内容缺省给空串', () => {
    expect(mapNotice({}).title).toBe('(无标题)');
    expect(mapNotice({}).content).toBe('');
  });
});

describe('countUnread', () => {
  it('只数未读，列表为空给 0', () => {
    expect(countUnread([])).toBe(0);
    expect(
      countUnread([
        mapNotice({ id: 1, status: 0 }),
        mapNotice({ id: 2, status: 1 }),
        mapNotice({ id: 3, status: 0 }),
      ]),
    ).toBe(2);
  });

  it('全部标记已读后角标归零（乐观更新的落点）', () => {
    const list = [mapNotice({ id: 1, status: 0 })];
    list[0]!.read = true;
    expect(countUnread(list)).toBe(0);
  });
});

/* ============================================================
 * 渲染层：铃铛的弹层与三种列表状态
 * ============================================================
 *
 * 上面那几组钉的是"数据算得对不对"，这一组钉的是"算完的东西真上了屏"：
 * 铃铛从旧组件库的 Popover/Badge/Spin 换成封装件以后，
 * 最容易丢的就是这三件事 —— 弹层打不开、角标不跟着未读数走、
 * 加载中/空列表/有数据三个分支少一个。断言全部用稳定钩子
 * （`data-testid` / `data-common-badge-dot`），不再钉组件库的内部类名。
 */

const api = vi.hoisted(() => ({
  getNoticeList: vi.fn(),
  markAllNoticeRead: vi.fn(),
  markNoticeRead: vi.fn(),
}));

vi.mock('~/api/system', () => api);

/** 保留真模块的其他导出，只把 WebSocket 订阅换成"永不推送" */
vi.mock('~/utils/ws', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useWebSocket: () => ({ onNotice: () => () => {} }),
}));

const RAW_NOTICES = [
  { id: 1, status: 0, title: '系统升级维护通知' },
  { id: 2, status: 1, title: '版本发布说明' },
  { id: 3, status: 0, title: '安全提醒' },
];

async function mountBell() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { component: { render: () => h('div') }, path: '/' },
      {
        component: { render: () => h('div') },
        name: 'system-notice',
        path: '/system/notice',
      },
    ],
  });
  await router.push('/');
  await router.isReady();

  const wrapper = mount(
    defineComponent({ setup: () => () => h(WidgetNotice) }),
    { global: { plugins: [pinia, router] } },
  );
  await flushPromises();

  /** 面板是浮层：内容挂在 body 上，不在 wrapper 子树里；铃铛本体反过来 */
  return {
    badge: () => wrapper.find('[data-common-badge-dot]'),
    panel: () => document.querySelector('[data-testid="notice-panel"]'),
    query: (selector: string) => document.body.querySelector(selector),
    queryAll: (selector: string) =>
      [...document.body.querySelectorAll(selector)] as HTMLElement[],
    router,
    // 触发器就是那颗铃铛（aria-label 由 WidgetButton 给出）
    trigger: wrapper.get('[aria-label="通知"]'),
    wrapper,
  };
}

/** 点铃铛展开面板，并等首屏数据落地 */
async function openPanel(bell: Awaited<ReturnType<typeof mountBell>>) {
  await bell.trigger.trigger('click');
  await flushPromises();
  await nextTick();
}

afterEach(() => {
  // 浮层是 Teleport 出去的，逐个用例清干净，避免上一条的面板串到下一条
  document.body.innerHTML = '';
  vi.clearAllMocks();
  api.getNoticeList.mockResolvedValue({ list: [] });
});

describe('WidgetNotice —— 弹层、角标与三分支渲染', () => {
  it('点铃铛展开面板，未读角标与列表里的未读条数一致', async () => {
    api.getNoticeList.mockResolvedValue({ list: RAW_NOTICES });
    const bell = await mountBell();

    // 未展开时浮层不存在（封装件与旧 Popover 一样是懒渲染）
    expect(bell.panel()).toBeNull();

    await openPanel(bell);
    expect(bell.panel(), '点铃铛没有展开通知面板').not.toBeNull();
    expect(bell.queryAll('[data-testid="notice-item"]')).toHaveLength(3);
    expect(
      bell.queryAll('[data-testid="notice-item"][data-unread="true"]'),
    ).toHaveLength(2);

    // 角标：封装 Badge 的计数气泡（旧实现钉的是 `.ant-badge-count`）
    expect(bell.badge().exists(), '铃铛上没有未读角标').toBe(true);
    expect(bell.badge().text()).toBe('2');
  });

  it('加载中给加载态，数据为空给空态，两者不叠在一起', async () => {
    let resolveList: (value: { list: unknown[] }) => void = () => {};
    api.getNoticeList.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    const bell = await mountBell();
    await openPanel(bell);

    expect(bell.query('[data-testid="notice-loading"]')).not.toBeNull();
    expect(bell.query('[data-testid="notice-empty"]')).toBeNull();

    resolveList({ list: [] });
    await flushPromises();
    await nextTick();

    expect(bell.query('[data-testid="notice-loading"]')).toBeNull();
    expect(bell.query('[data-testid="notice-empty"]')).not.toBeNull();
  });

  it('「全部已读」把角标归零并让按钮自己消失', async () => {
    api.getNoticeList.mockResolvedValue({ list: RAW_NOTICES });
    api.markAllNoticeRead.mockResolvedValue(undefined);
    const bell = await mountBell();
    await openPanel(bell);

    await bell
      .query('[data-testid="notice-mark-all"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    await nextTick();

    expect(api.markAllNoticeRead).toHaveBeenCalledOnce();
    expect(bell.queryAll('[data-testid="notice-item"][data-unread="true"]')).toEqual(
      [],
    );
    // 没有未读之后按钮本身就该消失（`v-if="hasUnread"`），角标也跟着归零
    expect(bell.query('[data-testid="notice-mark-all"]')).toBeNull();
    expect(bell.badge().exists(), '全部已读后角标没有归零').toBe(false);
  });

  it('接口失败时安静降级成空态，不糊错误弹窗在布局上', async () => {
    api.getNoticeList.mockRejectedValue(new Error('500'));
    const bell = await mountBell();
    await openPanel(bell);

    expect(bell.query('[data-testid="notice-empty"]')).not.toBeNull();
    expect(bell.queryAll('[data-testid="notice-item"]')).toEqual([]);
  });
});
