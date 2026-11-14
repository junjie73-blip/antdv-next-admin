import type { GraphEdge } from '@antdv/graph';

import type {
  EngineOptions,
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowNodeData,
  WorkflowTask,
} from '../../src/workflow/core/types';

import { describe, expect, it, vi } from 'vitest';

import {
  createNodeHandlerRegistry,
  createWorkflowEngine,
  SYSTEM_NODE,
  validateWorkflowDefinition,
  WorkflowEngineError,
} from '../../src/workflow/index';

/**
 * 测试口径：时钟与 id 都是确定的（`now()` 返回可推进的计数器、引擎默认 id 生成器按序自增），
 * 所以断言可以精确到 `tk-3`；换成 Date.now/random 后这些断言会变成"看起来稳定"的 flaky。
 */

let clock = 1000;
const now = () => clock;
function advance(ms: number) {
  clock += ms;
}

function node(id: string, type: string, data?: WorkflowNodeData) {
  return { id, label: id, position: { x: 0, y: 0 }, type, data };
}

function edge(id: string, source: string, target: string): GraphEdge {
  return { id, source, target };
}

function def(
  nodes: WorkflowDefinition['nodes'],
  edges: WorkflowDefinition['edges'],
): WorkflowDefinition {
  return {
    edges,
    id: `flow-${Math.random().toString(36).slice(2, 8)}`,
    name: '测试流程',
    nodes,
    version: 1,
  };
}

function assignees(...ids: string[]): WorkflowNodeData {
  return {
    assignees: ids.map((id) => ({
      params: { userIds: [id] },
      strategy: 'user',
    })),
  };
}

function makeEngine(
  definition: WorkflowDefinition,
  extra: Partial<EngineOptions> = {},
) {
  clock = 1000;
  return createWorkflowEngine({ definition, now, ...extra });
}

async function tasksOf(
  engine: ReturnType<typeof makeEngine>,
  inst: WorkflowInstance,
) {
  return await engine.tasksOf(inst.id);
}

async function pendingOf(
  engine: ReturnType<typeof makeEngine>,
  inst: WorkflowInstance,
) {
  return (await tasksOf(engine, inst)).filter(
    (task) => task.status === 'pending',
  );
}

describe('直线审批', () => {
  it('发起后停在第一个审批节点，逐个办完走到结束', async () => {
    const definition = def(
      [
        node('s', 'start'),
        node('a', 'approval', assignees('u1')),
        node('b', 'approval', assignees('u2')),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'a'), edge('e2', 'a', 'b'), edge('e3', 'b', 'e')],
    );
    const engine = makeEngine(definition);
    const events: string[] = [];
    engine.on((event) => events.push(event.kind));

    const inst = await engine.start({ initiator: 'boss' });
    expect(inst.status).toBe('running');
    let opened = await pendingOf(engine, inst);
    expect(opened).toHaveLength(1);
    expect(opened[0]?.assignee).toBe('u1');

    // 存储里的游标确实落在 a：不是"看起来在等"，而是 tokenNodeIds 写进去了
    const stored = await engine.getInstance(inst.id);
    expect(stored?.tokenNodeIds).toEqual(['a']);

    opened = await pendingOf(engine, inst);
    await engine.complete((opened[0] as WorkflowTask).id);
    opened = await pendingOf(engine, inst);
    expect(opened.map((task) => task.assignee)).toEqual(['u2']);

    await engine.complete((opened[0] as WorkflowTask).id);
    const done = await engine.getInstance(inst.id);
    expect(done?.status).toBe('completed');
    expect(done?.tokenNodeIds).toEqual([]);
    expect(events).toContain('instance.completed');
    expect(events.filter((kind) => kind === 'task.created')).toHaveLength(2);
  });

  it('办理意见与变量写回会进历史与实例', async () => {
    const definition = def(
      [
        node('s', 'start'),
        node('a', 'approval', assignees('u1')),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'a'), edge('e2', 'a', 'e')],
    );
    const engine = makeEngine(definition);
    const inst = await engine.start({ initiator: 'boss' });
    const task = (await pendingOf(engine, inst))[0] as WorkflowTask;
    await engine.complete(task.id, {
      comment: '同意，注意预算',
      variables: { budget: 800 },
    });
    const done = await engine.getInstance(inst.id);
    expect(done?.variables.budget).toBe(800);
    expect(
      done?.history.some((item) => item.comment === '同意，注意预算'),
    ).toBe(true);
  });

  it('重复办理同一个任务会报明确错误', async () => {
    const definition = def(
      [
        node('s', 'start'),
        node('a', 'approval', { ...assignees('u1', 'u2'), multi: 'all' }),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'a'), edge('e2', 'a', 'e')],
    );
    const engine = makeEngine(definition);
    const inst = await engine.start({ initiator: 'boss' });
    const task = (await pendingOf(engine, inst))[0] as WorkflowTask;
    await engine.complete(task.id);
    // 另一个人还没办，实例仍是 running，所以这里踩到的是"任务级"的重复办理守卫
    expect((await engine.getInstance(inst.id))?.status).toBe('running');
    await expect(engine.complete(task.id)).rejects.toThrow(/不能重复办理/u);
  });

  it('实例已经结束时再办理，报的是实例状态而不是任务状态', async () => {
    const definition = def(
      [
        node('s', 'start'),
        node('a', 'approval', assignees('u1')),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'a'), edge('e2', 'a', 'e')],
    );
    const engine = makeEngine(definition);
    const inst = await engine.start({ initiator: 'boss' });
    const task = (await pendingOf(engine, inst))[0] as WorkflowTask;
    await engine.complete(task.id);
    await expect(engine.complete(task.id)).rejects.toThrow(
      /处于 completed，不能继续办理/u,
    );
  });
});

