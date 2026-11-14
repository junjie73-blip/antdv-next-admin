import type { GraphEdge, GraphPosition } from '@antdv/graph';

import type {
  AssigneeRule,
  WorkflowDefinition,
  WorkflowNodeData,
  WorkflowNodeKind,
} from './types';

import { createGraphIndex, topologicalSort } from '@antdv/graph';

import { cloneDeep } from './clone';

/**
 * 设计器要做的**定义编辑**动作，全部是纯函数：进一份 `WorkflowDefinition`，
 * 出一份新的 `WorkflowDefinition`，不碰 vue、不碰画布。
 *
 * 这么切的理由有三个：
 * 1. 画布（`@vue-flow/core`）负责的是"拖到哪里、连成哪条线"，**流程语义仍然只有
 *    这一份定义**；把编辑动作抽出来，视图换库（今天 vue-flow，明天别人）不动语义。
 * 2. 属性面板改的是 `node.data`（办理人策略、或签/会签、驳回落点、超时、分支表达式），
 *    这些必须能被单测钉住 —— jsdom 里的画布事件不可靠，纯函数可以。
 * 3. 宿主要做"批量改定义"的运营工具时，直接 import 这层就够，不必挂一个画布。
 */

/** 设计器错误：给面板一条能直接展示的中文，而不是 `Cannot read properties of undefined` */
export class WorkflowDesignerError extends Error {
  code: WorkflowDesignerErrorCode;

  constructor(message: string, code: WorkflowDesignerErrorCode) {
    super(message);
    this.code = code;
    this.name = 'WorkflowDesignerError';
  }
}

export type WorkflowDesignerErrorCode =
  | 'duplicate-edge'
  | 'duplicate-node'
  | 'node-protected'
  | 'self-loop'
  | 'unknown-edge'
  | 'unknown-kind'
  | 'unknown-node'
  | 'wrong-kind';

export interface DesignerNodeKindMeta {
  /** 面板上的中文名 */
  label: string;
  /** 一句话说明这个节点解决什么问题（面板顶部提示） */
  hint: string;
  kind: WorkflowNodeKind;
  /** 只允许出现一个（start）；end 允许多个出口，但 `singleton` 为真时重复添加会报错 */
  singleton?: boolean;
  /** 从这条起可以画连线（end 是终点，不再出发） */
  sourceable?: boolean;
  /** 可以作为连线的落点 */
  targetable?: boolean;
  /** 新建时的初始 data（条件节点自带一条空分支，面板才有东西可填） */
  defaultData?: () => WorkflowNodeData;
  defaultLabel?: string;
}

/**
 * 六个内置类型 + 一个自定义示例。
 *
 * 自定义 kind 走 `handlers` 注册（见 `core/registry.ts`），设计器这边只要把
 * `extraKinds` 传进 `addNode` 就能出现在面板里 —— 不内置宿主业务的节点名。
 */
export const DESIGNER_NODE_KINDS: DesignerNodeKindMeta[] = [
  {
    kind: 'start',
    label: '发起',
    hint: '流程入口，一条定义只有一个',
    singleton: true,
    sourceable: true,
    targetable: false,
    defaultLabel: '发起',
  },
  {
    kind: 'approval',
    label: '审批',
    hint: '等人办理；或签/会签/顺序会签都在这一个类型里',
    sourceable: true,
    targetable: true,
    defaultLabel: '审批节点',
    defaultData: () => ({
      assignees: [{ params: { userIds: [] }, strategy: 'user' }],
      multi: 'any',
      rejectTo: 'previous',
    }),
  },
  {
    kind: 'cc',
    label: '抄送',
    hint: '建任务但不拦流程，通知发完继续走',
    sourceable: true,
    targetable: true,
    defaultLabel: '抄送',
    defaultData: () => ({
      assignees: [{ params: { userIds: [] }, strategy: 'user' }],
    }),
  },
  {
    kind: 'condition',
    label: '条件分支',
    hint: '按顺序取第一条命中的出线，都不命中走默认边',
    sourceable: true,
    targetable: true,
    defaultLabel: '条件分支',
    defaultData: () => ({ branches: [], defaultEdgeId: undefined }),
  },
  {
    kind: 'timer',
    label: '定时等待',
    hint: '到期靠宿主调 tick() 唤醒，引擎自己不看钟',
    sourceable: true,
    targetable: true,
    defaultLabel: '定时等待',
    defaultData: () => ({ timeoutMs: 60_000 }),
  },
  {
    kind: 'end',
    label: '结束',
    hint: '流程出口；允许多个出口（不同分支各自收敛）',
    sourceable: false,
    targetable: true,
    defaultLabel: '结束',
  },
];

