import type { GraphDefinition, GraphEdge } from '@antdv/graph';

/**
 * 工作流的领域形状。
 *
 * 与 `@antdv/graph` 的关系是「复用骨架、不共用语义」：
 * 顶点/边/位置沿用 graph 的定义，`type` 与 `data` 里装什么由本包解释。
 * 这样 AI 编排可以把同一张图画成完全不同的东西，两边不会因为一个字段名互相牵制。
 */

/**
 * 内置节点类型。尾部的 `(string & {})` 是有意为之：
 * 注册自定义处理器时可以直接写 `'webhook'`、`'script'` 这样的字面量而不必改本包，
 * 同时六个内置值仍然享有自动补全。
 */
export type WorkflowNodeKind =
  | 'approval'
  | 'cc'
  | 'condition'
  | 'end'
  | 'start'
  | 'timer'
  | (string & {});

/** 多人节点的推进方式 */
export type MultiInstanceMode = 'all' | 'any' | 'sequence';

/** 审批人来源。业务侧要接自己的组织架构，注册新解析器即可，不必改引擎 */
export interface AssigneeRule {
  strategy: AssigneeStrategyName;
  /** 策略参数：角色码、用户 id 列表、表达式……由对应解析器解释 */
  params?: Record<string, unknown>;
  /** 兜底人：主策略解析出空集合时使用，避免流程卡死在无人节点 */
  fallback?: AssigneeRule;
}

export type AssigneeStrategyName =
  | 'departmentHead'
  | 'expression'
  | 'initiator'
  | 'role'
  | 'user'
  | string;

export type WorkflowActionName =
  | 'addSign'
  | 'approve'
  | 'reject'
  | 'skip'
  | 'transfer'
  | 'withdraw';

/** 驳回落点：回上一节点 / 回发起 / 回指定节点 */
export type RejectTarget = 'initiator' | 'previous' | (string & {});

export interface WorkflowNodeData extends Record<string, unknown> {
  /** 仅 approval / cc 有意义 */
  assignees?: AssigneeRule[];
  /** 多人如何推进；缺省等同 'any'（一个人办完就算办完） */
  multi?: MultiInstanceMode;
  /** 顺序会签时同时激活几条 */
  sequentialBatch?: number;
  /** 该节点允许的动作；缺省全部 */
  actions?: WorkflowActionName[];
  /** 驳回落到哪 */
  rejectTo?: RejectTarget;
  /** 超时（ms）。引擎不自己看钟，由宿主调 `engine.tick(now)` 或后台扫描触发 */
  timeoutMs?: number;
  /** 超时后自动执行的动作 */
  timeoutAction?: 'approve' | 'reject' | 'remind';
  /** condition 节点：按顺序取第一条命中的分支 */
  branches?: Array<{ edgeId: string; expression: string }>;
  /** condition 节点所有分支都不命中时走的边 */
  defaultEdgeId?: string;
  /**
   * 汇聚语义，缺省 `'any'`：第一条到达即进入。
   * 之所以不默认 `'all'`：互斥分支（condition 扇出后重新汇合）是最常见画法，
   * 用 all 会永远等不齐而静默死锁；需要并行汇聚的节点显式声明 `'all'`，
   * 引擎按「所有入边的源节点都到达」计数。
   * `'any'` 下若该节点已有待办，后到的分支不会再生成第二条重复任务。
   */
  join?: 'all' | 'any';
}

export interface WorkflowEdgeCondition {
  /** 走图表达式（@antdv/graph 的受限语法），不是 JS */
  expression: string;
}

export interface WorkflowDefinition extends GraphDefinition<WorkflowNodeData> {
  id: string;
  name: string;
  version: number;
}

/**
 * `failed` 与 `rejected` 是两件事：后者是业务上被驳回，前者是流程本身跑不下去了
 * （无人可办、未知节点、配置表达式报错、超出推进步数）。
 * 分开才能在待办中心里把"审批没过"和"流程定义有 bug"用不同语气说给不同的人听。
 */
export type InstanceStatus =
  | 'canceled'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'running'
  | 'suspended';
/**
 * `queued` 只出现在顺序会签里：任务已按办理人建好，但还没轮到它。
 * 单独一个态而不是"先不建、办完再建"，是为了让「这个节点一共要几个人办」在设计器和
 * 时间线上从一开始就看得见，也避免运行中途再解析一遍组织架构导致办理人漂移。
 */
export type TaskStatus =
  | 'canceled'
  | 'done'
  | 'pending'
  | 'queued'
  | 'skipped'
  | 'transferred';

