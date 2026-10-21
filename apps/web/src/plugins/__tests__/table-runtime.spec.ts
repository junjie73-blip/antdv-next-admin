import type { Pinia } from 'pinia';

import { message } from '@antdv/popup-ui';
import { resolveErrorMessage } from '@antdv/request';
import { useUserStore } from '@antdv/stores';
import { tableRuntime } from '@antdv/table-ui';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureTableRuntime } from '~/plugins/table-runtime';

/**
 * 表格包（`@antdv/table-ui`）不认权限、也不管错误文案怎么取，四件事全从这里注入。
 * 用例读的是包那边的 `tableRuntime`，这样"注没注上、注的是不是应用那套"都跑不掉。
 */
const userWith = (permissions: string[]) => ({
  avatar: '',
  email: '',
  id: 1,
  nickname: '测试用户',
  permissions,
  phone: '',
  roles: [],
  username: 'tester',
});

describe('configureTableRuntime', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    configureTableRuntime();
  });

  afterEach(() => {
    setActivePinia(null as unknown as Pinia);
    vi.restoreAllMocks();
  });

  it('配置阶段不取权限：入口在 pinia 就绪之前也能调', () => {
    setActivePinia(null as unknown as Pinia);

    expect(() => configureTableRuntime()).not.toThrow();
  });

  it('权限判定跟着 user store 走，是调用时现取现算', () => {
    const userStore = useUserStore();
    userStore.token = 'token';
    userStore.userInfo = userWith(['system:user:add']);

    expect(tableRuntime.checkAuth('system:user:add')).toBe(true);
    expect(tableRuntime.checkAuth('system:user:delete')).toBe(false);
    expect(tableRuntime.checkAnyAuth(['nope', 'system:user:add'])).toBe(true);
    expect(tableRuntime.checkAnyAuth(['nope', 'another'])).toBe(false);

    userStore.userInfo = userWith([]);
    expect(tableRuntime.checkAuth('system:user:add')).toBe(false);
  });

  it('没登录时一律判否', () => {
    const userStore = useUserStore();
    userStore.token = null;
    userStore.userInfo = userWith(['*']);

    expect(tableRuntime.checkAuth('system:user:add')).toBe(false);
    expect(tableRuntime.checkAnyAuth(['system:user:add'])).toBe(false);
  });

  it('接口错误文案复用请求层那套解析，包自己不再猜字段', () => {
    expect(
      tableRuntime.resolveErrorMessage({ msg: '参数校验失败' }, '兜底'),
    ).toBe(resolveErrorMessage({ msg: '参数校验失败' }, '兜底'));
    expect(tableRuntime.resolveErrorMessage({}, '兜底')).toBe('兜底');
  });

  it('错误提示走应用的 message', () => {
    const error = vi
      .spyOn(message, 'error')
      .mockImplementation(
        () => '' as unknown as ReturnType<typeof message.error>,
      );

    tableRuntime.notifyError('删除失败');

    expect(error).toHaveBeenCalledWith('删除失败');
  });
});
