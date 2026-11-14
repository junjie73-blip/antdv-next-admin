import type { ExpressionEvaluator } from '@antdv/graph';

import type {
  ComponentMeta,
  DataSourceSpec,
  FlatNode,
  InsertTarget,
  LowcodeIssue,
  NodeId,
  NodeSchema,
  PageSchema,
  WalkContext,
} from './types';

import {
  createExpressionEvaluator,
  createGraphId,
  nextUniqueId,
} from '@antdv/graph';

import { parseEventAction, unsafePathMessage } from './binding';

/**
 * Schema DSL 的纯函数层：增删改移、克隆、拍平、体检。
 *
 * 分层位置：`core/`，无 vue、无副作用、不碰 DOM。所有改动**返回新树**而不是原地变更，
 * 理由是低代码的编辑动作要能进撤销栈 —— 原地改意味着每次动作前自己先深拷贝一份，
 * 反而更容易漏；不可变的返回让「上一份」天然可用（宿主想接 undo 直接压栈即可）。
 *
 * 本文件**不做**的事：不求值绑定（`binding.ts`）、不登记物料（`registry.ts`）、
 * 不取数（`datasource.ts`）、不认识 Vue 组件对象。
 */

/** 子树深度上限：设计器里超过这个深度基本是把循环写成树了 */
export const DEFAULT_MAX_DEPTH = 24;

/** 新节点 id 的前缀；与 `@antdv/graph` 的短 id 同一套字符集，可直接进 `data-*` 与 CSS 选择器 */
export const NODE_ID_PREFIX = 'node';

export type DslErrorCode =
  | 'cycle'
  | 'invalid-target'
  | 'not-found'
  | 'unknown-parent';

export class LowCodeDslError extends Error {
  readonly code: DslErrorCode;

  constructor(code: DslErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'LowCodeDslError';
  }

  static is(error: unknown): error is LowCodeDslError {
    return error instanceof LowCodeDslError;
  }
}

/** 设计器新建节点要的 id */
export function createNodeId(prefix: string = NODE_ID_PREFIX): NodeId {
  return createGraphId(prefix);
}

/* ------------------------------- 结构复制 ------------------------------- */

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => cloneValue(item));
  if (
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>))
      out[key] = cloneValue(item);
    return out;
  }
  return value;
}

/** 深复制一个节点：只复制 Schema 写得出的形状（plain object / array / 原始值） */
export function cloneNode(node: NodeSchema): NodeSchema {
  const next: NodeSchema = { id: node.id, type: node.type };
  if (node.props)
    next.props = cloneValue(node.props) as Record<string, unknown>;
  if (node.condition !== undefined) next.condition = node.condition;
  if (node.events)
    next.events = cloneValue(node.events) as Record<string, string>;
  if (node.children)
    next.children = node.children.map((child) => cloneNode(child));
  if (node.slots) {
    const slots: Record<string, NodeSchema[]> = {};
    for (const [name, items] of Object.entries(node.slots))
      slots[name] = items.map((child) => cloneNode(child));
    next.slots = slots;
  }
  return next;
}

export function cloneTree(tree: NodeSchema[]): NodeSchema[] {
  return tree.map((node) => cloneNode(node));
}

/** 整份页面深复制：改动前先克隆，是最低成本的「不污染原始 Schema」做法 */
export function cloneSchema(page: PageSchema): PageSchema {
  const next: PageSchema = {
    id: page.id,
    name: page.name,
    tree: cloneTree(page.tree),
    version: page.version,
  };
  if (page.state)
    next.state = cloneValue(page.state) as Record<string, unknown>;
  if (page.dataSources)
    next.dataSources = cloneValue(page.dataSources) as DataSourceSpec[];
  return next;
}

/* -------------------------------- 遍历 -------------------------------- */

/** 节点的子列表：`children` 用 `slot === undefined` 表达，具名插槽用名字表达 */
export function childGroups(
  node: NodeSchema,
): Array<{ items: NodeSchema[]; slot: string | undefined }> {
  const groups: Array<{ items: NodeSchema[]; slot: string | undefined }> = [];
  if (node.children && node.children.length > 0)
    groups.push({ items: node.children, slot: undefined });
  for (const [name, items] of Object.entries(node.slots ?? {})) {
    if (items && items.length > 0) groups.push({ items, slot: name });
  }
  return groups;
}