export function nodeKindMeta(kind: WorkflowNodeKind): DesignerNodeKindMeta {
  const meta = DESIGNER_NODE_KINDS.find((item) => item.kind === kind);
  if (meta) return meta;
  // 自定义 kind 不在内置表里：给一份中性元数据，让它照样能出现在画布上
  return {
    kind,
    label: kind,
    hint: '自定义节点：由宿主注册的处理器解释',
    sourceable: true,
    targetable: true,
    defaultLabel: kind,
  };
}

export function isKnownKind(kind: WorkflowNodeKind): boolean {
  return DESIGNER_NODE_KINDS.some((item) => item.kind === kind);
}

export function cloneDefinition(def: WorkflowDefinition): WorkflowDefinition {
  // 见 core/clone.ts：这里必须是代理安全的，宿主传进来的 props 是 reactive 代理
  return cloneDeep(def);
}

/** 一条新定义的起点：只带 start + end，草稿态允许中间是空的 */
export function createEmptyDefinition(
  input: { id?: string; name?: string; version?: number } = {},
): WorkflowDefinition {
  const start = 'node_start';
  const end = 'node_end';
  return {
    edges: [{ id: 'edge_1', source: start, target: end }],
    id: input.id ?? 'flow-new',
    name: input.name ?? '未命名流程',
    nodes: [
      {
        data: {},
        id: start,
        label: '发起',
        position: { x: 60, y: 120 },
        type: 'start',
      },
      {
        data: {},
        id: end,
        label: '结束',
        position: { x: 340, y: 120 },
        type: 'end',
      },
    ],
    version: input.version ?? 1,
  };
}

export interface AddNodeInput {
  data?: WorkflowNodeData;
  /** 自定义 kind（宿主注册过处理器的类型）；不传按内置表 */
  kind: WorkflowNodeKind;
  label?: string;
  position?: GraphPosition;
}

export interface AddNodeResult {
  definition: WorkflowDefinition;
  nodeId: string;
}

/** 同类型第 n 个节点的 id：`approval` → `approval_1`、`approval_2`，跳开已占用的号 */
function nextNodeId(def: WorkflowDefinition, kind: WorkflowNodeKind): string {
  let seq = 1;
  const taken = new Set(def.nodes.map((node) => node.id));
  while (taken.has(`${kind}_${seq}`)) seq += 1;
  return `${kind}_${seq}`;
}

function requireNode(def: WorkflowDefinition, nodeId: string) {
  const node = def.nodes.find((item) => item.id === nodeId);
  if (!node)
    throw new WorkflowDesignerError(
      `节点 ${nodeId} 不在这条流程里`,
      'unknown-node',
    );
  return node;
}

function requireEdge(def: WorkflowDefinition, edgeId: string): GraphEdge {
  const edge = def.edges.find((item) => item.id === edgeId);
  if (!edge)
    throw new WorkflowDesignerError(
      `连线 ${edgeId} 不在这条流程里`,
      'unknown-edge',
    );
  return edge;
}

