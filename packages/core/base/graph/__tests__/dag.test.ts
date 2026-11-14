import type { GraphDefinition } from '../src/types';

import { describe, expect, it } from 'vitest';

import {
  createGraphIndex,
  entryNodesOf,
  exitNodesOf,
  findCycles,
  neighborsOf,
  reachableFrom,
  topologicalSort,
  validateGraph,
} from '../src/dag';

/** 串行 + 一个条件分支：最常见的审批骨架 */
const linear: GraphDefinition = {
  edges: [
    { id: 'e1', source: 'start', target: 'approve' },
    { id: 'e2', source: 'approve', target: 'end' },
  ],
  nodes: [
    { id: 'start', type: 'start' },
    { id: 'approve', type: 'approval' },
    { id: 'end', type: 'end' },
  ],
};

describe('graph/dag · 索引', () => {
  it('出入边按顶点分桶，查询不再线性扫全表', () => {
    const index = createGraphIndex(linear);
    expect(index.nodesById.size).toBe(3);
    expect(neighborsOf(index, 'approve', 'in')).toStrictEqual(['start']);
    expect(neighborsOf(index, 'approve', 'out')).toStrictEqual(['end']);
    expect(neighborsOf(index, 'approve', 'both')).toStrictEqual([
      'start',
      'end',
    ]);
  });

  it('入口是入度为 0 的节点，出口是出度为 0 的节点', () => {
    const index = createGraphIndex(linear);
    expect(entryNodesOf(index).map((node) => node.id)).toStrictEqual(['start']);
    expect(exitNodesOf(index).map((node) => node.id)).toStrictEqual(['end']);
  });

  it('可达闭包只朝一个方向扩散', () => {
    const index = createGraphIndex(linear);
    expect(reachableFrom(index, 'start', 'out').sort()).toStrictEqual([
      'approve',
      'end',
    ]);
    expect(reachableFrom(index, 'end', 'out')).toStrictEqual([]);
    expect(reachableFrom(index, 'end', 'in').sort()).toStrictEqual([
      'approve',
      'start',
    ]);
  });
});

describe('graph/dag · 拓扑与环', () => {
  it('无环图给出稳定顺序：同样的图每次跑出的序一致', () => {
    const index = createGraphIndex(linear);
    const first = topologicalSort(index);
    const second = topologicalSort(index);
    expect(first.isAcyclic).toBe(true);
    expect(first.order).toStrictEqual(['start', 'approve', 'end']);
    expect(second.order).toStrictEqual(first.order);
  });

  it('条件分支汇聚回主线时拓扑序仍然唯一确定', () => {
    const graph: GraphDefinition = {
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
        { id: 'e3', source: 'b', target: 'd' },
        { id: 'e4', source: 'c', target: 'e' },
        { id: 'e5', source: 'd', target: 'e' },
      ],
      nodes: [
        { id: 'a', type: 'start' },
        { id: 'b', type: 'condition' },
        { id: 'c', type: 'task' },
        { id: 'd', type: 'task' },
        { id: 'e', type: 'end' },
      ],
    };
    const result = topologicalSort(createGraphIndex(graph));
    expect(result.isAcyclic).toBe(true);
    expect(result.order[0]).toBe('a');
    expect(result.order.at(-1)).toBe('e');
    expect(result.order.indexOf('c')).toBeLessThan(result.order.indexOf('e'));
  });

  it('成环时 order 为空并给出参与环的节点', () => {
    const graph: GraphDefinition = {
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
        { id: 'e3', source: 'c', target: 'a' },
        { id: 'e4', source: 'a', target: 'done' },
      ],
      nodes: [
        { id: 'a', type: 'task' },
        { id: 'b', type: 'task' },
        { id: 'c', type: 'task' },
        { id: 'done', type: 'end' },
      ],
    };
    const result = topologicalSort(createGraphIndex(graph));
    expect(result.isAcyclic).toBe(false);
    expect(result.order).toStrictEqual([]);
    expect(result.cycles.flat().sort()).toStrictEqual(['a', 'b', 'c']);
  });

  it('自环单独报出来', () => {
    const graph: GraphDefinition = {
      edges: [{ id: 'e1', source: 'a', target: 'a' }],
      nodes: [{ id: 'a', type: 'task' }],
    };
    expect(findCycles(createGraphIndex(graph))).toStrictEqual([['a']]);
  });

  it('800 层串行不吃爆调用栈', () => {
    const nodes = Array.from({ length: 800 }, (_unused, i) => ({
      id: `n${i}`,
      type: 'task',
    }));
    const edges = Array.from({ length: 799 }, (_unused, i) => ({
      id: `e${i}`,
      source: `n${i}`,
      target: `n${i + 1}`,
    }));
    const index = createGraphIndex({ edges, nodes });
    expect(() => findCycles(index)).not.toThrow();
    expect(topologicalSort(index).order).toHaveLength(800);
  });

  it('边指向不存在的节点时被忽略而不是崩溃', () => {
    const graph: GraphDefinition = {
      edges: [{ id: 'e1', source: 'a', target: 'ghost' }],
      nodes: [{ id: 'a', type: 'task' }],
    };
    const index = createGraphIndex(graph);
    expect(topologicalSort(index).order).toStrictEqual(['a']);
    expect(neighborsOf(index, 'a', 'out')).toStrictEqual(['ghost']);
  });
});

