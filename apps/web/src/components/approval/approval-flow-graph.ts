import type { Edge, Node } from '@vue-flow/core';
import type { ApprovalFlowNode } from '~/api/approval';

import { MarkerType } from '@vue-flow/core';

/**
 * 审批节点 → vue-flow 图数据。纯函数，单独成文件的原因有两个：
 * 1. 节点定位和连线是「渲染正确性」的核心，必须能脱离 DOM 单测；
 * 2. 画布组件只负责挂 VueFlow，不掺业务状态判断。
 *
 * 布局约定：一轮审批横向从左到右，新一轮整体向下追加一行，
 * 轮次之间用虚线箭头连接，历史节点永远不会被新一轮覆盖。
 */

export interface ApprovalGraphNodeData {
  approvalNode: ApprovalFlowNode;
  current: boolean;
  overdue: boolean;
}

export type ApprovalGraphNode = Node<ApprovalGraphNodeData>;

const NODE_WIDTH = 208;
const COLUMN_GAP = 64;
const ROW_HEIGHT = 166;
const TOP_PADDING = 36;
const LEFT_PADDING = 32;

const STATUS_STROKE: Record<string, string> = {
  approved: '#10b981',
  current: '#f59e0b',
  pending: '#94a3b8',
  rejected: '#f43f5e',
  skipped: '#94a3b8',
};

function strokeOf(status: string): string {
  return STATUS_STROKE[status] ?? STATUS_STROKE.pending!;
}

function isOverdue(node: ApprovalFlowNode, now: number): boolean {
  if (!node.dueAt || ['approved', 'rejected', 'skipped'].includes(node.status))
    return false;
  const time = new Date(node.dueAt.replace(' ', 'T')).getTime();
  return Number.isFinite(time) && time < now;
}

function sortNodes(nodes: ApprovalFlowNode[]): ApprovalFlowNode[] {
  return [...nodes].sort((a, b) =>
    a.round === b.round ? a.step - b.step : a.round - b.round,
  );
}

export interface ApprovalGraph {
  edges: Edge[];
  /** 画布高度随轮次增长，但设上限避免详情抽屉被图撑满 */
  height: number;
  nodes: ApprovalGraphNode[];
  roundCount: number;
}

/** 把审批节点映射成 vue-flow 的节点与边；currentStep 仅用于旧数据兜底定位 */
export function buildApprovalGraph(
  source: ApprovalFlowNode[],
  currentStep?: number,
  now = Date.now(),
): ApprovalGraph {
  const sorted = sortNodes(source ?? []);
  const rounds = [...new Set(sorted.map((node) => node.round || 1))].sort(
    (a, b) => a - b,
  );
  const lastRound = rounds.at(-1) ?? 1;
  const markedCurrent = sorted.find((node) => node.status === 'current');
  const fallbackCurrent = sorted.find(
    (node) =>
      node.round === lastRound &&
      node.kind === 'approval' &&
      node.status === 'pending' &&
      node.step === currentStep,
  );
  const currentNode = markedCurrent ?? fallbackCurrent;
  const nodes: ApprovalGraphNode[] = [];
  const edges: Edge[] = [];

  rounds.forEach((round, roundIndex) => {
    const roundNodes = sorted.filter((node) => (node.round || 1) === round);
    roundNodes.forEach((node, column) => {
      nodes.push({
        data: {
          approvalNode: node,
          current: node === currentNode,
          overdue: isOverdue(node, now),
        },
        id: `approval-${round}-${column}`,
        position: {
          x: LEFT_PADDING + column * (NODE_WIDTH + COLUMN_GAP),
          y: TOP_PADDING + roundIndex * ROW_HEIGHT,
        },
        type: 'approval',
      });
    });

    for (let index = 0; index < roundNodes.length - 1; index += 1) {
      const from = roundNodes[index]!;
      const to = roundNodes[index + 1]!;
      const color = strokeOf(to.status);
      edges.push({
        // 当前节点的前后两段都高亮，视觉上能读出「走到哪一条边」
        animated: from.status === 'current' || to.status === 'current',
        id: `edge-${round}-${index}`,
        markerEnd: {
          color,
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
        },
        source: `approval-${round}-${index}`,
        style: { stroke: color, strokeWidth: 1.6 },
        target: `approval-${round}-${index + 1}`,
        type: 'smoothstep',
      });
    }
  });

  // 第 N 轮末尾 → 第 N+1 轮起点：新一轮是追加，不是重画
  for (let index = 0; index < rounds.length - 1; index += 1) {
    const previous = rounds[index]!;
    const next = rounds[index + 1]!;
    const previousCount = sorted.filter(
      (node) => node.round === previous,
    ).length;
    edges.push({
      animated: true,
      id: `edge-round-${previous}-${next}`,
      label: '新一轮',
      labelStyle: { fill: '#64748b', fontSize: 11 },
      markerEnd: {
        color: '#6366f1',
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
      },
      source: `approval-${previous}-${previousCount - 1}`,
      sourceHandle: 'bottom',
      style: { stroke: '#6366f1', strokeDasharray: '6 4', strokeWidth: 1.8 },
      target: `approval-${next}-0`,
      targetHandle: 'top',
      type: 'smoothstep',
    });
  }

  return {
    edges,
    height: Math.min(460, Math.max(182, rounds.length * ROW_HEIGHT + 24)),
    nodes,
    roundCount: rounds.length,
  };
}
