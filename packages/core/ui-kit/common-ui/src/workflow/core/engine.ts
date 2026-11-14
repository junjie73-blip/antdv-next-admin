import type { GraphEdge, GraphIssue } from '@antdv/graph';

import type {
  AssigneeResolver,
  EngineOptions,
  NodeHandlerResult,
  TaskDraft,
  WorkflowDefinition,
  WorkflowEvent,
  WorkflowEventListener,
  WorkflowInstance,
  WorkflowNodeData,
  WorkflowNodeHandler,
  WorkflowStoreAdapter,
  WorkflowTask,
} from './types';

import {
  createExpressionEvaluator,
  createGraphIndex,
  validateGraph,
} from '@antdv/graph';

import { builtinAssigneeResolvers, resolveAssigneeSet } from './policies';
import { createNodeHandlerRegistry } from './registry';
import { createMemoryWorkflowStore } from './store';

/**
 * 工作流引擎。
 *
 * 四条口径，改动前先读：
 *
 * 1. **引擎自己不碰时间也不碰数据库。** 时钟与存储都是注入的（`now()` / `WorkflowStoreAdapter`），
 *    单测里给定固定时间戳就能跑出完全确定的轨迹；定时与超时靠宿主调 `tick(now)` 驱动，
 *    到期时间写在实例的 `timers` 上，宿主重启后不丢。
 * 2. **节点语义不在引擎里。** 六种内置节点是注册表条目，引擎只负责边路由、任务成组与推进判定；
 *    换掉或新增一种节点不需要动这个文件。
 * 3. **推进是一趟单线程循环。** 一次 `drive()` 把所有能走的路走完，走不动了才把游标落回
 *    `tokenNodeIds`；因此存储里的实例要么处于等待态、要么处于终态，不会留下"跑一半"的中间态。
 * 4. **办理是否推得动，只认「该节点此刻是否持有令牌」。** 抄送这类不阻塞的节点，
 *    它的任务照样能办（标记已阅），但不会因为办完就多走一步。
 */

/** 历史里不属于任何节点的动作（撤回、挂起、超时触发）统一记在这个伪节点上 */
export const SYSTEM_NODE = '__system__';

/** 单次 `drive()` 允许推进的最大步数：驳回回溯会造出合法的环，靠步数上限兜住死循环 */
const DEFAULT_MAX_STEPS = 200;

export interface StartInput {
  initiator: string;
  /** 单次运行覆盖定义：灰度换版本或按单据类型选流程时用 */
  definition?: WorkflowDefinition;
  variables?: Record<string, unknown>;
}

export interface ActionInput {
  actor?: string;
  comment?: string;
  /** 合并进流程变量，办理时顺便改单子的场景 */
  variables?: Record<string, unknown>;
}

export interface RejectInput extends ActionInput {
  /** 覆盖节点上声明的驳回落点 */
  to?: string;
}

export interface TransferInput extends ActionInput {
  to: string;
}

export interface AddSignInput extends ActionInput {
  users: string[];
  /** `'before'` 先加签后办（子任务立刻可办，父任务被锁），`'after'` 办完再加签（子任务排队） */
  mode?: 'after' | 'before';
}

export interface WorkflowEngine {
  addSign: (taskId: string, input: AddSignInput) => Promise<WorkflowInstance>;
  cancel: (
    instanceId: string,
    input?: ActionInput,
  ) => Promise<WorkflowInstance>;
  complete: (taskId: string, input?: ActionInput) => Promise<WorkflowInstance>;
  readonly definition: WorkflowDefinition;
  getInstance: (id: string) => Promise<undefined | WorkflowInstance>;
  on: (listener: WorkflowEventListener) => () => void;
  reject: (taskId: string, input?: RejectInput) => Promise<WorkflowInstance>;
  resume: (
    instanceId: string,
    input?: ActionInput,
  ) => Promise<WorkflowInstance>;
  skip: (taskId: string, input?: ActionInput) => Promise<WorkflowInstance>;
  start: (input: StartInput) => Promise<WorkflowInstance>;
  suspend: (
    instanceId: string,
    input?: ActionInput,
  ) => Promise<WorkflowInstance>;
  /** 实例下的全部任务（含已办/作废），UI 侧自己按 assignee/status 过滤 */
  tasksOf: (instanceId: string) => Promise<WorkflowTask[]>;
  /** 到钟驱动：返回触发的条数（放开的定时节点 + 超时动作），0 表示无事可做 */
  tick: (now?: number) => Promise<number>;
  transfer: (taskId: string, input: TransferInput) => Promise<WorkflowInstance>;
  withdraw: (
    instanceId: string,
    input?: ActionInput,
  ) => Promise<WorkflowInstance>;
}

