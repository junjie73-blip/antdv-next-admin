import { effectScope, reactive } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** vue-router 全局守卫的三元签名（实现已改为"返回值式"，next 只作为参数占位） */
type BeforeGuard = (
  to: unknown,
  from: unknown,
  next: (value?: unknown) => void,
) => void;
type AfterGuard = (to: unknown, from: unknown) => void;
interface RouteLike {
  path: string;
}

const { guards, holder } = vi.hoisted(() => ({
  /** 自动模式注册的导航守卫，测试里手动触发 */
  guards: { afterEach: [] as AfterGuard[], beforeEach: [] as BeforeGuard[] },
  /**
   * useRoute() 的返回值。
   * 必须放这儿延迟赋值：源对象要 `reactive()` 才能被 watch 追踪，
   * 而 vi.hoisted 的工厂跑在任何 import 之前，拿不到 vue。
   */
  holder: { route: { path: '/a' } as RouteLike },
}));

vi.mock('vue-router', () => ({
  useRoute: () => holder.route,
  useRouter: () => ({
    afterEach: (fn: AfterGuard) => guards.afterEach.push(fn),
    beforeEach: (fn: BeforeGuard) => guards.beforeEach.push(fn),
  }),
}));

import { useRouteLoading } from '../src/useRouteLoading';

/**
 * useRouteLoading 用 route.path 做 watch 源，所以要传一个真正可追踪的对象。
 * vue-router 的 useRoute 返回 reactive route，这里用同样的形状。
 */
function setup(options?: Parameters<typeof useRouteLoading>[0]) {
  const scope = effectScope();
  let api!: ReturnType<typeof useRouteLoading>;
  scope.run(() => {
    api = useRouteLoading(options);
  });
  return { api, scope };
}

describe('useRouteLoading', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    guards.afterEach.length = 0;
    guards.beforeEach.length = 0;
    holder.route = reactive({ path: '/a' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('手动模式：start 同步置位，complete 走最小显示时间后收工', () => {
    const { api, scope } = setup({ auto: false });

    expect(api.isLoading.value).toBe(false);
    api.start();
    // 关键：start 不再等 requestAnimationFrame，否则同帧内 complete 会被吞掉
    expect(api.isLoading.value).toBe(true);

    api.complete();
    vi.advanceTimersByTime(300);
    expect(api.isComplete.value).toBe(true);
    expect(api.progress.value).toBe(100);

    vi.advanceTimersByTime(200);
    expect(api.isLoading.value).toBe(false);
    expect(api.isComplete.value).toBe(false);
    scope.stop();
  });

  it('加载比 minDuration 快时不会把进度条挂死', () => {
    const { api, scope } = setup({ auto: false, minDuration: 1000 });
    api.start();
    api.complete();
    vi.advanceTimersByTime(1000);
    expect(api.isComplete.value).toBe(true);
    vi.advanceTimersByTime(200);
    expect(api.isLoading.value).toBe(false);
    scope.stop();
  });

  it('minDuration 之内完成要补足剩余时间', () => {
    const { api, scope } = setup({ auto: false, minDuration: 500 });
    api.start();
    vi.advanceTimersByTime(100);
    api.complete();
    vi.advanceTimersByTime(350);
    expect(api.isComplete.value).toBe(false);
    vi.advanceTimersByTime(60);
    expect(api.isComplete.value).toBe(true);
    scope.stop();
  });

  it('withLoading 成功时透传返回值并结束加载', async () => {
    const { api, scope } = setup({ auto: false });
    const pending = api.withLoading(async () => 'ok');
    expect(api.isLoading.value).toBe(true);

    const result = await pending;
    expect(result).toBe('ok');
    // 只推进 minDuration：再多 200ms 就会连「淡出」定时器一起跑完，isComplete 归 false
    vi.advanceTimersByTime(320);
    expect(api.isComplete.value).toBe(true);
    scope.stop();
  });

  it('withLoading 失败时标记 isError 并把原始错误抛出去', async () => {
    const { api, scope } = setup({ auto: false });
    const boom = new Error('boom');
    await expect(
      api.withLoading(async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);

    // 回归：catch 形参曾经叫 error，把「标记失败」的同名方法遮掉了，
    // 于是失败路径既不标记 isError，又会抛 TypeError。
    vi.advanceTimersByTime(300);
    expect(api.isError.value).toBe(true);
    vi.advanceTimersByTime(500);
    expect(api.isLoading.value).toBe(false);
    expect(api.isError.value).toBe(false);
    scope.stop();
  });

  it('cancel 立刻复位', () => {
    const { api, scope } = setup({ auto: false });
    api.start();
    api.cancel();
    expect(api.isLoading.value).toBe(false);
    expect(api.progress.value).toBe(0);
    scope.stop();
  });

  it('isSlow 在超过 3 秒且仍在加载时为真', () => {
    const { api, scope } = setup({ auto: false });
    api.start();
    vi.advanceTimersByTime(3100);
    expect(api.isSlow.value).toBe(true);
    api.complete();
    vi.advanceTimersByTime(600);
    expect(api.isSlow.value).toBe(false);
    scope.stop();
  });

  it('自动模式：导航开始 start，导航结束后按 minDuration 收尾', async () => {
    const { api, scope } = setup({ minDuration: 200 });

    guards.beforeEach.forEach((fn) => fn({ path: '/b' }, { path: '/a' }, () => {}));
    expect(api.isLoading.value).toBe(true);

    guards.afterEach.forEach((fn) => fn({ path: '/b' }, { path: '/a' }));
    vi.advanceTimersByTime(100);
    await Promise.resolve();
    expect(api.isLoading.value).toBe(true);

    vi.advanceTimersByTime(600);
    expect(api.isLoading.value).toBe(false);
    scope.stop();
  });

  it('自动模式的守卫用返回值而不是 next()（vue-router 5 已废弃 next 回调）', () => {
    const { api, scope } = setup({ minDuration: 100 });
    expect(guards.beforeEach).toHaveLength(1);
    expect(guards.afterEach).toHaveLength(1);

    // 守卫必须"什么都不返回"：返回值会被 vue-router 当成导航结果
    const next = vi.fn();
    const results = guards.beforeEach.map((fn) =>
      fn({ path: '/c' }, { path: '/a' }, next),
    );
    expect(next).not.toHaveBeenCalled();
    expect(results).toEqual([undefined]);
    expect(api.isLoading.value).toBe(true);

    guards.afterEach.forEach((fn) => fn({ path: '/c' }, { path: '/a' }));
    vi.advanceTimersByTime(50);
    api.complete();
    vi.advanceTimersByTime(600);
    expect(api.isLoading.value).toBe(false);
    scope.stop();
  });

  it('作用域停止时复位，不给路由条留下悬挂状态', () => {
    const { api, scope } = setup({ auto: false });
    api.start();
    scope.stop();
    expect(api.isLoading.value).toBe(false);
  });

  it('未加载时 progress 为 0，加载中 progress 不超过 90', () => {
    const { api, scope } = setup({ auto: false, minDuration: 1000 });
    expect(api.progress.value).toBe(0);
    api.start();
    vi.advanceTimersByTime(10_000);
    expect(api.progress.value).toBeLessThanOrEqual(90);
    scope.stop();
  });
});
