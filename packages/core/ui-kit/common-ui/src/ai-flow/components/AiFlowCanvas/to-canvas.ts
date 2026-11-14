import type {
  AiFlowDefinition,
  AiNodeData,
  AiNodeKind,
  AiNodeStatus,
  AiRunState,
} from '../../core/types';

/**
 * 图 → 画布数据的纯映射。
 *
 * 分层位置：`components/AiFlowCanvas/to-canvas.ts`。单独成文件的唯一理由是把「怎么画」
 * 变成可以直接断言的函数 —— 组件里有 VueFlow 的生命周期与 DOM，jsdom 里测不动，
 * 而节点配色、状态环、边高亮这些规则是会被 review 挑的东西，必须有测试撑着。
 *
 * 刻意不做的事：**这里没有任何运行语义。**
 * 谁是入口、条件往哪走、重试几次，全在 `core/`；画布只把 `AiRunState` 里已经算好的结论涂成颜色。
 * 反过来也一样：`core/` 不 import 这个文件，运行器不知道有画布这回事。
 */

/** VueFlow 的节点类型名（对应插槽 `#node-ai`）；所有 AI 节点共用一个模板，配色按 kind 分 */
export const AI_CANVAS_NODE_TYPE = 'ai';

/** 画布节点的负载：只放显示要用的字段，不放函数、不放运行器句柄 */
export interface AiCanvasNodeData extends Record<string, unknown> {
  description: string;
  kind: AiNodeKind;
  label: string;
  status: AiNodeStatus;
  /** 该节点写回的产物键，`{{ }}` 引用时肉眼可查 */
  valueKey?: string;
}

export interface AiCanvasNode {
  data: AiCanvasNodeData;
  id: string;
  label?: string;
  position: { x: number; y: number };
  type: string;
}

export interface AiCanvasEdge {
  /**
   * 走过 / 没走过两套配色：**类名 + 内联 `style` 都要给**，原因只有真浏览器知道。
   *
   * `edge.class` 挂在 vue-flow 的外层 `<g class="vue-flow__edge">` 上，而它自带的
   * `style.css` 里有一条 `.vue-flow__edge-path { stroke: #b1b1b7 }` —— 直接命中 `<path>` 的规则
   * 赢过从父级继承来的 stroke。所以只写类名的话，所有边永远都是那个默认灰，
   * 画布上「走了哪条路」白画（单测里断言类名照样全绿）。
   *
   * 内联 style 落到 `<path>` 上才压得住那条规则；值仍然写 `hsl(var(--x))`，
   * 吃的是同一套 token，不是绕开主题系统写死颜色。类名继续留着：宿主想按自己的
   * CSS 覆写（更粗、虚线、动画）时有稳定的钩子。
   */
  class: string;
  data?: Record<string, unknown>;
  id: string;
  label?: string;
  source: string;
  /** 实际生效的着色：vue-flow 把它原样铺在边的 `<path>` 上 */
  style: { stroke: string };
  target: string;
}

/** 边走廊的两种颜色，对应 `traversed` 真与假 */
export const AI_EDGE_STROKE = {
  idle: 'hsl(var(--border))',
  traversed: 'hsl(var(--primary))',
} as const;

/**
 * 节点类型 → token 类名。
 *
 * 只有 token 名，没有十六进制、没有 `--ant-*`：换主题时画布跟着走。
 * 八种内置 + 未知类型兜底，兜底走中性色，自定义业务节点不该在配色上抢戏。
 */
export const AI_NODE_PALETTE: Record<string, string> = {
  condition:
    'border-secondary-foreground bg-secondary text-secondary-foreground',
  end: 'border-destructive bg-destructive/10 text-destructive',
  human: 'border-warning bg-warning/10 text-warning',
  llm: 'border-primary bg-primary/10 text-primary',
  prompt: 'border-info bg-info/10 text-info',
  start: 'border-success bg-success/10 text-success',
  tool: 'border-accent-foreground bg-accent text-accent-foreground',
  transform: 'border-border bg-card text-card-foreground',
};

export const AI_NODE_PALETTE_FALLBACK =
  'border-border bg-muted text-muted-foreground';

