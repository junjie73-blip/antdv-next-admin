import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { useApiHealthStore } from '../src/api-health';

/**
 * 接口健康态是「粘性」的：一次失败就让导航降级，成功请求不自动清除。
 * 否则登录失败后紧接着拉菜单成功，错误态在用户看到之前就被抹平了。
 */
describe('useApiHealthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('初始状态健康', () => {
    const store = useApiHealthStore();
    expect(store.hasError).toBe(false);
    expect(store.errorCount).toBe(0);
    expect(store.lastError).toBeNull();
  });

  it('上报后进入错误态，并记录次数与最后一条消息', () => {
    const store = useApiHealthStore();
    store.markError('用户名或密码错误');
    store.markError('服务器繁忙');

    expect(store.hasError).toBe(true);
    expect(store.errorCount).toBe(2);
    expect(store.lastError).toBe('服务器繁忙');
  });

  it('reset 后回到干净状态（登录成功走这条）', () => {
    const store = useApiHealthStore();
    store.markError('请求失败');
    store.reset();

    expect(store.hasError).toBe(false);
    expect(store.errorCount).toBe(0);
    expect(store.lastError).toBeNull();
  });

  it('多个组件读同一个 store 实例', () => {
    useApiHealthStore().markError('boom');
    expect(useApiHealthStore().hasError).toBe(true);
  });
});
