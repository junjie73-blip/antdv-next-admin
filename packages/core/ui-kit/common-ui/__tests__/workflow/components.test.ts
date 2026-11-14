import type {
  WorkflowHistoryEntry,
  WorkflowTask,
} from '../../src/workflow/core/types';

import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import {
  configureWorkflow,
  createConfiguredWorkflowEngine,
  getWorkflowRuntime,
  resetWorkflowRuntime,
  WorkflowApprovalBar,
  WorkflowTaskList,
  WorkflowTimeline,
} from '../../src/workflow/index';

/**
 * 组件层口径：这三个组件只做「渲染 + 回抛事件」，不碰引擎、不取数。
 * 所以测试也只验这两件事——按钮的可用性判断、插槽覆盖、空态与文案，
 * 一旦出现"组件里偷偷调了 engine"的写法，这里会先红。
 */

function task(overrides: Partial<WorkflowTask> = {}): WorkflowTask {
  return {
    assignee: 'u1',
    createdAt: 1_700_000_000_000,
    id: 'tk-1',
    instanceId: 'ins-1',
    nodeKind: 'approval',
    nodeId: 'a',
    seq: 0,
    status: 'pending',
    ...overrides,
  };
}

function entry(
  overrides: Partial<WorkflowHistoryEntry> = {},
): WorkflowHistoryEntry {
  return {
    action: 'approve',
    at: 1_700_000_000_000,
    nodeId: 'a',
    ...overrides,
  };
}

describe('workflowTimeline', () => {
  it('按节点标题与动作渲染，系统伪节点走 systemLabel', () => {
    const wrapper = mount(WorkflowTimeline, {
      props: {
        entries: [
          entry(),
          entry({ action: 'reject.to-initiator', nodeId: '__system__' }),
        ],
        labelOf: (id) => (id === 'a' ? '部门审批' : id),
        systemLabel: '流水线',
      },
    });
    const text = wrapper.text();
    expect(text).toContain('部门审批');
    expect(text).toContain('同意');
    expect(text).toContain('流水线');
    expect(wrapper.find('[data-slot="workflow-timeline"]').exists()).toBe(true);
  });

  it('空历史给出可解释的空态，定义告警就地列出', () => {
    const wrapper = mount(WorkflowTimeline, {
      props: {
        emptyText: '还没有动作',
        entries: [],
        issues: [
          { code: 'cycle', level: 'warning', message: '驳回回溯形成环' },
        ],
      },
    });
    expect(wrapper.text()).toContain('还没有动作');
    expect(wrapper.text()).toContain('驳回回溯形成环');
  });
});

describe('workflowTaskList', () => {
  it('渲染待办并回抛选中项', async () => {
    const wrapper = mount(WorkflowTaskList, {
      props: {
        labelOf: () => '一级审批',
        tasks: [task(), task({ assignee: 'u2', id: 'tk-2', status: 'queued' })],
      },
    });
    expect(wrapper.findAll('[data-task-id]')).toHaveLength(2);
    expect(wrapper.text()).toContain('未轮到');
    await wrapper.findAll('[data-task-id]')[0]!.trigger('click');
    expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({ id: 'tk-1' });
  });

  it('空列表用空态而不是留白，loading 时不误报空', () => {
    const empty = mount(WorkflowTaskList, { props: { tasks: [] } });
    expect(empty.text()).toContain('没有待办');
    const loading = mount(WorkflowTaskList, {
      props: { loading: true, tasks: [] },
    });
    expect(loading.text()).toContain('加载中');
    expect(loading.text()).not.toContain('没有待办');
  });
});

describe('workflowApprovalBar', () => {
  function bar(props: Record<string, unknown> = {}) {
    return mount(WorkflowApprovalBar, { props });
  }

  it('驳回没写意见时按钮不可用，写完就可用并发出事件', async () => {
    const wrapper = bar();
    const reject = wrapper.find('[data-action="reject"]');
    expect((reject.element as HTMLButtonElement).disabled).toBe(true);
    await wrapper
      .find('[data-slot="workflow-approval-comment"]')
      .setValue('  金额有误，请重填  ');
    expect(
      (wrapper.find('[data-action="reject"]').element as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    await wrapper.find('[data-action="reject"]').trigger('click');
    expect(wrapper.emitted('action')?.[0]?.[0]).toMatchObject({
      action: 'reject',
      comment: '金额有误，请重填',
    });
    // 发完即清空，避免"提交成功但输入框还留着意见"的二次提交
    expect(
      (wrapper.find('[data-action="reject"]').element as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('转办与加签在没选人时不可用，选人后带上 users', async () => {
    const wrapper = bar({ actions: ['transfer'] });
    expect(
      (wrapper.find('[data-action="transfer"]').element as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await wrapper
      .find('[data-slot="workflow-approval-users"]')
      .setValue('u9, u8，u7');
    await wrapper.find('[data-action="transfer"]').trigger('click');
    expect(wrapper.emitted('action')?.[0]?.[0]).toMatchObject({
      action: 'transfer',
      users: ['u9', 'u8', 'u7'],
    });
  });

  it('loading 时全部按钮禁用，动作集合与文案由 props 决定', () => {
    const wrapper = bar({
      actions: ['approve', 'skip'],
      labels: { approve: '确认无误' },
      loading: true,
    });
    expect(wrapper.findAll('[data-action]')).toHaveLength(2);
    expect(wrapper.text()).toContain('确认无误');
    for (const button of wrapper.findAll('[data-action]')) {
      expect((button.element as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('#user-picker 插槽可以整体替换掉默认的输入框', () => {
    const wrapper = mount(WorkflowApprovalBar, {
      props: { actions: ['approve'] },
      slots: { 'user-picker': '<div data-testid="org-picker">组织架构</div>' },
    });
    expect(wrapper.find('[data-slot="workflow-approval-users"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="org-picker"]').exists()).toBe(true);
  });
});

describe('运行时配置（宿主注入点）', () => {
  it('configureWorkflow 增量合并，reset 回到出厂', () => {
    resetWorkflowRuntime();
    const before = getWorkflowRuntime();
    configureWorkflow({ pageSize: 50 });
    expect(getWorkflowRuntime().pageSize).toBe(50);
    // 只改一个字段不会把别的字段清掉：宿主通常在 app 入口配一次，页面再补一次
    expect(getWorkflowRuntime().pollMs).toBe(before.pollMs);
    resetWorkflowRuntime();
    expect(getWorkflowRuntime().pageSize).toBe(before.pageSize);
  });

  it('用 configureWorkflow 注册的处理器，createConfiguredWorkflowEngine 直接就能用上', async () => {
    resetWorkflowRuntime();
    configureWorkflow({
      handlers: [
        {
          kind: 'auto-pass',
          run: () => ({ status: 'advance' as const }),
        },
      ],
    });
    const engine = createConfiguredWorkflowEngine({
      edges: [
        { id: 'e1', source: 's', target: 'a' },
        { id: 'e2', source: 'a', target: 'e' },
      ],
      id: 'flow-config',
      name: '配置驱动',
      nodes: [
        { id: 's', position: { x: 0, y: 0 }, type: 'start' },
        { id: 'a', position: { x: 0, y: 0 }, type: 'auto-pass' },
        { id: 'e', position: { x: 0, y: 0 }, type: 'end' },
      ],
      version: 1,
    });
    const inst = await engine.start({ initiator: 'boss' });
    expect(inst.status).toBe('completed');
    resetWorkflowRuntime();
  });
});
