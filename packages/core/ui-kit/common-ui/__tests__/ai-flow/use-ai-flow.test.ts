import type { EffectScope } from 'vue';

import type { UseAiFlowOptions } from '../../src/ai-flow/composables/use-ai-flow';
import type {
  AiFlowDefinition,
  AiProvider,
  AiRunStatus,
} from '../../src/ai-flow/core/types';

import { effectScope, nextTick, reactive, watch } from 'vue';

import { describe, expect, it } from 'vitest';

import { useAiFlow } from '../../src/ai-flow/composables/use-ai-flow';
import { createAiRunner } from '../../src/ai-flow/core/runner';

/**
 * `useAiFlow` 只交付一件事：**运行器就地改过的运行态，视图那一侧要看得见**。
 *
 * 它是 `core/runner`（纯数据、命令式、一个对象改到底）与组件（响应式、声明式、按引用判变化）
 * 之间唯一的接缝。这一层坏了不会让任何一条 core 用例变红，表现全是「界面说的话和跑出来的事
 * 对不上」：输出都出来了徽标还写着等待人工确认、重跑一次字幕不再动、运行中点取消没反应。
 * 所以这里用**真实运行器 + 假 Provider** 把整个动作跑完，只断言视图拿到的那几份值。
 */

function node(
  id: string,
  type: string,
  data: Record<string, unknown> = {},
  label?: string,
) {
  return { data, id, label, position: { x: 0, y: 0 }, type };
}

function def(
  id: string,
  nodes: AiFlowDefinition['nodes'],
  edges: AiFlowDefinition['edges'],
): AiFlowDefinition {
  return { edges, id, name: '视图接线测试', nodes, version: 1 };
}

const provider: AiProvider = {
  invoke: async () => ({
    finishReason: 'stop',
    text: '已受理',
    usage: { completion: 4, prompt: 10, total: 14 },
  }),
};

/** 起点 → llm → 收口：一条不挂起的直线，用来观察「重跑第二次」 */
const linearFlow = def(
  'flow-linear',
  [
    node('s', 'start'),
    node('llm1', 'llm', { model: 'gpt-test', prompt: '改写这段文字' }),
    node('e', 'end', { outputKey: 'llm1' }),
  ],
  [
    { id: 'e1', source: 's', target: 'llm1' },
    { id: 'e2', source: 'llm1', target: 'e' },
  ],
);

/** 起点 → 人工确认 → 收口：唯一能演完「挂起 → 续跑 → 收口」的最短图 */
const humanFlow = def(
  'flow-human',
  [
    node('s', 'start'),
    node(
      'confirm',
      'human',
      { resumeLabel: '确认无误后点「发送」' },
      '人工确认',
    ),
    node('e', 'end', { prompt: '发出：{{ confirm_human }}' }, '发出'),
  ],
  [
    { id: 'e1', source: 's', target: 'confirm' },
    { id: 'e2', source: 'confirm', target: 'e' },
  ],
);

interface Harness {
  ai: ReturnType<typeof useAiFlow>;
  scope: EffectScope;
  /** `status` 这个 computed 每次变化被读到一次的记录：视图重绘的唯一依据 */
  seen: (AiRunStatus | undefined)[];
}

function harness(options: UseAiFlowOptions): Harness {
  const scope = effectScope();
  const seen: (AiRunStatus | undefined)[] = [];
  let ai: ReturnType<typeof useAiFlow> | undefined;
  scope.run(() => {
    ai = useAiFlow(options);
    watch(ai.status, (value) => seen.push(value), { immediate: true });
  });
  if (!ai) throw new Error('effectScope.run 里没拿到 composable');
  return { ai, scope, seen };
}

