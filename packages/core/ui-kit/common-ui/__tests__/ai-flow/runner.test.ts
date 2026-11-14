import type {
  AiFlowDefinition,
  AiNodeHandler,
  AiProvider,
  AiRequest,
  AiResult,
  AiRunState,
  AiStreamChunk,
} from '../../src/ai-flow/core/types';

import { describe, expect, it } from 'vitest';

import {
  createAiNodeRegistry,
  passthroughFallbackHandler,
} from '../../src/ai-flow/core/registry';
import { createAiRunner } from '../../src/ai-flow/core/runner';

/**
 * AI 编排运行器（`core/runner.ts`）。
 *
 * 测试口径：时钟、id、sleep 全部注入确定实现 —— 重试退避、耗时、事件顺序才会是可对账的数字与序列。
 * 换成 `Date.now` + `setTimeout` 之后这些断言会变成「看起来稳定」的 flaky，而 flaky 的取消/超时用例
 * 等于没有用例：那两条恰恰是线上最难复现的分支。
 *
 * Provider 一律是这里手写的假对象：本包不许联网，运行器也只该关心「契约有没有被满足」。
 */

let clock = 1000;
const now = () => (clock += 1000);

function resetClock(value = 1000) {
  clock = value;
}

function node(
  id: string,
  type: string,
  data: Record<string, unknown> = {},
  label?: string,
) {
  return { data, id, label, position: { x: 0, y: 0 }, type };
}

function def(
  nodes: AiFlowDefinition['nodes'],
  edges: AiFlowDefinition['edges'],
  id = 'flow-runner',
): AiFlowDefinition {
  return { edges, id, name: '运行器测试', nodes, version: 1 };
}

const TEXT = '新文案';

/** 直线三步：起点 → llm → 结束。llm 默认不带插值，免得用例之间互相牵连 */
function linearFlow(
  llm: Record<string, unknown> = {},
  end: Record<string, unknown> = { outputKey: '改写结果' },
) {
  return def(
    [
      node('s', 'start'),
      node('llm1', 'llm', {
        model: 'gpt-test',
        outputKey: '改写结果',
        prompt: '改写这段文字',
        ...llm,
      }),
      node('e', 'end', end),
    ],
    [
      { id: 'e1', source: 's', target: 'llm1' },
      { id: 'e2', source: 'llm1', target: 'e' },
    ],
  );
}

interface FakeProvider extends AiProvider {
  calls: AiRequest[];
  maxInflight: number;
}

/**
 * 假 Provider。`responder` 拿到「第几次调用」与请求本身；返回 Error 表示这一步抛错。
 * `neverSettles` 用于超时用例：既不 resolve 也不理会取消，只能靠运行器的计时器收口。
 */
