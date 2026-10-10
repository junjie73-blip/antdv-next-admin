import type {
  NavigationGuard,
  RouteLocationNormalized,
  Router,
} from 'vue-router';

interface FakeToOptions {
  fullPath?: string;
  meta?: Record<string, unknown>;
  name?: string;
  path?: string;
}

/** 只填守卫真正读取的字段，避免测试依赖完整路由对象 */
export function fakeTo(options: FakeToOptions = {}): RouteLocationNormalized {
  const path = options.path ?? '/';
  return {
    fullPath: options.fullPath ?? path,
    meta: options.meta ?? {},
    name: options.name,
    path,
  } as unknown as RouteLocationNormalized;
}

export interface RecordedRouter {
  afterEachHandlers: Array<(...args: unknown[]) => void>;
  beforeEachHandlers: Array<(...args: unknown[]) => void>;
  errorHandlers: Array<(...args: unknown[]) => void>;
  /** 调用顺序记录，用来断言装配顺序 */
  order: string[];
  router: Router;
}

export function fakeRouter(): RecordedRouter {
  const order: string[] = [];
  const beforeEachHandlers: Array<(...args: unknown[]) => void> = [];
  const afterEachHandlers: Array<(...args: unknown[]) => void> = [];
  const errorHandlers: Array<(...args: unknown[]) => void> = [];

  const router = {
    afterEach(handler: (...args: unknown[]) => void) {
      order.push('afterEach');
      afterEachHandlers.push(handler);
    },
    beforeEach(handler: (...args: unknown[]) => void) {
      order.push('beforeEach');
      beforeEachHandlers.push(handler);
    },
    onError(handler: (...args: unknown[]) => void) {
      order.push('onError');
      errorHandlers.push(handler);
    },
  } as unknown as Router;

  return {
    afterEachHandlers,
    beforeEachHandlers,
    errorHandlers,
    order,
    router,
  };
}

/**
 * 直接执行守卫并拿到返回值。
 *
 * `next` 传空函数：这两个守卫都是"返回值式"写法（不混用 next），
 * 断言返回值比断言 next 调用更能说明重定向目标。
 */
export function runGuard(
  guard: NavigationGuard,
  to: RouteLocationNormalized,
) {
  return guard(to, fakeTo({ path: '/from' }), () => {});
}