/**
 * 前序深度遍历。回调返回 `false` 表示**不下钻该子树**（只跳过自身以下的部分）。
 * 顺序被固定成「先 children，再按声明顺序的各插槽」，大纲与体检都依赖它稳定。
 */
export function walkSchema(
  nodes: NodeSchema[],
  visit: (node: NodeSchema, ctx: WalkContext) => boolean | void,
): void {
  function walk(
    list: NodeSchema[],
    depth: number,
    parentId: NodeId | undefined,
    slot: string | undefined,
    trail: NodeId[],
  ) {
    list.forEach((node, index) => {
      const nextTrail = [...trail, node.id];
      const descend = visit(node, {
        depth,
        index,
        parentId,
        slot,
        trail: nextTrail,
      });
      if (descend === false) return;
      for (const group of childGroups(node))
        walk(group.items, depth + 1, node.id, group.slot, nextTrail);
    });
  }
  walk(nodes, 0, undefined, undefined, []);
}

export function collectNodes(nodes: NodeSchema[]): NodeSchema[] {
  const out: NodeSchema[] = [];
  walkSchema(nodes, (node) => {
    out.push(node);
  });
  return out;
}

export function collectIds(nodes: NodeSchema[]): NodeId[] {
  return collectNodes(nodes).map((node) => node.id);
}

export function maxDepthOf(nodes: NodeSchema[]): number {
  let max = 0;
  walkSchema(nodes, (_node, ctx) => {
    max = Math.max(max, ctx.depth);
  });
  return max;
}

/** 子树里是否出现某个 id：跨父移动前要用它拒绝「把自己塞进自己的后代」 */
export function containsId(node: NodeSchema, id: NodeId): boolean {
  if (node.id === id) return true;
  return childGroups(node).some((group) =>
    group.items.some((item) => containsId(item, id)),
  );
}

/* -------------------------------- 定位 -------------------------------- */

export interface NodeHit extends WalkContext {
  node: NodeSchema;
}

export function findNode(
  nodes: NodeSchema[],
  id: NodeId,
): NodeSchema | undefined {
  let found: NodeSchema | undefined;
  walkSchema(nodes, (node) => {
    if (found) return false;
    if (node.id !== id) return;
    found = node;
    return false;
  });
  return found;
}

export function locateNode(
  nodes: NodeSchema[],
  id: NodeId,
): NodeHit | undefined {
  let hit: NodeHit | undefined;
  walkSchema(nodes, (node, ctx) => {
    if (hit) return false;
    if (node.id !== id) return;
    hit = { ...ctx, node };
    return false;
  });
  return hit;
}

/** 某节点所在兄弟列表（根级就是根数组本身）；大纲算上下移边界用 */
export function siblingsOf(nodes: NodeSchema[], id: NodeId): NodeSchema[] {
  const hit = locateNode(nodes, id);
  if (!hit) return [];
  if (hit.parentId === undefined) return nodes;
  const parent = findNode(nodes, hit.parentId);
  if (!parent) return [];
  return (
    (hit.slot === undefined ? parent.children : parent.slots?.[hit.slot]) ?? []
  );
}

/* ---------------------------- 不可变增删改 ---------------------------- */

/** 空列表归一化：`children: []` 与 `slots: {}` 一律删掉，避免「空数组」和「没有该键」两套真相 */
function pruneKeys(node: NodeSchema): NodeSchema {
  const next: NodeSchema = { ...node };
  if (next.children && next.children.length === 0) delete next.children;
  if (next.slots) {
    const slots: Record<string, NodeSchema[]> = {};
    for (const [name, items] of Object.entries(next.slots)) {
      if (items && items.length > 0) slots[name] = items;
    }
    if (Object.keys(slots).length === 0) delete next.slots;
    else next.slots = slots;
  }
  return next;
}

/**
 * 对命中 id 的节点应用 `transform`（返回 `undefined` 表示删除），未命中的分支保持对象引用不变，
 * 这样上层的 Vue diff 与宿主撤销栈都能复用旧引用。
 */
