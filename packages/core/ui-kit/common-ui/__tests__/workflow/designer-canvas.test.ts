import type { WorkflowCanvasNodeData } from '../../src/workflow/components/WorkflowDefinitionDesigner/to-canvas';
import type { WorkflowDefinition } from '../../src/workflow/core/types';

import { describe, expect, it } from 'vitest';

import {
  assigneeHint,
  hasUnpositionedNodes,
  nodeSummaryOf,
  nodeToneOf,
  toCanvasEdges,
  toCanvasNodes,
} from '../../src/workflow/components/WorkflowDefinitionDesigner/to-canvas';
import {
  addNode,
  createEmptyDefinition,
} from '../../src/workflow/core/designer';

/**
 * 画布映射层的测试。
 *
 * 这一层的价值全在"它是纯的"：不挂组件、不装 jsdom，直接对对象下断言。
 * 一旦有人把 `type` 改回"按节点类型分插槽"，自定义节点就得回来改这里 ——
 * 下面第一条用例正是为了拦住那次改动。
 */

function shaped(): WorkflowDefinition {
  let def = createEmptyDefinition();
  def = addNode(def, { kind: 'approval' }).definition;
  def = addNode(def, { kind: 'condition' }).definition;
  def = {
    ...def,
    edges: [
      { id: 'edge_1', source: 'node_start', target: 'approval_1' },
      { id: 'edge_2', source: 'approval_1', target: 'condition_1' },
      { id: 'edge_3', source: 'condition_1', target: 'node_end' },
      { id: 'edge_4', source: 'condition_1', target: 'approval_1' },
    ],
    nodes: def.nodes.map((node) => {
      if (node.id === 'approval_1') {
        return {
          ...node,
          data: {
            assignees: [
              { params: { userIds: ['admin', 'custom'] }, strategy: 'user' },
              { params: { roleCode: 'hrManager' }, strategy: 'role' },
            ],
            multi: 'all',
          },
        };
      }
      if (node.id === 'condition_1') {
        return {
          ...node,
          data: {
            branches: [{ edgeId: 'edge_3', expression: 'days >= 3' }],
            defaultEdgeId: 'edge_4',
          },
        };
      }
      return node;
    }),
  };
  return def;
}

/** vue-flow 的 `Node.data` 是可选的，这里统一收窄成 `WorkflowCanvasNodeData` */
function dataOf(
  node: ReturnType<typeof toCanvasNodes>[number],
): WorkflowCanvasNodeData {
  return node.data as WorkflowCanvasNodeData;
}