export function createWorkflowEngine(options: EngineOptions): WorkflowEngine {
  const store: WorkflowStoreAdapter =
    options.store ?? createMemoryWorkflowStore();
  const clock = options.now ?? (() => Date.now());
  const resolvers: Record<string, AssigneeResolver> = {
    ...builtinAssigneeResolvers,
    ...options.assigneeResolvers,
  };
  const registry = createNodeHandlerRegistry(options.handlers ?? []);
  const evaluator = createExpressionEvaluator();
  const onEmptyAssignees = options.onEmptyAssignees ?? 'fail';
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const listeners = new Set<WorkflowEventListener>();
  const counters = new Map<string, number>();
  const nextId =
    options.idFactory ??
    ((prefix: string) => {
      const n = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, n);
      return `${prefix}-${n}`;
    });

  const definition = options.definition;

  function emit(event: WorkflowEvent) {
    for (const listener of listeners) listener(event);
  }

  function requireStore(capability: string): never {
    throw new WorkflowEngineError(
      `存储适配器没有实现 ${capability}，该 API 无法工作；请补上适配器或改用 getInstance/tasksOf 路径`,
      'store-capability-missing',
    );
  }

  async function load(instanceId: string): Promise<WorkflowInstance> {
    const found = await store.getInstance(instanceId);
    if (!found)
      throw new WorkflowEngineError(
        `实例不存在：${instanceId}`,
        'instance-not-found',
      );
    return found;
  }

  async function loadTasks(instanceId: string): Promise<WorkflowTask[]> {
    return [...(await store.tasksOf(instanceId))];
  }

  async function save(inst: WorkflowInstance) {
    inst.updatedAt = clock();
    await store.saveInstance(inst);
  }

  function createInstance(
    def: WorkflowDefinition,
    input: StartInput,
  ): WorkflowInstance {
    const now = clock();
    return {
      activeTaskIds: [],
      arrivals: {},
      createdAt: now,
      definitionId: def.id,
      history: [],
      id: nextId('ins'),
      initiator: input.initiator,
      status: 'running',
      timers: [],
      tokenNodeIds: [],
      trail: [],
      updatedAt: now,
      variables: { ...input.variables },
    };
  }

  function nodeById(id: string, def: WorkflowDefinition) {
    return def.nodes.find((node) => node.id === id);
  }

  function dataOf(
    node: undefined | { data?: WorkflowNodeData },
  ): WorkflowNodeData {
    return (node?.data ?? {}) as WorkflowNodeData;
  }

  function outgoing(nodeId: string, def: WorkflowDefinition): GraphEdge[] {
    return def.edges.filter((edge) => edge.source === nodeId);
  }

  function incomingSources(nodeId: string, def: WorkflowDefinition): string[] {
    return [
      ...new Set(
        def.edges
          .filter((edge) => edge.target === nodeId)
          .map((edge) => edge.source),
      ),
    ];
  }

  function entryNode(def: WorkflowDefinition): string | undefined {
    const start = def.nodes.find((node) => node.type === 'start');
    if (start) return start.id;
    const index = createGraphIndex(def);
    return def.nodes.find(
      (node) => (index.incoming.get(node.id)?.length ?? 0) === 0,
    )?.id;
  }

  function record(
    inst: WorkflowInstance,
    nodeId: string,
    action: string,
    actor?: string,
    comment?: string,
  ) {
    inst.history.push({ action, actor, at: clock(), comment, nodeId });
  }

  async function materialize(
    inst: WorkflowInstance,
    drafts: TaskDraft[],
    kind: string,
  ): Promise<WorkflowTask[]> {
    if (drafts.length === 0) return [];
    const now = clock();
    const tasks: WorkflowTask[] = drafts.map((draft) => ({
      assignee: draft.assignee,
      createdAt: now,
      id: nextId('tk'),
      instanceId: inst.id,
      nodeKind: draft.nodeKind,
      nodeId: draft.nodeId,
      parentId: draft.parentId,
      seq: draft.seq,
      status: draft.status ?? 'pending',
    }));
    await store.saveTasks(tasks);
    for (const task of tasks) {
      pushActive(inst, task.id);
      emit({ instanceId: inst.id, kind: 'task.created', task });
      record(inst, task.nodeId, `${kind}.assigned`, undefined, task.assignee);
    }
    return tasks;
  }

  /** 无人可办的三种处置集中在这里，处理器只负责交出空草案 */
  function draftsWhenEmpty(
    inst: WorkflowInstance,
    nodeId: string,
  ): 'fail' | TaskDraft[] {
    if (onEmptyAssignees === 'skip') return [];
    if (onEmptyAssignees === 'initiator') {
      return [
        { assignee: inst.initiator, nodeKind: 'approval', nodeId, seq: 0 },
      ];
    }
    return 'fail';
  }

  function evalContext(inst: WorkflowInstance): Record<string, unknown> {
    return { ...options.evaluatorContext, ...inst.variables };
  }

  /** 还没结清的任务：pending 是正等着办，queued 是顺序会签里还没轮到 */
  function isOpen(status: WorkflowTask['status']) {
    return status === 'pending' || status === 'queued';
  }

  /** 待办指针集合是去重的：同一条任务被提两次（先建后激活）会在详情页里画成两行 */
  function pushActive(inst: WorkflowInstance, taskId: string) {
    if (!inst.activeTaskIds.includes(taskId)) inst.activeTaskIds.push(taskId);
  }

  async function cancelOpenTasks(
    inst: WorkflowInstance,
    tasks: WorkflowTask[],
  ) {
    const open = tasks.filter((task) => isOpen(task.status));
    for (const task of open) task.status = 'canceled';
    inst.activeTaskIds = [];
    if (open.length > 0) await store.saveTasks(open);
  }

  /**
   * 从给定节点开始把流程走到不能再走。
   * `starts` 的 `from` 是带来这条令牌的源节点，只用于 `join: 'all'` 的到达计数。
   */
  async function drive(
    inst: WorkflowInstance,
    def: WorkflowDefinition,
    starts: Array<{ from?: string; nodeId: string }>,
  ): Promise<DriveOutcome> {
    const parked = new Set(inst.tokenNodeIds);
    const worklist = [...starts];
    let steps = 0;

    while (worklist.length > 0) {
      steps += 1;
      if (steps > maxSteps) {
        return {
          reason: `推进步数超过上限 ${maxSteps}，流程定义里可能存在死循环`,
          status: 'failed',
        };
      }
      const token = worklist.shift();
      if (!token) break;
      const node = nodeById(token.nodeId, def);
      if (!node)
        return { reason: `定义里找不到节点 ${token.nodeId}`, status: 'failed' };
      const nodeId = node.id;
      const data = dataOf(node);

      // 重新进入一个正在等待的节点（驳回回溯）：旧游标由本次接管
      parked.delete(nodeId);

      const sources = incomingSources(nodeId, def);
      if (data.join === 'all' && sources.length > 1) {
        const arrived = new Set(inst.arrivals?.[nodeId] ?? []);
        if (token.from) arrived.add(token.from);
        const missing = sources.filter((source) => !arrived.has(source));
        if (missing.length > 0) {
          inst.arrivals = { ...inst.arrivals, [nodeId]: [...arrived] };
          parked.add(nodeId);
          inst.tokenNodeIds = [...parked];
          await save(inst);
          emit({ instanceId: inst.id, kind: 'node.waiting', nodeId });
          continue;
        }
        inst.arrivals = { ...inst.arrivals, [nodeId]: [] };
      }

      emit({ instanceId: inst.id, kind: 'node.entered', nodeId });
      record(inst, nodeId, 'node.enter');
      if (node.type === 'approval') inst.trail.push(nodeId);

      const handler: undefined | WorkflowNodeHandler =
        registry.get(node.type) ?? options.fallbackHandler;
      if (!handler) {
        return {
          reason: `节点类型 "${node.type}" 没有注册处理器`,
          status: 'failed',
        };
      }

      let result: NodeHandlerResult;
      try {
        result = await handler.run({
          definition: def,
          evaluate: (expression) =>
            evaluator.evaluate(expression, evalContext(inst)),
          instance: inst,
          node,
          now: clock(),
          outgoingEdges: outgoing(nodeId, def),
          resolveAssignees: (rules) =>
            resolveAssigneeSet(rules, {
              instance: inst,
              resolvers,
              resolveDepartmentHead: options.resolveDepartmentHead,
              resolveRole: options.resolveRole,
            }),
          setVariable: (name, value) => {
            inst.variables[name] = value;
          },
        });
      } catch (error) {
        // 处理器抛错（典型是条件表达式写错）不能让实例停在"running 且无游标"的悬空态：
        // 统一落成 failed，宿主在待办中心就能看到，而不是等有人来催才发现单子没了
        const message = error instanceof Error ? error.message : String(error);
        return {
          reason: `节点 ${node.label ?? nodeId} 的处理器抛错：${message}`,
          status: 'failed',
        };
      }

      const move = (edgeIds?: string[]) => {
        const edges = outgoing(nodeId, def);
        const chosen = edgeIds
          ? edges.filter((edge) => edgeIds.includes(edge.id))
          : edges;
        for (const edge of chosen)
          worklist.push({ from: nodeId, nodeId: edge.target });
      };

      switch (result.status) {
        case 'advance': {
          move(result.nextEdgeIds);
          break;
        }
        case 'fail': {
          return { reason: result.reason, status: 'failed' };
        }
        case 'finish': {
          inst.status = result.result;
          inst.tokenNodeIds = [];
          await cancelOpenTasks(inst, await loadTasks(inst.id));
          inst.timers = [];
          return { status: 'finished' };
        }
        case 'notify': {
          // 不阻塞：任务建完就把游标让出去，待阅靠 assignee 维度查
          await materialize(inst, result.tasks, node.type);
          move();
          break;
        }
        case 'wait': {
          const drafts =
            result.tasks.length > 0
              ? result.tasks
              : draftsWhenEmpty(inst, nodeId);
          if (drafts === 'fail') {
            return {
              reason: `节点 ${node.label ?? nodeId}（${node.type}）解析不出办理人`,
              status: 'failed',
            };
          }
          if (drafts.length === 0) {
            record(inst, nodeId, 'node.skipped-empty');
            move();
            break;
          }
          await materialize(inst, drafts, node.type);
          parked.add(nodeId);
          emit({ instanceId: inst.id, kind: 'node.waiting', nodeId });
          break;
        }
        case 'wait_until': {
          inst.timers = [
            ...(inst.timers ?? []),
            { dueAt: result.dueAt, nodeId },
          ];
          parked.add(nodeId);
          record(inst, nodeId, 'timer.armed');
          emit({ instanceId: inst.id, kind: 'node.waiting', nodeId });
          break;
        }
      }
    }

    inst.tokenNodeIds = [...parked];
    inst.timers = (inst.timers ?? []).filter((timer) =>
      parked.has(timer.nodeId),
    );
    if (parked.size === 0 && inst.status === 'running') {
      // 没有游标也没有待办：图走到了没有 end 节点的尽头，按完成收口而不是悬着
      inst.status = 'completed';
      return { status: 'finished' };
    }
    return { status: 'parked' };
  }

  async function settleOutcome(inst: WorkflowInstance, outcome: DriveOutcome) {
    if (outcome.status === 'finished') {
      emit({
        instanceId: inst.id,
        kind:
          inst.status === 'rejected'
            ? 'instance.rejected'
            : 'instance.completed',
      });
      return;
    }
    if (outcome.status === 'failed') {
      inst.status = 'failed';
      inst.tokenNodeIds = [];
      inst.timers = [];
      await cancelOpenTasks(inst, await loadTasks(inst.id));
      record(inst, SYSTEM_NODE, 'engine.fail', undefined, outcome.reason);
      emit({
        detail: outcome.reason,
        instanceId: inst.id,
        kind: 'instance.failed',
      });
    }
  }

  /** 该节点是否还欠着待办：决定这次办理能不能把流程推走 */
  function gateForNode(
    mode: WorkflowNodeData['multi'],
    openSiblings: WorkflowTask[],
  ): 'advance' | 'hold' | 'promote' {
    if (mode === 'all') return openSiblings.length === 0 ? 'advance' : 'hold';
    if (mode === 'sequence') {
      if (openSiblings.some((task) => task.status === 'pending')) return 'hold';
      return openSiblings.length === 0 ? 'advance' : 'promote';
    }
    return 'advance';
  }

  async function resolveRun(
    inst: WorkflowInstance,
  ): Promise<WorkflowDefinition> {
    if (inst.definitionId === definition.id) return definition;
    const other = options.definitions?.[inst.definitionId];
    if (other) return other;
    throw new WorkflowEngineError(
      `实例 ${inst.id} 引用的定义 ${inst.definitionId} 不在引擎携带的定义集里（多版本请传 definitions）`,
      'definition-not-found',
    );
  }

  async function requireRunning(
    instanceId: string,
  ): Promise<{ def: WorkflowDefinition; inst: WorkflowInstance }> {
    const inst = await load(instanceId);
    if (inst.status !== 'running') {
      throw new WorkflowEngineError(
        `实例 ${instanceId} 处于 ${inst.status}，不能继续办理`,
        'instance-not-running',
      );
    }
    return { def: await resolveRun(inst), inst };
  }

  async function locateTask(taskId: string): Promise<{
    actorTask: WorkflowTask;
    def: WorkflowDefinition;
    inst: WorkflowInstance;
    tasks: WorkflowTask[];
  }> {
    if (!store.getTaskById) requireStore('getTaskById');
    const owner = await store.getTaskById?.(taskId);
    if (!owner)
      throw new WorkflowEngineError(`任务不存在：${taskId}`, 'task-not-found');
    const { def, inst } = await requireRunning(owner.instanceId);
    const tasks = await loadTasks(inst.id);
    const actorTask = tasks.find((task) => task.id === taskId);
    if (!actorTask)
      throw new WorkflowEngineError(`任务不存在：${taskId}`, 'task-not-found');
    return { actorTask, def, inst, tasks };
  }

  async function finishTask(
    task: WorkflowTask,
    inst: WorkflowInstance,
    def: WorkflowDefinition,
    tasks: WorkflowTask[],
    input: ActionInput,
    action: 'approve' | 'reject' | 'skip',
    rejectTo?: string,
  ): Promise<WorkflowInstance> {
    if (!isOpen(task.status)) {
      throw new WorkflowEngineError(
        `任务 ${task.id} 当前是 ${task.status}，不能重复办理`,
        'task-not-open',
      );
    }
    if (task.status === 'queued') {
      throw new WorkflowEngineError(
        `任务 ${task.id} 还没轮到（顺序会签第 ${task.seq + 1} 位），请先办完前一批`,
        'task-not-activated',
      );
    }
    // 先加签后办（子任务已可办）时父任务被锁；办完再加签的子任务还在排队，不该挡在这里
    const blockingChildren = tasks.filter(
      (item) => item.parentId === task.id && item.status === 'pending',
    );
    if (action !== 'reject' && blockingChildren.length > 0) {
      throw new WorkflowEngineError(
        `任务 ${task.id} 还有待办的前加签（${blockingChildren.map((item) => item.assignee).join('、')}），先让他们办完`,
        'children-unfinished',
      );
    }

    Object.assign(inst.variables, input.variables ?? {});
    task.action = action;
    task.comment = input.comment ?? task.comment;
    task.finishedAt = clock();
    task.status = action === 'skip' ? 'skipped' : 'done';
    await store.saveTasks([task]);
    inst.activeTaskIds = inst.activeTaskIds.filter((id) => id !== task.id);
    emit({
      instanceId: inst.id,
      kind:
        action === 'reject'
          ? 'task.rejected'
          : action === 'skip'
            ? 'task.skipped'
            : 'task.approved',
      task,
    });
    record(
      inst,
      task.nodeId,
      action,
      input.actor ?? task.assignee,
      task.comment,
    );

    if (action === 'reject')
      return routeReject(inst, def, task, tasks, rejectTo);

    /**
     * 加签子任务不参与节点的推进判定 —— 它是父任务借来的帮手，办完只结清自己。
     * 只有"同批加签都办完 **且** 父任务也结清了"才落到下面的节点判定，
     * 否则就会出现"加签人先点同意，流程绕过审批人直接走掉"这种后果很严重的错。
     */
    if (task.parentId) {
      const remaining = tasks.filter(
        (item) =>
          item.parentId === task.parentId &&
          item.id !== task.id &&
          isOpen(item.status),
      );
      const parent = tasks.find((item) => item.id === task.parentId);
      if (remaining.length > 0 || !parent || isOpen(parent.status)) {
        await save(inst);
        return inst;
      }
    }

    // 非阻塞节点（抄送）：只记办理，不参与推进判定
    if (!inst.tokenNodeIds.includes(task.nodeId)) {
      await save(inst);
      return inst;
    }

    // 办完再加签：把排队的子任务提上来，节点继续等着
    const queuedChildren = tasks.filter(
      (item) => item.parentId === task.id && item.status === 'queued',
    );
    if (queuedChildren.length > 0) {
      for (const child of queuedChildren) {
        child.status = 'pending';
        pushActive(inst, child.id);
        emit({ instanceId: inst.id, kind: 'task.activated', task: child });
      }
      await store.saveTasks(queuedChildren);
      await save(inst);
      return inst;
    }

    const siblings = tasks.filter(
      (item) =>
        item.nodeId === task.nodeId &&
        item.id !== task.id &&
        !item.parentId &&
        isOpen(item.status),
    );
    const data = dataOf(nodeById(task.nodeId, def));
    const gate = gateForNode(data.multi, siblings);

    if (gate === 'promote') {
      const batch = Math.max(1, Math.trunc(data.sequentialBatch ?? 1));
      const next = siblings
        .filter((item) => item.status === 'queued')
        .sort((a, b) => a.seq - b.seq)
        .slice(0, batch);
      for (const item of next) {
        item.status = 'pending';
        pushActive(inst, item.id);
        emit({ instanceId: inst.id, kind: 'task.activated', task: item });
      }
      await store.saveTasks(next);
      await save(inst);
      return inst;
    }

    if (gate === 'hold') {
      await save(inst);
      return inst;
    }

    // 'any'（缺省）：一个人办完就算办完，同节点其余待办作废，避免重复轨迹
    const obsolete = siblings.filter(
      (item) => item.status === 'pending' || item.status === 'queued',
    );
    if (
      data.multi !== 'all' &&
      data.multi !== 'sequence' &&
      obsolete.length > 0
    ) {
      for (const item of obsolete) item.status = 'canceled';
      await store.saveTasks(obsolete);
      inst.activeTaskIds = inst.activeTaskIds.filter(
        (id) => !obsolete.some((item) => item.id === id),
      );
    }

    inst.tokenNodeIds = inst.tokenNodeIds.filter((id) => id !== task.nodeId);
    const outcome = await drive(
      inst,
      def,
      outgoing(task.nodeId, def).map((edge) => ({
        from: task.nodeId,
        nodeId: edge.target,
      })),
    );
    await settleOutcome(inst, outcome);
    await save(inst);
    return inst;
  }

  async function routeReject(
    inst: WorkflowInstance,
    def: WorkflowDefinition,
    task: WorkflowTask,
    tasks: WorkflowTask[],
    override?: string,
  ): Promise<WorkflowInstance> {
    const declared =
      override ?? dataOf(nodeById(task.nodeId, def)).rejectTo ?? 'initiator';
    const target = resolveRejectTarget(declared, inst, def, task.nodeId);

    if (target === 'terminate') {
      inst.status = 'rejected';
      inst.tokenNodeIds = [];
      inst.timers = [];
      await cancelOpenTasks(inst, tasks);
      record(
        inst,
        task.nodeId,
        'rejected.terminate',
        task.assignee,
        task.comment,
      );
      emit({ instanceId: inst.id, kind: 'instance.rejected' });
      await save(inst);
      return inst;
    }

    // 实例级回退：驳回取消其它并行分支的待办，只保留回退落点。
    // 需要"分支级驳回"的业务请注册自定义处理器，引擎不在这里猜语义。
    await cancelOpenTasks(
      inst,
      tasks.filter((item) => item.id !== task.id),
    );

    const starts: Array<{ from?: string; nodeId: string }> = [];
    if (target === 'initiator') {
      const startId = entryNode(def);
      if (!startId)
        throw new WorkflowEngineError(
          '定义里没有入口节点，无法退回发起人',
          'no-entry-node',
        );
      await materialize(
        inst,
        [
          {
            assignee: inst.initiator,
            nodeKind: 'approval',
            nodeId: startId,
            seq: 0,
          },
        ],
        'return',
      );
      inst.tokenNodeIds = [...new Set([...inst.tokenNodeIds, startId])];
      record(inst, startId, 'reject.to-initiator', task.assignee, task.comment);
    } else {
      starts.push({ nodeId: target });
      record(inst, target, 'reject.to-node', task.assignee, task.comment);
    }
    inst.trail = inst.trail.filter((id) => id !== target);
    const outcome = await drive(inst, def, starts);
    await settleOutcome(inst, outcome);
    await save(inst);
    return inst;
  }

  function resolveRejectTarget(
    declared: string,
    inst: WorkflowInstance,
    def: WorkflowDefinition,
    currentNodeId: string,
  ): 'initiator' | 'terminate' | string {
    if (declared === 'terminate' || declared === 'initiator') return declared;
    if (declared === 'previous') {
      const previous = inst.trail.filter((id) => id !== currentNodeId).at(-1);
      // 上一个审批节点都没有（第一环就驳回）时退回发起人，比报错友好
      return previous ?? 'initiator';
    }
    // 落点必须真实存在：这里不挡的话，后面会 drive 到一个不存在的节点，报出来的错就没人看得懂了
    if (!nodeById(declared, def)) {
      throw new WorkflowEngineError(
        `驳回落点 ${declared} 不是流程里的节点`,
        'unknown-reject-target',
      );
    }
    return declared;
  }

  const engine: WorkflowEngine = {
    addSign: async (taskId, input) => {
      const { actorTask, inst } = await locateTask(taskId);
      const mode = input.mode ?? 'before';
      const drafts: TaskDraft[] = input.users.map((assignee, index) => ({
        assignee,
        nodeKind: actorTask.nodeKind,
        nodeId: actorTask.nodeId,
        parentId: actorTask.id,
        seq: actorTask.seq + index + 1,
        status: mode === 'before' ? ('pending' as const) : ('queued' as const),
      }));
      const created = await materialize(inst, drafts, `addSign:${mode}`);
      for (const item of created)
        emit({ instanceId: inst.id, kind: 'task.added', task: item });
      record(
        inst,
        actorTask.nodeId,
        'addSign',
        input.actor ?? actorTask.assignee,
        input.comment,
      );
      inst.tokenNodeIds = [
        ...new Set([...inst.tokenNodeIds, actorTask.nodeId]),
      ];
      await save(inst);
      return inst;
    },

    cancel: async (instanceId, input) => {
      const inst = await load(instanceId);
      if (
        inst.status === 'completed' ||
        inst.status === 'rejected' ||
        inst.status === 'canceled'
      ) {
        throw new WorkflowEngineError(
          `实例 ${instanceId} 已结束（${inst.status}）`,
          'instance-not-running',
        );
      }
      inst.status = 'canceled';
      inst.tokenNodeIds = [];
      inst.timers = [];
      await cancelOpenTasks(inst, await loadTasks(instanceId));
      record(inst, SYSTEM_NODE, 'cancel', input?.actor, input?.comment);
      emit({ instanceId: inst.id, kind: 'instance.canceled' });
      await save(inst);
      return inst;
    },

    complete: async (taskId, input) => {
      const found = await locateTask(taskId);
      return finishTask(
        found.actorTask,
        found.inst,
        found.def,
        found.tasks,
        input ?? {},
        'approve',
      );
    },

    definition,

    getInstance: (id) => load(id),

    on: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    reject: async (taskId, input) => {
      const found = await locateTask(taskId);
      return finishTask(
        found.actorTask,
        found.inst,
        found.def,
        found.tasks,
        input ?? {},
        'reject',
        input?.to,
      );
    },

    resume: async (instanceId, input) => {
      const inst = await load(instanceId);
      if (inst.status !== 'suspended') {
        throw new WorkflowEngineError(
          `实例 ${instanceId} 未挂起`,
          'instance-not-suspended',
        );
      }
      inst.status = 'running';
      record(inst, SYSTEM_NODE, 'resume', input?.actor, input?.comment);
      emit({ instanceId: inst.id, kind: 'instance.resumed' });
      await save(inst);
      return inst;
    },

    skip: async (taskId, input) => {
      const found = await locateTask(taskId);
      return finishTask(
        found.actorTask,
        found.inst,
        found.def,
        found.tasks,
        input ?? {},
        'skip',
      );
    },

    start: async (input) => {
      const def = input.definition ?? definition;
      const startId = entryNode(def);
      if (!startId)
        throw new WorkflowEngineError('流程定义没有入口节点', 'no-entry-node');
      const inst = createInstance(def, input);
      await store.saveInstance(inst);
      record(inst, startId, 'start', input.initiator);
      emit({ instanceId: inst.id, kind: 'instance.started' });
      const outcome = await drive(inst, def, [{ nodeId: startId }]);
      await settleOutcome(inst, outcome);
      await save(inst);
      if (outcome.status === 'failed') {
        throw new WorkflowEngineError(
          outcome.reason ?? '流程启动失败',
          'engine-fail',
          inst,
        );
      }
      return inst;
    },

    suspend: async (instanceId, input) => {
      const inst = await load(instanceId);
      if (inst.status !== 'running') {
        throw new WorkflowEngineError(
          `实例 ${instanceId} 处于 ${inst.status}`,
          'instance-not-running',
        );
      }
      inst.status = 'suspended';
      record(inst, SYSTEM_NODE, 'suspend', input?.actor, input?.comment);
      emit({ instanceId: inst.id, kind: 'instance.suspended' });
      await save(inst);
      return inst;
    },

    /**
     * 到钟：先放开到期的定时节点，再跑待办上的超时动作。
     * 重复调用是安全的 —— 提醒靠 `remindedAt` 去重，自动办理靠任务状态机自己挡。
     */
    tasksOf: async (instanceId) => loadTasks(instanceId),

    tick: async (at) => {
      const now = at ?? clock();
      if (!store.runningInstances) requireStore('runningInstances');
      let fired = 0;
      const running = await store.runningInstances?.();
      if (!running) return 0;

      for (const inst of running) {
        let def: WorkflowDefinition;
        try {
          def = await resolveRun(inst);
        } catch {
          continue; // 定义不在本引擎里：交给持有该版本的引擎处理
        }
        const due = (inst.timers ?? []).filter((timer) => timer.dueAt <= now);
        if (due.length > 0) {
          inst.timers = (inst.timers ?? []).filter(
            (timer) => timer.dueAt > now,
          );
          record(inst, SYSTEM_NODE, 'timer.fire');
          // 从定时节点的**出边**继续走，而不是重跑它自己：重跑等于再上一次闹钟，流程永远出不了这个节点
          const starts = due.flatMap((timer) =>
            outgoing(timer.nodeId, def).map((edge) => ({
              from: timer.nodeId,
              nodeId: edge.target,
            })),
          );
          const outcome = await drive(inst, def, starts);
          await settleOutcome(inst, outcome);
          await save(inst);
          fired += due.length;
        }

        const pending = (await loadTasks(inst.id)).filter(
          (task) =>
            isOpen(task.status) &&
            !task.remindedAt &&
            inst.tokenNodeIds.includes(task.nodeId),
        );
        for (const task of pending) {
          const data = dataOf(nodeById(task.nodeId, def));
          if (!data.timeoutMs || task.createdAt + data.timeoutMs > now)
            continue;
          task.remindedAt = now;
          await store.saveTasks([task]);
          emit({ instanceId: inst.id, kind: 'task.timeout', task });
          fired += 1;
          const action = data.timeoutAction ?? 'remind';
          if (action === 'remind') continue;
          // 自动动作走正常办理路径，保证历史与推进判定和人工完全一致
          const fresh = await locateTask(task.id);
          await finishTask(
            fresh.actorTask,
            fresh.inst,
            fresh.def,
            fresh.tasks,
            {
              actor: 'system',
              comment:
                action === 'approve' ? '[超时自动通过]' : '[超时自动驳回]',
            },
            action,
          );
        }
      }
      return fired;
    },

    transfer: async (taskId, input) => {
      const { actorTask, inst } = await locateTask(taskId);
      const from = actorTask.assignee;
      actorTask.assignee = input.to;
      actorTask.transferredFrom = from;
      actorTask.comment = input.comment ?? actorTask.comment;
      await store.saveTasks([actorTask]);
      emit({ instanceId: inst.id, kind: 'task.transferred', task: actorTask });
      record(
        inst,
        actorTask.nodeId,
        'transfer',
        input.actor ?? from,
        `${from} → ${input.to}`,
      );
      await save(inst);
      return inst;
    },

    withdraw: async (instanceId, input) => {
      const inst = await load(instanceId);
      if (inst.status !== 'running') {
        throw new WorkflowEngineError(
          `实例 ${instanceId} 处于 ${inst.status}，不能撤回`,
          'instance-not-running',
        );
      }
      const tasks = await loadTasks(instanceId);
      if (
        tasks.some(
          (task) => task.status === 'done' || task.status === 'skipped',
        )
      ) {
        throw new WorkflowEngineError(
          '已有审批人办理，不能撤回；请走驳回',
          'already-acted',
        );
      }
      inst.status = 'canceled';
      inst.tokenNodeIds = [];
      inst.timers = [];
      await cancelOpenTasks(inst, tasks);
      record(
        inst,
        SYSTEM_NODE,
        'withdraw',
        input?.actor ?? inst.initiator,
        input?.comment,
      );
      emit({ instanceId: inst.id, kind: 'instance.canceled' });
      await save(inst);
      return inst;
    },
  };

  return engine;
}

