import type { GraphPosition } from '@antdv/graph';
import type { Edge, Node } from '@vue-flow/core';

import type {
  AssigneeRule,
  WorkflowDefinition,
  WorkflowNodeKind,
} from '../../core/types';

import { MarkerType } from '@vue-flow/core';

import { autoLayout, nodeKindMeta } from '../../core/designer';

/**
 * `WorkflowDefinition` → vue-flow 元素的纯映射。
 *
 * 单独成一个文件有两个实在的理由：
 *
 * 1. **画布只认识"这一份图长什么样"**。增删改的语义全在 `core/designer.ts`，
 *    这里只做展示层的形状转换，不写校验、不判权限、不碰引擎。
 * 2. **它能脱离 jsdom 单测**。vue-flow 在测试环境里要补齐 ResizeObserver、
 *    DOMMatrix 之类的浏览器能力，断言"元素对不对"成本高且脆；把映射抽出来之后，
 *    "选中边变成了 animated"这种结论直接用对象断言钉住。
 *
 * 一个刻意的取舍：所有节点在画布上都是同一个 `type: 'workflow'`，
 * 真实类型放在 `data.kind` 里。vue-flow 的插槽是按 `type` 匹配的，如果按类型分插槽，
 * 宿主注册一个自定义节点（`erpSync`）就得同时改这个组件；
 * 统一类型 + 按 `data.kind` 上色，自定义类型天然就能出现在画布上。
 */

/** 画布上每个节点的展示负载（由定义算出来，不含任何运行时状态） */
export interface WorkflowCanvasNodeData extends Record<string, unknown> {
  /** 面板提示语，直接来自 `DESIGNER_NODE_KINDS` */
  hint: string;
  /** 定义里的真实类型 */
  kind: WorkflowNodeKind;
  /** 类型的中文名 */
  kindLabel: string;
  /** 定义里的节点 id */
  nodeId: string;
  /**
   * 选中态。放在 `data` 里而不是节点的 `selected` 字段上：vue-flow 的 `Node` 类型
   * 没有 `selected`（那是它内部 `GraphNode` 的事），写上去既不报错也不生效，
   * 而我们的选中态本来就来自自己的 `selectedNodeId`，不该跟画布的内部状态争。
   */
  selected: boolean;
  /** 一行摘要：办理人 / 或签会签 / 分支数 / 超时 */
  summary: string;
  /** 节点标题 */
  title: string;
}

/**
 * 内置类型的配色，全部取自 shadcn 规范名 token（`--primary` / `--muted` / `--secondary`…），
 * 不写死任何调色板色值 —— 换预设主题时节点卡片跟着变色。自定义类型落到 `fallback`。
 */
const NODE_TONE: Record<string, string> = {
  approval: 'border-primary/45 bg-card',
  cc: 'border-border bg-muted/60',
  condition: 'border-primary/70 bg-secondary',
  end: 'border-border bg-secondary/70',
  fallback: 'border-border bg-card',
  start: 'border-primary/60 bg-primary/10',
  timer: 'border-dashed border-muted-foreground/40 bg-muted',
};

export function nodeToneOf(kind: WorkflowNodeKind): string {
  return NODE_TONE[kind] ?? NODE_TONE.fallback!;
}

/** 办理人策略的可读摘要：设计器不解析人，只说明"按什么规则找人" */
export function assigneeHint(rules?: AssigneeRule[]): string {
  if (!rules?.length) return '未配置办理人';
  return rules
    .map((rule) => {
      const params = rule.params ?? {};
      if (rule.strategy === 'user') {
        const ids = (params.userIds ?? params.users) as string[] | undefined;
        return ids?.length ? `指定人 ${ids.join('/')}` : '指定人（未填）';
      }
      if (rule.strategy === 'role')
        return `角色 ${String(params.roleCode ?? params.role ?? '（未填）')}`;
      if (rule.strategy === 'expression')
        return `变量 ${String(params.expression ?? params.value ?? '（未填）')}`;
      if (rule.strategy === 'initiator') return '发起人';
      if (rule.strategy === 'departmentHead') return '部门负责人';
      return rule.strategy;
    })
    .join('，');
}

/**
 * 节点卡片上那一行小字：把"这个节点到底干了什么"讲清楚。
 *
 * 宁可写得土，也不要在卡片上堆 JSON —— 设计器里最常见的误操作是
 * "以为这条线是分支、实际它是默认边"，摘要行和边上的 label 就是给这个的。
 */
