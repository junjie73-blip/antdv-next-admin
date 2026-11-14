/**
 * 设计器里新建节点 / 连线时要的短 id。
 *
 * 不用 `nanoid`：它的字母表带 `_-$`，而边 id 会进 CSS 选择器与 `data-*`，
 * `$` 与 `-` 在属性选择器转义里是可读的但极易写错。这里固定小写字母 + 数字，
 * 保证任何 `#id` / `[data-node-id=id]` 场景都不用转义。
 */
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

let counter = 0;

export function createGraphId(prefix = 'n'): string {
  counter = (counter + 1) % 0xffff;
  let random = '';
  for (let i = 0; i < 6; i += 1) {
    random += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  // 计数器进尾数：同一毫秒内批量创建（粘贴 50 个节点）也不会撞名
  return `${prefix}-${random}${counter.toString(36)}`;
}

/** 在已有 id 集合里找一个不冲突的 id，用于复制节点 */
export function nextUniqueId(existing: Iterable<string>, prefix = 'n'): string {
  const taken = new Set(existing);
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const id = createGraphId(prefix);
    if (!taken.has(id)) return id;
  }
  return `${prefix}-over-${Date.now().toString(36)}`;
}