export function addNode(
  def: WorkflowDefinition,
  input: AddNodeInput & { id?: string },
): AddNodeResult {
  const meta = nodeKindMeta(input.kind);
  if (meta.singleton && def.nodes.some((node) => node.type === input.kind)) {
    throw new WorkflowDesignerError(
      `${meta.label}节点只能有一个`,
      'node-protected',
    );
  }
  const nodeId = input.id ?? nextNodeId(def, input.kind);
  if (def.nodes.some((node) => node.id === nodeId)) {
    throw new WorkflowDesignerError(
      `节点 id ${nodeId} 已存在`,
      'duplicate-node',
    );
  }
  const position = input.position ?? autoPlace(def);
  const definition = cloneDefinition(def);
  definition.nodes.push({
    data: { ...(input.data ?? meta.defaultData?.()) },
    id: nodeId,
    label: input.label ?? meta.defaultLabel ?? input.kind,
    position,
    type: input.kind,
  });
  return { definition, nodeId };
}

/**
 * 新节点的落点：从最右列往下找第一个空格，一列排满 4 个再右移一列。
 *
 * 为什么判据是几何而不是"最右列有几个人"（旧写法）：自动布局换行之后同一列会有好几段
 * （x 相同、y 差 240+），按"第几个人"编出来的 y 正好压在某一段身上 ——
 * 表现是"新加的抄送节点和归档节点叠在一起"，在画布上看着就像设计器坏了。
 * 卡片占位不超过 `columnGap × rowGap`，所以两点坐标差同时小于这两个间距就是重合。
 */
function autoPlace(def: WorkflowDefinition): GraphPosition {
  const columnGap = LAYOUT_COLUMN_GAP;
  const rowGap = LAYOUT_ROW_GAP;
  const taken = def.nodes.map((node) => node.position ?? { x: 60, y: 120 });
  const collides = (point: GraphPosition) =>
    taken.some(
      (other) =>
        Math.abs(other.x - point.x) < columnGap &&
        Math.abs(other.y - point.y) < rowGap,
    );
  const maxX = Math.max(60, ...taken.map((point) => point.x));
  const minY = Math.min(120, ...taken.map((point) => point.y));
  for (let column = 0; column < 3; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      const point = { x: maxX + column * columnGap, y: minY + row * rowGap };
      if (!collides(point)) return point;
    }
  }
  // 三列都排不下（宿主自己摆过一大片）：往下让一行，至少不压在最右列上
  return { x: maxX, y: minY + 4 * rowGap };
}

export function renameNode(
  def: WorkflowDefinition,
  nodeId: string,
  label: string,
): WorkflowDefinition {
  const definition = cloneDefinition(def);
  requireNode(definition, nodeId).label = label;
  return definition;
}

/** 浅合并 `node.data`：面板每次只交它改的那几个字段，未提的字段保持原样 */
export function patchNodeData(
  def: WorkflowDefinition,
  nodeId: string,
  patch: WorkflowNodeData,
): WorkflowDefinition {
  const definition = cloneDefinition(def);
  const node = requireNode(definition, nodeId);
  node.data = { ...node.data, ...patch };
  return definition;
}

export function moveNode(
  def: WorkflowDefinition,
  nodeId: string,
  position: GraphPosition,
): WorkflowDefinition {
  const definition = cloneDefinition(def);
  requireNode(definition, nodeId).position = { x: position.x, y: position.y };
  return definition;
}

export interface RemoveNodeResult {
  definition: WorkflowDefinition;
  /** 顺带删掉的连线，面板要能说出"我替你清了三条边" */
  removedEdgeIds: string[];
}

/**
 * 删节点会连带走它的所有出入边，并且要**顺手清理引用**：
 * 条件分支里的 `edgeId`、`defaultEdgeId`、其他节点 `rejectTo` 指向它的，
 * 都在这次删除里失效。留着这些悬空引用，表现是"流程跑得莫名其妙"，
 * 比报一条错难查得多 —— 所以宁可在设计上就把它当成删除的一部分。
 */
