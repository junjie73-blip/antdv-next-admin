import type {
  CacheInstance,
  UseCacheOptions,
  UseCacheReturn,
} from '@antdv/shared/cache';

import { customRef, onScopeDispose, ref, watch } from 'vue';

import { buildStorageKey, cache } from '@antdv/shared/cache';
import { isNil } from 'es-toolkit';

/** 默认过期时间（秒），0 表示永不过期 */
const DEFAULT_EXPIRE = 0;

/**
 * 响应式缓存组合式函数
 *
 * 单一数据源是 `cache` 单例：前缀、过期、可选加密都由它负责，
 * 这里只在其上面套一层 ref，让「读缓存」这件事能进模板和 watch。
 *
 * ⚠️ 早期实现同时在裸 `localStorage` 上又叠了一层 `useStorage`，
 * 于是同一个值有两份存储：`cache.setItem()` 写的是带前缀的 CacheItem 信封，
 * `useStorage` 写的是 `{ value: … }` 裸 JSON，两边读写互相看不见，
 * 过期时间只对其中一份生效，`hasItem()` 与 `value.value` 还会给出矛盾答案。现在删掉了那一层。
 *
 * 写回策略：
 *  - `value.value = x` → 立刻落盘；`x` 为 null 时等价于删除该条目；
 *  - `value.value.foo = 1` → 只有 `deep: true`（默认）时才会被捕获并落盘；
 *  - 两条路径不会重复写盘：主动写入用 `internalWrite` 门卫挡住 watch（见下）。
 *
 * 跨标签页：监听 `storage` 事件后重读。注意该事件只在「其他」标签页触发，
 * 本标签页不会自触发，因此不存在回环。
 *
 * @example
 * ```ts
 * const { value, removeItem, hasItem } = useCache<UserInfo>('user-info');
 * value.value = { name: 'Tom' }; // 写入缓存
 * console.log(value.value); // 读取缓存
 * ```
 */
export function useCache<T = unknown>(
  key: string,
  options: UseCacheOptions = {},
): UseCacheReturn<T> {
  const {
    defaultValue = null,
    expire = DEFAULT_EXPIRE,
    deep = true,
    immediate = false,
  } = options;

  const instance = cache as CacheInstance<T>;
  const fallbackValue = defaultValue as null | T;

  /** 读缓存；不存在或已过期时回落到默认值 */
  const read = (): null | T => instance.getItem(key) ?? fallbackValue;

  const source = ref<null | T>(read());

  /**
   * 主动写入的门卫。
   *
   * 嵌套改动要靠 `flush: 'sync'` 的 deep watch 才能即时落盘，而 `value.value = x`
   * 本身也是一次对 source 的赋值——不加区分的话同一次赋值会写两遍盘
   * （两遍 JSON 序列化 + 两遍 SM4 + 两次 localStorage）。
   * 用同步 watch 是为了让这个门卫是确定的：回调一定发生在 `mark()` 内部，
   * 不存在「flag 复位了，回调下一拍才来」的竞态。
   */
  let internalWrite = false;
  const mark = (fn: () => void) => {
    internalWrite = true;
    try {
      fn();
    } finally {
      internalWrite = false;
    }
  };

  /** 把值落到缓存并同步内部状态（null 视为删除） */
  const apply = (next: null | T, targetExpire?: number) => {
    mark(() => {
      if (isNil(next)) {
        instance.removeItem(key);
        source.value = fallbackValue;
      } else {
        instance.setItem(key, next as T, targetExpire ?? expire);
        source.value = next as null | T;
      }
    });
  };

  const value = customRef<null | T>((track, trigger) => ({
    get() {
      track();
      return source.value;
    },
    set(next: null | T) {
      apply(next);
      trigger();
    },
  }));

  if (deep) {
    const stop = watch(
      source,
      () => {
        if (internalWrite) return;
        // 嵌套改动：source 里就是最新形状，整体重写一次
        const current = source.value;
        if (isNil(current)) instance.removeItem(key);
        else instance.setItem(key, current as T, expire);
      },
      { deep: true, flush: 'sync' },
    );
    onScopeDispose(stop);
  }

  /** immediate：缓存里还没有值时，先把默认值写进去 */
  if (immediate && instance.getItem(key) === null && !isNil(fallbackValue)) {
    apply(fallbackValue);
  }

  /** 从缓存重读（别的标签页或绕过本 composable 直接写 cache 之后用） */
  const refresh = () => mark(() => void (source.value = read()));

  if (typeof window !== 'undefined') {
    const onStorage = (event: StorageEvent) => {
      // key === null 表示整份 localStorage 被清空
      if (event.key === null || event.key === buildStorageKey(key)) refresh();
    };
    window.addEventListener('storage', onStorage);
    onScopeDispose(() => window.removeEventListener('storage', onStorage));
  }

  return {
    key,
    value,

    getItem: (target: string) => instance.getItem(target),

    setItem: (target: string, next: T, targetExpire?: number) => {
      instance.setItem(target, next, targetExpire ?? expire);
      if (target === key) mark(() => void (source.value = next));
    },

    removeItem: (target: string) => {
      instance.removeItem(target);
      if (target === key) mark(() => void (source.value = fallbackValue));
    },

    hasItem: (target: string) => instance.hasItem(target),

    clear: () => {
      instance.clear();
      refresh();
    },

    keys: () => instance.keys(),

    getExpire: (target: string) => instance.getExpire(target),

    setExpire: (target: string, targetExpire: number) =>
      instance.setExpire(target, targetExpire),

    touch: (target: string, targetExpire?: number) =>
      instance.touch(target, targetExpire),
  } satisfies UseCacheReturn<T>;
}
