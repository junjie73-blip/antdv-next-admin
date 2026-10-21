import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 两只 toaster 的路由契约，以及两条通道共用一份实现这件事本身。
 *
 * vue-sonner 2.0.9 的分发规则是：带 `toasterId` 的 toast 只进同名的那只，
 * **不带** id 的只进没有 id 的那只。所以 `message.*` 必须一律不传 `toasterId` ——
 * 传了就把轻提示送进通知那只，宿主没挂第二只时轻提示直接消失（不报错，只是看不见）。
 *
 * 停留时长只有一份常量（3 秒），两条通道都靠它自动消失；能不能点 ✕ 手动关
 * 由宿主那只 `<Toaster close-button>` 决定，不在这一层分叉。
 */
vi.mock('vue-sonner', () => ({
  toast: {
    dismiss: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

import { toast } from 'vue-sonner';

import { message, NOTIFICATION_TOASTER_ID, notification } from '../src/message';

type ToastMethod = 'error' | 'info' | 'loading' | 'success' | 'warning';

const spies = toast as unknown as Record<
  'dismiss' | ToastMethod,
  ReturnType<typeof vi.fn>
>;
const types = ['error', 'info', 'success', 'warning'] as const;

beforeEach(() => {
  for (const fn of Object.values(spies)) fn.mockClear();
});

describe('message —— 轻提示通道', () => {
  it('四种类型落到同名的 toast 方法', () => {
    for (const type of types) message[type](`文本-${type}`, 1500);
    for (const type of types) {
      expect(spies[type]).toHaveBeenCalledWith(`文本-${type}`, {
        duration: 1500,
      });
    }
  });

  it('缺省停留 3 秒：够读完一行短文案，又不至于挡路', () => {
    message.info('内容');
    expect(spies.info).toHaveBeenCalledWith('内容', { duration: 3000 });
  });

  it('一条都不带 toasterId：漏挂通知那只时轻提示仍然可见', () => {
    for (const type of types) message[type]('内容');
    message.loading('加载中');
    for (const type of [...types, 'loading'] as const) {
      const options = spies[type].mock.calls[0]?.[1];
      expect(options ?? {}, `${type} 多出 toasterId`).not.toHaveProperty(
        'toasterId',
      );
    }
  });
});

describe('notification —— 通知通道', () => {
  it('每条都带 NOTIFICATION_TOASTER_ID，出场位置交给宿主那只 toaster', () => {
    for (const type of types) notification[type]('标题', '描述');
    for (const type of types) {
      expect(spies[type]).toHaveBeenCalledWith('标题', {
        description: '描述',
        duration: 3000,
        toasterId: NOTIFICATION_TOASTER_ID,
      });
    }
  });

  it('默认停留时长与轻提示同值：同一段文案在两条通道上不该一个 3 秒一个 8 秒', () => {
    notification.info('标题', '描述');
    message.info('标题');
    const notify = spies.info.mock.calls[0]?.[1];
    const light = spies.info.mock.calls[1]?.[1];
    expect(notify?.duration).toBe(light?.duration);
    expect(notify?.duration).toBe(3000);
  });

  it('第二个参数是数字时按停留时长处理，与轻提示同形', () => {
    notification.success('标题', 2000);
    expect(spies.success).toHaveBeenCalledWith('标题', {
      duration: 2000,
      toasterId: NOTIFICATION_TOASTER_ID,
    });
  });

  it('对象写法同时给描述与时长', () => {
    notification.warning('标题', { description: '描述', duration: 5000 });
    expect(spies.warning).toHaveBeenCalledWith('标题', {
      description: '描述',
      duration: 5000,
      toasterId: NOTIFICATION_TOASTER_ID,
    });
  });

  it('loading 也认这条通道，且同样不设时长（常驻到手动关闭）', () => {
    notification.loading('同步中');
    expect(spies.loading).toHaveBeenCalledWith('同步中', {
      toasterId: NOTIFICATION_TOASTER_ID,
    });
  });

  it('id 就是宿主 `<Toaster :id>` 用的那个字符串', () => {
    expect(NOTIFICATION_TOASTER_ID).toBe('notification');
  });
});

describe('两条通道的 API 形状', () => {
  it('方法清单完全一致：只有 toasterId 这一个差别，没有第二套实现可漂移', () => {
    expect(Object.keys(notification).toSorted()).toEqual(
      Object.keys(message).toSorted(),
    );
  });

  it('不传描述时连键都不写：轻提示的载荷里没有 description 这一项', () => {
    message.error('内容');
    expect(spies.error.mock.calls[0]?.[1]).toEqual({ duration: 3000 });
  });

  it('close(id) / closeAll() 两边都走同一条 dismiss', () => {
    message.close('id-1');
    notification.close('id-2');
    expect(spies.dismiss).toHaveBeenNthCalledWith(1, 'id-1');
    expect(spies.dismiss).toHaveBeenNthCalledWith(2, 'id-2');

    message.closeAll();
    expect(spies.dismiss).toHaveBeenLastCalledWith();
  });

  it('调用返回 toast 的 id，close(id) 关得掉刚刚那条', () => {
    spies.success.mockReturnValueOnce('toast-42');
    const id = message.success('内容');
    message.close(id);
    expect(spies.dismiss).toHaveBeenCalledWith('toast-42');
  });
});
