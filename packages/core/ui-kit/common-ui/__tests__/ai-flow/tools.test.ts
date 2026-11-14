import type {
  AiMessage,
  AiRequest,
  AiResult,
  ToolContext,
  ToolLoopRequest,
  ToolParam,
  ToolSpec,
} from '../../src/ai-flow/core/types';

import { describe, expect, it } from 'vitest';

import {
  coerceToolArgs,
  createToolRegistry,
  isToolRegistryLike,
  runTool,
  runToolLoop,
  toToolSchemas,
} from '../../src/ai-flow/core/tools';

/**
 * 工具注册表与工具循环（`core/tools.ts`）。
 *
 * 全篇不联网：工具实现就是这里的几个闭包，`invoke` 是手写的假 Provider 出口。
 * 值得测的理由集中在一处 —— schema 映射与回喂消息的形状错了，症状是「模型死活不调用工具」
 * 或「模型在等一个永远不会来的答案」，线上要靠抓包才能看出来，所以必须能在离线里断言。
 */

const ctx: ToolContext = {
  now: () => 1_700_000_000_000,
  runId: 'run-1',
  values: { 租户: 'acme' },
};

function param(
  name: string,
  type: ToolParam['type'],
  extra: Partial<ToolParam> = {},
): ToolParam {
  return { name, type, ...extra };
}

/** 记账用的工具：留下最后一次收到的 args 与 ctx，方便断言「强转后的值」而不是原始值 */
function spyTool(
  name: string,
  parameters: ToolParam[],
  output: unknown = '工具产物',
) {
  const seen: Array<{ args: Record<string, unknown>; ctx: ToolContext }> = [];
  const tool: ToolSpec = {
    description: `${name} 的描述`,
    name,
    parameters,
    run: (args, toolCtx) => {
      seen.push({ args, ctx: toolCtx });
      return output;
    },
  };
  return { seen, tool };
}

function boomTool(name: string, error: unknown): ToolSpec {
  return {
    description: `${name} 会抛错`,
    name,
    parameters: [],
    run: () => {
      throw error;
    },
  };
}

/** 按脚本一轮轮回话的假 invoke：数组长度就是「模型被问了几次」 */
function scripted(results: Array<Partial<AiResult>>): {
  calls: AiRequest[];
  invoke: (request: AiRequest) => Promise<AiResult>;
} {
  const calls: AiRequest[] = [];
  return {
    calls,
    invoke: async (request: AiRequest) => {
      const outcome = results[calls.length] ?? { text: '收敛了' };
      calls.push(request);
      return { text: outcome.text ?? '', ...outcome } as AiResult;
    },
  };
}

function loopRequest(
  overrides: Partial<ToolLoopRequest> = {},
): ToolLoopRequest {
  return {
    ctx,
    invoke: scripted([{ text: '不用工具' }]).invoke,
    messages: [{ content: '查一下北京天气', role: 'user' }],
    ...overrides,
  };
}