export function updateNode(
  nodes: NodeSchema[],
  id: NodeId,
  transform: (node: NodeSchema) => NodeSchema | undefined,
): NodeSchema[] {
  function mapList(list: NodeSchema[]): {
    changed: boolean;
    out: NodeSchema[];
  } {
    let changed = false;
    const out: NodeSchema[] = [];
    for (const node of list) {
      if (node.id === id) {
        changed = true;
        const next = transform(node);
        if (next) out.push(next);
        continue;
      }
      let touched = false;
      let children: NodeSchema[] | undefined;
      let slots: Record<string, NodeSchema[]> | undefined;
      for (const group of childGroups(node)) {
        const mapped = mapList(group.items);
        if (!mapped.changed) continue;
        touched = true;
        if (group.slot === undefined) children = mapped.out;
        else slots = { ...(slots ?? node.slots), [group.slot]: mapped.out };
      }
      if (!touched) {
        out.push(node);
        continue;
      }
      const next: NodeSchema = { ...node };
      if (children) next.children = children;
      if (slots) next.slots = slots;
      out.push(pruneKeys(next));
    }
    return { changed, out };
  }

  return mapList(nodes).out;
}

/** 改写某个节点的子列表；空列表由 `pruneKeys` 收掉 */
function withSlot(
  node: NodeSchema,
  slot: string | undefined,
  items: NodeSchema[],
): NodeSchema {
  const next: NodeSchema = { ...node };
  if (slot === undefined) {
    next.children = items;
    return pruneKeys(next);
  }
  next.slots = { ...node.slots, [slot]: items };
  return pruneKeys(next);
}

type Placement = {
  parentId: NodeId | undefined;
  position: 'after' | 'before' | 'inside';
  refId: NodeId | undefined;
  slot: string | undefined;
};

function place(
  nodes: NodeSchema[],
  node: NodeSchema,
  at: Placement,
): NodeSchema[] {
  if (at.parentId === undefined) {
    if (at.position === 'inside' || at.refId === undefined)
      return [...nodes, node];
    const index = nodes.findIndex((item) => item.id === at.refId);
    if (index === -1)
      throw new LowCodeDslError(
        'not-found',
        `找不到参照节点「${String(at.refId)}」`,
      );
    const insertAt = at.position === 'before' ? index : index + 1;
    return [...nodes.slice(0, insertAt), node, ...nodes.slice(insertAt)];
  }
  return updateNode(nodes, at.parentId, (parent) => {
    const list = [
      ...(at.slot === undefined
        ? (parent.children ?? [])
        : (parent.slots?.[at.slot] ?? [])),
    ];
    if (at.position === 'inside' || at.refId === undefined)
      return withSlot(parent, at.slot, [...list, node]);
    const index = list.findIndex((item) => item.id === at.refId);
    if (index === -1) {
      throw new LowCodeDslError(
        'not-found',
        `节点「${parent.id}」的${at.slot ? `插槽「${at.slot}」` : '子节点'}里没有「${String(at.refId)}」`,
      );
    }
    const insertAt = at.position === 'before' ? index : index + 1;
    return withSlot(parent, at.slot, [
      ...list.slice(0, insertAt),
      node,
      ...list.slice(insertAt),
    ]);
  });
}

/**
 * 归一化落点：`{}` -> 根级末尾；只给 `refId` -> 参照节点同层前后；给 `parentId` -> 放进该父。
 *
 * 「同层」必须以**参照节点自己的父级**为准，而不是把没写 `parentId` 当成根级 ——
 * 设计器里「在这个节点后面插一个」是最常见的动作，参照往往是深层节点，
 * 按根级解释会直接找不到参照（老实现就在这里抛过 `找不到参照节点「a2」`）。
 * 同理，`slot` 缺省时继承参照的插槽：往 `footer` 里的节点后面插，不该掉回 `children`。
 */
function normalizeTarget(nodes: NodeSchema[], target: InsertTarget): Placement {
  const position = target.position ?? 'inside';
  if (target.parentId !== undefined) {
    return {
      parentId: target.parentId,
      position,
      refId: target.refId,
      slot: target.slot,
    };
  }
  if (target.refId !== undefined) {
    // 只给 refId 且没说要放进哪里：同层插；显式 inside 时把 refId 当父节点看待
    if (position === 'inside')
      return {
        parentId: target.refId,
        position,
        refId: undefined,
        slot: target.slot,
      };
    const hit = locateNode(nodes, target.refId);
    if (!hit)
      throw new LowCodeDslError(
        'not-found',
        `找不到参照节点「${target.refId}」`,
      );
    return {
      parentId: hit.parentId,
      position,
      refId: target.refId,
      slot: target.slot ?? hit.slot,
    };
  }
  return { parentId: undefined, position, refId: undefined, slot: target.slot };
}

