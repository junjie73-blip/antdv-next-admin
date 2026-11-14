import type {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowStoreAdapter,
  WorkflowTask,
} from '../../src/workflow/core/types';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import {
  createWorkflowEngine,
  OPEN_TASK_STATUSES,
  useWorkflow,
  useWorkflowTasks,
} from '../../src/workflow/index';

/**
 * composable 层的口径：它们是视图与引擎之间唯一的接缝，
 * 负责「命令式异步 → 响应式状态」的翻译。所以测试只盯三件事：
 * 动作之后状态自动刷新、动作期间 busy 为真、引擎抛错时 errorText 有可读信息。
 * 引擎本身的推进规则由 engine.test.ts 负责，这里不重复证明。
 */

const definition: WorkflowDefinition = {
  edges: [
    { id: 'e1', source: 's', target: 'a' },
    { id: 'e2', source: 'a', target: 'b' },
    { id: 'e3', source: 'b', target: 'e' },
  ],
  id: 'flow-demo',
  name: '两级审批',
  nodes: [
    { id: 's', type: 'start' },
    {
      data: { assignees: [{ params: { userIds: ['u1'] }, strategy: 'user' }] },
      id: 'a',
      type: 'approval',
    },
    {
      data: { assignees: [{ params: { userIds: ['u2'] }, strategy: 'user' }] },
      id: 'b',
      type: 'approval',
    },
    { id: 'e', type: 'end' },
  ],
  version: 1,
};

let clock = 1000;

function makeEngine(extra: Record<string, unknown> = {}) {
  clock = 1000;
  return createWorkflowEngine({ definition, now: () => clock, ...extra });
}

/** 把 composable 挂进一个测试组件，返回它的 setup 返回值 */
function withSetup<T>(factory: () => T) {
  let result!: T;
  const Probe = defineComponent({
    setup() {
      result = factory();
      return () => h('div');
    },
  });
  const wrapper = mount(Probe);
  return { result, wrapper };
}