describe('注册表的存取', () => {
  it('同 name 后注册者覆盖：宿主接 MCP 时整表替换，不该留着上一版实现', () => {
    const first = spyTool('weather', [], '第一版');
    const second = spyTool('weather', [], '第二版');
    const registry = createToolRegistry({ tools: [first.tool] });
    expect(registry.get('weather')).toBe(first.tool);
    expect(registry.has('weather')).toBe(true);

    registry.register(second.tool);
    expect(registry.get('weather')).toBe(second.tool);
    expect(registry.list()).toHaveLength(1);

    // 取消注册返回是否存在过：UI 的「移除工具」要靠它决定要不要提示
    expect(registry.unregister('weather')).toBe(true);
    expect(registry.unregister('weather')).toBe(false);
    expect(registry.has('weather')).toBe(false);
  });

  it('toToolSchemas 是纯映射、无副作用：这段错了表现为「模型死活不调用工具」，是全包最难查的一类故障', () => {
    const [schema] = toToolSchemas([
      spyTool('weather', [
        param('城市', 'string', { description: '城市名', required: true }),
        param('天数', 'number'),
      ]).tool,
    ]);
    expect(schema).toEqual({
      function: {
        description: 'weather 的描述',
        name: 'weather',
        parameters: {
          properties: {
            城市: { description: '城市名', type: 'string' },
            天数: { type: 'number' },
          },
          required: ['城市'],
          type: 'object',
        },
      },
      type: 'function',
    });
    // properties 的键序按声明序、required 只收声明为必填的：顺序变了模型的行为就会漂
    expect(Object.keys(schema!.function.parameters.properties)).toEqual([
      '城市',
      '天数',
    ]);
    expect(toToolSchemas([])).toEqual([]);
  });

  it('registry.schemas 只取点名的工具，未注册的名字静默跳过 —— 交给运行前的 unknown-tool 校验去报错', () => {
    const registry = createToolRegistry({
      tools: [spyTool('a', []).tool, spyTool('b', []).tool],
    });
    expect(registry.schemas(['b']).map((item) => item.function.name)).toEqual([
      'b',
    ]);
    expect(
      registry.schemas(['b', 'ghost']).map((item) => item.function.name),
    ).toEqual(['b']);
    // 不传 names 就是全表：节点没配 tools 时把整表给模型
    expect(registry.schemas().map((item) => item.function.name)).toEqual([
      'a',
      'b',
    ]);
  });

  it('isToolRegistryLike 认结构而不是认出身：宿主自己实现的注册表在装配前先问一句', () => {
    expect(isToolRegistryLike(createToolRegistry())).toBe(true);
    expect(
      isToolRegistryLike({
        get: 1,
        list: () => [],
        runTool: () => {},
        runToolLoop: () => {},
        schemas: () => [],
      }),
    ).toBe(false);
    expect(isToolRegistryLike(undefined)).toBe(false);
    expect(isToolRegistryLike({})).toBe(false);
  });
});