describe('条件网关', () => {
  function branchDefinition() {
    return def(
      [
        node('s', 'start'),
        node('c', 'condition', {
          branches: [
            { edgeId: 'big', expression: 'amount >= 10000' },
            { edgeId: 'small', expression: 'amount < 10000' },
          ],
          defaultEdgeId: 'small',
        }),
        node('boss', 'approval', assignees('ceo')),
        node('lead', 'approval', assignees('lead1')),
        node('e', 'end'),
      ],
      [
        edge('e0', 's', 'c'),
        edge('big', 'c', 'boss'),
        edge('small', 'c', 'lead'),
        edge('e2', 'boss', 'e'),
        edge('e3', 'lead', 'e'),
      ],
    );
  }

  it('按声明顺序取第一条命中的分支', async () => {
    const engine = makeEngine(branchDefinition());
    const inst = await engine.start({
      initiator: 'staff',
      variables: { amount: 50_000 },
    });
    expect(
      (await pendingOf(engine, inst)).map((task) => task.assignee),
    ).toEqual(['ceo']);
  });

  it('不命中大额的分支时走小额分支', async () => {
    const engine = makeEngine(branchDefinition());
    const inst = await engine.start({
      initiator: 'staff',
      variables: { amount: 50 },
    });
    expect(
      (await pendingOf(engine, inst)).map((task) => task.assignee),
    ).toEqual(['lead1']);
  });

  it('全不命中且没配默认分支时按出边顺序走，不报错', async () => {
    const definition = def(
      [
        node('s', 'start'),
        node('c', 'condition', {
          branches: [{ edgeId: 'x', expression: 'flag == true' }],
        }),
        node('a', 'approval', assignees('u1')),
        node('e', 'end'),
      ],
      [edge('e0', 's', 'c'), edge('x', 'c', 'a'), edge('e1', 'a', 'e')],
    );
    const engine = makeEngine(definition);
    const inst = await engine.start({
      initiator: 'staff',
      variables: { flag: false },
    });
    expect(
      (await pendingOf(engine, inst)).map((task) => task.assignee),
    ).toEqual(['u1']);
  });

  it('表达式语法错误落成 failed，而不是留下一个既不在跑也没结束的实例', async () => {
    const definition = def(
      [
        node('s', 'start'),
        node('c', 'condition', {
          branches: [{ edgeId: 'x', expression: 'amount >>>' }],
        }),
        node('a', 'approval', assignees('u1')),
        node('e', 'end'),
      ],
      [edge('e0', 's', 'c'), edge('x', 'c', 'a'), edge('e1', 'a', 'e')],
    );
    const engine = makeEngine(definition);
    const events: string[] = [];
    engine.on((event) => events.push(event.kind));
    await expect(
      engine.start({ initiator: 'staff', variables: { amount: 1 } }),
    ).rejects.toThrow(WorkflowEngineError);
    const stored = await engine.getInstance('ins-1');
    expect(stored?.status).toBe('failed');
    expect(events).toContain('instance.failed');
  });
});