export function removeNode(
  def: WorkflowDefinition,
  nodeId: string,
): RemoveNodeResult {
  const node = requireNode(def, nodeId);
  const meta = nodeKindMeta(node.type);
  if (meta.singleton) {
    throw new WorkflowDesignerError(
      `${meta.label}节点不能删除`,
      'node-protected',
    );
  }
  const removedEdgeIds = def.edges
    .filter((edge) => edge.source === nodeId || edge.target === nodeId)
    .map((edge) => edge.id);
  const definition = cloneDefinition(def);
  definition.nodes = definition.nodes.filter((item) => item.id !== nodeId);
  definition.edges = definition.edges.filter(
    (edge) => !removedEdgeIds.includes(edge.id),
  );
  for (const item of definition.nodes) {
    pruneReferences(item, { edgeIds: new Set(removedEdgeIds), nodeId });
  }
  return { definition, removedEdgeIds };
}

/**
 * 清掉一个节点上因为"某个节点/某条边没了"而悬空的引用。
 *
 * 用对象参数而不是位置参数：`removeEdge` 那条路径没有"被删的节点"，
 * 传位置参数就得编一个 `__none__` 之类的哨兵字符串，而业务完全可以把节点命名成它。
 */
function pruneReferences(
  node: WorkflowDefinition['nodes'][number],
  removed: { edgeIds: Set<string>; nodeId?: string },
) {
  const data = node.data;
  if (!data) return;
  if (removed.nodeId && data.rejectTo === removed.nodeId)
    data.rejectTo = undefined;
  if (data.branches?.length) {
    data.branches = data.branches.filter(
      (branch) => !removed.edgeIds.has(branch.edgeId),
    );
  }
  if (data.defaultEdgeId && removed.edgeIds.has(data.defaultEdgeId))
    data.defaultEdgeId = undefined;
}

export function removeEdge(
  def: WorkflowDefinition,
  edgeId: string,
): WorkflowDefinition {
  requireEdge(def, edgeId);
  const definition = cloneDefinition(def);
  definition.edges = definition.edges.filter((edge) => edge.id !== edgeId);
  const removed = { edgeIds: new Set([edgeId]) };
  for (const node of definition.nodes) pruneReferences(node, removed);
  return definition;
}

export interface ConnectInput {
  id?: string;
  label?: string;
  source: string;
  target: string;
}

/**
 * 连线不禁止成环：驳回回溯本来就是"往回连"的合法画法，
 * `validateWorkflowDefinition` 会把环降级成 warning 而不是 error。
 * 但自环（自己连自己）和重复边是纯粹的脏数据，这里直接拒。
 */
export function connect(
  def: WorkflowDefinition,
  input: ConnectInput,
): { definition: WorkflowDefinition; edge: GraphEdge } {
  requireNode(def, input.source);
  requireNode(def, input.target);
  if (input.source === input.target) {
    throw new WorkflowDesignerError('不能把节点连到它自己', 'self-loop');
  }
  if (
    def.edges.some(
      (edge) => edge.source === input.source && edge.target === input.target,
    )
  ) {
    throw new WorkflowDesignerError(
      '这两个节点之间已经有连线',
      'duplicate-edge',
    );
  }
  const target = requireNode(def, input.target);
  if (!nodeKindMeta(target.type).targetable) {
    throw new WorkflowDesignerError(
      `${nodeKindMeta(target.type).label}节点不能作为连线终点`,
      'wrong-kind',
    );
  }
  const source = requireNode(def, input.source);
  if (!nodeKindMeta(source.type).sourceable) {
    throw new WorkflowDesignerError(
      `${nodeKindMeta(source.type).label}节点不能作为连线起点`,
      'wrong-kind',
    );
  }
  const id = input.id ?? nextEdgeId(def);
  const edge: GraphEdge = { id, source: input.source, target: input.target };
  if (input.label) edge.label = input.label;
  const definition = cloneDefinition(def);
  definition.edges.push(edge);
  return { definition, edge: cloneDeep(edge) };
}