/**
 * 插入节点。
 * - 落点非法（父/参照不存在）抛 `LowCodeDslError`：静默吞掉一次拖入结果是最难查的 bug 形态；
 * - id 撞车时自动给新子树换 id：物料面板一个 `type` 会插多次，宿主常常懒得先分配 id，
 *   这里兜住比让体检报错友好，同时仍然保证「树内 id 唯一」这条硬规矩。
 */
export function insertNode(
  nodes: NodeSchema[],
  node: NodeSchema,
  target: InsertTarget = {},
): NodeSchema[] {
  const at = normalizeTarget(nodes, target);
  if (at.parentId !== undefined && !findNode(nodes, at.parentId)) {
    throw new LowCodeDslError(
      'unknown-parent',
      `父节点「${String(at.parentId)}」不存在`,
    );
  }
  if (at.parentId !== undefined && containsId(node, at.parentId)) {
    throw new LowCodeDslError('cycle', '不能把节点放进自己的子树里');
  }
  const taken = new Set(collectIds(nodes));
  const collides = collectIds([node]).some((id) => taken.has(id));
  const next = collides ? renewSubtreeIds(node, taken).node : cloneNode(node);
  return place(nodes, next, at);
}

export interface RemoveResult {
  removed: NodeSchema | undefined;
  tree: NodeSchema[];
}

/** 删除并返回被删子树：撤销栈要能把原节点放回原位 */
export function removeNode(nodes: NodeSchema[], id: NodeId): RemoveResult {
  const removed = findNode(nodes, id);
  if (!removed) return { removed: undefined, tree: nodes };
  return { removed, tree: updateNode(nodes, id, () => undefined) };
}

/** 改名/改属性/改事件的统一入口，保证「只改一处也返回新树」 */
export function patchNode(
  nodes: NodeSchema[],
  id: NodeId,
  patch: Partial<Omit<NodeSchema, 'id'>>,
): NodeSchema[] {
  return updateNode(nodes, id, (node) => {
    const next: NodeSchema = { ...node, ...patch, id: node.id };
    if (patch.props) next.props = { ...node.props, ...patch.props };
    return pruneKeys(next);
  });
}

/**
 * 移动节点，同覆盖跨父移动与同层重排：先摘出子树，再按 target 放回。
 * 摘除与放回都用不可变实现，所以「移动后 children 顺序」完全由 target 决定
 * （`before`/`after` 落在参照两侧，`inside` 追加到目标列表末尾）。
 */
export function moveNode(
  nodes: NodeSchema[],
  id: NodeId,
  target: InsertTarget,
): NodeSchema[] {
  const current = locateNode(nodes, id);
  if (!current)
    throw new LowCodeDslError(
      'not-found',
      `找不到要移动的节点「${String(id)}」`,
    );
  const at = normalizeTarget(nodes, target);
  if (at.parentId === id)
    throw new LowCodeDslError('cycle', `不能把「${id}」放进自己里面`);
  if (at.parentId !== undefined) {
    if (!findNode(nodes, at.parentId))
      throw new LowCodeDslError(
        'unknown-parent',
        `父节点「${String(at.parentId)}」不存在`,
      );
    if (containsId(current.node, at.parentId)) {
      throw new LowCodeDslError(
        'cycle',
        `不能把「${id}」放进自己的子树（父节点「${String(at.parentId)}」在它下面）`,
      );
    }
  }
  if (at.refId === id)
    throw new LowCodeDslError('invalid-target', '参照节点不能是自身');
  const detached = updateNode(nodes, id, () => undefined);
  return place(detached, cloneNode(current.node), at);
}