describe('多人节点', () => {
  function multiDefinition(mode: 'all' | 'any' | 'sequence', batch?: number) {
    return def(
      [
        node('s', 'start'),
        node('m', 'approval', {
          ...assignees('u1', 'u2', 'u3'),
          multi: mode,
          sequentialBatch: batch,
        }),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'm'), edge('e2', 'm', 'e')],
    );
  }

  it('或签：一个人办完就走，其余待办作废', async () => {
    const engine = makeEngine(multiDefinition('any'));
    const inst = await engine.start({ initiator: 'boss' });
    const all = await tasksOf(engine, inst);
    expect(all).toHaveLength(3);
    await engine.complete((all[0] as WorkflowTask).id);
    const after = await engine.getInstance(inst.id);
    expect(after?.status).toBe('completed');
    const rest = await tasksOf(engine, inst);
    expect(rest.filter((task) => task.status === 'canceled')).toHaveLength(2);
  });

  it('会签：全部办完才推进，中途仍然 running', async () => {
    const engine = makeEngine(multiDefinition('all'));
    const inst = await engine.start({ initiator: 'boss' });
    const all = await tasksOf(engine, inst);
    await engine.complete((all[0] as WorkflowTask).id);
    expect((await engine.getInstance(inst.id))?.status).toBe('running');
    await engine.complete((all[1] as WorkflowTask).id);
    expect((await engine.getInstance(inst.id))?.status).toBe('running');
    await engine.complete((all[2] as WorkflowTask).id);
    expect((await engine.getInstance(inst.id))?.status).toBe('completed');
  });

  it('顺序会签：未轮到的是 queued，一批办完自动提下一批', async () => {
    const engine = makeEngine(multiDefinition('sequence', 1));
    const inst = await engine.start({ initiator: 'boss' });
    const all = await tasksOf(engine, inst);
    expect(all.map((task) => task.status)).toEqual([
      'pending',
      'queued',
      'queued',
    ]);
    await engine.complete((all[0] as WorkflowTask).id);
    expect((await tasksOf(engine, inst))[1]?.status).toBe('pending');
    // 还没轮到的人此时办理会被拒
    await expect(engine.complete((all[2] as WorkflowTask).id)).rejects.toThrow(
      /不能重复办理|还没轮到/u,
    );
    await engine.complete((all[1] as WorkflowTask).id);
    await engine.complete((await pendingOf(engine, inst))[0]!.id);
    expect((await engine.getInstance(inst.id))?.status).toBe('completed');
  });

  it('顺序会签批量为 2 时一次激活两条', async () => {
    const engine = makeEngine(multiDefinition('sequence', 2));
    const inst = await engine.start({ initiator: 'boss' });
    expect((await tasksOf(engine, inst)).map((task) => task.status)).toEqual([
      'pending',
      'pending',
      'queued',
    ]);
  });

  it('跳过一个人不影响会签计数（skipped 也算办完）', async () => {
    const engine = makeEngine(multiDefinition('all'));
    const inst = await engine.start({ initiator: 'boss' });
    const all = await tasksOf(engine, inst);
    await engine.skip((all[0] as WorkflowTask).id);
    await engine.skip((all[1] as WorkflowTask).id);
    await engine.complete((all[2] as WorkflowTask).id);
    expect((await engine.getInstance(inst.id))?.status).toBe('completed');
  });
});

describe('转办与加签', () => {
  const base = () =>
    def(
      [
        node('s', 'start'),
        node('a', 'approval', assignees('u1')),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'a'), edge('e2', 'a', 'e')],
    );

  it('转办换了办理人但节点不换，原办理人留在审计字段里', async () => {
    const engine = makeEngine(base());
    const inst = await engine.start({ initiator: 'boss' });
    const task = (await pendingOf(engine, inst))[0] as WorkflowTask;
    await engine.transfer(task.id, { to: 'u9', comment: '出差' });
    const after = await tasksOf(engine, inst);
    expect(after).toHaveLength(1);
    expect(after[0]?.assignee).toBe('u9');
    expect(after[0]?.transferredFrom).toBe('u1');
    expect(after[0]?.status).toBe('pending');
    await engine.complete(task.id, { actor: 'u9' });
    expect((await engine.getInstance(inst.id))?.status).toBe('completed');
  });

  it('前加签没办完之前父任务办不了', async () => {
    const engine = makeEngine(base());
    const inst = await engine.start({ initiator: 'boss' });
    const parent = (await pendingOf(engine, inst))[0] as WorkflowTask;
    await engine.addSign(parent.id, { users: ['u2', 'u3'], mode: 'before' });
    await expect(engine.complete(parent.id)).rejects.toThrow(/前加签/u);
    const list = await tasksOf(engine, inst);
    const children = list.filter((task) => task.parentId === parent.id);
    expect(children).toHaveLength(2);
    for (const child of children) await engine.complete(child.id);
    await engine.complete(parent.id);
    expect((await engine.getInstance(inst.id))?.status).toBe('completed');
  });

  it('后加签在父任务办完后被激活，且流程仍停在本节点等他们', async () => {
    const engine = makeEngine(base());
    const inst = await engine.start({ initiator: 'boss' });
    const parent = (await pendingOf(engine, inst))[0] as WorkflowTask;
    await engine.addSign(parent.id, { users: ['u5'], mode: 'after' });
    const list = await tasksOf(engine, inst);
    const child = list.find(
      (task) => task.parentId === parent.id,
    ) as WorkflowTask;
    expect(child.status).toBe('queued');
    await engine.complete(parent.id);
    expect((await engine.getInstance(inst.id))?.status).toBe('running');
    expect(
      (await tasksOf(engine, inst)).find((task) => task.id === child.id)
        ?.status,
    ).toBe('pending');
    await engine.complete(child.id);
    expect((await engine.getInstance(inst.id))?.status).toBe('completed');
  });
});