export function nodeSummaryOf(
  node: WorkflowDefinition['nodes'][number],
): string {
  const data = node.data ?? {};
  switch (node.type) {
    case 'approval': {
      const mode =
        data.multi === 'all'
          ? '会签'
          : data.multi === 'sequence'
            ? '顺序会签'
            : '或签';
      return `${assigneeHint(data.assignees)} · ${mode}`;
    }
    case 'cc': {
      return `抄送给 ${assigneeHint(data.assignees)}`;
    }
    case 'condition': {
      const branches = data.branches?.length ?? 0;
      return `${branches} 条分支${data.defaultEdgeId ? ' · 有默认边' : ' · 无默认边'}`;
    }
    case 'timer': {
      return data.timeoutMs
        ? `等待 ${Math.round((data.timeoutMs as number) / 1000)} 秒`
        : '等待到期';
    }
    default: {
      return nodeKindMeta(node.type).hint;
    }
  }
}

/**
 * 定义里有没有"还没画过坐标"的节点 —— 组件用它决定要不要把自动布局的结果交回宿主。
 *
 * 后端存的、别的工具导出的、`createEmptyDefinition()` 之后手改的，都可能是这一种：
 * 定义本身合法，只是没有布局信息。
 */
export function hasUnpositionedNodes(def: WorkflowDefinition): boolean {
  return def.nodes.some((node) => node.position === undefined);
}

/**
 * 无坐标节点的位置兜底：整图跑一次 `autoLayout()`，只把结果发给**没有坐标**的那些节点。
 *
 * 为什么不在映射层兜到原点：那 8 个节点会全部叠在左上角同一格里 —— 点任何一张卡片命中的
 * 都是最上面那张，连线的两端重合到看不出来，而"自动布局"这颗按钮就在工具条上，
 * 用户不点它就只能对着一坨发呆。设计器第一次打开就应当是能看的。
 *
 * 为什么只兜"没坐标的那几个"而不是全部：已经拖过的坐标是用户意图，覆盖它等于把
 * 用户摆好的图改回去。混用带来的重合由 `autoPlace()` 负责避让，不由这里负责。
 *
 * 结果确定：同一份定义两次映射给出同一组坐标（`autoLayout` 本身按拓扑分层 + 定义次序）。
 */
function fallbackPositions(
  def: WorkflowDefinition,
): Map<string, GraphPosition> | undefined {
  if (!hasUnpositionedNodes(def)) return undefined;
  return new Map(
    autoLayout(def).nodes.map((node) => [
      node.id,
      node.position ?? { x: 0, y: 0 },
    ]),
  );
}

/** 定义 → 画布节点；`selectedNodeId` 决定哪张卡片是选中态 */
export function toCanvasNodes(
  def: WorkflowDefinition,
  selectedNodeId?: string,
): Node<WorkflowCanvasNodeData>[] {
  const fallback = fallbackPositions(def);
  return def.nodes.map((node) => {
    const meta = nodeKindMeta(node.type);
    return {
      data: {
        hint: meta.hint,
        kind: node.type,
        kindLabel: meta.label,
        nodeId: node.id,
        selected: node.id === selectedNodeId,
        summary: nodeSummaryOf(node),
        title: node.label ?? node.id,
      },
      // vue-flow 靠 id 建立节点图：漏了这一行，点击回抛的是 undefined、拖完的坐标也写不回去
      id: node.id,
      // 坐标优先用定义里的；缺了才落到分层布局，绝不兜到原点（那是一张卡片叠一张卡片）
      position: node.position ?? fallback?.get(node.id) ?? { x: 0, y: 0 },
      type: 'workflow',
    };
  });
}

/** 边 id → 这条边在条件节点上承担的语义（命中表达式 / 默认边） */
function edgeRoleOf(
  def: WorkflowDefinition,
  edgeId: string,
): string | undefined {
  for (const node of def.nodes) {
    const branch = node.data?.branches?.find((item) => item.edgeId === edgeId);
    if (branch)
      return branch.expression ? `命中: ${branch.expression}` : '命中';
    if (node.data?.defaultEdgeId === edgeId) return '默认';
  }
  return undefined;
}

/** 定义 → 画布边；选中边 animated 高亮，分支表达式写在 label 上 */
export function toCanvasEdges(
  def: WorkflowDefinition,
  selectedEdgeId?: string,
): Edge[] {
  return def.edges.map((edge) => ({
    animated: edge.id === selectedEdgeId,
    id: edge.id,
    label: edgeRoleOf(def, edge.id) ?? edge.label,
    markerEnd: { type: MarkerType.ArrowClosed },
    source: edge.source,
    target: edge.target,
  }));
}