/** 同层重排：大纲面板的上移/下移按钮走这个入口；到头就原样返回 */
export function shiftNode(
  nodes: NodeSchema[],
  id: NodeId,
  direction: 'down' | 'up',
): NodeSchema[] {
  const hit = locateNode(nodes, id);
  if (!hit) return nodes;
  const siblings = siblingsOf(nodes, id);
  const index = siblings.findIndex((item) => item.id === id);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= siblings.length) return nodes;
  const anchor = siblings[target]!;
  return moveNode(nodes, id, {
    parentId: hit.parentId,
    position: direction === 'up' ? 'before' : 'after',
    refId: anchor.id,
    slot: hit.slot,
  });
}

export interface RenewResult {
  /** 旧 id -> 新 id，方便宿主把选中态跟着搬过去 */
  idMap: Record<NodeId, NodeId>;
  node: NodeSchema;
}

/**
 * 子树 id 重新生成：复制出来的节点如果留着旧 id，树里立刻出现重复 id，
 * 渲染 key、事件定位、撤销栈全会错乱，所以连 children 与各插槽一起换。
 * `idFactory` 可注入，单测传确定性函数就能断言复制结果。
 */
export function renewSubtreeIds(
  node: NodeSchema,
  taken: Iterable<NodeId>,
  prefix: string = NODE_ID_PREFIX,
  idFactory: (prefix: string) => NodeId = createNodeId,
): RenewResult {
  const used = new Set(taken);
  const idMap: Record<NodeId, NodeId> = {};

  /** 一律发新号：复制体留着旧 id 等于往树里塞重复 key，宁可多花一次随机 */
  const allocate = (): NodeId => {
    for (let attempt = 0; attempt < 64; attempt += 1) {
      const candidate = idFactory(prefix);
      if (!used.has(candidate)) {
        used.add(candidate);
        return candidate;
      }
    }
    const fallback = nextUniqueId(used, prefix);
    used.add(fallback);
    return fallback;
  };

  const mapId = (id: NodeId): NodeId => {
    const cached = idMap[id];
    if (cached) return cached;
    const next = allocate();
    idMap[id] = next;
    return next;
  };

  function renew(input: NodeSchema): NodeSchema {
    const output = cloneNode(input);
    output.id = mapId(input.id);
    if (output.children) output.children = output.children.map(renew);
    if (output.slots) {
      const slots: Record<string, NodeSchema[]> = {};
      for (const [name, items] of Object.entries(output.slots))
        slots[name] = items.map(renew);
      output.slots = slots;
    }
    return output;
  }

  return { idMap, node: renew(node) };
}

/** 复制节点并插回原位置之后；大纲的「复制」按钮走这里 */
export function duplicateNode(
  nodes: NodeSchema[],
  id: NodeId,
  options: { idFactory?: (prefix: string) => NodeId; prefix?: string } = {},
): { idMap: Record<NodeId, NodeId>; tree: NodeSchema[] } {
  const hit = locateNode(nodes, id);
  if (!hit)
    throw new LowCodeDslError(
      'not-found',
      `找不到要复制的节点「${String(id)}」`,
    );
  const renewed = renewSubtreeIds(
    hit.node,
    collectIds(nodes),
    options.prefix,
    options.idFactory,
  );
  return {
    idMap: renewed.idMap,
    tree: place(nodes, renewed.node, {
      parentId: hit.parentId,
      position: 'after',
      refId: hit.node.id,
      slot: hit.slot,
    }),
  };
}

/* ------------------------------ 拍平与重建 ------------------------------ */

interface Frame {
  children?: NodeSchema[];
  node: NodeSchema;
  slots?: Record<string, NodeSchema[]>;
}

/**
 * 树 -> 有序扁平行（大纲、搜索、虚拟化列表共用一个形状）。
 * `maxDepth` 只是「少渲染几层」的性能阀门，不影响 `fromFlatList` 的可逆性
 * —— 被裁掉的行本来就不在结果里。
 */
export function toFlatList(
  nodes: NodeSchema[],
  options: { labelOf?: (node: NodeSchema) => string; maxDepth?: number } = {},
): FlatNode[] {
  const rows: FlatNode[] = [];
  walkSchema(nodes, (node, ctx) => {
    const row: FlatNode = { ...ctx, node };
    if (options.labelOf) row.label = options.labelOf(node);
    rows.push(row);
    if (options.maxDepth !== undefined && ctx.depth >= options.maxDepth)
      return false;
  });
  return rows;
}