describe('驳回', () => {
  const chain = (data: WorkflowNodeData = {}) =>
    def(
      [
        node('s', 'start'),
        node('a', 'approval', { ...assignees('u1'), ...data }),
        node('b', 'approval', assignees('u2')),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'a'), edge('e2', 'a', 'b'), edge('e3', 'b', 'e')],
    );

  it('缺省驳回即终止：实例 rejected，待办全部作废', async () => {
    const engine = makeEngine(chain({ rejectTo: 'terminate' }));
    const inst = await engine.start({ initiator: 'boss' });
    const task = (await pendingOf(engine, inst))[0] as WorkflowTask;
    await engine.reject(task.id, { comment: '材料不全' });
    const done = await engine.getInstance(inst.id);
    expect(done?.status).toBe('rejected');
    expect(
      (await tasksOf(engine, inst)).every(
        (item) => !['pending', 'queued'].includes(item.status),
      ),
    ).toBe(true);
  });

  it('驳回到发起人：在入口节点生成一条发起人待办，重新提交后继续向前', async () => {
    const engine = makeEngine(chain());
    const inst = await engine.start({ initiator: 'boss' });
    const task = (await pendingOf(engine, inst))[0] as WorkflowTask;
    await engine.reject(task.id, { to: 'initiator', comment: '金额写错' });
    const running = await engine.getInstance(inst.id);
    expect(running?.status).toBe('running');
    const todo = (
      await pendingOf(engine, running as WorkflowInstance)
    )[0] as WorkflowTask;
    expect(todo.assignee).toBe('boss');
    expect(todo.nodeId).toBe('s');
    await engine.complete(todo.id, { variables: { amount: 2 } });
    const next = await pendingOf(engine, running as WorkflowInstance);
    expect(next.map((item) => item.assignee)).toEqual(['u1']);
  });

  it('驳回到上一节点：靠 trail 回溯，第二环驳回回到第一环', async () => {
    const engine = makeEngine(chain());
    const inst = await engine.start({ initiator: 'boss' });
    const first = (await pendingOf(engine, inst))[0] as WorkflowTask;
    await engine.complete(first.id);
    const second = (await pendingOf(engine, inst))[0] as WorkflowTask;
    await engine.reject(second.id, { to: 'previous' });
    const back = await pendingOf(engine, inst);
    expect(back.map((task) => task.assignee)).toEqual(['u1']);
    expect((await engine.getInstance(inst.id))?.status).toBe('running');
  });

  it('驳回到指定节点 id：落点就是那个节点，不要求它是上一环', async () => {
    const engine = makeEngine(chain());
    const inst = await engine.start({ initiator: 'boss' });
    await engine.complete((await pendingOf(engine, inst))[0]!.id);
    const second = (await pendingOf(engine, inst))[0] as WorkflowTask;
    await engine.reject(second.id, { to: 'a' });
    const back = await pendingOf(engine, inst);
    expect(back.map((task) => [task.nodeId, task.assignee])).toEqual([
      ['a', 'u1'],
    ]);
  });

  it('驳回落到入口节点会重跑 start，于是停在第一个审批节点', async () => {
    const engine = makeEngine(chain());
    const inst = await engine.start({ initiator: 'boss' });
    await engine.complete((await pendingOf(engine, inst))[0]!.id);
    const second = (await pendingOf(engine, inst))[0] as WorkflowTask;
    await engine.reject(second.id, { to: 's' });
    const back = await pendingOf(engine, inst);
    // start 是自动节点，不产生待办；退回它等价于"从头再走一遍"
    expect(back.map((task) => task.nodeId)).toEqual(['a']);
  });

  it('驳回事件带 instance.rejected（终止型）', async () => {
    const engine = makeEngine(chain({ rejectTo: 'terminate' }));
    const events: string[] = [];
    engine.on((event) => events.push(event.kind));
    const inst = await engine.start({ initiator: 'boss' });
    await engine.reject((await pendingOf(engine, inst))[0]!.id);
    expect(events).toEqual(
      expect.arrayContaining(['task.rejected', 'instance.rejected']),
    );
  });
});