describe('参数强转', () => {
  it('string 收数字与布尔时 stringify，收对象就报错：硬转对象说明模型误解了参数含义', () => {
    const { args, errors } = coerceToolArgs(
      [param('a', 'string'), param('b', 'string'), param('c', 'string')],
      {
        a: 42,
        b: true,
        c: { 不是: '字符串' },
      },
    );
    expect(args).toMatchObject({ a: '42', b: 'true' });
    expect(errors).toEqual(['参数 "c" 期望 string，实际是 object']);
  });

  it('number 只认「确实是数」的字符串：空串与带汉字的串报错，不能悄悄变成 NaN 或 0', () => {
    const { args, errors } = coerceToolArgs(
      [
        param('天数', 'number'),
        param('空的', 'number'),
        param('乱的', 'number'),
      ],
      { 天数: ' 7 ', 乱的: '三天', 空的: '  ' },
    );
    expect(args['天数']).toBe(7);
    expect(errors).toHaveLength(2);
    expect(errors.join(',')).toContain('期望 number，实际是 string');
    expect(args['空的']).toBe('  ');
  });

  it('boolean 认 true/false/1/0 四种写法（模型四种都会给），其余保持报错', () => {
    const { args, errors } = coerceToolArgs(
      [
        param('t', 'boolean'),
        param('f', 'boolean'),
        param('n1', 'boolean'),
        param('n0', 'boolean'),
        param('bad', 'boolean'),
      ],
      { bad: '也许', f: 'FALSE', n0: 0, n1: 1, t: 'true' },
    );
    expect(args).toMatchObject({ f: false, n0: false, n1: true, t: true });
    expect(errors).toEqual(['参数 "bad" 期望 boolean，实际是 string']);
  });

  it('array/object 只接受「JSON 字符串」这一种安全转换；数组还要逐个验元素类型', () => {
    const { args, errors } = coerceToolArgs(
      [
        param('列表', 'array', { items: 'string' }),
        param('对象', 'object'),
        param('坏串', 'array'),
        param('错位', 'array', { items: 'number' }),
      ],
      { 对象: '{"k":1}', 坏串: '[1,2', 错位: '["甲"]', 列表: '["甲","乙"]' },
    );
    expect(args).toMatchObject({ 列表: ['甲', '乙'], 对象: { k: 1 } });
    expect(errors).toEqual([
      '参数 "坏串" 期望 array，收到的字符串不是合法 JSON',
      '参数 "错位" 元素期望 number，实际是 string',
    ]);
    // 已经是数组就直接透传，不再 JSON 一遍
    const passthrough = coerceToolArgs([param('列表', 'array')], {
      列表: [1, 2],
    });
    expect(passthrough.args['列表']).toEqual([1, 2]);
    expect(passthrough.errors).toEqual([]);
  });

  it('必填缺失与类型不合一起收集成 errors 而不是抛异常：这些文本要原样回喂给模型重试', () => {
    const { args, errors } = coerceToolArgs(
      [
        param('城市', 'string', { required: true }),
        param('天数', 'number', { required: true }),
      ],
      { 城市: '', 天数: 'x' },
    );
    // 空串是「有值」，不该被当成缺失；只有 undefined/null 才算缺
    expect(errors).toEqual(['参数 "天数" 期望 number，实际是 string']);
    expect(args['城市']).toBe('');

    const missing = coerceToolArgs(
      [param('城市', 'string', { required: true })],
      undefined,
    );
    expect(missing.errors).toEqual(['缺少必填参数 "城市"']);
  });

  it('未声明的键原样透传、可选键传 null 时删掉：模型爱加解释字段，工具自己决定用不用', () => {
    const source = {
      说明: '模型自己加的',
      城市: '北京',
      天数: null,
      可选: null,
      必填: '要',
    };
    const { args, errors } = coerceToolArgs(
      [
        param('必填', 'string', { required: true }),
        param('城市', 'string'),
        param('天数', 'number'),
      ],
      source,
    );
    expect(errors).toEqual([]);
    // 声明过的可选键传 null 会被摘掉，工具里的 `args.天数 ?? 7` 才真走到缺省分支；没声明的键连值一起留着
    expect(args).toEqual({
      城市: '北京',
      必填: '要',
      说明: '模型自己加的',
      可选: null,
    });
    expect('天数' in args).toBe(false);
    // 不改动调用方传进来的对象：那是模型的原始回复，回喂与排错都要它保持原样
    expect(source).toEqual({
      说明: '模型自己加的',
      城市: '北京',
      天数: null,
      可选: null,
      必填: '要',
    });
  });

  it('不支持的 type 报「不支持的参数类型」，而不是在深处 undefined 崩掉', () => {
    const { errors } = coerceToolArgs(
      [param('怪', 'date' as unknown as ToolParam['type'])],
      { 怪: '2026-01-01' },
    );
    expect(errors).toEqual(['参数 "怪" 不支持的参数类型 "date"']);
  });
});

describe('runTool 的三种失败', () => {
  it('未注册 / 参数不合格 / 实现抛错，统一成 { ok:false }，工具堆栈不许冒到运行器', async () => {
    const { tool } = spyTool('weather', [
      param('城市', 'string', { required: true }),
    ]);
    const registry = createToolRegistry({
      tools: [tool, boomTool('boom', new Error('数据库连不上'))],
    });

    const ghost = await registry.runTool('ghost', {}, ctx);
    expect(ghost).toEqual({
      error: '工具 "ghost" 未注册',
      invalid: true,
      name: 'ghost',
      ok: false,
    });

    const invalid = await registry.runTool('weather', { 城市: { 坏: 1 } }, ctx);
    expect(invalid).toMatchObject({ invalid: true, ok: false });
    expect(invalid.error).toContain('期望 string，实际是 object');

    const thrown = await registry.runTool('boom', {}, ctx);
    // 抛错这一类没有 invalid：不是模型写错了参数，重试同样的请求也不会变好
    expect(thrown).toEqual({ error: '数据库连不上', name: 'boom', ok: false });

    const ok = await registry.runTool('weather', { 城市: '北京' }, ctx);
    expect(ok).toEqual({ name: 'weather', ok: true, output: '工具产物' });
  });

  it('交给工具实现的是强转后的 args，ctx 原样传递：类型转换只做一次且只在入口做', async () => {
    const { seen, tool } = spyTool('weather', [param('天数', 'number')]);
    const byName = new Map([[tool.name, tool]]);
    const result = await runTool('weather', { 天数: '3' }, ctx, byName);
    expect(result.ok).toBe(true);
    expect(seen[0]?.args).toEqual({ 天数: 3 });
    expect(seen[0]?.ctx).toBe(ctx);
    // 不传 byName 时独立函数查不到工具：注册表才是名字的出处
    const orphan = await runTool('weather', {}, ctx);
    expect(orphan).toMatchObject({ ok: false });
  });
});