function nextEdgeId(def: WorkflowDefinition): string {
  const taken = new Set(def.edges.map((edge) => edge.id));
  let seq = 1;
  while (taken.has(`edge_${seq}`)) seq += 1;
  return `edge_${seq}`;
}

export function outgoingEdges(
  def: WorkflowDefinition,
  nodeId: string,
): GraphEdge[] {
  return def.edges.filter((edge) => edge.source === nodeId);
}

/** 条件分支面板要的：这个节点上已绑定的分支 + 还没被任何分支认领的出线 */
export interface BranchView {
  bound: Array<{ edgeId: string; expression: string; target: string }>;
  unbound: GraphEdge[];
  defaultEdgeId?: string;
}

export function branchView(
  def: WorkflowDefinition,
  nodeId: string,
): BranchView {
  const node = requireNode(def, nodeId);
  if (node.type !== 'condition') {
    throw new WorkflowDesignerError(`${nodeId} 不是条件分支节点`, 'wrong-kind');
  }
  const branches = node.data?.branches ?? [];
  const boundIds = new Set(branches.map((branch) => branch.edgeId));
  const edges = outgoingEdges(def, nodeId);
  return {
    bound: branches
      .map((branch) => {
        const edge = edges.find((item) => item.id === branch.edgeId);
        return edge
          ? {
              edgeId: branch.edgeId,
              expression: branch.expression,
              target: edge.target,
            }
          : undefined;
      })
      .filter(
        (
          item,
        ): item is { edgeId: string; expression: string; target: string } =>
          !!item,
      ),
    defaultEdgeId: node.data?.defaultEdgeId,
    unbound: edges.filter((edge) => !boundIds.has(edge.id)),
  };
}

/** 绑定/改一条分支表达式；edgeId 必须是这个节点的出线，否则当场报错 */
export function bindBranch(
  def: WorkflowDefinition,
  nodeId: string,
  input: { edgeId: string; expression: string },
): WorkflowDefinition {
  const node = requireNode(def, nodeId);
  if (node.type !== 'condition') {
    throw new WorkflowDesignerError(`${nodeId} 不是条件分支节点`, 'wrong-kind');
  }
  const edge = requireEdge(def, input.edgeId);
  if (edge.source !== nodeId) {
    throw new WorkflowDesignerError(
      `连线 ${input.edgeId} 不是 ${nodeId} 的出线`,
      'unknown-edge',
    );
  }
  const definition = cloneDefinition(def);
  const target = requireNode(definition, nodeId);
  const branches = target.data?.branches ?? [];
  const index = branches.findIndex((branch) => branch.edgeId === input.edgeId);
  if (index === -1)
    branches.push({ edgeId: input.edgeId, expression: input.expression });
  else branches[index] = { edgeId: input.edgeId, expression: input.expression };
  target.data = { ...target.data, branches };
  return definition;
}

export function setDefaultBranchEdge(
  def: WorkflowDefinition,
  nodeId: string,
  edgeId: null | string,
): WorkflowDefinition {
  requireNode(def, nodeId);
  if (edgeId) requireEdge(def, edgeId);
  const definition = cloneDefinition(def);
  const node = requireNode(definition, nodeId);
  node.data = { ...node.data, defaultEdgeId: edgeId ?? undefined };
  return definition;
}

export function setAssignees(
  def: WorkflowDefinition,
  nodeId: string,
  rules: AssigneeRule[],
): WorkflowDefinition {
  requireNode(def, nodeId);
  return patchNodeData(def, nodeId, { assignees: rules });
}

/**
 * 布局的默认间距。卡片在画布上是定宽（`to-canvas.ts` 里 `w-[220px]`）、三行小字，
 * 所以这两个数就是"占位盒"的尺寸：`autoPlace` 判重合也用它，别再另编一套数。
 */
