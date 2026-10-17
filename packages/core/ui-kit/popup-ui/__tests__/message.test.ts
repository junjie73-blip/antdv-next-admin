import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 两只 toaster 的路由契约。
 *
 * vue-sonner 2.0.9 的分发规则是：带 `toasterId` 的 toast 只进同名的那只，
 * **不带** id 的只进没有 id 的那只。所以 `message.*` 必须一律不传 `toasterId` ——
 * 传了就把轻提示送进通知那只，宿主没挂第二只时轻提示直接消失（不报错，只是看不见）。
 */
vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

import { toast } from 'vue-sonner';

import {
  NOTIFICATION_TOASTER_ID,
  message,
  notification,
} from '../src/message';

type ToastMethod = 'error' | 'info' | 'loading' | 'success' | 'warning';

const spies = toast as unknown as Record<ToastMethod, ReturnType<typeof vi.fn>>;
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
        toasterId: NOTIFICATION_TOASTER_ID,
      });
    }
  });

  it('id 就是宿主 `<Toaster :id>` 用的那个字符串', () => {
    expect(NOTIFICATION_TOASTER_ID).toBe('notification');
  });
});