describe('runToolLoop 的往返与回喂', () => {
  it('模型不点名工具就一轮收工：iterations 记的是真实往返次数', async () => {
    const spy = scripted([{ text: '直接回答' }]);
    const loop = await runToolLoop(
      loopRequest({ invoke: spy.invoke }),
      new Map(),
    );
    expect(loop.iterations).toBe(1);
    expect(loop.result.text).toBe('直接回答');
    expect(loop.toolResults).toEqual([]);
    // 原始 messages 不被改动：循环内部用的是副本
    expect(loop.messages).toHaveLength(1);
  });

  it('一次工具调用要补两条消息回喂（assistant 带 toolCalls、tool 带 toolCallId）：缺了模型不知道自己在等什么', async () => {
    const { tool } = spyTool('weather', [param('城市', 'string')], {
      温度: 21,
    });
    const spy = scripted([
      {
        text: '',
        toolCalls: [{ args: { 城市: '北京' }, id: 'call-1', name: 'weather' }],
      },
      { text: '北京 21 度' },
    ]);
    const loop = await runToolLoop(
      loopRequest({ invoke: spy.invoke }),
      new Map([[tool.name, tool]]),
    );

    expect(loop.iterations).toBe(2);
    expect(loop.messages.map((m: AiMessage) => m.role)).toEqual([
      'user',
      'assistant',
      'tool',
    ]);
    expect(loop.messages[1]!.toolCalls).toEqual([
      { args: { 城市: '北京' }, id: 'call-1', name: 'weather' },
    ]);
    expect(loop.messages[2]).toEqual({
      content: '{"温度":21}',
      name: 'weather',
      role: 'tool',
      toolCallId: 'call-1',
    });
    expect(loop.result.text).toBe('北京 21 度');
    expect(loop.toolResults).toEqual([
      { name: 'weather', ok: true, output: { 温度: 21 } },
    ]);
    // signal / nodeId 每轮都重新带上：取消要能打断循环中间的任意一次往返
    expect(spy.calls[1]?.nodeId).toBeUndefined();
    expect(spy.calls).toHaveLength(2);
  });

  it('参数不合格时把错误文本回喂给模型继续跑，而不是中止整个节点', async () => {
    const { tool } = spyTool('weather', [
      param('城市', 'string', { required: true }),
    ]);
    const spy = scripted([
      { text: '', toolCalls: [{ args: {}, id: 'c1', name: 'weather' }] },
      { text: '这次带上城市了' },
    ]);
    const loop = await runToolLoop(
      loopRequest({ invoke: spy.invoke }),
      new Map([[tool.name, tool]]),
    );
    expect(loop.messages[2]!.content).toContain('缺少必填参数 "城市"');
    expect(loop.toolResults[0]).toMatchObject({ invalid: true, ok: false });
    expect(loop.result.text).toBe('这次带上城市了');
  });

  it('未注册的工具名也回喂而不是抛：模型点了没接的工具时，剩下的工具还能继续', async () => {
    const spy = scripted([
      { text: '', toolCalls: [{ args: {}, id: 'c1', name: 'ghost' }] },
      { text: '改用别的办法' },
    ]);
    const loop = await runToolLoop(
      loopRequest({ invoke: spy.invoke }),
      new Map(),
    );
    expect(loop.messages[2]!.content).toBe('工具执行失败：工具 "ghost" 未注册');
    expect(loop.iterations).toBe(2);
  });

  it('长输出截到 4000 字符再回喂：整张表塞进上下文会把后面几轮全挤掉', async () => {
    const { tool } = spyTool('big', [], 'x'.repeat(4200));
    const spy = scripted([
      { text: '', toolCalls: [{ args: {}, id: 'c1', name: 'big' }] },
      { text: '够了' },
    ]);
    const loop = await runToolLoop(
      loopRequest({ invoke: spy.invoke }),
      new Map([[tool.name, tool]]),
    );
    const fed = loop.messages[2]!.content;
    expect(fed.length).toBeLessThan(4200);
    expect(fed.endsWith('…（已截断）')).toBe(true);
  });

  it('不收敛时抛 tool-loop-limit 并点名最后要的工具，而不是返回一个半成品文本', async () => {
    const { tool } = spyTool('weather', []);
    // 每一轮都坚持要点名工具：这才是「工具描述与任务不匹配」的真实形状
    const stubborn = { args: {}, id: 'c1', name: 'weather' };
    const spy = scripted([
      { text: '', toolCalls: [stubborn] },
      { text: '', toolCalls: [stubborn] },
    ]);
    await expect(
      runToolLoop(
        loopRequest({ invoke: spy.invoke, maxIterations: 2, nodeId: 'llm1' }),
        new Map([[tool.name, tool]]),
      ),
    ).rejects.toMatchObject({
      code: 'tool-loop-limit',
      message: expect.stringContaining('weather'),
    });
    expect(spy.calls).toHaveLength(2);
  });

  it('每轮请求体都合并节点级参数，model 与 signal 走显式优先级', async () => {
    const spy = scripted([{ text: '好了' }]);
    const abort = new AbortController();
    await runToolLoop(
      loopRequest({
        ctx: { ...ctx, signal: abort.signal },
        invoke: spy.invoke,
        model: '节点选的模型',
        nodeId: 'llm1',
        request: {
          maxTokens: 32,
          messages: [],
          model: '请求里的模型',
          temperature: 0.5,
          tools: [
            {
              function: {
                description: 'd',
                name: 'weather',
                parameters: { properties: {}, required: [], type: 'object' },
              },
              type: 'function',
            },
          ],
        },
      }),
      new Map(),
    );
    const request = spy.calls[0]!;
    expect(request.model).toBe('节点选的模型');
    expect(request.maxTokens).toBe(32);
    expect(request.temperature).toBe(0.5);
    expect(request.nodeId).toBe('llm1');
    expect(request.signal).toBe(abort.signal);
    expect(request.tools).toHaveLength(1);
  });

  it('注册表版 runToolLoop 用表里的工具，轮数上限是注册表缺省、被请求覆盖', async () => {
    const { tool } = spyTool('weather', []);
    const registry = createToolRegistry({ maxIterations: 1, tools: [tool] });
    const spy = scripted([
      { text: '', toolCalls: [{ args: {}, id: 'c1', name: 'weather' }] },
    ]);
    // 缺省 1 轮：一次调用完还要再问一次才算收敛，所以这里必然撞上上限
    await expect(
      registry.runToolLoop(loopRequest({ invoke: spy.invoke })),
    ).rejects.toMatchObject({
      code: 'tool-loop-limit',
    });
    // 节点上的 maxIterations 覆盖注册表缺省
    const longer = scripted([
      { text: '', toolCalls: [{ args: {}, id: 'c1', name: 'weather' }] },
      { text: '第二轮就收' },
    ]);
    const done = await registry.runToolLoop(
      loopRequest({ invoke: longer.invoke, maxIterations: 3 }),
    );
    expect(done.iterations).toBe(2);
    expect(done.result.text).toBe('第二轮就收');
  });
});
