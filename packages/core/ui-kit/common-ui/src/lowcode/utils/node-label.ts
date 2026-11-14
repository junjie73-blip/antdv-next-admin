import type { NodeSchema } from '../core/types';

/**
 * 节点展示名。
 *
 * 分层位置：`utils/`，只服务组件层（大纲、属性面板、面包屑），core 不用它 ——
 * core 的产物是数据，「怎么显示」是视图的事，两者不该互相牵住。
 *
 * 本文件**不做**的事：不猜业务语义（没有「订单」这种词表），不翻译（i18n 归宿主），
 * 也不改 Schema。
 */

/** 注册表的最小形状：只要 `getMeta`，方便单测传一个对象代替整个注册表 */
export interface LabelRegistry {
  getMeta: (type: string) => undefined | { name?: string };
}

/**
 * 能当「一句话摘要」的属性键，按顺序取第一个有值的字符串。
 * 口径来自 basic 预设：文本用 `text`、标题用 `title`、表单用 `label`，
 * 宿主自己的物料若用了别的键，传 `labelKeys` 覆盖即可。
 */
export const DEFAULT_LABEL_KEYS: string[] = [
  'title',
  'text',
  'label',
  'name',
  'placeholder',
];

function firstStringish(
  node: NodeSchema,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = node.props?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

/**
 * `文本（我是标题）`这样的「类型名 + 摘要」：
 * 摘要只在能读到的时候才拼，读不到就只给类型名 —— 大纲里出现 `（undefined）` 比没摘要更难读。
 */
export function nodeLabel(
  node: NodeSchema,
  registry?: LabelRegistry,
  options: { labelKeys?: readonly string[]; withSummary?: boolean } = {},
): string {
  const name = registry?.getMeta(node.type)?.name ?? node.type;
  if (options.withSummary === false) return name;
  const summary = firstStringish(node, options.labelKeys ?? DEFAULT_LABEL_KEYS);
  if (!summary) return name;
  // 摘要截一下：属性面板里把一段长文案塞进大纲行会把整行撑开
  return `${name}（${summary.length > 12 ? `${summary.slice(0, 12)}…` : summary}）`;
}

/**
 * 大纲缩进用的固定 Tailwind 类表。
 *
 * 为什么不用内联 `padding-left`：本包的样式口径是「只用 Tailwind 工具类与 shadcn token」，
 * 动态拼接的类名（`pl-${depth}`）Tailwind 扫描不到会被 purge，所以这里预置一张表按层取。
 */
export const INDENT_CLASSES: readonly string[] = [
  'pl-0',
  'pl-3',
  'pl-6',
  'pl-9',
  'pl-12',
  'pl-16',
  'pl-20',
];

export function indentClass(depth: number): string {
  const safe = Number.isFinite(depth) && depth > 0 ? Math.floor(depth) : 0;
  return INDENT_CLASSES[Math.min(safe, INDENT_CLASSES.length - 1)]!;
}
