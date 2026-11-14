/**
 * 图（DAG）的公共形状。
 *
 * 工作流引擎与 AI 编排都在这套形状上跑，但它们**不共享节点语义**：
 * 这里只规定「有 id 的顶点 + 有向边 + 位置」，节点里装什么由各自的 `data` 决定。
 * 这样两个模块可以各自演进，又能在同一个画布适配器上互换。
 */

export interface GraphPosition {
  x: number;
  y: number;
}

export interface GraphNode<
  TData extends Record<string, unknown> = Record<string, unknown>,
> {
  /** 图内唯一；由业务侧生成，引擎不改写 */
  id: string;
  /** 节点类型，决定用哪个渲染器 / 执行器；未知类型不报错，走 fallback */
  type: string;
  /** 画布标题，缺省时由 labelOf() 回落到 type */
  label?: string;
  /** 画布坐标；纯服务端图（无设计器）可以整体省略 */
  position?: GraphPosition;
  /** 业务负载，引擎只透传不解释 */
  data?: TData;
  /** 自定义端口，用于分支节点（如条件真假两条出线） */
  handles?: string[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  /** 出发的端口名；条件分支靠它区分「命中 / 未命中」 */
  sourceHandle?: string;
  label?: string;
  /** 边级条件表达式，由消费方用自己的求值器解释 */
  condition?: string;
  data?: Record<string, unknown>;
}

export interface GraphDefinition<
  TData extends Record<string, unknown> = Record<string, unknown>,
> {
  nodes: GraphNode<TData>[];
  edges: GraphEdge[];
  meta?: Record<string, unknown>;
}

export type GraphIssueLevel = 'error' | 'warning';

export interface GraphIssue {
  code: GraphIssueCode;
  level: GraphIssueLevel;
  message: string;
  /** 问题定位到的节点 / 边，设计器据此高亮 */
  nodeIds?: string[];
  edgeIds?: string[];
}

export type GraphIssueCode =
  | 'cycle'
  | 'duplicate-id'
  | 'isolated-node'
  | 'multiple-entry'
  | 'no-entry'
  | 'no-exit'
  | 'self-loop'
  | 'unknown-endpoint'
  | 'unreachable';