describe('节点映射', () => {
  it('画布节点的 id 与定义一致 —— vue-flow 靠它建立节点图，漏了就没法点选与回写坐标', () => {
    const nodes = toCanvasNodes(shaped());
    expect(nodes.map((node) => node.id)).toEqual(
      shaped().nodes.map((node) => node.id),
    );
    expect(nodes.every((node) => dataOf(node).nodeId === node.id)).toBe(true);
    const edges = toCanvasEdges(shaped());
    expect(edges.map((edge) => edge.id)).toEqual(
      shaped().edges.map((edge) => edge.id),
    );
  });

  it('所有节点共用一个画布类型，真实类型在 data.kind 里 —— 自定义节点因此无需改组件', () => {
    const nodes = toCanvasNodes(shaped());
    expect(new Set(nodes.map((node) => node.type))).toEqual(
      new Set(['workflow']),
    );
    expect(nodes.map((node) => dataOf(node).kind)).toEqual([
      'start',
      'end',
      'approval',
      'condition',
    ]);
  });

  it('卡片上的摘要是人话：办理人、或签会签、分支数都读得出来', () => {
    const nodes = toCanvasNodes(shaped());
    const approval = nodes.find((node) => dataOf(node).kind === 'approval')!;
    expect(dataOf(approval).summary).toBe(
      '指定人 admin/custom，角色 hrManager · 会签',
    );
    const condition = nodes.find((node) => dataOf(node).kind === 'condition')!;
    expect(dataOf(condition).summary).toBe('1 条分支 · 有默认边');
    expect(
      dataOf(nodes.find((node) => dataOf(node).kind === 'start')!).summary,
    ).toContain('一条定义只有一个');
  });

  it('选中态只落在这一次调用指定的那个节点上', () => {
    const nodes = toCanvasNodes(shaped(), 'approval_1');
    expect(
      nodes
        .filter((node) => dataOf(node).selected)
        .map((node) => dataOf(node).nodeId),
    ).toEqual(['approval_1']);
    expect(
      toCanvasNodes(shaped()).every((node) => !dataOf(node).selected),
    ).toBe(true);
  });

  it('没画过坐标的节点铺成分层网格，而不是全部叠在原点', () => {
    const bare: WorkflowDefinition = {
      edges: [],
      id: 'bare',
      name: '无坐标',
      nodes: [{ data: {}, id: 'x', type: 'approval' }],
      version: 1,
    };
    // 单节点图：第 0 层第 0 行 —— 关键是它落在布局起点上，不是 (0,0) 那一坨
    expect(toCanvasNodes(bare)[0]!.position).toEqual({ x: 60, y: 60 });
  });

  it('整条流程都没坐标时按拓扑分层铺开：坐标互不重合，且两次映射给同一组', () => {
    const chain = (): WorkflowDefinition => ({
      edges: [
        { id: 'e1', source: 's', target: 'a1' },
        { id: 'e2', source: 'a1', target: 'a2' },
        { id: 'e3', source: 'a2', target: 'end' },
        { id: 'e4', source: 'a1', target: 'cc' },
        { id: 'e5', source: 'cc', target: 'end' },
      ],
      id: 'chain',
      name: '无坐标的一条流程',
      nodes: [
        { data: {}, id: 's', type: 'start' },
        { data: {}, id: 'a1', type: 'approval' },
        { data: {}, id: 'a2', type: 'approval' },
        { data: {}, id: 'cc', type: 'cc' },
        { data: {}, id: 'end', type: 'end' },
      ],
      version: 1,
    });

    const laid = toCanvasNodes(chain());
    const at = (id: string) => laid.find((node) => node.id === id)!.position;
    // a1 在第 1 层；a2 与 cc 都在第 2 层，竖着排；end 被最长路径推到第 3 层
    expect(at('s')).toEqual({ x: 60, y: 60 });
    expect(at('a1')).toEqual({ x: 320, y: 60 });
    expect(at('a2')).toEqual({ x: 580, y: 60 });
    expect(at('cc')).toEqual({ x: 580, y: 180 });
    expect(at('end')).toEqual({ x: 840, y: 60 });
    // 铺开 = 坐标两两不同；叠在原点时这里只有 1 个不同值
    expect(
      new Set(laid.map((node) => `${node.position.x},${node.position.y}`)).size,
    ).toBe(5);
    expect(toCanvasNodes(chain()).map((node) => node.position)).toEqual(
      laid.map((node) => node.position),
    );
  });

  it('坐标只补给没画过的那几个：用户摆好的位置不被兜底改回去', () => {
    const mixed: WorkflowDefinition = {
      edges: [{ id: 'e1', source: 's', target: 'a1' }],
      id: 'mixed',
      name: '部分有坐标',
      nodes: [
        { data: {}, id: 's', position: { x: 500, y: 40 }, type: 'start' },
        { data: {}, id: 'a1', type: 'approval' },
      ],
      version: 1,
    };
    const laid = toCanvasNodes(mixed);
    expect(laid[0]!.position).toEqual({ x: 500, y: 40 });
    // 兜底走的是整图布局的格子位：a1 在第 1 层，与 s 自己摆在哪无关
    expect(laid[1]!.position).toEqual({ x: 320, y: 60 });
    // 全都有坐标时映射层一次布局都不做（判据是"有没有缺"，不是"有几个缺"）
    expect(hasUnpositionedNodes(mixed)).toBe(true);
    expect(
      hasUnpositionedNodes({
        ...mixed,
        nodes: mixed.nodes.map((node, index) => ({
          ...node,
          position: { x: index * 260, y: 60 },
        })),
      }),
    ).toBe(false);
  });

  it('未配置办理人要说出来，而不是显示一行空字', () => {
    const bare: WorkflowDefinition = {
      edges: [],
      id: 'bare',
      name: '无办理人',
      nodes: [{ data: {}, id: 'a', type: 'approval' }],
      version: 1,
    };
    expect(nodeSummaryOf(bare.nodes[0]!)).toContain('未配置办理人');
  });
});