export const LAYOUT_COLUMN_GAP = 260;
export const LAYOUT_ROW_GAP = 120;
/**
 * 一段里最多几列。
 *
 * 为什么默认要换行：宿主给画布的是**定高定宽的容器**（示例页 556×460），
 * 一条八步的链按 260 的列距排开是 2080 逻辑像素，即使缩到 `minZoom` 0.4 也只放得下一半 ——
 * 表现是"自动布局排完，右半边那几个节点在屏幕外，点也点不着"。
 * 4 列一段刚好把长链折成两三段塞进一屏；单段内的次序仍然是"层级 = 列"。
 */
export const LAYOUT_MAX_COLUMNS = 4;

export interface LayoutOptions {
  /** 段与段之间的额外间距；缺省等于 `rowGap` */
  bandGap?: number;
  columnGap?: number;
  /** 一段里最多几列，超出换段；给 `0` 或比层数大的数等于不换行 */
  maxColumns?: number;
  /** 起点坐标；默认 {x: 60, y: 60} */
  origin?: GraphPosition;
  rowGap?: number;
}

/**
 * 自动分层布局：按最长路径算层级（`layer(target) = max(layer(source)) + 1`），
 * 同层按定义里的原始次序竖着排，每 `maxColumns` 列折成一段。
 *
 * 为什么不用现成布局库：审批流的图本来就浅（十几步、分支不超过三条），
 * 一个 `O(V+E)` 的分层就够用，而且**结果必须是确定的** —— 同样一张图两次
 * 自动布局给出同样坐标，"保存前后 diff 了哪些字段"才看得出来。
 * 有环（驳回回溯画成了边）时走不到 `order` 末尾的节点，按原次序补在最后一级。
 */
export function autoLayout(
  def: WorkflowDefinition,
  options: LayoutOptions = {},
): WorkflowDefinition {
  const columnGap = options.columnGap ?? LAYOUT_COLUMN_GAP;
  const rowGap = options.rowGap ?? LAYOUT_ROW_GAP;
  const bandGap = options.bandGap ?? rowGap;
  const maxColumns = Math.max(1, options.maxColumns ?? LAYOUT_MAX_COLUMNS);
  const origin = options.origin ?? { x: 60, y: 60 };
  const index = createGraphIndex(def);
  const { order } = topologicalSort(index);
  const layers = new Map<string, number>();
  for (const id of order) {
    const incoming = index.incoming.get(id) ?? [];
    let layer = 0;
    for (const edge of incoming) {
      layer = Math.max(layer, (layers.get(edge.source) ?? 0) + 1);
    }
    layers.set(id, layer);
  }
  // 拓扑序没覆盖到的（成环部分）排在最后一级，保持可见而不是消失
  const tail = order.length === 0 ? 0 : Math.max(...[...layers.values()]) + 1;
  def.nodes.forEach((node, nodeIndex) => {
    if (layers.has(node.id)) return;
    layers.set(node.id, tail + nodeIndex);
  });

  const perLayer = new Map<number, string[]>();
  for (const node of def.nodes) {
    const layer = layers.get(node.id) ?? 0;
    const bucket = perLayer.get(layer) ?? [];
    bucket.push(node.id);
    perLayer.set(layer, bucket);
  }

  const definition = cloneDefinition(def);
  const move = (id: string, x: number, y: number) => {
    const node = definition.nodes.find((item) => item.id === id);
    if (node) node.position = { x, y };
  };

  // 层级升序切段：段内是"列"，段与段之间往下走，段高取本段最高那一列
  const sortedLayers = [...perLayer.keys()].sort((a, b) => a - b);
  let bandY = origin.y;
  for (let start = 0; start < sortedLayers.length; start += maxColumns) {
    const slice = sortedLayers.slice(start, start + maxColumns);
    let rows = 1;
    slice.forEach((layer, column) => {
      const ids = perLayer.get(layer) ?? [];
      rows = Math.max(rows, ids.length);
      ids.forEach((id, row) =>
        move(id, origin.x + column * columnGap, bandY + row * rowGap),
      );
    });
    bandY += (rows - 1) * rowGap + bandGap;
  }
  return definition;
}