export interface WorkflowTask {
  id: string;
  instanceId: string;
  nodeId: string;
  nodeKind: WorkflowNodeKind;
  assignee: string;
  status: TaskStatus;
  createdAt: number;
  finishedAt?: number;
  /** 顺序会签里的位次，用于"下一棒"激活 */
  seq: number;
  action?: WorkflowActionName;
  comment?: string;
  /** 转办链，用于审计：原始办理人 -> 现在办理人 */
  transferredFrom?: string;
  /** 加签产生的任务挂在父任务下，父任务等子任务办完才回到 pending */
  parentId?: string;
  /** 超时提醒只发一次；`tick()` 可安全重复调用全靠它去重 */
  remindedAt?: number;
}

export interface WorkflowHistoryEntry {
  at: number;
  nodeId: string;
  actor?: string;
  action: string;
  comment?: string;
}

export interface WorkflowInstance {
  id: string;
  definitionId: string;
  status: InstanceStatus;
  initiator: string;
  variables: Record<string, unknown>;
  /** 当前等待中的任务 id；空数组 + running 说明引擎在推进途中（不该持久化这种态） */
  activeTaskIds: string[];
  /** 串行推进时的游标；并行分支为多条 */
  tokenNodeIds: string[];
  /**
   * `join: 'all'` 的到达计数：目标节点 id -> 已到达的源节点 id 列表。
   * 做成可选是因为实例可能来自宿主的旧库表；引擎在写入时补齐。
   */
  arrivals?: Record<string, string[]>;
  /** 定时节点的到期登记；宿主重启后靠它恢复等待，不靠内存计时器 */
  timers?: Array<{ dueAt: number; nodeId: string }>;
  history: WorkflowHistoryEntry[];
  createdAt: number;
  updatedAt: number;
  /** 驳回栈：previous 落点靠它回溯 */
  trail: string[];
}

/**
 * 事件是给 UI 与审计的单向通知，不参与推进判定（判定只认存储里的实例与任务）。
 * 因此每个事件都自带 `instanceId`，宿主可以把整台引擎的事件流接到一个 websocket 主题上。
 */
export type WorkflowEvent =
  | { detail?: string; instanceId: string; kind: 'instance.failed' }
  | { instanceId: string; kind: 'instance.canceled' }
  | {
      instanceId: string;
      kind: 'instance.completed' | 'instance.rejected' | 'instance.started';
    }
  | { instanceId: string; kind: 'instance.resumed' | 'instance.suspended' }
  | {
      instanceId: string;
      kind: 'node.entered' | 'node.waiting';
      nodeId: string;
    }
  | {
      instanceId: string;
      kind: 'task.activated' | 'task.created';
      task: WorkflowTask;
    }
  | { instanceId: string; kind: 'task.skipped'; task: WorkflowTask }
  | { instanceId: string; kind: 'task.timeout'; task: WorkflowTask }
  | {
      instanceId: string;
      kind:
        | 'task.added'
        | 'task.approved'
        | 'task.rejected'
        | 'task.transferred';
      task: WorkflowTask;
    };

export type WorkflowEventListener = (event: WorkflowEvent) => void;

/**
 * 引擎不直接碰数据库：实例与任务的读写走这个适配器。
 * `createMemoryWorkflowStore()` 给单测与本地演示；生产替换成接口实现即可。
 *
 * 后两个方法是**可选**的，因为按 taskId 操作和全表扫描都不是所有存储愿意承诺的能力：
 * 没实现时引擎会抛出带 code 的明确错误，而不是静默什么都不做。
 * 若宿主更希望由自己控制权限与索引，可以只用 `getInstance` + `tasksOf` 的 API 子集。
 */
export interface WorkflowStoreAdapter {
  /** 按 taskId 反查归属实例（转办/加签/办理只需要 taskId 时用到） */
  getTaskById?: (
    id: string,
  ) => Promise<undefined | WorkflowTask> | undefined | WorkflowTask;
  getInstance: (
    id: string,
  ) => Promise<undefined | WorkflowInstance> | undefined | WorkflowInstance;
  /** 定时扫描要的「在跑实例」集合 */
  runningInstances?: () => Promise<WorkflowInstance[]> | WorkflowInstance[];
  saveInstance: (instance: WorkflowInstance) => Promise<void> | void;
  saveTasks: (tasks: WorkflowTask[]) => Promise<void> | void;
  tasksOf: (instanceId: string) => Promise<WorkflowTask[]> | WorkflowTask[];
}

/** 自定义节点处理器：注册后即可新增节点类型，不必 fork 引擎 */
export interface WorkflowNodeHandler {
  kind: string;
  /**
   * 引擎走到该节点时调用。
   * 返回 `waiting` 表示流程在此停住等外部推进（审批、工具确认），
   * 返回 `advance` 表示立刻继续；`finish`/`fail` 直接结束整条流程。
   */
  run: (
    ctx: NodeHandlerContext,
  ) => NodeHandlerResult | Promise<NodeHandlerResult>;
}