export interface DriveOutcome {
  reason?: string;
  status: 'failed' | 'finished' | 'parked';
}

export class WorkflowEngineError extends Error {
  readonly code: string;
  readonly instance?: WorkflowInstance;

  constructor(message: string, code: string, instance?: WorkflowInstance) {
    super(message);
    this.code = code;
    this.name = 'WorkflowEngineError';
    this.instance = instance;
  }
}

export type WorkflowIssueCode =
  | 'dangling-branch'
  | 'no-handler'
  | 'unknown-reject-target'
  | GraphIssue['code'];

export interface WorkflowIssue extends Omit<GraphIssue, 'code'> {
  code: WorkflowIssueCode;
}

/**
 * 定义期校验：graph 的通用检查 + 工作流特有的三条。
 *
 * 与引擎的分工是"能在打开设计器时就发现的错，不该等到有人点提交才炸"，
 * 所以这里查的是引用完整性（分支指向、rejectTo 落点、处理器是否注册），
 * 运行时仍然会再判一次，因为定义可能来自不受控的存储。
 */
export function validateWorkflowDefinition(
  def: WorkflowDefinition,
  registry = createNodeHandlerRegistry(),
): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];
  for (const issue of validateGraph(def)) {
    // 工作流允许"驳回回溯"这种刻意的环，graph 报成 error 对我们太硬，降为 warning
    issues.push(
      issue.code === 'cycle' ? { ...issue, level: 'warning' } : issue,
    );
  }
  for (const node of def.nodes) {
    const data = dataOfStatic(node);
    if (!registry.has(node.type)) {
      issues.push({
        code: 'no-handler',
        level: 'error',
        message: `节点 "${node.label ?? node.id}" 的类型 "${node.type}" 没有注册处理器`,
        nodeIds: [node.id],
      });
    }
    for (const branch of data.branches ?? []) {
      const edge = def.edges.find((item) => item.id === branch.edgeId);
      if (!edge || edge.source !== node.id) {
        issues.push({
          code: 'dangling-branch',
          edgeIds: [branch.edgeId],
          level: 'error',
          message: `节点 "${node.label ?? node.id}" 的分支指向了不存在或非本节点出发的边 ${branch.edgeId}`,
          nodeIds: [node.id],
        });
      }
    }
    if (
      data.defaultEdgeId &&
      !def.edges.some((edge) => edge.id === data.defaultEdgeId)
    ) {
      issues.push({
        code: 'dangling-branch',
        edgeIds: [data.defaultEdgeId],
        level: 'error',
        message: `节点 "${node.label ?? node.id}" 的默认分支 ${data.defaultEdgeId} 不存在`,
        nodeIds: [node.id],
      });
    }
    const target = data.rejectTo;
    if (
      target &&
      !['initiator', 'previous', 'terminate'].includes(target) &&
      !def.nodes.some((item) => item.id === target)
    ) {
      issues.push({
        code: 'unknown-reject-target',
        level: 'error',
        message: `节点 "${node.label ?? node.id}" 的 rejectTo 指向了不存在的节点 ${target}`,
        nodeIds: [node.id],
      });
    }
  }
  return issues;
}

function dataOfStatic(node: { data?: WorkflowNodeData }): WorkflowNodeData {
  return (node.data ?? {}) as WorkflowNodeData;
}
