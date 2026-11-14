import type {
  NodeHandlerContext,
  NodeHandlerResult,
  TaskDraft,
  WorkflowNodeData,
  WorkflowNodeHandler,
} from './types';

/**
 * 节点处理器注册表。
 *
 * 内置的六种节点**本身就是注册表里的条目**，不是引擎里的 switch —— 这是"易扩展"的落点：
 * 想把 `condition` 换成自己的网关语义，注册一个同名 kind 的处理器就覆盖掉了，
 * 不需要 fork 引擎，也不需要引擎为每一种业务开一个配置开关。
 */

export interface NodeHandlerRegistry {
  get: (kind: string) => undefined | WorkflowNodeHandler;
  has: (kind: string) => boolean;
  list: () => WorkflowNodeHandler[];
  register: (handler: WorkflowNodeHandler) => void;
  unregister: (kind: string) => boolean;
}

function nodeData(ctx: NodeHandlerContext): WorkflowNodeData {
  return (ctx.node.data ?? {}) as WorkflowNodeData;
}

/**
 * 把办理人列表展开成任务草案，并按 `multi` 决定谁立刻可办、谁排队。
 *
 * 口径：
 * - `'all'` / `'any'`：全部立刻 pending，区别只在推进条件（引擎侧判）。
 * - `'sequence'`：前 `sequentialBatch`（缺省 1）条 pending，其余 `queued`，
 *   办完一批由引擎把下一批提上来 —— 排队项也一次性建好，
 *   这样"这个节点到底要几个人办"从一开始就在库里，不靠运行期再解析组织。
 */
export function toTaskDrafts(
  ctx: NodeHandlerContext,
  assignees: string[],
  kind: string,
): TaskDraft[] {
  const data = nodeData(ctx);
  const mode = data.multi ?? 'any';
  const batch =
    mode === 'sequence'
      ? Math.max(1, Math.trunc(data.sequentialBatch ?? 1))
      : 0;
  return assignees.map((assignee, index) => ({
    assignee,
    nodeKind: kind,
    nodeId: ctx.node.id,
    seq: index,
    status:
      mode === 'sequence' && index >= batch
        ? ('queued' as const)
        : ('pending' as const),
  }));
}

/** 办理人为空时交出空草案，由引擎按 onEmptyAssignees 处置，避免生成 assignee 为空的死任务 */
function waitOrEmpty(ctx: NodeHandlerContext, kind: string): NodeHandlerResult {
  const assignees = ctx.resolveAssignees(nodeData(ctx).assignees);
  if (assignees.length === 0) return { status: 'wait', tasks: [] };
  return { status: 'wait', tasks: toTaskDrafts(ctx, assignees, kind) };
}

/**
 * 条件网关：按声明顺序取第一条命中的分支。
 *
 * 命中判据是「求值结果按宽松真值判断为真」，与 graph 表达式求值的 `truthy` 口径一致；
 * 表达式抛错**不吞**，直接冒到引擎变成 `fail`，因为条件写错属于配置错误，
 * 静默走默认分支会让流程悄悄走错路且无人发现。
 */
function runCondition(ctx: NodeHandlerContext): NodeHandlerResult {
  const data = nodeData(ctx);
  const declared = data.branches ?? [];
  for (const branch of declared) {
    if (!branch.expression.trim()) continue;
    if (isTruthy(ctx.evaluate(branch.expression))) {
      return { nextEdgeIds: [branch.edgeId], status: 'advance' };
    }
  }
  if (data.defaultEdgeId) {
    return { nextEdgeIds: [data.defaultEdgeId], status: 'advance' };
  }
  // 没配默认分支又全不命中：走出边而不是失败，但把选择权留给边的声明顺序，
  // 单出边时等价于"无条件通过"，这也是最常见的画法。
  return { status: 'advance' };
}

export const builtinNodeHandlers: readonly WorkflowNodeHandler[] = [
  {
    kind: 'start',
    run: () => ({ status: 'advance' }),
  },
  {
    kind: 'end',
    run: () => ({ result: 'completed', status: 'finish' }),
  },
  {
    kind: 'condition',
    run: runCondition,
  },
  {
    kind: 'approval',
    run: (ctx) => waitOrEmpty(ctx, 'approval'),
  },
  {
    // 抄送：任务建完就走，不阻塞流程；待阅列表由 assignee 维度查询得到
    kind: 'cc',
    run: (ctx) => {
      const assignees = ctx.resolveAssignees(nodeData(ctx).assignees);
      return { status: 'notify', tasks: toTaskDrafts(ctx, assignees, 'cc') };
    },
  },
  {
    // 定时等待：把到期时间登记到实例上，宿主调 tick(now) 才推进；
    // 没有 timeoutMs 的 timer 节点等价于直通，比报错友好
    kind: 'timer',
    run: (ctx) => {
      const ms = nodeData(ctx).timeoutMs;
      if (!ms || ms <= 0) return { status: 'advance' };
      return { dueAt: ctx.now + ms, status: 'wait_until' };
    },
  },
];

export function createNodeHandlerRegistry(
  extra: WorkflowNodeHandler[] = [],
): NodeHandlerRegistry {
  const byKind = new Map<string, WorkflowNodeHandler>();
  for (const handler of builtinNodeHandlers) byKind.set(handler.kind, handler);
  for (const handler of extra) byKind.set(handler.kind, handler);
  return {
    get: (kind) => byKind.get(kind),
    has: (kind) => byKind.has(kind),
    list: () => [...byKind.values()],
    register: (handler) => {
      byKind.set(handler.kind, handler);
    },
    unregister: (kind) => byKind.delete(kind),
  };
}

/** 与 graph 表达式求值一致的宽松真值：0 / '' / false / null / undefined 为假，数组与对象为真 */
export function isTruthy(value: unknown): boolean {
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  if (typeof value === 'string') return value.length > 0;
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  return true;
}