/**
 * 扁平行 -> 树，与 `toFlatList` 互逆。
 * 靠 `depth` 递增维护一条父链栈，`slot` 决定挂进 children 还是某个具名插槽；
 * 空列表按 `pruneKeys` 的口径消失，所以「叶子没有 children 键」是唯一的真相。
 */
export function fromFlatList(rows: readonly FlatNode[]): NodeSchema[] {
  const root: NodeSchema[] = [];
  const stack: Frame[] = [];

  for (const row of rows) {
    const node = cloneNode(row.node);
    const frame: Frame = { node };
    if (row.depth === 0) root.push(node);
    else {
      const parent = stack[row.depth - 1];
      if (!parent)
        throw new LowCodeDslError(
          'invalid-target',
          `扁平行「${node.id}」缺少第 ${row.depth} 层的父节点`,
        );
      if (row.slot === undefined) {
        parent.children ??= [];
        parent.children.push(node);
        parent.node.children = parent.children;
      } else {
        parent.slots ??= {};
        const list = (parent.slots[row.slot] ??= []);
        list.push(node);
        parent.node.slots = { ...parent.node.slots, [row.slot]: list };
      }
    }
    stack[row.depth] = frame;
    stack.length = row.depth + 1;
  }
  return root;
}

/* -------------------------------- 体检 -------------------------------- */

const TEMPLATE_SEGMENT = /\{\{\s*([\s\S]+?)\s*\}\}/gu;

/** 取出一个值里所有 `{{ }}` 段（递归数组与对象），顺序按出现顺序 */
export function expressionsIn(value: unknown, sink: string[] = []): string[] {
  if (typeof value === 'string') {
    for (const match of value.matchAll(TEMPLATE_SEGMENT)) {
      const raw = match[1];
      if (raw !== undefined) sink.push(raw.trim());
    }
    return sink;
  }
  if (Array.isArray(value)) {
    for (const item of value) expressionsIn(item, sink);
    return sink;
  }
  if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>))
      expressionsIn(item, sink);
  }
  return sink;
}

/**
 * `{{ a ?? 'x' }}` 的两段按 `resolveTemplate` 的同一套切法处理，
 * 否则体检会报出运行期根本不会执行的「假错误」—— 两边必须同构。
 */