describe('useWorkflow', () => {
  it('start 之后实例与待办自动就位，动作完成后状态跟着刷新', async () => {
    const engine = makeEngine();
    const { result } = withSetup(() => useWorkflow({ engine }));
    expect(result.instance.value).toBeUndefined();

    await result.start({ initiator: 'boss', variables: { amount: 100 } });
    await flushPromises();
    expect(result.instance.value?.status).toBe('running');
    expect(
      result.tasks.value.filter((task) => task.status === 'pending'),
    ).toHaveLength(1);

    const first = result.tasks.value.find(
      (task) => task.status === 'pending',
    ) as WorkflowTask;
    await result.complete(first.id, { actor: 'u1', comment: '同意' });
    await flushPromises();
    // 不用手动 refresh：第二环的待办已经换人了
    const pending = result.tasks.value.filter(
      (task) => task.status === 'pending',
    );
    expect(pending.map((task) => task.assignee)).toEqual(['u2']);
  });

  it('动作期间 busy 为真，结束后回落', async () => {
    const engine = makeEngine();
    const { result } = withSetup(() => useWorkflow({ engine }));
    const pending = result.start({ initiator: 'boss' });
    expect(result.busy.value).toBe(true);
    await pending;
    expect(result.busy.value).toBe(false);
  });

  it('引擎报错时写 errorText 并回调 onError，不静默吞掉', async () => {
    const engine = makeEngine();
    const inst = await engine.start({ initiator: 'boss' });
    const onError = vi.fn();
    const { result } = withSetup(() =>
      useWorkflow({ engine, instanceId: inst.id, onError }),
    );
    await flushPromises();
    const task = result.tasks.value.find(
      (item) => item.status === 'pending',
    ) as WorkflowTask;
    await expect(
      result.reject(task.id, { to: 'not-a-node' }),
    ).rejects.toThrow();
    expect(result.errorText.value).toContain('not-a-node');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('实例级动作缺 id 时报错而不是 no-op', async () => {
    const engine = makeEngine();
    const { result } = withSetup(() => useWorkflow({ engine }));
    await expect(result.suspend()).rejects.toThrow(/还没有实例 id/u);
    await expect(result.cancel()).rejects.toThrow(/还没有实例 id/u);
  });

  it('transfer / addSign / suspend+resume / skip 都走引擎并刷新', async () => {
    const engine = makeEngine();
    const inst = await engine.start({ initiator: 'boss' });
    const { result } = withSetup(() =>
      useWorkflow({ engine, instanceId: inst.id }),
    );
    await flushPromises();
    const task = () =>
      result.tasks.value.find(
        (item) => item.status === 'pending',
      ) as WorkflowTask;

    await result.transfer(task().id, { actor: 'u1', to: 'u9' });
    expect(task().assignee).toBe('u9');

    await result.suspend();
    expect(result.instance.value?.status).toBe('suspended');
    await result.resume();
    expect(result.instance.value?.status).toBe('running');

    const parent = task();
    await result.addSign(parent.id, {
      actor: 'u9',
      mode: 'before',
      users: ['u8'],
    });
    const child = result.tasks.value.find(
      (item) => item.parentId === parent.id,
    ) as WorkflowTask;
    expect(child).toBeTruthy();
    expect(child.assignee).toBe('u8');
    // 前加签的次序由引擎保证：先办子任务，父任务才回到可办状态
    await result.complete(child.id, { actor: 'u8', comment: '加签意见' });
    await result.complete(parent.id, { actor: 'u9' });

    const second = result.tasks.value.find(
      (item) => item.nodeId === 'b',
    ) as WorkflowTask;
    await result.skip(second.id, {
      actor: 'admin',
      comment: '已在别的系统处理',
    });
    await flushPromises();
    expect((await engine.getInstance(inst.id))?.status).toBe('completed');
    expect(result.instance.value?.status).toBe('completed');
  });

  it('withdraw 只在没人办过时成立，办完后由引擎给可读错误', async () => {
    const engine = makeEngine();
    const { result } = withSetup(() => useWorkflow({ engine }));
    await result.start({ initiator: 'boss' });
    const task = result.tasks.value.find(
      (item) => item.status === 'pending',
    ) as WorkflowTask;
    await result.complete(task.id, { actor: 'u1' });
    await expect(result.withdraw()).rejects.toThrow(/不能撤回/u);
    expect(result.errorText.value).toContain('不能撤回');
  });

  it('tick 返回这次放开的事件数，并把当前实例刷进状态', async () => {
    const timerDef: WorkflowDefinition = {
      edges: [
        { id: 'e1', source: 's', target: 't' },
        { id: 'e2', source: 't', target: 'e' },
      ],
      id: 'flow-timer',
      name: '定时演示',
      nodes: [
        { id: 's', type: 'start' },
        { data: { timeoutMs: 5000 }, id: 't', type: 'timer' },
        { id: 'e', type: 'end' },
      ],
      version: 1,
    };
    const engine = createWorkflowEngine({
      definition: timerDef,
      now: () => clock,
    });
    clock = 1000;
    const { result } = withSetup(() => useWorkflow({ engine }));
    await result.start({ initiator: 'boss' });
    expect(result.instance.value?.tokenNodeIds).toEqual(['t']);
    clock = 7000;
    expect(await result.tick()).toBe(1);
    expect(result.instance.value?.status).toBe('completed');
  });

  it('start 把草稿定义透传给引擎 —— 设计器改出来的流程要能直接发起', async () => {
    const draft: WorkflowDefinition = {
      ...structuredClone(definition),
      id: 'flow-draft',
      version: 2,
    };
    const engine = makeEngine({ definitions: { 'flow-draft': draft } });
    const { result } = withSetup(() => useWorkflow({ engine }));
    await result.start({ definition: draft, initiator: 'boss' });
    await flushPromises();
    // 只证明 composable 没把 StartInput.definition 吃掉；推进语义由 engine.test.ts 负责
    expect(result.instance.value?.definitionId).toBe('flow-draft');
    expect(result.instance.value?.status).toBe('running');
  });
});

describe('useWorkflowTasks', () => {
  function seed(): WorkflowTask[] {
    return [
      {
        assignee: 'u1',
        createdAt: 3,
        id: 'tk-3',
        instanceId: 'ins-1',
        nodeKind: 'approval',
        nodeId: 'b',
        seq: 0,
        status: 'pending',
      },
      {
        assignee: 'u1',
        createdAt: 2,
        id: 'tk-2',
        instanceId: 'ins-1',
        nodeKind: 'approval',
        nodeId: 'a',
        seq: 0,
        status: 'queued',
      },
      {
        assignee: 'u2',
        createdAt: 1,
        id: 'tk-1',
        instanceId: 'ins-1',
        nodeKind: 'approval',
        nodeId: 'a',
        seq: 1,
        status: 'pending',
      },
      {
        assignee: 'u1',
        createdAt: 4,
        finishedAt: 9,
        id: 'tk-4',
        instanceId: 'ins-2',
        nodeKind: 'approval',
        nodeId: 'a',
        seq: 0,
        status: 'done',
      },
    ];
  }

  it('按办理人与状态筛选，rawItems 保留全量', async () => {
    const assignee = ref('u1');
    const { result } = withSetup(() =>
      useWorkflowTasks({
        assignee,
        load: () => seed(),
        statuses: OPEN_TASK_STATUSES,
      }),
    );
    await flushPromises();
    expect(result.items.value.map((task) => task.id)).toEqual(['tk-3', 'tk-2']);
    expect(result.rawItems.value).toHaveLength(4);
    expect(result.total.value).toBe(2);

    assignee.value = 'u2';
    await flushPromises();
    expect(result.items.value.map((task) => task.id)).toEqual(['tk-1']);
  });

  it('分页：pageSize 生效时 items 只给当前页，totalPages 由筛选后的条数算', async () => {
    const { result } = withSetup(() =>
      useWorkflowTasks({
        load: () => seed(),
        pageSize: 1,
        statuses: OPEN_TASK_STATUSES,
      }),
    );
    await flushPromises();
    expect(result.items.value.map((task) => task.id)).toEqual(['tk-3']);
    expect(result.total.value).toBe(3);
    expect(result.totalPages.value).toBe(3);
    result.page.value = 3;
    await flushPromises();
    expect(result.items.value.map((task) => task.id)).toEqual(['tk-1']);
  });

  it('refresh 会重新取数，pollMs 到点自动取一次', async () => {
    vi.useFakeTimers();
    try {
      let version = 0;
      const load = vi.fn(() =>
        seed().map((task) => ({ ...task, id: `${task.id}@${version}` })),
      );
      const { result } = withSetup(() =>
        useWorkflowTasks({ load, pollMs: 1000 }),
      );
      await flushPromises();
      expect(load).toHaveBeenCalledTimes(1);
      version = 1;
      await result.refresh();
      expect(load).toHaveBeenCalledTimes(2);
      expect(result.items.value[0]?.id).toContain('@1');
      version = 2;
      await vi.advanceTimersByTimeAsync(1000);
      expect(load).toHaveBeenCalledTimes(3);
      expect(result.items.value[0]?.id).toContain('@2');
    } finally {
      vi.useRealTimers();
    }
  });

  it('load 抛错时记进 error/errorText，成功后清掉，不留下未处理的 rejection', async () => {
    let failing = true;
    const onError = vi.fn();
    const { result } = withSetup(() =>
      useWorkflowTasks({
        load: () => (failing ? Promise.reject(new Error('接口 500')) : seed()),
        onError,
      }),
    );
    await flushPromises();
    expect(await result.refresh()).toBe(false);
    expect(result.loading.value).toBe(false);
    expect(result.errorText.value).toBe('接口 500');
    expect(result.items.value).toEqual([]);
    // 一次来自初始加载，一次来自上面这次显式 refresh：两次都记账、都不抛出
    expect(onError).toHaveBeenCalledTimes(2);

    // 成功后错误记录必须清掉，否则页面会一直挂着上一次的失败提示
    failing = false;
    expect(await result.refresh()).toBe(true);
    expect(result.error.value).toBeUndefined();
    expect(result.errorText.value).toBeUndefined();
    expect(result.items.value).toHaveLength(4);
  });
});

describe('store 与引擎的配合', () => {
  /**
   * 这里手写一份宿主侧适配器，而不是把内存 store 展开再改两个方法：
   * 展开写法里可选方法的返回类型会退化成 `T | Promise<T>`，看着别扭，
   * 也正说明接宿主的适配器应当把签名写清楚。顺带把「读走快照、写走快照」
   * 这套真实库的语义演一遍 —— 引擎和测试拿的是同一批对象引用，
   * 不做快照的话改一下 `instance.status` 就能"证明"流程推进了。
   */
  function makeHostStore() {
    const instances = new Map<string, WorkflowInstance>();
    const tasks = new Map<string, WorkflowTask[]>();
    const savedInstanceIds: string[] = [];
    const savedTaskBatches: number[] = [];
    const runningScans: number[] = [];

    const store: WorkflowStoreAdapter = {
      // 办理/转办/加签只带 taskId，靠这张反查表找到归属实例
      getTaskById: (id) => {
        for (const list of tasks.values()) {
          const found = list.find((task) => task.id === id);
          if (found) return structuredClone(found);
        }
        return undefined;
      },
      getInstance: (id) => {
        const found = instances.get(id);
        return found ? structuredClone(found) : undefined;
      },
      runningInstances: () => {
        const running = [...instances.values()].filter(
          (item) => item.status === 'running',
        );
        runningScans.push(running.length);
        return running.map((item) => structuredClone(item));
      },
      saveInstance: (instance) => {
        savedInstanceIds.push(instance.id);
        instances.set(instance.id, structuredClone(instance));
      },
      saveTasks: (next) => {
        savedTaskBatches.push(next.length);
        for (const task of next) {
          const list = tasks.get(task.instanceId) ?? [];
          const index = list.findIndex((item) => item.id === task.id);
          const snapshot = structuredClone(task);
          if (index === -1) list.push(snapshot);
          else list[index] = snapshot;
          tasks.set(task.instanceId, list);
        }
      },
      tasksOf: (instanceId) =>
        (tasks.get(instanceId) ?? []).map((task) => structuredClone(task)),
    };

    return { runningScans, savedInstanceIds, savedTaskBatches, store };
  }

  const pendingAssignees = async (
    engine: ReturnType<typeof makeEngine>,
    id: string,
  ) =>
    (await engine.tasksOf(id))
      .filter((task) => task.status === 'pending')
      .map((task) => task.assignee);

  it('注入自定义 store 时，实例与任务都落到宿主那侧', async () => {
    const host = makeHostStore();
    const engine = makeEngine({ store: host.store });

    const inst = await engine.start({ initiator: 'boss' });
    expect(host.savedInstanceIds).toContain(inst.id);
    expect(host.savedTaskBatches.length).toBeGreaterThan(0);
    expect(await pendingAssignees(engine, inst.id)).toEqual(['u1']);

    const first = (await engine.tasksOf(inst.id)).find(
      (task) => task.status === 'pending',
    ) as WorkflowTask;
    await engine.complete(first.id, { actor: 'u1', comment: '同意' });
    // 第二环的待办是从宿主读出来的，说明 saveTasks 真的写进去了
    expect(await pendingAssignees(engine, inst.id)).toEqual(['u2']);
    expect((await engine.getInstance(inst.id))?.status).toBe('running');

    // 定时扫描走宿主的 runningInstances，引擎不自己翻表
    expect(await engine.tick(clock + 5000)).toBe(0);
    expect(host.runningScans.at(-1)).toBe(1);
  });

  it('宿主读出来的是副本：改返回值污染不了已落库的数据', async () => {
    const host = makeHostStore();
    const engine = makeEngine({ store: host.store });

    const inst = await engine.start({ initiator: 'boss' });
    const read = await engine.getInstance(inst.id);
    expect(read).toBeDefined();
    read!.status = 'suspended';

    expect((await engine.getInstance(inst.id))?.status).toBe('running');
  });
});
