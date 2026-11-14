import type {
  AiFlowDefinition,
  AiFlowEvent,
  AiRunState,
} from '../../src/ai-flow/core/types';

import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import { AiRunPanel } from '../../src/ai-flow/index';

/**
 * 运行面板的组件测试。
 *
 * `core/runner` 那边已经把调度语义测透了，这个文件只管一件事：
 * **runner 算出来的东西，界面上说的是不是同一句话**。
 * 这一层的错不会让任何一条 core 用例变红，表现全是"人看错状态"：
 * 没跑过写着运行中、挂起看起来像卡死、流式文本混成一坨分不清是谁在输出。
 */

const flow: AiFlowDefinition = {
  edges: [{ id: 'e1', source: 'start', target: 'answer' }],
  id: 'flow-panel',
  name: '面板用例图',
  nodes: [
    { id: 'start', label: '入口', type: 'start' },
    { data: { prompt: 'hi' }, id: 'answer', label: '回答', type: 'llm' },
    { id: 'confirm', label: '人工确认', type: 'human' },
  ],
  version: 1,
};

function state(overrides: Partial<AiRunState> = {}): AiRunState {
  return {
    flowId: 'flow-panel',
    frontier: [],
    id: 'run-1',
    logs: [{ at: 1, level: 'info', message: '开始运行' }],
    nodes: {
      answer: {
        attempts: 1,
        id: 'answer',
        kind: 'llm',
        label: '回答',
        status: 'succeeded',
      },
      start: {
        attempts: 1,
        id: 'start',
        kind: 'start',
        label: '入口',
        status: 'succeeded',
      },
    },
    startedAt: 0,
    steps: 2,
    status: 'running',
    usage: { completion: 12, prompt: 80, total: 92 },
    values: {},
    ...overrides,
  };
}

function chunk(nodeId: string, text: string): AiFlowEvent {
  return { kind: 'node.chunk', nodeId, runId: 'run-1', text };
}

describe('aiRunPanel', () => {
  it('一次都没跑过时说「未运行」，而不是拿 running 的语义占位糊弄眼睛', () => {
    const wrapper = mount(AiRunPanel, { props: { flow } });

    expect(wrapper.text()).toContain('未运行');
    expect(wrapper.text()).not.toContain('运行中');
    // 没有 state 就不该列出节点行：列出来全是 pending，看着像"跑过但都失败"
    expect(wrapper.text()).toContain('还没有节点执行过。');
    // 运行按钮可用、取消按钮禁用，靠的是 `running` prop，不是状态兜底
    expect(
      wrapper.get('[data-action="run"]').attributes('disabled'),
    ).toBeUndefined();
    expect(
      wrapper.get('[data-action="cancel"]').attributes('disabled'),
    ).toBeDefined();
  });

  it('状态徽标说的是 runner 给的那句话：awaiting 是「等待人工确认」，不是卡住', () => {
    const awaiting = mount(AiRunPanel, {
      props: {
        flow,
        state: state({
          awaiting: { nodeId: 'confirm', resumeLabel: '确认无误后点「发送」' },
          frontier: ['confirm'],
          status: 'awaiting',
        }),
      },
    });
    expect(awaiting.text()).toContain('等待人工确认');
    // 挂起区块必须把宿主写的续跑文案摆出来，否则人不知道该干什么
    expect(
      awaiting.get('[data-slot="ai-run-panel-awaiting"]').text(),
    ).toContain('确认无误后点「发送」');

    const done = mount(AiRunPanel, {
      props: { flow, state: state({ status: 'succeeded' }) },
    });
    expect(done.text()).toContain('成功');
    expect(done.find('[data-slot="ai-run-panel-awaiting"]').exists()).toBe(
      false,
    );
  });

  it('续跑输入默认按纯文本交回；打开 JSON 开关后交出解析过的对象，解析不了仍按原文走', async () => {
    const wrapper = mount(AiRunPanel, {
      props: {
        flow,
        state: state({ awaiting: { nodeId: 'confirm' }, status: 'awaiting' }),
      },
    });
    // 没配 resumeLabel 时给一句通用提示，而不是空白
    expect(wrapper.get('[data-slot="ai-run-panel-awaiting"]').text()).toContain(
      '需要人工确认后才能继续',
    );

    await wrapper.get('[data-field="resume-input"]').setValue('同意发送');
    await wrapper.get('[data-action="resume"]').trigger('click');
    expect(wrapper.emitted('resume')?.at(-1)).toEqual(['同意发送']);

    await wrapper.get('[role="switch"]').trigger('click');
    await wrapper.get('[data-field="resume-input"]').setValue('{"ok":true}');
    await wrapper.get('[data-action="resume"]').trigger('click');
    expect(wrapper.emitted('resume')?.at(-1)).toEqual([{ ok: true }]);

    // 人在确认框里打的多半不是 JSON：解析失败就原样交出去，不许把流程卡死
    await wrapper.get('[data-field="resume-input"]').setValue('同意，但先看看');
    await wrapper.get('[data-action="resume"]').trigger('click');
    expect(wrapper.emitted('resume')?.at(-1)).toEqual(['同意，但先看看']);
  });

  it('流式 token 按节点归拢：两个节点同时在流时不会混成一坨', () => {
    const wrapper = mount(AiRunPanel, {
      props: {
        events: [
          chunk('answer', '前半'),
          chunk('confirm', '别家的'),
          chunk('answer', '后半'),
        ],
        flow,
        state: state({
          nodes: {
            ...state().nodes,
            confirm: {
              attempts: 1,
              id: 'confirm',
              kind: 'human',
              label: '人工确认',
              status: 'running',
            },
          },
        }),
      },
    });

    const streams = wrapper.findAll('[data-slot="ai-run-panel-stream"]');
    expect(streams).toHaveLength(2);
    // 拼接顺序 = 事件到达顺序（不是"按长度排"或"按节点排"）：'前半' + '后半'
    expect(streams[0]!.text()).toBe('前半后半');
    expect(streams[1]!.text()).toBe('别家的');
  });

  it('用量、波次与进度都从 state 现读：错误条用的是 core 的同一套措辞', () => {
    const wrapper = mount(AiRunPanel, {
      props: {
        error: new Error('provider 没有配置'),
        flow,
        state: state({ steps: 3 }),
      },
    });

    const usage = wrapper.get('[data-slot="ai-run-panel-usage"]').text();
    expect(usage).toContain('入参 token 80');
    expect(usage).toContain('出参 token 12');
    expect(usage).toContain('合计 92');
    expect(usage).toContain('波次 3');
    // 3 个节点里收了 2 个（succeeded / skipped 都算走完）
    expect(
      wrapper.get('[role="progressbar"]').attributes('aria-valuenow'),
    ).toBe('67');
    expect(wrapper.get('[data-slot="ai-run-panel-error"]').text()).toBe(
      'provider 没有配置',
    );
  });
});
