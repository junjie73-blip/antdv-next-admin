/**
 * 透明持久化集合 —— 让现有 handler 真正零改动的关键。
 *
 * 现状：handler 直接 `import { XXX_DB }`，并对数组做
 *   `[...DB]` / `.find()` / `.filter()` / `.push()` / `.splice()` / `DB[i] = {...}`，
 * 甚至直接改行对象（`notice.status = 1`）或嵌套数组（`dictType.items.push(x)`）。
 * 这里用一个数组 Proxy + 行 Proxy + 嵌套数组 Proxy 三层代理，把这些写操作
 * 全部翻译成 DataStore 的 insert / update / remove（软删除），读操作则每次
 * 从仓储拉最新快照 —— 因此 SQLite 成为唯一真实源，重启后数据仍在。
 *
 * `MOCK_STORE=memory`（默认）时直接返回普通数组，行为与改造前逐字一致。
 */

import type { DataStore, Row } from './store';

import { getStore } from './runtime';
import { idKey } from './ids';

/** 库内下一个业务 id（替代模块级 next*Id 自增变量，重启不撞号） */
export function nextBizId(table: string): number {
  const store = getStore();
  if (store.kind === 'memory') return 0; // 由调用方回落到原自增逻辑
  const rows = store.list<Row>(table, { includeDeleted: true }).list;
  return rows.reduce((max, row) => {
    const n = Number(row.id);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0) + 1;
}

/** 写操作回调：把整行覆盖回仓储 */
type Commit = (next: Row) => void;

/** 业务 id 读取：泛型只约束 object，避免要求业务 interface 带索引签名 */
function bizId(row: object): unknown {
  return (row as { id?: unknown }).id;
}

/**
 * 嵌套数组代理：`dictType.items.push(newItem)` / `items.splice(...)` / `items[0] = x`
 * 都会回写整行，避免「行对象里嵌的数组被改了但库里没变」。
 */
function wrapNestedArray(source: unknown[], commitArray: (next: unknown[]) => void): unknown[] {
  const target = [...source];
  const commit = () => commitArray([...target]);
  return new Proxy(target, {
    get(t, prop, receiver) {
      if (prop === 'push') {
        return (...items: unknown[]) => {
          const n = Array.prototype.push.apply(t, items);
          commit();
          return n;
        };
      }
      if (prop === 'unshift') {
        return (...items: unknown[]) => {
          const n = Array.prototype.unshift.apply(t, items);
          commit();
          return n;
        };
      }
      if (prop === 'splice') {
        return (start: number, deleteCount?: number, ...items: unknown[]) => {
          const removed = Array.prototype.splice.call(t, start, deleteCount ?? 0, ...items);
          commit();
          return removed;
        };
      }
      if (prop === 'pop' || prop === 'shift') {
        return () => {
          const removed = Array.prototype[prop].call(t) as unknown;
          commit();
          return removed;
        };
      }
      return Reflect.get(t, prop, receiver);
    },
    set(t, prop, value) {
      const ok = Reflect.set(t, prop, value);
      if (typeof prop === 'string' && /^\d+$/.test(prop)) commit();
      return ok;
    },
  });
}

/** 行代理：拦截属性赋值，落库为局部 update */
function wrapRow<T extends object>(row: T, commit: Commit): T {
  const target: Row = { ...row } as Row;
  return new Proxy(target, {
    get(t, prop, receiver) {
      const value = Reflect.get(t, prop, receiver);
      if (Array.isArray(value)) {
        return wrapNestedArray(value, (next) => {
          const nextRow = { ...t, [prop]: next };
          Object.assign(t, nextRow);
          commit(nextRow);
        });
      }
      return value;
    },
    set(t, prop, value) {
      const ok = Reflect.set(t, prop, value);
      // 只持久化业务字段，不把 Symbol / length 之类写进 JSON
      if (typeof prop === 'string') {
        const nextRow = { ...t };
        commit(nextRow);
      }
      return ok;
    },
  }) as T;
}

/** 只读数组方法：转发到包装后的快照数组 */
const PASSTHROUGH_METHODS = new Set([
  'at',
  'concat',
  'entries',
  'every',
  'filter',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
  'flat',
  'flatMap',
  'forEach',
  'includes',
  'indexOf',
  'join',
  'keys',
  'lastIndexOf',
  'map',
  'reduce',
  'reduceRight',
  'slice',
  'some',
  'toLocaleString',
  'toString',
  'values',
]);

export interface CollectionOptions<T extends object> {
  /** 表名，必须在 schema.ts 白名单内 */
  table: string;
  /** 首次播种数据（复用确定性内置数据）；表内已有数据时不重复播种 */
  seed?: () => T[];
}

/**
 * 定义一个集合。返回类型仍是 `T[]`，所以所有既有 handler 的 import 与用法不变。
 */
export function defineCollection<T extends object>(options: CollectionOptions<T>): T[] {
  const { table, seed } = options;
  const store: DataStore = getStore();

  // 默认内存实现：保持改造前的普通数组语义，零回归
  if (store.kind === 'memory') return seed ? seed() : [];

  ensureSeed(table, seed, store);
  return createSqliteArray<T>(table, store);
}

function ensureSeed<T extends object>(
  table: string,
  seed: (() => T[]) | undefined,
  store: DataStore,
): void {
  if (!seed) return;
  // 含软删除一起算：用户删空后重启不应把数据"复活"
  if (store.count(table, true) > 0) return;
  for (const row of seed()) store.insert(table, row);
}

function createSqliteArray<T extends object>(table: string, store: DataStore): T[] {
  /** 每次读取都拉最新快照，保证同一进程内多个 handler 看到一致数据 */
  const snapshot = (): T[] => {
    const rows = store.list<T>(table).list;
    return rows.map((row) => wrapRow(row, (next) => store.update(table, idKey(bizId(row)), next)));
  };

  const target: T[] = [];

  return new Proxy(target, {
    get(_t, prop, receiver) {
      const rows = snapshot();

      if (prop === 'length') return rows.length;
      if (prop === Symbol.iterator) {
        return function* () {
          yield* rows;
        };
      }
      if (typeof prop === 'string' && /^\d+$/.test(prop)) return rows[Number(prop)];

      if (prop === 'push') {
        return (...items: T[]) => {
          for (const item of items) store.insert(table, item);
          return store.list<T>(table).total;
        };
      }
      if (prop === 'unshift') {
        return (...items: T[]) => {
          for (const item of items) store.insert(table, item);
          return store.list<T>(table).total;
        };
      }
      if (prop === 'splice') {
        return (start: number, deleteCount?: number, ...items: T[]) => {
          const removed = rows.slice(start, start + (deleteCount ?? 0));
          for (const row of removed) store.remove(table, bizId(row));
          for (const item of items) store.insert(table, item);
          return removed;
        };
      }
      if (prop === 'pop' || prop === 'shift') {
        return () => {
          const row = prop === 'pop' ? rows[rows.length - 1] : rows[0];
          if (!row) return undefined;
          store.remove(table, bizId(row));
          return row;
        };
      }
      if (prop === 'sort' || prop === 'reverse') {
        // 排序只作用于临时快照（前端展示排序由 handler 自己的 filtered 数组承担），
        // 不改变库内物理顺序，避免意外把展示顺序持久化。
        return (...args: unknown[]) => (Array.prototype as never as Record<string, Function>)[prop]!.apply(rows, args);
      }
      if (typeof prop === 'string' && PASSTHROUGH_METHODS.has(prop)) {
        const fn = (rows as unknown as Record<string, Function>)[prop];
        return fn && typeof fn === 'function' ? fn.bind(rows) : fn;
      }
      return Reflect.get(rows, prop, receiver);
    },

    set(_t, prop, value) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        const rows = snapshot();
        const index = Number(prop);
        const current = rows[index];
        if (current) {
          // handler 常见写法：DB[idx] = { ...DB[idx], ...patch }
          store.update(table, bizId(current), value as Row);
        } else {
          store.insert(table, value as T);
        }
        return true;
      }
      if (prop === 'length') {
        // 标准数组语义：`DB.length = 0` 清空集合。测试用它在不同用例间还原
        // 快照（全仓库仅 demo-task.test.ts 使用），sqlite 下必须真正清空，
        // 否则快照还原失效、数据跨用例累积，表现为 id 重复 / 软删后仍可见。
        // 这里走 truncate（reset 语义），与业务删除一律软删除的约束不冲突。
        if (value === 0) store.truncate(table);
        return true;
      }
      return Reflect.set(_t, prop, value);
    },

    has(_t, prop) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        return Number(prop) < snapshot().length;
      }
      return prop in snapshot();
    },
  });
}