describe('办理人策略与异常', () => {
  it('解析不出办理人默认落成 failed，并带上可诊断的 reason', async () => {
    const definition = def(
      [
        node('s', 'start'),
        node('a', 'approval', {
          assignees: [{ params: { userIds: [] }, strategy: 'user' }],
        }),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'a'), edge('e2', 'a', 'e')],
    );
    const engine = makeEngine(definition);
    let detail: string | undefined;
    engine.on((event) => {
      if (event.kind === 'instance.failed') detail = event.detail;
    });
    await expect(engine.start({ initiator: 'boss' })).rejects.toThrow(
      /解析不出办理人/u,
    );
    expect(detail).toMatch(/解析不出办理人/u);
  });

  it('onEmptyAssignees=skip 时直接跳过该节点，历史留痕', async () => {
    const definition = def(
      [
        node('s', 'start'),
        node('a', 'approval', {
          assignees: [{ params: { userIds: [] }, strategy: 'user' }],
        }),
        node('b', 'approval', assignees('u2')),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'a'), edge('e2', 'a', 'b'), edge('e3', 'b', 'e')],
    );
    const engine = makeEngine(definition, { onEmptyAssignees: 'skip' });
    const inst = await engine.start({ initiator: 'boss' });
    expect(
      (await pendingOf(engine, inst)).map((task) => task.assignee),
    ).toEqual(['u2']);
    const stored = await engine.getInstance(inst.id);
    expect(
      stored?.history.some((item) => item.action === 'node.skipped-empty'),
    ).toBe(true);
  });

  it('onEmptyAssignees=initiator 时回落到发起人办理', async () => {
    const definition = def(
      [
        node('s', 'start'),
        node('a', 'approval', { assignees: [{ strategy: 'role' }] }),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'a'), edge('e2', 'a', 'e')],
    );
    const engine = makeEngine(definition, { onEmptyAssignees: 'initiator' });
    const inst = await engine.start({ initiator: 'boss' });
    expect(
      (await pendingOf(engine, inst)).map((task) => task.assignee),
    ).toEqual(['boss']);
  });

  it('角色解析器由宿主注入，引擎不猜组织架构', async () => {
    const definition = def(
      [
        node('s', 'start'),
        node('a', 'approval', {
          assignees: [{ params: { roleCode: 'finance' }, strategy: 'role' }],
        }),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'a'), edge('e2', 'a', 'e')],
    );
    const engine = makeEngine(definition, {
      resolveRole: (code: string) =>
        code === 'finance' ? ['fin1', 'fin2'] : [],
    });
    const inst = await engine.start({ initiator: 'boss' });
    expect(
      (await pendingOf(engine, inst)).map((task) => task.assignee),
    ).toEqual(['fin1', 'fin2']);
  });

  it('未知节点类型落成 failed，并且 reason 指向那个类型', async () => {
    const definition = def(
      [node('s', 'start'), node('x', 'webhook'), node('e', 'end')],
      [edge('e1', 's', 'x'), edge('e2', 'x', 'e')],
    );
    const engine = makeEngine(definition);
    await expect(engine.start({ initiator: 'boss' })).rejects.toThrow(
      /webhook/u,
    );
  });

  it('fallbackHandler 可以兜住未知类型（自定义扩展点）', async () => {
    const definition = def(
      [node('s', 'start'), node('x', 'webhook'), node('e', 'end')],
      [edge('e1', 's', 'x'), edge('e2', 'x', 'e')],
    );
    const engine = makeEngine(definition, {
      fallbackHandler: {
        kind: '__fallback',
        run: () => ({ status: 'advance' as const }),
      },
    });
    const inst = await engine.start({ initiator: 'boss' });
    expect((await engine.getInstance(inst.id))?.status).toBe('completed');
  });
});

