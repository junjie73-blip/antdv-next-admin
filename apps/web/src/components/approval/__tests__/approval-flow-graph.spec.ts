import type { ApprovalFlowNode } from '~/api/approval';

import { describe, expect, it } from 'vitest';

import { buildApprovalGraph } from '../approval-flow-graph';

function node(
  round: number,
  step: number,
  status: ApprovalFlowNode['status'] = 'approved',
  overrides: Partial<ApprovalFlowNode> = {},
): ApprovalFlowNode {
  return {
    actedAt: '',
    approver: '周珂',
    auto: false,
    comment: '',
    dueAt: '',
    kind: 'approval',
    reminded: false,
    round,
    step,
    status,
    title: `节点${round}-${step}`,
    ...overrides,
  };
}

const NOW = new Date('2026-11-25T10:00:00Z').getTime();

describe('审批流程 vue-flow 图映射', () => {
  it('按轮次横向排列节点，并标出当前节点位置', () => {
    const graph = buildApprovalGraph(
      [node(1, 1), node(1, 2, 'current'), node(1, 3, 'pending')],
      2,
      NOW,
    );

    expect(graph.nodes).toHaveLength(3);
    expect(graph.nodes.map((item) => item.position.x)).toEqual([32, 304, 576]);
    expect(graph.nodes.every((item) => item.position.y === 36)).toBe(true);
    expect(graph.nodes.filter((item) => item.data.current)).toHaveLength(1);
    expect(graph.nodes[1]?.data.current).toBe(true);
    expect(graph.edges).toHaveLength(2);
    expect(graph.edges[1]?.animated).toBe(true);
  });

  it('新一轮追加在下方，历史节点的位置与数量不变化', () => {
    const firstRound = [node(1, 1), node(1, 2), node(1, 3)];
    const before = buildApprovalGraph(firstRound, undefined, NOW);
    const after = buildApprovalGraph(
      [...firstRound, node(2, 1), node(2, 2, 'current')],
      undefined,
      NOW,
    );

    expect(after.roundCount).toBe(2);
    expect(after.nodes).toHaveLength(5);
    expect(after.nodes.slice(0, 3).map((item) => item.position)).toEqual(
      before.nodes.map((item) => item.position),
    );
    expect(after.nodes[3]?.position.y).toBeGreaterThan(
      after.nodes[0]!.position.y,
    );
    const roundEdge = after.edges.find((edge) => edge.id === 'edge-round-1-2');
    expect(roundEdge?.label).toBe('新一轮');
    expect(roundEdge?.source).toBe('approval-1-2');
    expect(roundEdge?.target).toBe('approval-2-0');
  });

  it('超时未处理节点带 overdue 标记，已完结节点不带', () => {
    const graph = buildApprovalGraph(
      [
        node(1, 1, 'approved', {
          dueAt: '2026-11-24 09:00:00',
        }),
        node(1, 2, 'current', {
          dueAt: '2026-11-24 09:00:00',
        }),
      ],
      undefined,
      NOW,
    );
    expect(graph.nodes[0]?.data.overdue).toBe(false);
    expect(graph.nodes[1]?.data.overdue).toBe(true);
  });
});