function fakeProvider(
  responder: (call: number, request: AiRequest) => AiResult | Error,
  options: { neverSettles?: boolean; streamChunks?: AiStreamChunk[] } = {},
): FakeProvider {
  const calls: AiRequest[] = [];
  let inflight = 0;
  const provider: FakeProvider = {
    calls,
    invoke: async (request: AiRequest): Promise<AiResult> => {
      calls.push(request);
      inflight += 1;
      provider.maxInflight = Math.max(provider.maxInflight, inflight);
      await Promise.resolve();
      inflight -= 1;
      if (options.neverSettles) return new Promise<AiResult>(() => undefined);
      const outcome = responder(calls.length, request);
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
    maxInflight: 0,
  };
  if (options.streamChunks) {
    const chunks = options.streamChunks;
    // 构造时就装上 stream：运行器是按「provider 有没有 stream 这个方法」决定走不走流式的
    provider.stream = async function* (): AsyncIterable<AiStreamChunk> {
      for (const chunk of chunks) yield chunk;
    };
  }
  return provider;
}

/** 只在中止时拒绝的 Provider：模拟真实传输层对 signal 的反应，用来验「取消不被当成失败重试」 */
function abortableProvider() {
  const calls: AiRequest[] = [];
  return {
    calls,
    invoke: (request: AiRequest) =>
      new Promise<AiResult>((_resolve, reject) => {
        calls.push(request);
        request.signal?.addEventListener('abort', () =>
          reject(new Error('请求已中止')),
        );
      }),
  } satisfies AiProvider & { calls: AiRequest[] };
}

interface RunnerHarness {
  events: string[];
  provider: FakeProvider;
  runner: ReturnType<typeof createAiRunner>;
  sleeps: number[];
}

function makeRunner(
  provider: AiProvider,
  overrides: Partial<Parameters<typeof createAiRunner>[0]> = {},
): RunnerHarness {
  resetClock();
  let seq = 0;
  const sleeps: number[] = [];
  const events: string[] = [];
  const runner = createAiRunner({
    clock: now,
    idFactory: (prefix) => `${prefix}-${(seq += 1)}`,
    provider,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    ...overrides,
  });
  runner.on((event) => events.push(event.kind));
  return {
    events,
    provider: provider as unknown as FakeProvider,
    runner,
    sleeps,
  };
}

async function until(predicate: () => boolean, tries = 40): Promise<void> {
  for (let index = 0; index < tries; index += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('等待条件超时：假 Provider 没有收到预期的调用');
}

describe('正常推进', () => {
  it('直线三步跑完就是 succeeded：任何节点级失败都落进运行态，run() 不会 reject', async () => {
    const harness = makeRunner(
      fakeProvider(() => ({
        text: TEXT,
        usage: { completion: 5, prompt: 10, total: 15 },
      })),
    );
    const state = await harness.runner.run(linearFlow());

    expect(state.id).toBe('run-1');
    expect(state.flowId).toBe('flow-runner');
    expect(state.status).toBe('succeeded');
    expect(state.steps).toBe(3);
    expect(state.frontier).toEqual([]);
    expect(state.values).toEqual({ 改写结果: TEXT });
    expect(state.output).toBe(TEXT);
    expect(state.usage).toEqual({ completion: 5, prompt: 10, total: 15 });
    expect(state.finishedAt).toBeGreaterThan(state.startedAt);
  });

  it('事件序列是固定顺序（含 node.output 排在节点完成之后），运行面板的时间线直接照它排', async () => {
    const harness = makeRunner(fakeProvider(() => ({ text: TEXT })));
    await harness.runner.run(linearFlow());
    expect(harness.events).toEqual([
      'run.started',
      'node.started',
      'node.finished',
      'node.started',
      'node.finished',
      'node.output',
      'node.started',
      'node.finished',
      'run.finished',
    ]);
  });

  it('每个事件都带同一个 runId：宿主会把多个并发运行接到同一条通道上再按 runId 分流', async () => {
    const harness = makeRunner(fakeProvider(() => ({ text: TEXT })));
    const ids: string[] = [];
    harness.runner.on((event) => ids.push(event.runId));
    const state = await harness.runner.run(linearFlow());
    expect(ids.length).toBeGreaterThan(5);
    expect(new Set(ids)).toEqual(new Set([state.id]));
  });

  it('运行入参成为初始变量，节点模板据此渲染 —— 漏了 input 注入就是「模型看不到用户说了什么」', async () => {
    const harness = makeRunner(fakeProvider(() => ({ text: TEXT })));
    const state = await harness.runner.run(
      linearFlow({ prompt: '改写：{{ 原始文本 }}' }),
      { 原始文本: '原文' },
    );
    expect(state.values['原始文本']).toBe('原文');
    expect(harness.provider.calls[0]?.messages).toEqual([
      { content: '改写：原文', role: 'user' },
    ]);
  });

  it('节点状态、耗时与本次用量都落到运行态里：时钟是注入的固定步进，所以耗时是确定值', async () => {
    const harness = makeRunner(
      fakeProvider(() => ({
        text: TEXT,
        usage: { completion: 2, prompt: 3, total: 5 },
      })),
    );
    const state = await harness.runner.run(linearFlow());
    const llm = state.nodes.llm1!;
    expect(llm.status).toBe('succeeded');
    expect(llm.kind).toBe('llm');
    expect(llm.label).toBe('llm1');
    expect(llm.attempts).toBe(1);
    expect(llm.usage).toEqual({ completion: 2, prompt: 3, total: 5 });
    expect(llm.durationMs).toBe(1000);
    expect(state.nodes.s!.status).toBe('succeeded');
    expect(state.nodes.e!.status).toBe('succeeded');
  });

  it('请求体带得上游信息：nodeId、signal、model、渲染后的消息，Provider 记账与按节点取回复都靠它们', async () => {
    const harness = makeRunner(fakeProvider(() => ({ text: TEXT })));
    await harness.runner.run(linearFlow({ maxTokens: 64, temperature: 0.2 }));
    expect(harness.provider.calls).toHaveLength(1);
    const request = harness.provider.calls[0]!;
    expect(request.nodeId).toBe('llm1');
    expect(request.model).toBe('gpt-test');
    expect(request.maxTokens).toBe(64);
    expect(request.temperature).toBe(0.2);
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(request.signal?.aborted).toBe(false);
  });

  it('system 段排在最前，其余拼装不属于运行器的职责', async () => {
    const harness = makeRunner(fakeProvider(() => ({ text: TEXT })));
    await harness.runner.run(linearFlow({ system: '你是编辑' }));
    expect(harness.provider.calls[0]?.messages).toEqual([
      { content: '你是编辑', role: 'system' },
      { content: '改写这段文字', role: 'user' },
    ]);
  });

  it('节点没写 model 时回落运行器 defaultModel，写了就以节点为准 —— 优先级反了会整包换错模型', async () => {
    const harness = makeRunner(
      fakeProvider(() => ({ text: TEXT })),
      { defaultModel: 'fallback-model' },
    );
    await harness.runner.run(linearFlow());
    expect(harness.provider.calls[0]?.model).toBe('gpt-test');
    await harness.runner.run(linearFlow({ model: undefined }));
    expect(harness.provider.calls[1]?.model).toBe('fallback-model');
  });

  it('配了 stream 且 Provider 实现了 stream 才走流式：逐段产出要变成 node.chunk 事件并累加 usage', async () => {
    const harness = makeRunner(
      fakeProvider(() => ({ text: '不该被用到' }), {
        streamChunks: [
          { delta: '新' },
          { delta: '文' },
          {
            delta: '案',
            finishReason: 'stop',
            usage: { completion: 3, prompt: 1, total: 4 },
          },
        ],
      }),
    );
    const chunks: string[] = [];
    harness.runner.on((event) => {
      if (event.kind === 'node.chunk') chunks.push(event.text);
    });
    const state = await harness.runner.run(
      linearFlow({ stream: true, outputKey: '改写结果' }),
    );
    expect(chunks).toEqual(['新', '文', '案']);
    expect(state.values['改写结果']).toBe('新文案');
    expect(state.usage.total).toBe(4);
  });

  it('provider 没有 stream 时自动退回非流式，不抛 provider-stream-missing —— 这是契约里写明的可选', async () => {
    const harness = makeRunner(fakeProvider(() => ({ text: TEXT })));
    const state = await harness.runner.run(linearFlow({ stream: true }));
    expect(state.status).toBe('succeeded');
    expect(harness.events).not.toContain('node.chunk');
  });

  it('outputFormat 在节点级收口成结构：解析失败是节点错误而不是未捕获异常', async () => {
    const harness = makeRunner(
      fakeProvider(() => ({ text: '```json\n{"title":"甲"}\n```' })),
    );
    const state = await harness.runner.run(
      linearFlow({ outputFormat: 'json' }),
    );
    expect(state.values['改写结果']).toEqual({ title: '甲' });
    expect(state.status).toBe('succeeded');

    const broken = makeRunner(fakeProvider(() => ({ text: '这不是 JSON' })));
    const failed = await broken.runner.run(
      linearFlow({ outputFormat: 'json' }),
    );
    expect(failed.status).toBe('failed');
    expect(failed.nodes.llm1!.status).toBe('failed');
    expect(failed.nodes.llm1!.error).toContain('output-json');
  });

  it('end 节点三种收口写法都认：模板优先，其次取产物键，再次算表达式', async () => {
    const byTemplate = await makeRunner(
      fakeProvider(() => ({ text: 'A' })),
    ).runner.run(linearFlow({}, { prompt: '结论：{{ 改写结果 }}' }));
    expect(byTemplate.output).toBe('结论：A');

    const nothing = await makeRunner(
      fakeProvider(() => ({ text: 'A' })),
    ).runner.run(linearFlow({}, {}));
    expect(nothing.status).toBe('succeeded');
    expect(nothing.output).toBeUndefined();

    const byExpression = await makeRunner(
      fakeProvider(() => ({ text: 'A' })),
    ).runner.run(
      def(
        [
          node('s', 'start'),
          node('t', 'transform', { expression: '1 + 2' }),
          node('e', 'end', { expression: 't * 10' }),
        ],
        [
          { id: 'e1', source: 's', target: 't' },
          { id: 'e2', source: 't', target: 'e' },
        ],
      ),
    );
    expect(byExpression.output).toBe(30);
  });

  it('同层并发受 maxConcurrency 限流：默认四车道，压到一就真的一次只跑一个（再高容易撞供应商限流）', async () => {
    const threeWide = def(
      [
        node('s', 'start'),
        node('a', 'llm', { model: 'm', prompt: '甲' }),
        node('b', 'llm', { model: 'm', prompt: '乙' }),
        node('c', 'llm', { model: 'm', prompt: '丙' }),
        node('e', 'end'),
      ],
      [
        { id: 'e1', source: 's', target: 'a' },
        { id: 'e2', source: 's', target: 'b' },
        { id: 'e3', source: 's', target: 'c' },
        { id: 'e4', source: 'a', target: 'e' },
        { id: 'e5', source: 'b', target: 'e' },
        { id: 'e6', source: 'c', target: 'e' },
      ],
    );
    const wide = makeRunner(fakeProvider(() => ({ text: 'x' })));
    await wide.runner.run(threeWide);
    expect(wide.provider.maxInflight).toBe(3);

    const serial = makeRunner(
      fakeProvider(() => ({ text: 'x' })),
      { maxConcurrency: 1 },
    );
    await serial.runner.run(threeWide);
    expect(serial.provider.maxInflight).toBe(1);
  });

  it('同一波里重复到达的目标只跑一次：两条分支汇到同一个节点不该跑两遍', async () => {
    const fan: AiNodeHandler = {
      kind: 'fan',
      run: () => ({ nextEdgeIds: ['e2', 'e3'], status: 'advance' }),
    };
    const harness = makeRunner(
      fakeProvider(() => ({ text: 'x' })),
      { handlers: [fan] },
    );
    const state = await harness.runner.run(
      def(
        [
          node('s', 'start'),
          node('f', 'fan'),
          node('n', 'llm', { model: 'm', prompt: '跑一次' }),
          node('e', 'end'),
        ],
        [
          { id: 'e1', source: 's', target: 'f' },
          { id: 'e2', source: 'f', target: 'n' },
          { id: 'e3', source: 'f', target: 'n' },
          { id: 'e4', source: 'n', target: 'e' },
        ],
      ),
    );
    expect(state.nodes.n!.attempts).toBe(1);
    expect(harness.provider.calls).toHaveLength(1);
  });

  it('分支选了不属于自己出边的边要立刻失败：当成没命中放过的话，流程会走一条图上没有的路线', async () => {
    const ghost: AiNodeHandler = {
      kind: 'fan',
      run: () => ({ nextEdgeIds: ['不是我的边'], status: 'advance' }),
    };
    const harness = makeRunner(
      fakeProvider(() => ({ text: 'x' })),
      { handlers: [ghost] },
    );
    const state = await harness.runner.run(
      def(
        [
          node('s', 'start'),
          node('f', 'fan'),
          node('n', 'llm', { model: 'm', prompt: '到不了' }),
        ],
        [
          { id: 'e1', source: 's', target: 'f' },
          { id: 'e2', source: 'f', target: 'n' },
        ],
      ),
    );
    expect(state.status).toBe('failed');
    expect(state.logs.at(-1)?.message).toContain('不属于它出边的分支');
  });

  it('skip 是不写值地空转：节点仍然 succeeded，下游照常推进', async () => {
    const noop: AiNodeHandler = {
      kind: 'fan',
      run: () => ({ status: 'skip' }),
    };
    const harness = makeRunner(
      fakeProvider(() => ({ text: 'x' })),
      { handlers: [noop] },
    );
    const state = await harness.runner.run(
      def(
        [
          node('s', 'start'),
          node('f', 'fan'),
          node('n', 'llm', { model: 'm', prompt: '照常跑' }),
          node('e', 'end'),
        ],
        [
          { id: 'e1', source: 's', target: 'f' },
          { id: 'e2', source: 'f', target: 'n' },
          { id: 'e3', source: 'n', target: 'e' },
        ],
      ),
    );
    expect(state.nodes.f!.status).toBe('succeeded');
    expect(state.nodes.f!.output).toBeUndefined();
    expect(state.status).toBe('succeeded');
  });
});

describe('节点失败与重试', () => {
  it('前两次抛错、第三次成功：attempts 记到 3，退避是 100/200 的指数序列', async () => {
    const provider = fakeProvider((call) =>
      call <= 2 ? new Error('网关 502') : { text: TEXT },
    );
    const harness = makeRunner(provider);
    const state = await harness.runner.run(
      linearFlow({ retries: 2, retryDelayMs: 100 }),
    );

    expect(state.status).toBe('succeeded');
    expect(state.nodes.llm1!.attempts).toBe(3);
    expect(harness.sleeps).toEqual([100, 200]);
    expect(state.logs.filter((log) => log.level === 'warn')).toHaveLength(2);
    expect(state.logs[0]?.message).toContain('第 2 次尝试');
    expect(state.logs[0]?.message).toContain('网关 502');
  });

  it('重试次数用尽就整条落 failed，并把最后一次错误留在节点上 —— 而不是悄悄往下走', async () => {
    const provider = fakeProvider(() => new Error('一直失败'));
    const harness = makeRunner(provider);
    const state = await harness.runner.run(
      linearFlow({ retries: 1, retryDelayMs: 50 }),
    );

    expect(state.status).toBe('failed');
    expect(provider.calls).toHaveLength(2);
    expect(harness.sleeps).toEqual([50]);
    expect(state.nodes.llm1!.status).toBe('failed');
    expect(state.nodes.llm1!.attempts).toBe(2);
    expect(state.nodes.llm1!.error).toBe('一直失败');
    expect(state.logs.at(-1)?.level).toBe('error');
    expect(state.logs.at(-1)?.message).toContain('失败：一直失败');
    expect(state.nodes.e!.status).toBe('pending');
    expect(state.output).toBeUndefined();
  });

  it('处理器主动返回 fail 也算节点失败，时间线上看得出一步黄了', async () => {
    const refuse: AiNodeHandler = {
      kind: 'llm',
      run: () => ({ reason: '内容不合格', status: 'fail' }),
    };
    const harness = makeRunner(
      fakeProvider(() => ({ text: TEXT })),
      { handlers: [refuse] },
    );
    const state = await harness.runner.run(linearFlow());
    expect(state.status).toBe('failed');
    expect(state.nodes.llm1!.error).toBe('内容不合格');
    expect(state.logs.at(-1)?.message).toContain('内容不合格');
    expect(
      harness.events.filter((kind) => kind === 'node.finished'),
    ).toHaveLength(2);
  });

  it('未注册的 kind 且没有兜底处理器时失败，原因写清楚是「没注册」而不是「跑不通」', async () => {
    const harness = makeRunner(fakeProvider(() => ({ text: TEXT })));
    const state = await harness.runner.run(
      def(
        [node('s', 'start'), node('r', 'rag'), node('e', 'end')],
        [
          { id: 'e1', source: 's', target: 'r' },
          { id: 'e2', source: 'r', target: 'e' },
        ],
      ),
    );
    expect(state.status).toBe('failed');
    expect(state.nodes.r!.error).toContain('没有注册处理器');
    expect(state.nodes.r!.status).toBe('failed');
  });

  it('配置了 fallbackHandler 就直通：草稿态画布上没实现的节点不该把整条运行卡住', async () => {
    const harness = makeRunner(
      fakeProvider(() => ({ text: TEXT })),
      { fallbackHandler: passthroughFallbackHandler },
    );
    const state = await harness.runner.run(
      def(
        [node('s', 'start'), node('r', 'rag'), node('e', 'end')],
        [
          { id: 'e1', source: 's', target: 'r' },
          { id: 'e2', source: 'r', target: 'e' },
        ],
      ),
    );
    expect(state.status).toBe('succeeded');
    expect(state.nodes.r!.status).toBe('succeeded');
  });

  it('宿主注册同名 kind 即覆盖内置处理器 —— 换实现不必 fork 运行器', async () => {
    const cached: AiNodeHandler = {
      kind: 'llm',
      // 覆盖内置实现自己要负责产物键：运行器只按 outputKey 落值表，不替处理器决定
      run: (ctx) => ({
        output: '来自自定义处理器',
        outputKey: ctx.data.outputKey,
        status: 'advance',
      }),
    };
    const harness = makeRunner(
      fakeProvider(() => ({ text: TEXT })),
      { handlers: [cached] },
    );
    const state = await harness.runner.run(linearFlow());
    expect(state.values['改写结果']).toBe('来自自定义处理器');
    expect(harness.provider.calls).toHaveLength(0);
    expect(harness.runner.handlers.get('llm')).toBe(cached);
  });

  it('处理器抛非 Error 的东西时日志里也是可读文本，不该出现 [object Object]', async () => {
    const weird: AiNodeHandler = {
      kind: 'llm',
      run: () => {
        throw { code: '内容不合格' };
      },
    };
    const harness = makeRunner(
      fakeProvider(() => ({ text: TEXT })),
      { handlers: [weird] },
    );
    const state = await harness.runner.run(linearFlow());
    expect(state.status).toBe('failed');
    expect(state.nodes.llm1!.error).toContain('内容不合格');
    expect(state.nodes.llm1!.error).not.toContain('[object Object]');

    // 抛字符串是宿主封装里常见的写法：原样收进日志，而不是包成 "undefined" 或再 JSON 一次带引号
    const shouty: AiNodeHandler = {
      kind: 'llm',
      run: () => {
        throw '模型配额用尽';
      },
    };
    const second = makeRunner(
      fakeProvider(() => ({ text: TEXT })),
      { handlers: [shouty] },
    );
    const byString = await second.runner.run(linearFlow());
    expect(byString.nodes.llm1!.error).toBe('模型配额用尽');
  });
});

describe('取消与中止', () => {
  it('取消一个在跑的运行：状态落 canceled、Provider 收到中止信号，且 run() 仍然是 resolve', async () => {
    const provider = abortableProvider();
    resetClock();
    let seq = 0;
    const runner = createAiRunner({
      clock: now,
      idFactory: (prefix) => `${prefix}-${(seq += 1)}`,
      provider,
      sleep: async () => undefined,
    });
    const pending = runner.run(linearFlow());
    await until(() => provider.calls.length === 1);

    expect(runner.cancel('run-1')).toBe(true);
    const state = await pending;

    expect(state.status).toBe('canceled');
    expect(state.nodes.llm1!.status).toBe('canceled');
    expect(provider.calls[0]?.signal?.aborted).toBe(true);
    // 收尾之后已经没有进行中的运行了
    expect(runner.cancel('run-1')).toBe(false);
  });

  it('取消导致的失败绝不重试：漏了这一行，一次用户取消会被烧掉 retries 次模型调用的钱', async () => {
    const provider = abortableProvider();
    resetClock();
    let seq = 0;
    const runner = createAiRunner({
      clock: now,
      idFactory: (prefix) => `${prefix}-${(seq += 1)}`,
      provider,
      sleep: async () => undefined,
    });
    const pending = runner.run(linearFlow({ retries: 3, retryDelayMs: 10 }));
    await until(() => provider.calls.length === 1);
    runner.cancel('run-1');
    const state = await pending;

    expect(state.nodes.llm1!.attempts).toBe(1);
    expect(provider.calls).toHaveLength(1);
    expect(state.nodes.llm1!.error).toBeUndefined();
    expect(state.status).toBe('canceled');
  });

  it('取消时同波里还没开始的兄弟节点被标 canceled 且不敲 Provider，日志说明是在收尾', async () => {
    const provider = abortableProvider();
    resetClock();
    let seq = 0;
    const runner = createAiRunner({
      clock: now,
      idFactory: (prefix) => `${prefix}-${(seq += 1)}`,
      maxConcurrency: 1,
      provider,
      sleep: async () => undefined,
    });
    const wide = def(
      [
        node('s', 'start'),
        node('a', 'llm', { model: 'm', prompt: '甲' }),
        node('b', 'llm', { model: 'm', prompt: '乙' }),
        node('e', 'end'),
      ],
      [
        { id: 'e1', source: 's', target: 'a' },
        { id: 'e2', source: 's', target: 'b' },
        { id: 'e3', source: 'a', target: 'e' },
        { id: 'e4', source: 'b', target: 'e' },
      ],
    );
    const pending = runner.run(wide);
    await until(() => provider.calls.length === 1);
    runner.cancel('run-1');
    const state = await pending;

    expect(state.status).toBe('canceled');
    expect(state.nodes.a!.status).toBe('canceled');
    expect(state.nodes.b!.status).toBe('canceled');
    expect(provider.calls).toHaveLength(1);
    expect(state.logs.some((log) => log.message.includes('取消请求'))).toBe(
      true,
    );
  });

  it('已经跑完之后再取消返回 false，不会把 succeeded 改成 canceled —— 取消只对在跑的运行有效', async () => {
    const harness = makeRunner(fakeProvider(() => ({ text: TEXT })));
    const state = await harness.runner.run(linearFlow());
    expect(state.status).toBe('succeeded');
    expect(harness.runner.cancel(state.id)).toBe(false);
    expect((harness.runner.state(state.id) as AiRunState).status).toBe(
      'succeeded',
    );
  });
});

describe('超时', () => {
  it('节点 timeoutMs 到点就中止并落 failed：错误码是 node-timeout，而不是「卡住不动」', async () => {
    const harness = makeRunner(
      fakeProvider(() => ({ text: TEXT }), { neverSettles: true }),
    );
    const state = await harness.runner.run(linearFlow({ timeoutMs: 50 }));

    expect(state.status).toBe('failed');
    expect(harness.sleeps).toEqual([50]);
    expect(state.nodes.llm1!.error).toContain('执行超过 50ms 被中止');
    expect(state.nodes.llm1!.status).toBe('failed');
  });

  it('节点没写 timeoutMs 时用运行器级默认；两处都没配就完全不设限（多久算超时是 Provider 的事）', async () => {
    const withDefault = makeRunner(
      fakeProvider(() => ({ text: TEXT }), { neverSettles: true }),
      { timeoutMs: 30 },
    );
    await withDefault.runner.run(linearFlow());
    expect(withDefault.sleeps).toEqual([30]);

    const unlimited = makeRunner(fakeProvider(() => ({ text: TEXT })));
    const state = await unlimited.runner.run(linearFlow());
    expect(unlimited.sleeps).toEqual([]);
    expect(state.status).toBe('succeeded');
  });

  it('超时与取消的区别就在能不能重试：每次尝试都重新拿到一份预算', async () => {
    const harness = makeRunner(
      fakeProvider(() => ({ text: TEXT }), { neverSettles: true }),
    );
    const state = await harness.runner.run(
      linearFlow({ retries: 1, retryDelayMs: 200, timeoutMs: 50 }),
    );

    expect(harness.sleeps).toEqual([50, 200, 50]);
    expect(state.status).toBe('failed');
    expect(state.nodes.llm1!.attempts).toBe(2);
    expect(harness.provider.calls).toHaveLength(2);
  });
});

describe('挂起与续跑', () => {
  const humanFlow = () =>
    def(
      [
        node('s', 'start'),
        node('h', 'human', { resumeLabel: '请人工确认' }),
        node('e', 'end'),
      ],
      [
        { id: 'e1', source: 's', target: 'h' },
        { id: 'e2', source: 'h', target: 'e' },
      ],
    );

  it('人工确认节点第一次到达即挂起，运行态整份是纯数据（可以序列化存库）', async () => {
    const harness = makeRunner(fakeProvider(() => ({ text: TEXT })));
    const state = await harness.runner.run(humanFlow());

    expect(state.status).toBe('awaiting');
    expect(state.awaiting).toEqual({ nodeId: 'h', resumeLabel: '请人工确认' });
    expect(state.nodes.h!.status).toBe('awaiting');
    expect(state.finishedAt).toBeUndefined();
    expect(harness.events).toContain('run.awaiting');
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('resume 把人的输入交回该节点并走到结束，产物键带 _human 后缀', async () => {
    const harness = makeRunner(fakeProvider(() => ({ text: TEXT })));
    const paused = await harness.runner.run(humanFlow());
    const done = await harness.runner.resume(paused, '同意');

    expect(done.status).toBe('succeeded');
    expect(done.values.h_human).toBe('同意');
    expect(done.nodes.h!.status).toBe('succeeded');
    expect(done.awaiting).toBeUndefined();
  });

  it('跨进程续跑：只靠序列化后的运行态 + definitions 就能接上（内存里没有这次运行也不影响）', async () => {
    const first = makeRunner(fakeProvider(() => ({ text: TEXT })));
    const paused = await first.runner.run(humanFlow());
    const snapshot = JSON.parse(JSON.stringify(paused)) as AiRunState;

    const second = makeRunner(
      fakeProvider(() => ({ text: TEXT })),
      {
        definitions: { [paused.flowId]: humanFlow() },
      },
    );
    const done = await second.runner.resume(snapshot, '同意');

    expect(done.status).toBe('succeeded');
    expect(done.values.h_human).toBe('同意');
    expect(done.id).toBe(snapshot.id);
  });

  it('查不到定义时报 definition-not-found 并说明下一步动作，而不是在深处炸一个 undefined', async () => {
    const first = makeRunner(fakeProvider(() => ({ text: TEXT })));
    const paused = await first.runner.run(humanFlow());
    const snapshot = JSON.parse(JSON.stringify(paused)) as AiRunState;
    const second = makeRunner(fakeProvider(() => ({ text: TEXT })));
    await expect(second.runner.resume(snapshot, '同意')).rejects.toThrow(
      /definitions/u,
    );
  });

  it('resume 的两种误用各有说法：字符串 runId 不在内存里 / 当前状态根本不在等', async () => {
    const harness = makeRunner(fakeProvider(() => ({ text: TEXT })));
    await expect(harness.runner.resume('不存在-的-runId')).rejects.toThrow(
      /跨进程续跑/u,
    );
    const finished = await harness.runner.run(linearFlow());
    await expect(harness.runner.resume(finished, '同意')).rejects.toThrow(
      /不在等待人工确认的状态/u,
    );
  });
});

describe('未走到的分支要有自己的状态：skipped', () => {
  /** 只认领 eHot 那条边的分流节点：内置 condition 要配表达式，这里用一个处理器把「选了哪条边」写死 */
  const hotOnly: AiNodeHandler = {
    kind: 'fan',
    run: () => ({ nextEdgeIds: ['eHot'], status: 'advance' }),
  };

  function branchFlow(tail: AiNodeHandler['kind']) {
    return def(
      [
        node('s', 'start'),
        node('f', 'fan'),
        node('hot', tail, { model: 'm', prompt: '命中分支' }),
        node('cold', 'llm', { model: 'm', prompt: '没命中的分支' }),
        node('e', 'end'),
      ],
      [
        { id: 'e1', source: 's', target: 'f' },
        { id: 'eHot', source: 'f', target: 'hot' },
        { id: 'eCold', source: 'f', target: 'cold' },
        { id: 'e2', source: 'hot', target: 'e' },
      ],
    );
  }

  it('跑完收口时，未命中分支的节点是 skipped 而不是 pending —— 画布靠这两个词分「没走」和「还没轮到」', async () => {
    const harness = makeRunner(
      fakeProvider(() => ({ text: TEXT })),
      { handlers: [hotOnly] },
    );
    const state = await harness.runner.run(branchFlow('llm'));

    expect(state.status).toBe('succeeded');
    expect(state.nodes.hot!.status).toBe('succeeded');
    expect(state.nodes.cold!.status).toBe('skipped');
    // 没走到的分支一次模型都不该调：skipped 不是"跑了但没写值"
    expect(harness.provider.calls).toHaveLength(1);
    expect(state.logs.at(-1)?.message).toContain('1 个节点没被走到');
    // frontier 已经清空：skipped 只是给人看的结论，不参与调度
    expect(state.frontier).toEqual([]);
  });

  it('挂起时就该下结论：未命中的分支立刻 skipped，而挂起节点的下游仍然 pending', async () => {
    const harness = makeRunner(
      fakeProvider(() => ({ text: TEXT })),
      { handlers: [hotOnly] },
    );
    const paused = await harness.runner.run(branchFlow('human'));

    expect(paused.status).toBe('awaiting');
    expect(paused.nodes.cold!.status).toBe('skipped');
    // e 在挂起节点的下游，续跑时才会跑到 —— 把它标成 skipped 就等于说「这条路不要了」，是假结论
    expect(paused.nodes.e!.status).toBe('pending');

    const done = await harness.runner.resume(paused, '同意');
    expect(done.nodes.cold!.status).toBe('skipped');
    expect(done.nodes.e!.status).toBe('succeeded');
    expect(done.status).toBe('succeeded');
  });

  it('被中断的运行不下 skipped 结论：failed 时 pending 节点保留原样，宿主从中间续跑还认得它们', async () => {
    const harness = makeRunner(
      fakeProvider(() => new Error('网关 502')),
      { handlers: [hotOnly] },
    );
    const state = await harness.runner.run(branchFlow('llm'));

    expect(state.status).toBe('failed');
    expect(state.nodes.hot!.status).toBe('failed');
    expect(state.nodes.cold!.status).toBe('pending');
    expect(state.nodes.e!.status).toBe('pending');
    expect(state.logs.some((log) => log.message.includes('没被走到'))).toBe(
      false,
    );
  });
});

describe('跑不动的图要有明确结论', () => {
  it('空图直接 failed 并留下一条日志，不抛异常', async () => {
    const harness = makeRunner(fakeProvider(() => ({ text: TEXT })));
    const state = await harness.runner.run(def([], []));
    expect(state.status).toBe('failed');
    expect(state.logs.map((log) => log.message)).toEqual([
      '流程图里一个节点都没有',
    ]);
    expect(harness.events.at(-1)).toBe('run.finished');
  });

  it('全图入度都不为 0（纯循环）时报「没有入口」，而不是随机挑一个节点起跑', async () => {
    const harness = makeRunner(fakeProvider(() => ({ text: TEXT })));
    const state = await harness.runner.run(
      def(
        [
          node('a', 'llm', { model: 'm', prompt: '甲' }),
          node('b', 'llm', { model: 'm', prompt: '乙' }),
        ],
        [
          { id: 'e1', source: 'a', target: 'b' },
          { id: 'e2', source: 'b', target: 'a' },
        ],
      ),
    );
    expect(state.status).toBe('failed');
    expect(state.logs.at(-1)?.message).toContain('没有入口节点');
  });

  it('maxSteps 兜住不收敛的循环：报的是「波次超过上限」，让设计期知道该开 allowCycles 还是该修图', async () => {
    const loopBody: AiNodeHandler = {
      kind: 'loop',
      run: () => ({ nextEdgeIds: ['e3'], status: 'advance' }),
    };
    const harness = makeRunner(
      fakeProvider(() => ({ text: TEXT })),
      { handlers: [loopBody], maxSteps: 3 },
    );
    const state = await harness.runner.run(
      def(
        [node('s', 'start'), node('l', 'loop'), node('e', 'end')],
        [
          { id: 'e1', source: 's', target: 'l' },
          { id: 'e3', source: 'l', target: 'l' },
          { id: 'e4', source: 'l', target: 'e' },
        ],
      ),
    );
    expect(state.status).toBe('failed');
    expect(state.logs.at(-1)?.message).toContain('推进波次超过上限 3');
    expect(state.steps).toBe(4);
  });

  it('llm 节点既没配 prompt 又没有上游产物时报 llm-no-input，而不是发一个空请求烧 token', async () => {
    const harness = makeRunner(fakeProvider(() => ({ text: TEXT })));
    // llm 当入口且没有入边：directKeys 为空、又没写 prompt/inputKeys，此时请求体是彻底空的
    const state = await harness.runner.run(
      def(
        [node('a', 'llm', { model: 'm' }), node('e', 'end')],
        [{ id: 'e1', source: 'a', target: 'e' }],
      ),
    );
    expect(state.status).toBe('failed');
    expect(state.nodes.a!.error).toContain('没有任何输入');
    expect(harness.provider.calls).toHaveLength(0);
  });

  it('上游有产物时 llm 默认把直接前驱喂进上下文，outputKey 改了要能指出是哪个键没了', async () => {
    const base = def(
      [
        node('s', 'start'),
        node('t', 'transform', { expression: '1 + 1' }),
        node('a', 'llm', { model: 'm' }),
        node('e', 'end'),
      ],
      [
        { id: 'e1', source: 's', target: 't' },
        { id: 'e2', source: 't', target: 'a' },
        { id: 'e3', source: 'a', target: 'e' },
      ],
    );
    const harness = makeRunner(fakeProvider(() => ({ text: TEXT })));
    const state = await harness.runner.run(base);
    expect(harness.provider.calls[0]?.messages).toEqual([
      { content: '2', role: 'user' },
    ]);
    expect(state.status).toBe('succeeded');

    const renamed = def(
      base.nodes.map((item) =>
        item.id === 't'
          ? { ...item, data: { ...item.data, outputKey: '改名了' } }
          : item,
      ),
      base.edges,
    );
    const second = makeRunner(fakeProvider(() => ({ text: TEXT })));
    await expect(
      second.runner.run(
        def(
          renamed.nodes.map((item) =>
            item.id === 'a'
              ? { ...item, data: { ...item.data, inputKeys: ['t'] } }
              : item,
          ),
          renamed.edges,
        ),
      ),
    ).resolves.toMatchObject({
      nodes: { a: { error: expect.stringContaining('t') } },
    });
  });
});

describe('运行器的门面', () => {
  it('runner.state 只认内存里登记过的运行；序列化过的运行本来就不依赖它', async () => {
    const harness = makeRunner(fakeProvider(() => ({ text: TEXT })));
    const state = await harness.runner.run(linearFlow());
    expect(harness.runner.state(state.id)).toBe(state);
    expect(harness.runner.state('没跑过')).toBeUndefined();
  });

  it('on 返回的退订函数真的退订：共用一个 runner 的几个页面切换时不该继续收事件', async () => {
    const harness = makeRunner(fakeProvider(() => ({ text: TEXT })));
    const seen: string[] = [];
    const off = harness.runner.on((event) => seen.push(event.kind));
    off();
    await harness.runner.run(linearFlow());
    expect(seen).toEqual([]);
  });

  it('注册表暴露给宿主且缺省含内置八种：追加处理器不改内置语义', async () => {
    const harness = makeRunner(fakeProvider(() => ({ text: TEXT })));
    expect(
      harness.runner.handlers.list().map((handler) => handler.kind),
    ).toEqual(
      createAiNodeRegistry()
        .list()
        .map((handler) => handler.kind),
    );
    expect(harness.runner.provider).toBe(harness.provider);
  });
});
