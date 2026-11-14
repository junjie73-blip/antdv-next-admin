import type {
  GraphDefinition,
  GraphEdge,
  GraphIssue,
  GraphNode,
} from './types';

/**
 * 只读索引：把「找邻居」从 O(N) 扫描换成一次哈希建表。
 *
 * 引擎每轮调度都要问「谁的入度满了」，直接遍历 edges 会让大图退化成 O(N²)；
 * 建一次表、复用一轮，是这个模块里唯一的性能结构。
 */
export interface GraphIndex<
  TData extends Record<string, unknown> = Record<string, unknown>,
> {
  nodes: GraphNode<TData>[];
  edges: GraphEdge[];
  nodesById: Map<string, GraphNode<TData>>;
  /** 顶点 -> 出边 */
  outgoing: Map<string, GraphEdge[]>;
  /** 顶点 -> 入边 */
  incoming: Map<string, GraphEdge[]>;
}

export interface TopologicalResult {
  /** 无环时给出的线性顺序；有环时为空数组 */
  order: string[];
  /** 参与环的顶点（Tarjan 强连通分量大于一，或自环） */
  cycles: string[][];
  isAcyclic: boolean;
}

export interface ValidateOptions {
  /** 允许多入口（并行起始事件），默认 false */
  allowMultipleEntry?: boolean;
  /** 允许孤立节点（暂存草稿时常见），默认 true */
  allowIsolatedNodes?: boolean;
  /** 至少需要一个出口节点，默认 false（审批流允许以「结束」以外的方式收敛） */
  requireExit?: boolean;
}

function groupEdges<T extends { source: string; target: string }>(
  edges: T[],
  key: 'source' | 'target',
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const edge of edges) {
    const id = edge[key];
    const bucket = map.get(id);
    if (bucket) bucket.push(edge);
    else map.set(id, [edge]);
  }
  return map;
}

export function createGraphIndex<
  TData extends Record<string, unknown> = Record<string, unknown>,
>(graph: GraphDefinition<TData>): GraphIndex<TData> {
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  return {
    edges,
    incoming: groupEdges(edges, 'target'),
    nodes,
    nodesById: new Map(nodes.map((node) => [node.id, node])),
    outgoing: groupEdges(edges, 'source'),
  };
}

export function nodeIdsOf(index: GraphIndex<any>): string[] {
  return index.nodes.map((node) => node.id);
}

export function entryNodesOf(index: GraphIndex<any>): GraphNode[] {
  return index.nodes.filter((node) => !index.incoming.get(node.id)?.length);
}

export function exitNodesOf(index: GraphIndex<any>): GraphNode[] {
  return index.nodes.filter((node) => !index.outgoing.get(node.id)?.length);
}

/**
 * 邻居。`both` 固定「上游在前、下游在后」——
 * 设计器要高亮一条链路，顺序必须可预测，否则同样的图每次渲染出的 DOM 次序都在变。
 */
export function neighborsOf(
  index: GraphIndex<any>,
  id: string,
  direction: 'both' | 'in' | 'out' = 'out',
): string[] {
  const seen = new Set<string>();
  if (direction !== 'out')
    for (const edge of index.incoming.get(id) ?? []) seen.add(edge.source);
  if (direction !== 'in')
    for (const edge of index.outgoing.get(id) ?? []) seen.add(edge.target);
  return [...seen];
}

/** 传递闭包：沿方向能到达的所有顶点（不含自身） */
export function reachableFrom(
  index: GraphIndex<any>,
  from: string,
  direction: 'in' | 'out' = 'out',
): string[] {
  const queue = [from];
  const visited = new Set<string>([from]);
  const reached: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const next of neighborsOf(index, current, direction)) {
      if (visited.has(next)) continue;
      visited.add(next);
      reached.push(next);
      queue.push(next);
    }
  }
  return reached;
}

/**
 * Tarjan 强连通分量。分量 size > 1 即为环；自环单独补报。
 *
 * 写成显式栈而不是递归：审批流常有几百层的串行节点，
 * 递归版在浏览器里会把调用栈打满，报错信息还落在 Tarjan 内部。
 */
export function findCycles(index: GraphIndex<any>): string[][] {
  const loops = index.edges
    .filter((edge) => edge.source === edge.target)
    .map((edge) => [edge.source]);

  const adjacency = new Map<string, string[]>();
  for (const node of index.nodes) adjacency.set(node.id, []);
  for (const edge of index.edges) {
    if (edge.source === edge.target) continue;
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) continue;
    adjacency.get(edge.source)!.push(edge.target);
  }

  const indexCounter = new Map<string, number>();
  const lowLink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];
  let counter = 0;

  for (const root of adjacency.keys()) {
    if (indexCounter.has(root)) continue;

    // 每个待展开帧记着「它正在消费第几个邻居」，模拟递归的返回点
    const frames: { node: string; cursor: number }[] = [
      { cursor: 0, node: root },
    ];
    indexCounter.set(root, counter);
    lowLink.set(root, counter);
    counter += 1;
    stack.push(root);
    onStack.add(root);

    while (frames.length > 0) {
      const frame = frames[frames.length - 1]!;
      const children = adjacency.get(frame.node)!;

      if (frame.cursor < children.length) {
        const child = children[frame.cursor]!;
        frame.cursor += 1;
        if (!indexCounter.has(child)) {
          indexCounter.set(child, counter);
          lowLink.set(child, counter);
          counter += 1;
          stack.push(child);
          onStack.add(child);
          frames.push({ cursor: 0, node: child });
        } else if (onStack.has(child)) {
          lowLink.set(
            frame.node,
            Math.min(lowLink.get(frame.node)!, indexCounter.get(child)!),
          );
        }
        continue;
      }

      const done = frames.pop()!;
      if (frames.length > 0) {
        const parent = frames[frames.length - 1]!;
        lowLink.set(
          parent.node,
          Math.min(lowLink.get(parent.node)!, lowLink.get(done.node)!),
        );
      }
      if (lowLink.get(done.node) === indexCounter.get(done.node)) {
        const component: string[] = [];
        let popped: string;
        do {
          popped = stack.pop() as string;
          onStack.delete(popped);
          component.push(popped);
        } while (popped !== done.node);
        if (component.length > 1) components.push(component);
      }
    }
  }

  return [...components, ...loops];
}

