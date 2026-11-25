/**
 * `nitro/kv` / `nitro/storage` 的测试替身
 *
 * 实现 unstorage 的最小语义：前缀挂载（useKV(base)）、getItem/setItem/removeItem/getKeys/clear。
 * 单例 map 让 mock-kv 与 cache/policies 在测试里看到同一份数据，同时提供 reset 保证用例隔离。
 */

const store = new Map<string, unknown>();

function keyOf(prefix: string, key: string): string {
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
  const cleanKey = key.replace(/^\/+/, '');
  return cleanPrefix ? `${cleanPrefix}/${cleanKey}` : cleanKey;
}

function clone<T>(value: T): T {
  return value === undefined
    ? value
    : (structuredClone(value) as T);
}

export function useKV(base = '') {
  const full = (key: string) => keyOf(base, key);
  const prefixRoot = base ? `${base.replace(/^\/+|\/+$/g, '')}/` : '';

  return {
    async getItem<T = unknown>(key: string): Promise<T | null> {
      const k = full(key);
      return store.has(k) ? (clone(store.get(k) as T) as T) : null;
    },
    async setItem(key: string, value: unknown): Promise<void> {
      store.set(full(key), clone(value));
    },
    async removeItem(key: string): Promise<void> {
      store.delete(full(key));
    },
    async hasItem(key: string): Promise<boolean> {
      return store.has(full(key));
    },
    async getKeys(prefix = ''): Promise<string[]> {
      const root = full(prefix);
      return [...store.keys()]
        .filter((key) => key.startsWith(root))
        .map((key) => key.slice(prefixRoot.length));
    },
    async clear(): Promise<void> {
      const root = full('');
      for (const key of [...store.keys()]) {
        if (key.startsWith(root)) store.delete(key);
      }
    },
  };
}

/** 单测隔离：清空底层 map */
export function resetKvFixture(): void {
  store.clear();
}

/** 调试用：直接读取原始键值 */
export function kvFixtureSnapshot(): Record<string, unknown> {
  return Object.fromEntries(store);
}