describe('useAiFlow', () => {
  it('续跑收尾后，视图那一侧的状态与输出一起换成收尾后的值', async () => {
    const { ai, scope, seen } = harness({
      flow: humanFlow,
      runner: createAiRunner({ provider }),
    });

    await ai.run({ ticket: '物流一直不动' });
    await nextTick();
    expect(ai.status.value).toBe('awaiting');
    expect(ai.output.value).toBeUndefined();
    // 挂起时收口节点还是 pending：它正是续跑之后要跑的那一步
    expect(ai.state.value?.nodes.e?.status).toBe('pending');

    await ai.resume('同意发送');
    await nextTick();

    // 运行器交回的是**同一个对象**：不换一次引用的话 `status` 这个 computed 根本不会重算，
    // 于是徽标永远停在「等待人工确认」，而模板里直读 state 的输出区却已经写出结果 ——
    // 面板自相矛盾，且单看 runner 的用例全绿。
    expect(ai.status.value).toBe('succeeded');
    expect(ai.output.value).toBe('发出：同意发送');
    expect(ai.state.value?.nodes.e?.status).toBe('succeeded');
    expect(seen).toEqual([undefined, 'awaiting', 'succeeded']);

    scope.stop();
  });

  it('重跑第二次的事件仍然进缓冲：归属按「本次运行」认，不是按手里那份旧 state 认', async () => {
    const { ai, scope } = harness({
      flow: linearFlow,
      runner: createAiRunner({ provider }),
    });

    await ai.run({ ticket: '第一遍' });
    const firstRunId = ai.runId.value;
    expect(firstRunId).toBeTruthy();
    expect(new Set(ai.events.value.map((event) => event.runId))).toEqual(
      new Set([firstRunId]),
    );

    await ai.run({ ticket: '第二遍' });
    await nextTick();

    // 早先的判据是 `event.runId !== current.value?.id` 就丢掉；第二次跑的时候 `current.value`
    // 还停在第一次，整轮事件（含流式 token）被当成"别的页面的"扔掉 —— 表现是重跑一次字幕不再动
    const secondRunId = ai.runId.value;
    expect(secondRunId).not.toBe(firstRunId);
    expect(new Set(ai.events.value.map((event) => event.runId))).toEqual(
      new Set([firstRunId, secondRunId]),
    );
    expect(
      ai.events.value.filter((event) => event.kind === 'run.started'),
    ).toHaveLength(2);
    expect(ai.status.value).toBe('succeeded');
    expect(ai.output.value).toBe('已受理');

    scope.stop();
  });

  it('运行中就有 runId 可取消：不用等动作返回，也不用手里先有一份 state', async () => {
    const runner = createAiRunner({ provider });
    const { ai, scope } = harness({ flow: linearFlow, runner });
    const cancels: string[] = [];
    const spyOn = runner.cancel;
    runner.cancel = (runId) => {
      cancels.push(runId);
      return spyOn.call(runner, runId);
    };

    const running = ai.run({ ticket: '取消我' });
    // 事件是同步发出来的：`run.started` 一到，本次运行的 id 就该能拿来取消
    expect(ai.running.value).toBe(true);
    expect(ai.cancel()).toBe(true);
    await running;

    expect(cancels).toEqual([cancels[0]]);
    expect(cancels[0]).toBeTruthy();
    scope.stop();
  });

  it('换图等于换一次实验：状态与事件一起清空，而且跑的确实是新图', async () => {
    const options = reactive({
      flow: linearFlow,
      runner: createAiRunner({ provider }),
    });
    const { ai, scope } = harness(options);

    await ai.run({ ticket: '旧图' });
    expect(ai.state.value?.flowId).toBe('flow-linear');

    options.flow = humanFlow;
    await nextTick();
    expect(ai.state.value).toBeUndefined();
    expect(ai.events.value).toEqual([]);

    await ai.run({ ticket: '新图' });
    expect(ai.state.value?.flowId).toBe('flow-human');
    expect(ai.status.value).toBe('awaiting');

    scope.stop();
  });

  it('就地换掉图里一个节点不算换图：那是示例页改模板的常规动作，别把面板清空', async () => {
    const options = reactive({
      flow: { ...linearFlow, nodes: [...linearFlow.nodes] },
      runner: createAiRunner({ provider }),
    });
    const { ai, scope } = harness(options);

    await ai.run({ ticket: '先跑一遍' });
    expect(ai.state.value).toBeDefined();

    options.flow.nodes[1] = node('llm1', 'llm', {
      model: 'gpt-test',
      prompt: '改过的提示词',
    });
    await nextTick();
    expect(ai.state.value).toBeDefined();
    expect(ai.events.value.length).toBeGreaterThan(0);

    await ai.run({ ticket: '再跑一遍' });
    expect(ai.output.value).toBe('已受理');

    scope.stop();
  });
});