describe('定时与超时', () => {
  const timed = (
    timeoutMs?: number,
    action?: 'approve' | 'reject' | 'remind',
  ) =>
    def(
      [
        node('s', 'start'),
        node('t', 'timer', { timeoutMs: 5000 }),
        node('a', 'approval', {
          ...assignees('u1'),
          timeoutMs,
          timeoutAction: action,
        }),
        node('e', 'end'),
      ],
      [edge('e1', 's', 't'), edge('e2', 't', 'a'), edge('e3', 'a', 'e')],
    );

  it('定时节点在到点前不动，到点后由 tick 放行', async () => {
    const engine = makeEngine(timed());
    const inst = await engine.start({ initiator: 'boss' });
    expect(await engine.tick(now() + 1000)).toBe(0);
    expect((await engine.getInstance(inst.id))?.tokenNodeIds).toEqual(['t']);
    advance(6000);
    expect(await engine.tick(now())).toBe(1);
    expect(
      (await pendingOf(engine, inst)).map((task) => task.assignee),
    ).toEqual(['u1']);
  });

  it('到期未办默认只提醒一次，重复 tick 不刷屏', async () => {
    const engine = makeEngine(timed(2000));
    const inst = await engine.start({ initiator: 'boss' });
    advance(6000 + 3000);
    const timeouts: string[] = [];
    engine.on((event) => {
      if (event.kind === 'task.timeout') timeouts.push(event.task.id);
    });
    // 第一次 tick 只放开定时节点：待办是这一刻才建出来的，它自己的闹钟还没响
    expect(await engine.tick(now())).toBe(1);
    expect(timeouts).toHaveLength(0);
    advance(3000);
    expect(await engine.tick(now())).toBe(1);
    expect(timeouts).toHaveLength(1);
    // 重复 tick 不刷屏：remindedAt 把同一条待办挡在门外
    expect(await engine.tick(now())).toBe(0);
    expect(timeouts).toHaveLength(1);
    expect((await engine.getInstance(inst.id))?.status).toBe('running');
  });

  it('timeoutAction=approve 时超时自动通过并推进', async () => {
    const engine = makeEngine(timed(2000, 'approve'));
    const inst = await engine.start({ initiator: 'boss' });
    advance(6500);
    await engine.tick(now()); // 放开定时节点，开出 u1 待办
    advance(3000);
    await engine.tick(now()); // 待办超时 → 自动通过
    const done = await engine.getInstance(inst.id);
    expect(done?.status).toBe('completed');
    const auto = (await tasksOf(engine, inst)).find(
      (task) => task.assignee === 'u1',
    );
    expect(auto?.comment).toBe('[超时自动通过]');
    expect(auto?.status).toBe('done');
  });

  it('timeoutAction=reject 时超时自动驳回并终止', async () => {
    const definition = def(
      [
        node('s', 'start'),
        node('a', 'approval', {
          ...assignees('u1'),
          rejectTo: 'terminate',
          timeoutAction: 'reject',
          timeoutMs: 1000,
        }),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'a'), edge('e2', 'a', 'e')],
    );
    const engine = makeEngine(definition);
    const inst = await engine.start({ initiator: 'boss' });
    advance(2000);
    await engine.tick(now());
    expect((await engine.getInstance(inst.id))?.status).toBe('rejected');
  });

  it('没有配 timeoutMs 的 timer 节点等价于直通', async () => {
    const definition = def(
      [node('s', 'start'), node('t', 'timer'), node('e', 'end')],
      [edge('e1', 's', 't'), edge('e2', 't', 'e')],
    );
    const engine = makeEngine(definition);
    const inst = await engine.start({ initiator: 'boss' });
    expect((await engine.getInstance(inst.id))?.status).toBe('completed');
  });
});

describe('抄送', () => {
  it('抄送不阻塞流程，但任务留在待阅里可标记已阅', async () => {
    const definition = def(
      [
        node('s', 'start'),
        node('cc', 'cc', assignees('watcher1', 'watcher2')),
        node('a', 'approval', assignees('u1')),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'cc'), edge('e2', 'cc', 'a'), edge('e3', 'a', 'e')],
    );
    const engine = makeEngine(definition);
    const inst = await engine.start({ initiator: 'boss' });
    const stored = await engine.getInstance(inst.id);
    // 抄送不占游标：流程已经走到审批节点
    expect(stored?.tokenNodeIds).toEqual(['a']);
    const all = await tasksOf(engine, inst);
    expect(all.filter((task) => task.nodeKind === 'cc')).toHaveLength(2);
    // 已阅不会把流程多推一步
    const ccTask = all.find((task) => task.nodeKind === 'cc') as WorkflowTask;
    await engine.complete(ccTask.id);
    expect((await engine.getInstance(inst.id))?.tokenNodeIds).toEqual(['a']);
  });
});

describe('并行扇出与汇聚', () => {
  const parallel = (join?: 'all' | 'any') =>
    def(
      [
        node('s', 'start'),
        node('fork', 'fork'),
        node('a', 'approval', assignees('u1')),
        node('b', 'approval', assignees('u2')),
        node('m', 'approval', { ...assignees('u3'), join }),
        node('e', 'end'),
      ],
      [
        edge('f1', 's', 'fork'),
        edge('f2', 'fork', 'a'),
        edge('f3', 'fork', 'b'),
        edge('j1', 'a', 'm'),
        edge('j2', 'b', 'm'),
        edge('z', 'm', 'e'),
      ],
    );

  const forkHandler = {
    kind: 'fork',
    run: () => ({ status: 'advance' as const }),
  };

  it('两条分支同时挂起，join=all 时全部到达才进入汇聚节点', async () => {
    const engine = makeEngine(parallel('all'), { handlers: [forkHandler] });
    const inst = await engine.start({ initiator: 'boss' });
    const pending = await pendingOf(engine, inst);
    expect(pending.map((task) => task.assignee).sort()).toEqual(['u1', 'u2']);
    expect((await engine.getInstance(inst.id))?.tokenNodeIds.sort()).toEqual([
      'a',
      'b',
    ]);

    await engine.complete(pending[0]!.id);
    const afterOne = await engine.getInstance(inst.id);
    expect(afterOne?.status).toBe('running');
    // 只到了一条分支：汇聚节点在等另一条，到达计数记下来了
    expect(afterOne?.arrivals?.m).toEqual(['a']);

    await engine.complete(pending[1]!.id);
    const joined = await pendingOf(engine, inst);
    expect(joined.map((task) => task.assignee)).toEqual(['u3']);
    await engine.complete(joined[0]!.id);
    expect((await engine.getInstance(inst.id))?.status).toBe('completed');
  });

  it('join=any 时第一条到达即进入，第二条不会重复开待办', async () => {
    const engine = makeEngine(parallel('any'), { handlers: [forkHandler] });
    const inst = await engine.start({ initiator: 'boss' });
    const pending = await pendingOf(engine, inst);
    await engine.complete(pending[0]!.id);
    expect(
      (await pendingOf(engine, inst)).map((task) => task.assignee),
    ).toContain('u3');
  });
});

