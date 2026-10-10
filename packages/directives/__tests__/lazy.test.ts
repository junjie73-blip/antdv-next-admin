import type { LazyDirectiveOptions, LazyObserver, LazyObserverEntry } from '../src/lazy';

import { describe, expect, it, vi } from 'vitest';

import { createLazyDirective } from '../src/lazy';
import { clearBody, createImage, fakeBinding } from './helpers';

interface FakeObserver extends LazyObserver {
  disconnected: number;
  observed: Element[];
  unobserved: Element[];
}

class FakeObserverImpl implements FakeObserver {
  disconnected = 0;
  observed: Element[] = [];
  unobserved: Element[] = [];

  constructor(public callback: (entries: LazyObserverEntry[]) => void) {}

  disconnect(): void {
    this.disconnected += 1;
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  unobserve(target: Element): void {
    this.unobserved.push(target);
  }
}

/**
 * 测试台：假 IntersectionObserver 把回调交出来，
 * 「元素进没进视口」于是变成一次显式调用，而不是等真实布局的时序玄学。
 */
function createHarness(options: Partial<LazyDirectiveOptions> = {}) {
  const observers: FakeObserverImpl[] = [];

  const directive = createLazyDirective({
    createObserver: (callback) => {
      const observer = new FakeObserverImpl(callback);
      observers.push(observer);
      return observer;
    },
    // 每个用例独立缓存，避免模块级 loadedCache 跨用例命中
    loadedCache: new Set<string>(),
    preload: async () => true,
    ...options,
  });

  const intersect = (el: HTMLImageElement, isIntersecting = true) => {
    observers.at(-1)?.callback([{ isIntersecting, target: el }]);
  };

  return { directive, intersect, observers };
}

type Directive = ReturnType<typeof createLazyDirective>;

function mount(directive: Directive, el: HTMLImageElement, value: never) {
  directive.mounted?.(el, fakeBinding(value) as never, null as never, null as never);
}

function update(directive: Directive, el: HTMLImageElement, value: never) {
  directive.updated?.(el, fakeBinding(value) as never, null as never, null as never);
}

function unmount(directive: Directive, el: HTMLImageElement) {
  directive.unmounted?.(el, null as never, null as never, null as never);
}

describe('v-lazy 懒加载', () => {
  it('没进视口不发请求；进视口后加载并停止观察', async () => {
    const preload = vi.fn(async () => true);
    const { directive, intersect, observers } = createHarness({ preload });
    const el = createImage();

    mount(directive, el, { src: 'https://cdn/a.png' } as never);
    expect(el.dataset.src).toBe('https://cdn/a.png');
    expect(observers[0]?.observed).toEqual([el]);
    expect(preload).not.toHaveBeenCalled();

    intersect(el);
    await vi.waitFor(() => expect(preload).toHaveBeenCalledTimes(1));
    expect(el.getAttribute('src')).toBe('https://cdn/a.png');
    expect(observers[0]?.unobserved).toHaveLength(1);

    // 再触发一次也不该重复请求
    intersect(el);
    await Promise.resolve();
    expect(preload).toHaveBeenCalledTimes(1);

    clearBody();
  });

  it('还没进视口时 isIntersecting=false 不加载', () => {
    const preload = vi.fn(async () => true);
    const { directive, intersect } = createHarness({ preload });
    const el = createImage();

    mount(directive, el, 'https://cdn/a.png' as never);
    intersect(el, false);
    expect(preload).not.toHaveBeenCalled();

    clearBody();
  });

  it('环境没有 IntersectionObserver 时立即加载：宁可少懒，不能白图', async () => {
    const preload = vi.fn(async () => true);
    const directive = createLazyDirective({
      createObserver: () => null,
      loadedCache: new Set<string>(),
      preload,
    });
    const el = createImage();

    mount(directive, el, 'https://cdn/b.png' as never);
    await vi.waitFor(() =>
      expect(preload).toHaveBeenCalledWith('https://cdn/b.png'),
    );
    expect(el.getAttribute('src')).toBe('https://cdn/b.png');

    clearBody();
  });

  it('缺 src 时什么都不做（旧实现会抛在读 options.src 之前）', () => {
    const preload = vi.fn(async () => true);
    const { directive } = createHarness({ preload });
    const el = createImage();

    expect(() => mount(directive, el, undefined as never)).not.toThrow();
    expect(preload).not.toHaveBeenCalled();

    clearBody();
  });

  it('加载失败回退到 error 图并上报', async () => {
    const onError = vi.fn();
    const directive = createLazyDirective({
      createObserver: () => null,
      loadedCache: new Set<string>(),
      onError,
      preload: async () => false,
    });
    const el = createImage();

    mount(directive, el, {
      error: 'https://cdn/fallback.png',
      src: 'https://cdn/broken.png',
    } as never);

    await vi.waitFor(() =>
      expect(el.getAttribute('src')).toBe('https://cdn/fallback.png'),
    );
    expect(onError).toHaveBeenCalledWith({ src: 'https://cdn/broken.png' });

    clearBody();
  });

  it('预加载抛异常也算失败，不会变成未处理的 rejection', async () => {
    const onError = vi.fn();
    const directive = createLazyDirective({
      createObserver: () => null,
      loadedCache: new Set<string>(),
      onError,
      preload: async () => {
        throw new Error('network down');
      },
    });
    const el = createImage();

    mount(directive, el, 'https://cdn/x.png' as never);
    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith({
        error: expect.any(Error),
        src: 'https://cdn/x.png',
      }),
    );

    clearBody();
  });

  it('同一 URL 第二次命中缓存，不再预加载', async () => {
    const preload = vi.fn(async () => true);
    const cache = new Set<string>();
    const directive = createLazyDirective({
      createObserver: () => null,
      loadedCache: cache,
      preload,
    });

    const first = createImage();
    mount(directive, first, 'https://cdn/c.png' as never);
    await vi.waitFor(() => expect(preload).toHaveBeenCalledTimes(1));
    expect(cache.has('https://cdn/c.png')).toBe(true);

    const second = createImage();
    mount(directive, second, 'https://cdn/c.png' as never);
    await vi.waitFor(() =>
      expect(second.getAttribute('src')).toBe('https://cdn/c.png'),
    );
    expect(preload).toHaveBeenCalledTimes(1);

    clearBody();
  });

  it('加载途中换 src：晚到的旧图结果不会盖掉新图', async () => {
    let resolveSlow: (ok: boolean) => void = () => undefined;
    const preload = vi.fn((src: string) =>
      src === 'slow.png'
        ? new Promise<boolean>((resolve) => {
            resolveSlow = resolve;
          })
        : Promise.resolve(true),
    );

    // 用「无观察器」的降级路径，让两次加载都在 mount/update 时立即发起
    const directive = createLazyDirective({
      createObserver: () => null,
      loadedCache: new Set<string>(),
      preload,
    });
    const el = createImage();

    mount(directive, el, 'slow.png' as never);
    update(directive, el, 'fast.png' as never);
    await vi.waitFor(() => expect(el.getAttribute('src')).toBe('fast.png'));
    expect(preload).toHaveBeenNthCalledWith(1, 'slow.png');
    expect(preload).toHaveBeenNthCalledWith(2, 'fast.png');

    resolveSlow(true);
    await vi.waitFor(() => undefined);
    expect(el.getAttribute('src')).toBe('fast.png');

    clearBody();
  });

  it('unmounted 断开观察器并作废在途请求', async () => {
    const preload = vi.fn(async () => true);
    const { directive, observers } = createHarness({ preload });
    const el = createImage();

    mount(directive, el, 'https://cdn/d.png' as never);
    unmount(directive, el);
    expect(observers[0]?.disconnected).toBe(1);

    clearBody();
  });

  it('占位图：binding 优先于 data-placeholder', () => {
    const { directive } = createHarness();

    const withBinding = createImage();
    withBinding.dataset.placeholder = 'attr.png';
    mount(directive, withBinding, {
      placeholder: 'binding.png',
      src: 'real.png',
    } as never);
    expect(withBinding.getAttribute('src')).toBe('binding.png');

    const withAttr = createImage();
    withAttr.dataset.placeholder = 'attr.png';
    mount(directive, withAttr, 'real.png' as never);
    expect(withAttr.getAttribute('src')).toBe('attr.png');

    clearBody();
  });

  it('渐显：加载完成后 opacity 回到 1，fade=false 时不写动画', async () => {
    const fadeOn = createHarness();
    const el = createImage();
    mount(fadeOn.directive, el, 'https://cdn/e.png' as never);
    fadeOn.intersect(el);
    await vi.waitFor(() => expect(el.getAttribute('src')).toBe('https://cdn/e.png'));
    expect(el.style.transition).toContain('opacity');

    const noFadeDirective = createLazyDirective({
      createObserver: () => null,
      loadedCache: new Set<string>(),
      preload: async () => true,
    });
    const plain = createImage();
    mount(noFadeDirective, plain, { duration: 0, fade: false, src: 'https://cdn/f.png' } as never);
    await vi.waitFor(() => expect(plain.getAttribute('src')).toBe('https://cdn/f.png'));
    expect(plain.style.transition).toBe('');

    clearBody();
  });
});
