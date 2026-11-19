/**
 * KV 字典的透明持久化包装（SQLite 迁移 P2 · config）。
 *
 * 系统配置是 `Record<panelKey, Record<fieldKey, ConfigValue>>` 形态，
 * 不是数组，无法用 `defineCollection`。handler 的写法是整体替换
 * `CONFIG_VALUES[panel] = next`，因此这里用一层对象代理把读写翻译成
 * `DataStore.getById / insert / update`，handler 一行不用改：
 *
 * - SQLite 是唯一存储：每个面板在 `tb_config` 存一行（`data = { id, values }`），
 *   首次加载按默认值补齐缺失面板，改完落库、重启仍在。
 * - 配置默认值是应用正常运行所需的配置项（非伪造业务记录），所有环境都会初始化。
 *
 * 代理完整实现 ownKeys / getOwnPropertyDescriptor，保证
 * `JSON.stringify(CONFIG_VALUES)`（响应信封）与对象展开语义不变。
 */

import type { DataStore } from './store';

import { getStore } from './runtime';

interface KvRow<T extends object> {
  id: string;
  values: T;
}

export function defineKVMap<T extends object>(
  table: string,
  defaults: Record<string, T>,
): Record<string, T> {
  const store: DataStore = getStore();

  // 逐个面板补齐（而非只看 count），避免中途失败留下的半空表
  for (const [key, value] of Object.entries(defaults)) {
    if (!store.getById(table, key)) {
      store.insert(table, { id: key, values: structuredClone(value) });
    }
  }

  return new Proxy({} as Record<string, T>, {
    get(target, prop) {
      if (typeof prop === 'symbol') return Reflect.get(target, prop);
      return store.getById<KvRow<T>>(table, prop)?.values;
    },
    set(target, prop, value) {
      if (typeof prop === 'symbol') return Reflect.set(target, prop, value);
      if (store.getById(table, prop)) store.update(table, prop, { values: value });
      else store.insert(table, { id: prop, values: value });
      return true;
    },
    has(_target, prop) {
      return typeof prop === 'string' && Boolean(store.getById(table, prop));
    },
    ownKeys() {
      return store.list<KvRow<T>>(table).list.map((row) => String(row.id));
    },
    getOwnPropertyDescriptor(target, prop) {
      if (typeof prop === 'string' && store.getById(table, prop)) {
        return { configurable: true, enumerable: true, writable: true };
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  });
}