/** 状态 → 外环类名。与类型配色分开的理由：一个节点既要知道自己是什么，也要知道跑到哪了 */
export const AI_NODE_STATUS_RING: Record<AiNodeStatus, string> = {
  awaiting: 'ring-2 ring-warning',
  canceled: 'opacity-50',
  failed: 'ring-2 ring-destructive',
  pending: 'opacity-70',
  running: 'ring-2 ring-primary',
  skipped: 'opacity-40',
  succeeded: 'ring-1 ring-success',
};

export function nodePaletteOf(kind: string): string {
  return AI_NODE_PALETTE[kind] ?? AI_NODE_PALETTE_FALLBACK;
}

export function nodeStatusRingOf(status: AiNodeStatus): string {
  return AI_NODE_STATUS_RING[status];
}

/**
 * 节点没有坐标时按声明顺序横向铺开。
 *
 * 为什么不 import graph 的 `topologicalSort` 来自动排版：那是运行语义的工具，画布用了它就把两层绑死了，
 * 而且排版结果会随图的形状变，设计器里拖出来的坐标一旦被覆盖用户会骂。所以只做兜底。
 */
function positionOf(
  node: AiFlowDefinition['nodes'][number],
  index: number,
): { x: number; y: number } {
  if (node.position) return { x: node.position.x, y: node.position.y };
  return { x: 40 + index * 260, y: 80 };
}

/** 每个 kind 的一行说明，直接来自节点上真正配了什么，避免再写一套「读图」逻辑 */
function describeNode(type: string, data: AiNodeData): string {
  switch (type) {
    case 'condition': {
      return `${data.branches?.length ?? 0} 个分支${data.defaultEdgeId ? ' · 有默认边' : ''}`;
    }
    case 'human': {
      return data.resumeLabel ?? '等待人工确认';
    }
    case 'llm': {
      return [
        data.model ?? '默认模型',
        data.stream ? '流式' : null,
        data.tools?.length ? `工具 ×${data.tools.length}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
    }
    case 'prompt': {
      return `${data.fewShot?.length ?? 0} 个示例`;
    }
    case 'tool': {
      return data.tool ?? '未指定工具';
    }
    case 'transform': {
      return data.expression ?? '无表达式';
    }
    default: {
      return '';
    }
  }
}

export function toCanvasNodes(
  flow: AiFlowDefinition,
  state?: AiRunState,
): AiCanvasNode[] {
  return flow.nodes.map((node, index) => {
    const data: AiNodeData = node.data ?? {};
    const runNode = state?.nodes[node.id];
    return {
      data: {
        description: describeNode(node.type, data),
        kind: node.type,
        label: node.label ?? node.id,
        status: runNode?.status ?? 'pending',
        valueKey: runNode?.outputKey ?? data.outputKey,
      },
      id: node.id,
      position: positionOf(node, index),
      type: AI_CANVAS_NODE_TYPE,
    };
  });
}

/**
 * 边的高亮：**只有运行态里已经走过的节点之间的边**才涂主色。
 *
 * 判断依据是 `nodes[a].status` 而不是 `state.frontier`，因为 frontier 是「即将执行」的集合，
 * 画在边上会让人误以为那条边已经走完了。
 *
 * 走完的判据要**同时**看两头：源头 `succeeded` 只说明这个节点跑完了，不等于它选的每条出边都被走；
 * 目标拿到一个真状态（`pending` / `skipped` 之外）才说明它确实被调度过。少看目标这一半，
 * condition 未命中的那条分支会因为源节点成功而一起亮起主色 —— 画布上「走了哪条路」就白画了。
 */
export function toCanvasEdges(
  flow: AiFlowDefinition,
  state?: AiRunState,
): AiCanvasEdge[] {
  return flow.edges.map((edge) => {
    const from = state?.nodes[edge.source]?.status;
    const to = state?.nodes[edge.target]?.status;
    const traversed =
      from === 'succeeded' &&
      to !== undefined &&
      to !== 'pending' &&
      to !== 'skipped';
    return {
      class: traversed ? 'stroke-primary' : 'stroke-border',
      id: edge.id,
      label: edge.label,
      source: edge.source,
      style: {
        stroke: traversed ? AI_EDGE_STROKE.traversed : AI_EDGE_STROKE.idle,
      },
      target: edge.target,
    };
  });
}