export interface NodeHandlerContext {
  node: WorkflowDefinition['nodes'][number];
  instance: WorkflowInstance;
  definition: WorkflowDefinition;
  now: number;
  /** 写回流程变量，后续节点的条件表达式能读到 */
  setVariable: (name: string, value: unknown) => void;
  /**
   * 按引擎合并后的策略表取人（内置 + 注入）。
   * 放进上下文而不是让处理器自己 import policies，是为了让自定义处理器
   * 天然复用宿主的组织架构接线，不必自己再拼一遍解析器。
   */
  resolveAssignees: (rules?: AssigneeRule[]) => string[];
  /** 受限表达式求值：可读 instance.variables 与引擎的 evaluatorContext */
  evaluate: (expression: string) => unknown;
  /** 该节点的全部出边，省得处理器自己去 definition.edges 里过滤 */
  outgoingEdges: GraphEdge[];
}

/** 处理器产出的任务草案：id / 实例归属 / 创建时间由引擎补齐，处理器只管"该谁办、排第几" */
export interface TaskDraft {
  nodeId: string;
  nodeKind: WorkflowNodeKind;
  assignee: string;
  seq: number;
  /** 顺序会签里未轮到的填 queued，缺省 pending */
  status?: TaskStatus;
  /** 加签产生的子任务 */
  parentId?: string;
}

export type NodeHandlerResult =
  /** 立刻推进。nextEdgeIds 用于自定义网关节点自己决定走哪条边；缺省走全部出边 */
  | { dueAt: number; status: 'wait_until' }
  | { nextEdgeIds?: string[]; status: 'advance' }
  | { status: 'fail'; reason: string }
  /**
   * 建任务并停在此处等外部推进。`tasks` 为空数组时不生成死任务，
   * 而是交给引擎按 `onEmptyAssignees` 决定失败/跳过/回落发起人。
   */
  | { status: 'finish'; result: 'completed' | 'rejected' }
  /** 建任务但**不阻塞**：抄送这类"通知已发出、流程继续走"的节点 */
  | { status: 'notify'; tasks: TaskDraft[] }
  /** 定时等待：到点由宿主调 `engine.tick(now)` 触发推进，引擎自己不看钟 */
  | { status: 'wait'; tasks: TaskDraft[] };

export interface EngineOptions {
  definition: WorkflowDefinition;
  store?: WorkflowStoreAdapter;
  /** 审批人解析表；不传用内置策略 */
  assigneeResolvers?: Record<string, AssigneeResolver>;
  /** 追加或覆盖内置节点处理器：同 kind 后注册者胜 */
  handlers?: WorkflowNodeHandler[];
  /** 变量求值用的表达式上下文补充（如当前登录人、部门树） */
  evaluatorContext?: Record<string, unknown>;
  /** 时钟注入：单测里传固定值，流程推进就完全可复现 */
  now?: () => number;
  idFactory?: (prefix: string) => string;
  /** 单次推进允许走的步数上限，兜住"驳回回溯"造成的合法环跑飞 */
  maxSteps?: number;
  /**
   * 多版本共存：实例引用了非当前定义时按这张表查。
   * 只传一份定义的宿主不需要管它。
   */
  definitions?: Record<string, WorkflowDefinition>;
  /** 未注册 kind 的兜底处理器；不传则未知节点类型直接把实例落成 failed */
  fallbackHandler?: WorkflowNodeHandler;
  /**
   * 审批/抄送节点解析不出办理人时的处置，缺省 `'fail'`。
   * `'skip'` 静默跳过容易让审批链少一环却无人知晓，所以默认选响亮的那条；
   * 接了组织架构、确信"没配人就该跳过"的业务再显式改。
   */
  onEmptyAssignees?: 'fail' | 'initiator' | 'skip';
  /** 角色到人 / 部门负责人的接线，供内置解析策略使用 */
  resolveRole?: (roleCode: string) => string[];
  resolveDepartmentHead?: (userId: string) => string[];
}

export type AssigneeResolver = (
  rule: AssigneeRule,
  ctx: ResolverContext,
) => string[];

export interface ResolverContext {
  instance: WorkflowInstance;
  /** 引擎的合并策略表（内置 + 注入），由引擎填进来 */
  resolvers?: Record<string, AssigneeResolver>;
  /** 解析器之间不共享状态；需要组织架构就走 params */
  resolveRole?: (roleCode: string) => string[];
  resolveDepartmentHead?: (userId: string) => string[];
}

export type WorkflowEdgeWithCondition = GraphEdge & { condition?: string };