describe('挂起、撤回与取消', () => {
  const base = () =>
    def(
      [
        node('s', 'start'),
        node('a', 'approval', assignees('u1')),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'a'), edge('e2', 'a', 'e')],
    );

  it('挂起期间不能办理，恢复后可以', async () => {
    const engine = makeEngine(base());
    const inst = await engine.start({ initiator: 'boss' });
    await engine.suspend(inst.id, { actor: 'admin' });
    const task = (await tasksOf(engine, inst)).find(
      (item) => item.status === 'pending',
    ) as WorkflowTask;
    await expect(engine.complete(task.id)).rejects.toThrow(/suspended/u);
    await engine.resume(inst.id);
    await engine.complete(task.id);
    expect((await engine.getInstance(inst.id))?.status).toBe('completed');
  });

  it('没人办过时发起人可撤回，办过后必须走驳回', async () => {
    const engine = makeEngine(base());
    const inst = await engine.start({ initiator: 'boss' });
    const canceled = await engine.withdraw(inst.id, { actor: 'boss' });
    expect(canceled.status).toBe('canceled');
    expect(
      (await tasksOf(engine, inst)).every((task) => task.status === 'canceled'),
    ).toBe(true);

    // 两环链路：第一环办完流程还在跑，此时撤回会踩到"已有人办理"守卫
    const twoStep = def(
      [
        node('s', 'start'),
        node('a', 'approval', assignees('u1')),
        node('b', 'approval', assignees('u2')),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'a'), edge('e2', 'a', 'b'), edge('e3', 'b', 'e')],
    );
    const engine2 = makeEngine(twoStep);
    const second = await engine2.start({ initiator: 'boss' });
    await engine2.complete((await pendingOf(engine2, second))[0]!.id, {
      actor: 'u1',
    });
    expect((await engine2.getInstance(second.id))?.status).toBe('running');
    await expect(engine2.withdraw(second.id)).rejects.toThrow(/不能撤回/u);
  });

  it('流程已经办完时撤回报的是实例状态', async () => {
    const engine = makeEngine(base());
    const inst = await engine.start({ initiator: 'boss' });
    await engine.complete((await pendingOf(engine, inst))[0]!.id, {
      actor: 'u1',
    });
    await expect(engine.withdraw(inst.id)).rejects.toThrow(
      /处于 completed，不能撤回/u,
    );
  });

  it('cancel 强制作废，已完成的实例不能再取消', async () => {
    const engine = makeEngine(base());
    const inst = await engine.start({ initiator: 'boss' });
    await engine.cancel(inst.id, { actor: 'admin', comment: '重复提交' });
    expect((await engine.getInstance(inst.id))?.status).toBe('canceled');
    await expect(engine.cancel(inst.id)).rejects.toThrow(/已结束/u);
  });
});

describe('死循环与越界保护', () => {
  it('推进步数超限时报错而不是把主线程跑死', async () => {
    // 一个自环的直通节点：condition 每次都不命中且只有一条出边指回自己
    const definition = def(
      [
        node('s', 'start'),
        node('c', 'condition', {
          branches: [{ edgeId: 'loop', expression: 'false' }],
          defaultEdgeId: 'loop',
        }),
        node('e', 'end'),
      ],
      [edge('e0', 's', 'c'), edge('loop', 'c', 'c'), edge('e1', 'c', 'e')],
    );
    const engine = makeEngine(definition, { maxSteps: 50 });
    await expect(engine.start({ initiator: 'boss' })).rejects.toThrow(
      /推进步数超过上限/u,
    );
  });
});