export function templateParts(raw: string): string[] {
  const [head, fallback] = raw.split('??');
  const parts: string[] = [];
  const trimmedHead = head?.trim();
  if (trimmedHead) parts.push(trimmedHead);
  const trimmedFallback = fallback?.trim();
  if (trimmedFallback && !/^(['"]).*\1$/u.test(trimmedFallback))
    parts.push(trimmedFallback);
  return parts;
}

function checkSource(
  evaluator: ExpressionEvaluator,
  source: string,
  out: LowcodeIssue[],
  label: string,
  nodeId?: NodeId,
): void {
  try {
    evaluator.compile(source);
  } catch (error) {
    out.push({
      code: 'bad-expression',
      level: 'error',
      message: `${label}的表达式无法解析：${error instanceof Error ? error.message : String(error)}`,
      nodeId,
    });
  }
}

/** 校验一段带 `{{ }}` 的文本里所有表达式；不带花括号时按裸表达式处理 */
function checkTemplate(
  evaluator: ExpressionEvaluator,
  text: string,
  out: LowcodeIssue[],
  label: string,
  nodeId?: NodeId,
): void {
  const segments = [...text.matchAll(TEMPLATE_SEGMENT)]
    .map((match) => match[1]?.trim())
    .filter((item): item is string => Boolean(item));
  if (segments.length === 0) {
    checkSource(evaluator, text.trim(), out, label, nodeId);
    return;
  }
  for (const segment of segments) {
    for (const part of templateParts(segment))
      checkSource(evaluator, part, out, label, nodeId);
  }
}

export interface ValidateRegistry {
  getMeta: (type: string) => ComponentMeta | undefined;
  has: (type: string) => boolean;
}

export interface ValidateOptions {
  /** 只给 type 集合的简化用法，等价于一个没有元数据的注册表 */
  knownTypes?: Iterable<NodeId>;
  /** 求值器；缺省用 `@antdv/graph` 的受限语法 */
  evaluator?: ExpressionEvaluator;
  /** 物料注册表（或其 `{ getMeta, has }` 子集）；不给就跳过未知类型/插槽/容器校验 */
  registry?: ValidateRegistry;
  maxDepth?: number;
}

export interface ValidationResult {
  errors: LowcodeIssue[];
  issues: LowcodeIssue[];
  /** 只看 error：设计器允许「带告警保存」，但不允许带 error 发布 */
  valid: boolean;
  warnings: LowcodeIssue[];
}

/**
 * 页面体检：结构 + 语义一次跑完，返回机器可读的告警而不是抛异常。
 *
 * 覆盖：空/重复 id、缺 type、未知组件类型、深度上限、`condition` 与所有 `{{ }}`
 * 能否编译、事件动作串是否认识、`refresh:` 指向的数据源在不在、数据源重复 id /
 * 缺 url / 缺 handler / 依赖不存在 / `path` 里有原型链段。
 *
 * 未知组件类型报 **error 但不拦渲染**：渲染层的口径是「降级成可诊断占位」，
 * 体检负责把同一件事再用机器可读的方式说一遍，两边不冲突。
 */
export function validatePageSchema(
  page: PageSchema,
  options: ValidateOptions = {},
): ValidationResult {
  const issues: LowcodeIssue[] = [];
  const evaluator = options.evaluator ?? createExpressionEvaluator();
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const typeSet = options.knownTypes ? new Set(options.knownTypes) : undefined;

  const known = (type: string): boolean => {
    if (options.registry) return options.registry.has(type);
    if (typeSet) return typeSet.has(type);
    return true;
  };
  const metaOf = (type: string): ComponentMeta | undefined =>
    options.registry ? options.registry.getMeta(type) : undefined;

  if (!page.id)
    issues.push({
      code: 'invalid-node',
      level: 'warning',
      message: '页面缺少 id，宿主无法缓存与回显',
    });
  if (!page.name)
    issues.push({
      code: 'invalid-node',
      level: 'warning',
      message: '页面缺少名称',
    });
  if (!Array.isArray(page.tree) || page.tree.length === 0) {
    issues.push({
      code: 'empty-tree',
      level: 'warning',
      message: '页面没有任何节点',
    });
  }

  const seen = new Set<NodeId>();
  const dataSourceIds = new Set<NodeId>(
    (page.dataSources ?? []).map((item) => item.id),
  );

  walkSchema(page.tree, (node, ctx) => {
    if (typeof node.id !== 'string' || node.id.trim() === '') {
      issues.push({
        code: 'invalid-node',
        level: 'error',
        message: `存在空 id 的节点（type「${node.type}」，第 ${ctx.depth} 层）`,
      });
    } else if (seen.has(node.id)) {
      issues.push({
        code: 'duplicate-id',
        level: 'error',
        message: `节点 id「${node.id}」重复，渲染 key 与事件定位都会错乱`,
        nodeId: node.id,
      });
    } else seen.add(node.id);

    if (typeof node.type !== 'string' || node.type.trim() === '') {
      issues.push({
        code: 'invalid-node',
        level: 'error',
        message: `节点「${node.id}」缺少组件类型`,
        nodeId: node.id,
      });
    } else if (!known(node.type)) {
      issues.push({
        code: 'unknown-type',
        level: 'error',
        message: `组件类型「${node.type}」未登记，运行期会降级成占位`,
        nodeId: node.id,
      });
    }

    const meta = metaOf(node.type);
    const limit = meta?.maxDepth ?? maxDepth;
    if (ctx.depth > limit) {
      issues.push({
        code: 'depth-limit',
        level: 'error',
        message: `节点「${node.id}」的嵌套深度 ${ctx.depth} 超过上限 ${limit}`,
        nodeId: node.id,
      });
    }

    const hasKids =
      (node.children?.length ?? 0) > 0 ||
      Object.keys(node.slots ?? {}).length > 0;
    if (meta && meta.container === false && hasKids) {
      issues.push({
        code: 'invalid-node',
        level: 'warning',
        message: `「${node.type}」按元数据声明不承载子节点，多余的子节点不会被渲染`,
        nodeId: node.id,
      });
    }
    if (meta?.slots) {
      for (const name of Object.keys(node.slots ?? {})) {
        if (!meta.slots.includes(name)) {
          issues.push({
            code: 'unknown-slot',
            level: 'warning',
            message: `「${node.type}」没有声明插槽「${name}」，内容会落进默认插槽`,
            nodeId: node.id,
          });
        }
      }
    }

    if (node.condition !== undefined && node.condition.trim() !== '') {
      checkTemplate(evaluator, node.condition, issues, '显隐条件', node.id);
    }
    for (const [key, value] of Object.entries(node.props ?? {})) {
      for (const segment of expressionsIn(value))
        checkTemplate(
          evaluator,
          `{{ ${segment} }}`,
          issues,
          `属性「${key}」`,
          node.id,
        );
    }

    for (const [event, action] of Object.entries(node.events ?? {})) {
      const parsed = parseEventAction(action);
      if (parsed.error) {
        issues.push({
          code: 'bad-expression',
          level: 'error',
          message: `事件「${event}」的动作「${action}」不认识：${parsed.error}`,
          nodeId: node.id,
        });
        continue;
      }
      if (parsed.kind === 'refresh') {
        if (!dataSourceIds.has(parsed.arg)) {
          issues.push({
            code: 'unknown-datasource',
            level: 'error',
            message: `事件「${event}」要刷新的数据源「${parsed.arg}」不存在`,
            nodeId: node.id,
          });
        }
      } else if (parsed.kind !== 'emit') {
        const unsafe = unsafePathMessage(parsed.arg);
        if (unsafe)
          issues.push({
            code: 'unsafe-path',
            level: 'error',
            message: `事件「${event}」要写入的 ${unsafe}`,
            nodeId: node.id,
          });
        if (!parsed.arg)
          issues.push({
            code: 'invalid-node',
            level: 'error',
            message: `事件「${event}」的动作「${action}」缺少目标路径`,
            nodeId: node.id,
          });
        if (parsed.expression)
          checkTemplate(
            evaluator,
            parsed.expression,
            issues,
            `事件「${event}」的取值表达式`,
            node.id,
          );
      }
    }
  });

  const checked = new Set<NodeId>();
  for (const spec of page.dataSources ?? []) {
    if (!spec.id) {
      issues.push({
        code: 'invalid-datasource',
        level: 'error',
        message: '存在缺少 id 的数据源',
      });
      continue;
    }
    if (checked.has(spec.id))
      issues.push({
        code: 'duplicate-datasource',
        level: 'error',
        message: `数据源 id「${spec.id}」重复，后者会覆盖前者`,
      });
    checked.add(spec.id);

    if (spec.kind === 'rest' && !spec.url) {
      issues.push({
        code: 'invalid-datasource',
        dataSourceId: spec.id,
        level: 'error',
        message: `数据源「${spec.id}」是 rest 类型但没有 url`,
      });
    }
    if (spec.kind === 'function' && !spec.handler && !spec.expression) {
      issues.push({
        code: 'invalid-datasource',
        dataSourceId: spec.id,
        level: 'error',
        message: `数据源「${spec.id}」是 function 类型但既没有 handler 也没有 expression`,
      });
    }
    if (spec.path) {
      const unsafe = unsafePathMessage(spec.path);
      if (unsafe)
        issues.push({
          code: 'unsafe-path',
          dataSourceId: spec.id,
          level: 'error',
          message: `数据源「${spec.id}」写回的 ${unsafe}`,
        });
    }
    for (const segment of expressionsIn(spec.params ?? {}).concat(
      expressionsIn(spec.data),
    )) {
      checkTemplate(
        evaluator,
        `{{ ${segment} }}`,
        issues,
        `数据源「${spec.id}」`,
      );
    }
    // 数据源表达式与条件一样，`{{ x }}` 和裸 `x` 两种写法都收，所以走模板检查而不是裸编译
    if (spec.expression)
      checkTemplate(
        evaluator,
        spec.expression,
        issues,
        `数据源「${spec.id}」的表达式`,
      );
    for (const dep of spec.dependsOn ?? []) {
      if (!dataSourceIds.has(dep)) {
        issues.push({
          code: 'unknown-dependency',
          dataSourceId: spec.id,
          level: 'error',
          message: `数据源「${spec.id}」依赖的「${dep}」不存在`,
        });
      }
    }
  }

  const errors = issues.filter((item) => item.level === 'error');
  const warnings = issues.filter((item) => item.level === 'warning');
  return { errors, issues, valid: errors.length === 0, warnings };
}