describe('graph/dag · 结构体检', () => {
  it('单入口单出口的合法图不该报任何问题', () => {
    expect(validateGraph(linear)).toStrictEqual([]);
  });

  it('重复 id 是 error 且带上定位', () => {
    const graph: GraphDefinition = {
      edges: [],
      nodes: [
        { id: 'a', type: 'task' },
        { id: 'a', type: 'task' },
      ],
    };
    const issues = validateGraph(graph);
    expect(issues.map((issue) => issue.code)).toContain('duplicate-id');
    expect(
      issues.find((issue) => issue.code === 'duplicate-id')?.nodeIds,
    ).toContain('a');
  });

  it('悬空边与自环各自报一条', () => {
    const graph: GraphDefinition = {
      edges: [
        { id: 'e1', source: 'a', target: 'ghost' },
        { id: 'e2', source: 'a', target: 'a' },
      ],
      nodes: [{ id: 'a', type: 'task' }],
    };
    const codes = validateGraph(graph).map((issue) => issue.code);
    expect(codes).toContain('unknown-endpoint');
    expect(codes).toContain('self-loop');
  });

  it('孤立节点默认放行，收紧后变警告', () => {
    const graph: GraphDefinition = {
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
      nodes: [
        { id: 'a', type: 'start' },
        { id: 'b', type: 'task' },
        { id: 'orphan', type: 'task' },
      ],
    };
    expect(validateGraph(graph).map((issue) => issue.code)).not.toContain(
      'isolated-node',
    );
    const strict = validateGraph(graph, { allowIsolatedNodes: false });
    expect(
      strict.find((issue) => issue.code === 'isolated-node')?.nodeIds,
    ).toContain('orphan');
  });

  it('多入口默认警告，允许多入口时静默', () => {
    const graph: GraphDefinition = {
      edges: [{ id: 'e1', source: 'x', target: 'end' }],
      nodes: [
        { id: 'a', type: 'start' },
        { id: 'x', type: 'start' },
        { id: 'end', type: 'end' },
      ],
    };
    expect(validateGraph(graph).map((issue) => issue.code)).toContain(
      'multiple-entry',
    );
    expect(
      validateGraph(graph, { allowMultipleEntry: true }).map(
        (issue) => issue.code,
      ),
    ).not.toContain('multiple-entry');
  });

  it('从入口够不到的分支报 unreachable', () => {
    const graph: GraphDefinition = {
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'c', target: 'd' },
      ],
      nodes: [
        { id: 'a', type: 'start' },
        { id: 'b', type: 'task' },
        { id: 'c', type: 'task' },
        { id: 'd', type: 'end' },
      ],
    };
    const issue = validateGraph(graph).find(
      (entry) => entry.code === 'unreachable',
    );
    expect(issue?.nodeIds).toStrictEqual(['c', 'd']);
  });

  it('requireExit 打开后，全图没有终点会报错', () => {
    const graph: GraphDefinition = {
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'a' },
      ],
      nodes: [
        { id: 'a', type: 'task' },
        { id: 'b', type: 'task' },
      ],
    };
    const codes = validateGraph(graph, { requireExit: true }).map(
      (issue) => issue.code,
    );
    expect(codes).toContain('no-exit');
    expect(codes).toContain('cycle');
  });

  it('空图不报入口缺失（草稿态合法）', () => {
    expect(
      validateGraph({ edges: [], nodes: [] }).map((issue) => issue.code),
    ).not.toContain('no-entry');
  });
});