describe('定义期校验', () => {
  it('报出未注册的节点类型、悬空分支与非法落点', () => {
    const definition = def(
      [
        node('s', 'start'),
        node('c', 'condition', {
          branches: [{ edgeId: 'nope', expression: 'x' }],
          defaultEdgeId: 'a',
        }),
        node('a', 'approval', {
          assignees: [{ strategy: 'user' }],
          rejectTo: 'ghost',
        }),
        node('e', 'end'),
      ],
      [edge('e0', 's', 'c'), edge('a', 'c', 'a'), edge('e1', 'a', 'e')],
    );
    const codes = validateWorkflowDefinition(definition).map(
      (issue) => issue.code,
    );
    expect(codes).toEqual(
      expect.arrayContaining(['dangling-branch', 'unknown-reject-target']),
    );
  });

  it('cycle 在工作流里降级为 warning（驳回回溯是合法画法）', () => {
    const definition = def(
      [
        node('s', 'start'),
        node('a', 'approval', assignees('u1')),
        node('b', 'approval', assignees('u2')),
        node('e', 'end'),
      ],
      [
        edge('e1', 's', 'a'),
        edge('e2', 'a', 'b'),
        edge('back', 'b', 'a'),
        edge('e3', 'b', 'e'),
      ],
    );
    const cycles = validateWorkflowDefinition(definition).filter(
      (issue) => issue.code === 'cycle',
    );
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles.every((issue) => issue.level === 'warning')).toBe(true);
  });

  it('内置六种类型都能通过 no-handler 检查', () => {
    const definition = def(
      [
        node('s', 'start'),
        node('c', 'condition'),
        node('cc', 'cc', assignees('w')),
        node('a', 'approval', assignees('u')),
        node('t', 'timer', { timeoutMs: 1 }),
        node('e', 'end'),
      ],
      [
        edge('1', 's', 'c'),
        edge('2', 'c', 'cc'),
        edge('3', 'cc', 'a'),
        edge('4', 'a', 't'),
        edge('5', 't', 'e'),
      ],
    );
    expect(
      validateWorkflowDefinition(definition).filter(
        (issue) => issue.code === 'no-handler',
      ),
    ).toEqual([]);
  });
});

describe('扩展点', () => {
  it('注册同名 kind 即可覆盖内置节点语义', async () => {
    const definition = def(
      [
        node('s', 'start'),
        node('a', 'approval', assignees('u1')),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'a'), edge('e2', 'a', 'e')],
    );
    const engine = makeEngine(definition, {
      handlers: [
        {
          kind: 'approval',
          run: (ctx) => {
            ctx.setVariable('autoPassed', true);
            return { status: 'advance' as const };
          },
        },
      ],
    });
    const inst = await engine.start({ initiator: 'boss' });
    const stored = await engine.getInstance(inst.id);
    expect(stored?.status).toBe('completed');
    expect(stored?.variables.autoPassed).toBe(true);
    expect(await tasksOf(engine, inst)).toEqual([]);
  });

  it('注册表支持运行时增删处理器', () => {
    const registry = createNodeHandlerRegistry();
    expect(registry.has('approval')).toBe(true);
    registry.register({
      kind: 'mq',
      run: () => ({ status: 'advance' as const }),
    });
    expect(registry.get('mq')?.kind).toBe('mq');
    expect(registry.unregister('mq')).toBe(true);
    expect(registry.has('mq')).toBe(false);
    expect(registry.list().length).toBeGreaterThan(0);
  });

  it('处理器抛错时 reason 会带出原始错误信息', async () => {
    const definition = def(
      [node('s', 'start'), node('boom', 'explosion'), node('e', 'end')],
      [edge('e1', 's', 'boom'), edge('e2', 'boom', 'e')],
    );
    const engine = makeEngine(definition, {
      handlers: [
        {
          kind: 'explosion',
          run: () => {
            throw new Error('下游服务 500');
          },
        },
      ],
    });
    await expect(engine.start({ initiator: 'boss' })).rejects.toThrow(
      /下游服务 500/u,
    );
  });

  it('系统动作记在伪节点上，时间线据此显示"系统"', async () => {
    const engine = makeEngine(
      def(
        [
          node('s', 'start'),
          node('a', 'approval', assignees('u1')),
          node('e', 'end'),
        ],
        [edge('e1', 's', 'a'), edge('e2', 'a', 'e')],
      ),
    );
    const inst = await engine.start({ initiator: 'boss' });
    await engine.suspend(inst.id);
    const stored = await engine.getInstance(inst.id);
    expect(stored?.history.at(-1)?.nodeId).toBe(SYSTEM_NODE);
  });
});

describe('事件订阅', () => {
  it('取消订阅后不再收到事件', async () => {
    const engine = makeEngine(
      def(
        [
          node('s', 'start'),
          node('a', 'approval', assignees('u1')),
          node('e', 'end'),
        ],
        [edge('e1', 's', 'a'), edge('e2', 'a', 'e')],
      ),
    );
    const seen = vi.fn();
    const off = engine.on(seen);
    await engine.start({ initiator: 'boss' });
    expect(seen).toHaveBeenCalled();
    const before = seen.mock.calls.length;
    off();
    await engine.cancel((await engine.getInstance('ins-1'))!.id);
    expect(seen.mock.calls.length).toBe(before);
  });
});
