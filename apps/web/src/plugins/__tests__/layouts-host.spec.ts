import { layoutHost } from '@antdv/layouts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getNoticeList, markAllNoticeRead, markNoticeRead } from '~/api/system';
import { projectConfig } from '~/config/project';
import { configureLayoutsHost } from '~/plugins/layouts-host';

/**
 * 顶栏小部件（通知铃铛、账户页、语言候选、滚动条偏好）搬进 `@antdv/layouts` 之后
 * 不能再反向 import 应用，这五件事全靠这里注入。
 *
 * 用例读的是包那边的 `layoutHost`，而不是断言 `configureLayoutHost` 被调用过 ——
 * 只有读值才能证明"注的是应用的接口、不是包的兜底默认值"。
 * 接口与推送用 mock：`test/setup.ts` 没碰过它们，替换得掉。
 */
const wsStub = vi.hoisted(() => {
  const handlers: Array<(raw: unknown) => void> = [];
  return {
    handlers,
    unsubscribe: vi.fn(),
    useWebSocket: vi.fn(() => ({
      onNotice: (handler: (raw: unknown) => void) => {
        handlers.push(handler);
        return () => wsStub.unsubscribe();
      },
    })),
  };
});

vi.mock('~/api/system', () => ({
  getNoticeList: vi.fn(),
  markAllNoticeRead: vi.fn(),
  markNoticeRead: vi.fn(),
}));

vi.mock('~/utils/ws', () => ({ useWebSocket: wsStub.useWebSocket }));

describe('configureLayoutsHost', () => {
  beforeEach(() => {
    wsStub.handlers.length = 0;
    vi.clearAllMocks();
    configureLayoutsHost();
  });

  it('语言候选跟着文案表里已注册的语言走，标签用各自母语的写法', () => {
    // 不用 `toSorted()`：`tsconfig.vitest.json` 把 `lib` 清成了 `[]`，那里读不到 ES2023
    // oxlint-disable-next-line unicorn/no-array-sort
    const locales = [...layoutHost.locales].sort((a, b) =>
      a.code.localeCompare(b.code),
    );

    expect(locales).toEqual([
      { code: 'en-US', label: 'English' },
      { code: 'zh-CN', label: '简体中文' },
    ]);
  });

  it('滚动条偏好由应用告诉包', () => {
    expect(layoutHost.nativeScrollbar).toBe(
      projectConfig.scrollbar?.native ?? false,
    );
  });

  it('账户页是两个各自独立的块（异步分块，抽屉打开才下载，不进首屏）', () => {
    const { center, settings } = layoutHost.accountViews;

    expect(center).toBeTruthy();
    expect(settings).toBeTruthy();
    expect(center).not.toBe(settings);
  });

  it('通知中心的地址与三个接口都接到应用的 api 上', async () => {
    vi.mocked(getNoticeList).mockResolvedValue({ list: [{ id: 1 }], total: 1 });
    vi.mocked(markNoticeRead).mockResolvedValue(undefined);
    vi.mocked(markAllNoticeRead).mockResolvedValue(undefined);

    expect(layoutHost.notice.centerPath).toBe('/system/notice');

    await expect(layoutHost.notice.fetch(20)).resolves.toEqual({
      list: [{ id: 1 }],
      total: 1,
    });
    expect(getNoticeList).toHaveBeenCalledWith({ pageSize: 20 });

    await layoutHost.notice.markRead(7);
    expect(markNoticeRead).toHaveBeenCalledWith(7);

    await layoutHost.notice.markAllRead();
    expect(markAllNoticeRead).toHaveBeenCalledTimes(1);
  });

  it('推送载荷原样交给包归一，退订用的就是 ws 返回的那个函数', () => {
    const onPush = vi.fn();
    const cleanup = layoutHost.notice.onPush(onPush);

    expect(wsStub.handlers).toHaveLength(1);

    const payload = { id: 9, noticeType: '1', title: '新公告' };
    wsStub.handlers[0]?.(payload);
    expect(onPush).toHaveBeenCalledWith(payload);

    cleanup();
    expect(wsStub.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