describe('边映射', () => {
  it('被分支认领的边写上表达式，默认边写上"默认"', () => {
    const edges = toCanvasEdges(shaped());
    const byId = new Map(edges.map((edge) => [edge.id, edge]));
    expect(byId.get('edge_3')?.label).toBe('命中: days >= 3');
    expect(byId.get('edge_4')?.label).toBe('默认');
    expect(byId.get('edge_1')?.label).toBeUndefined();
  });

  it('选中边只有那一条 animated', () => {
    const edges = toCanvasEdges(shaped(), 'edge_2');
    expect(
      edges.filter((edge) => edge.animated).map((edge) => edge.id),
    ).toEqual(['edge_2']);
  });

  it('每条边都带箭头：审批流的方向是语义，不能靠猜', () => {
    for (const edge of toCanvasEdges(shaped())) {
      expect(edge.markerEnd).toBeTruthy();
    }
  });
});

describe('摘要与配色', () => {
  it('五种办理人策略各有一句中文，自定义策略原样透出', () => {
    expect(
      assigneeHint([{ params: { userIds: ['a'] }, strategy: 'user' }]),
    ).toBe('指定人 a');
    expect(assigneeHint([{ params: {}, strategy: 'user' }])).toBe(
      '指定人（未填）',
    );
    expect(assigneeHint([{ params: { role: 'g' }, strategy: 'role' }])).toBe(
      '角色 g',
    );
    expect(
      assigneeHint([
        { params: { expression: 'form.leader' }, strategy: 'expression' },
      ]),
    ).toBe('变量 form.leader');
    expect(assigneeHint([{ strategy: 'initiator' }])).toBe('发起人');
    expect(assigneeHint([{ strategy: 'departmentHead' }])).toBe('部门负责人');
    expect(assigneeHint([{ strategy: 'deptLeaderOf' }])).toBe('deptLeaderOf');
    expect(assigneeHint(undefined)).toBe('未配置办理人');
  });

  it('六种内置类型各有配色，自定义类型落到 fallback 而不是 undefined', () => {
    for (const kind of [
      'approval',
      'cc',
      'condition',
      'end',
      'start',
      'timer',
    ]) {
      expect(nodeToneOf(kind)).toBeTruthy();
    }
    const fallback = nodeToneOf('erpSync');
    expect(fallback).toBe(nodeToneOf('anything-unknown'));
    expect(fallback).toContain('bg-card');
  });

  it('配色只引用 token 派生的类名，不出现调色板硬值', () => {
    const tones = [
      'approval',
      'cc',
      'condition',
      'end',
      'start',
      'timer',
      'erpSync',
    ]
      .map((kind) => nodeToneOf(kind))
      .join(' ');
    expect(tones).not.toMatch(
      /\b(bg|text|border)-(red|blue|green|amber|gray|slate|zinc|neutral|stone)-\d/u,
    );
    expect(tones).toMatch(/(--)?(primary|muted|secondary|card|border)/u);
  });

  it('定时节点把毫秒翻成秒', () => {
    expect(
      nodeSummaryOf({ data: { timeoutMs: 5000 }, id: 't', type: 'timer' }),
    ).toBe('等待 5 秒');
    expect(nodeSummaryOf({ data: {}, id: 't', type: 'timer' })).toBe(
      '等待到期',
    );
  });

  it('抄送节点的摘要写明是抄送', () => {
    expect(
      nodeSummaryOf({
        data: { assignees: [{ strategy: 'initiator' }] },
        id: 'c',
        type: 'cc',
      }),
    ).toBe('抄送给 发起人');
  });
});