export function topologicalSort(index: GraphIndex<any>): TopologicalResult {
  const indegree = new Map<string, number>();
  for (const node of index.nodes) indegree.set(node.id, 0);
  for (const edge of index.edges) {
    if (edge.source === edge.target) continue;
    if (!indegree.has(edge.target)) continue;
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  // 稳定顺序：按节点在图里的原始次序排队，避免同样的图每次跑出一个新拓扑序
  const ready = index.nodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .map((node) => node.id);
  const order: string[] = [];

  while (ready.length > 0) {
    const current = ready.shift() as string;
    order.push(current);
    for (const edge of index.outgoing.get(current) ?? []) {
      if (edge.source === edge.target) continue;
      if (!indegree.has(edge.target)) continue;
      const left = (indegree.get(edge.target) ?? 0) - 1;
      indegree.set(edge.target, left);
      if (left === 0) ready.push(edge.target);
    }
  }

  const cycles = order.length === index.nodes.length ? [] : findCycles(index);
  return { cycles, isAcyclic: order.length === index.nodes.length, order };
}

/**
 * 结构体检。设计器在「保存」与「发布」前各调一次，
 * error 阻塞、warning 只提示 —— 草稿态允许残缺，发布态不允许。
 */
export function validateGraph<TData extends Record<string, unknown>>(
  graph: GraphDefinition<TData>,
  options: ValidateOptions = {},
): GraphIssue[] {
  const {
    allowIsolatedNodes = true,
    allowMultipleEntry = false,
    requireExit = false,
  } = options;
  const index = createGraphIndex(graph);
  const issues: GraphIssue[] = [];

  const seenIds = new Set<string>();
  const duplicated = new Set<string>();
  for (const node of index.nodes) {
    if (seenIds.has(node.id)) duplicated.add(node.id);
    seenIds.add(node.id);
  }
  if (duplicated.size > 0) {
    issues.push({
      code: 'duplicate-id',
      level: 'error',
      message: `节点 id 重复：${[...duplicated].join('、')}`,
      nodeIds: [...duplicated],
    });
  }

  const dangling = index.edges.filter(
    (edge) =>
      !index.nodesById.has(edge.source) || !index.nodesById.has(edge.target),
  );
  if (dangling.length > 0) {
    issues.push({
      code: 'unknown-endpoint',
      level: 'error',
      message: `${dangling.length} 条边连到不存在的节点`,
      edgeIds: dangling.map((edge) => edge.id),
    });
  }

  const selfLoops = index.edges.filter((edge) => edge.source === edge.target);
  if (selfLoops.length > 0) {
    issues.push({
      code: 'self-loop',
      level: 'error',
      message: '节点不能连到自己',
      edgeIds: selfLoops.map((edge) => edge.id),
    });
  }

  const cycles = findCycles(index);
  for (const cycle of cycles) {
    issues.push({
      code: 'cycle',
      level: 'error',
      message: `检测到环：${cycle.join(' → ')} → ${cycle[0]}`,
      nodeIds: cycle,
    });
  }

  const entries = entryNodesOf(index);
  if (index.nodes.length > 0 && entries.length === 0) {
    issues.push({
      code: 'no-entry',
      level: 'error',
      message: '没有入口节点（全图入度都不为 0）',
    });
  } else if (entries.length > 1 && !allowMultipleEntry) {
    issues.push({
      code: 'multiple-entry',
      level: 'warning',
      message: `有 ${entries.length} 个入口：${entries.map((node) => node.id).join('、')}`,
      nodeIds: entries.map((node) => node.id),
    });
  }

  const exits = exitNodesOf(index);
  if (requireExit && exits.length === 0) {
    issues.push({ code: 'no-exit', level: 'error', message: '没有出口节点' });
  }

  if (!allowIsolatedNodes) {
    const isolated = index.nodes.filter(
      (node) =>
        !index.incoming.get(node.id)?.length &&
        !index.outgoing.get(node.id)?.length,
    );
    if (isolated.length > 0) {
      issues.push({
        code: 'isolated-node',
        level: 'warning',
        message: `${isolated.length} 个节点没有任何连线`,
        nodeIds: isolated.map((node) => node.id),
      });
    }
  }

  const entry = entries[0];
  if (entry) {
    const reachable = new Set(reachableFrom(index, entry.id, 'out'));
    const orphaned = index.nodes
      .filter((node) => node.id !== entry.id && !reachable.has(node.id))
      .map((node) => node.id);
    if (orphaned.length > 0 && cycles.length === 0) {
      issues.push({
        code: 'unreachable',
        level: 'warning',
        message: `${orphaned.length} 个节点从入口不可达`,
        nodeIds: orphaned,
      });
    }
  }

  return issues;
}
