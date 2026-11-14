/**
 * 代理安全的深拷贝。
 *
 * 为什么不用 `structuredClone`：它是我们踩过的一次真实故障。
 * 宿主侧几乎一定是 `const definition = ref(createEmptyDefinition())`，
 * 模板里 `:definition="definition"` 传进组件的是 Vue 的 reactive 代理，
 * 而 `structuredClone(代理)` 直接抛 `DataCloneError: #<Object> could not be cloned` ——
 * 表现是"设计器一点自动布局就白屏"，堆栈里完全看不出跟响应式有关。
 * `core/` 这一层不许 import vue，所以也不能用 `toRaw()` 把代理拆掉再克隆，
 * 只能自己走一遍：读代理是合法的（每个 get 都会反射到目标对象），写才需要新对象。
 *
 * 口径：
 * - 只处理 JSON 形状的数据（数组、普通对象、原始值），外加保留 `Date`；
 * - 保留值为 `undefined` 的键（`{ defaultEdgeId: undefined }` 是"没设默认边"的显式表达，
 *   `JSON.parse(JSON.stringify())` 会把它抹掉，所以这里不走 JSON）；
 * - 函数、Map、Set、类实例原样透传引用 —— 定义与任务里不该出现它们，
 *   出现了也只会在调试时暴露，不会悄悄丢数据。
 */
export function cloneDeep<T>(value: T): T {
  return clone(value) as T;
}

function clone(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => clone(item));
  if (value instanceof Date) return new Date(value);
  if (value === null || typeof value !== 'object') return value;
  // 类实例 / Map / Set 不是"定义"该有的形状：原样透传，不压成普通对象
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    out[key] = clone((value as Record<string, unknown>)[key]);
  }
  return out;
}
