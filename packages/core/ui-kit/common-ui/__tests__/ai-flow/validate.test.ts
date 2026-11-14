import type {
  AiFlowDefinition,
  AiNodeData,
  AiNodeHandler,
  AiNodeKind,
  ToolSpec,
} from '../../src/ai-flow/core/types';

import { describe, expect, it } from 'vitest';

import { builtinAiNodeHandlers } from '../../src/ai-flow/core/registry';
import { validateAiFlow } from '../../src/ai-flow/core/validate';

/**
 * 设计期校验（`core/validate.ts`）。
 *
 * 为什么这一层最值得测：它是「保存时就亮红」和「跑起来才炸」的唯一分界线。
 * 误报的代价比漏报还高 —— 草稿态的图被成片报成坏表达式之后，用户会直接关掉校验面板，
 * 于是真正会炸的那几条也跟着被关掉了。所以每条用例都成对写：坏图必须报、可接受的形态必须不报。
 *
 * 另外这里刚做过一次类型收窄（`Pick<AiNodeHandlerRegistry,'has'>` / handler 数组 / kind 字符串数组
 * 三种入参形态），收窄错了不会报错，只会让自定义节点「时认时不认」，所以三种形态各钉一条。
 */

function node(
  id: string,
  type: AiNodeKind,
  data: AiNodeData = {},
  label?: string,
) {
  return { data, id, label, position: { x: 0, y: 0 }, type };
}

function edge(id: string, source: string, target: string) {
  return { id, source, target };
}

function def(
  nodes: AiFlowDefinition['nodes'],
  edges: AiFlowDefinition['edges'],
  name = '测试流程',
): AiFlowDefinition {
  return { edges, id: 'flow-validate', name, nodes, version: 1 };
}

/** 一张干净的最小合法图：起点 → 带 model 的 llm → end，模板变量走 knownInputs */
const validFlow = () =>
  def(
    [
      node('s', 'start'),
      node('a', 'llm', { model: 'gpt-test', prompt: '润色：{{ 原始文本 }}' }),
      node('e', 'end', { outputKey: 'a' }),
    ],
    [edge('e1', 's', 'a'), edge('e2', 'a', 'e')],
  );

function codesOf(
  result: ReturnType<typeof validateAiFlow>,
  level?: 'error' | 'warning',
) {
  return result.issues
    .filter((issue) => level === undefined || issue.level === level)
    .map((issue) => issue.code);
}

function expectCodes(result: ReturnType<typeof validateAiFlow>, code: string) {
  const hits = result.issues.filter((issue) => issue.code === code);
  expect(hits.map((issue) => issue.level)).not.toEqual([]);
  return hits;
}

/** 只有 `get` 这一个方法就够校验用；构造一个真实 ToolSpec 是为了让类型检查站得住 */
const lookupTool: ToolSpec = {
  description: '查资料',
  name: 'lookup',
  parameters: [{ name: 'q', required: true, type: 'string' }],
  run: () => ({ title: '查到了' }),
};

describe('合法图不该被误报', () => {
  it('干净的最小图零问题：把「没配 knownInputs 就报未知变量」这类误报摁住', () => {
    const result = validateAiFlow(validFlow(), undefined, {
      knownInputs: ['原始文本'],
    });
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('条件节点只有一条出边且不写条件时不该吵 —— 顺序流程也常画成网关样子', () => {
    const flow = def(
      [
        node('s', 'start'),
        node('a', 'llm', { model: 'gpt-test' }),
        node('c', 'condition', { defaultEdgeId: 'e3' }),
        node('b', 'llm', { model: 'gpt-test' }),
        node('e', 'end'),
      ],
      [
        edge('e1', 's', 'a'),
        edge('e2', 'a', 'c'),
        edge('e3', 'c', 'b'),
        edge('e4', 'b', 'e'),
      ],
    );
    const result = validateAiFlow(flow);
    expect(codesOf(result, 'warning')).not.toContain('bad-expression');
    expect(result.ok).toBe(true);
  });

  it('provider 自带默认模型时，llm 节点不写 model 不算错 —— 这一条拦住了整包迁移时的误报洪峰', () => {
    const flow = def(
      [node('s', 'start'), node('a', 'llm', {}), node('e', 'end')],
      [edge('e1', 's', 'a'), edge('e2', 'a', 'e')],
    );
    expect(codesOf(validateAiFlow(flow), 'error')).toContain('missing-model');
    expect(
      validateAiFlow(flow, undefined, { providerHasDefaultModel: true }).ok,
    ).toBe(true);
    expect(
      validateAiFlow(flow, undefined, { defaultModel: 'gpt-test' }).ok,
    ).toBe(true);
  });
});

describe('骨架问题只报一次，全部来自 graph', () => {
  it('空图只报 empty-flow 就收口：逐节点再走一遍只会产出十条同义噪音', () => {
    const result = validateAiFlow(def([], []));
    expect(result.issues.map((issue) => issue.code)).toEqual(['empty-flow']);
    expect(result.ok).toBe(false);
  });

  it('重复 id、悬空边、自环这些结构问题原样透传，不重复实现一遍', () => {
    const flow = def(
      [
        node('s', 'start'),
        node('a', 'llm', { model: 'm' }),
        node('a2', 'llm', { model: 'm' }),
        node('e', 'end'),
      ],
      [edge('e1', 's', 's'), edge('e2', 'a', 'ghost'), edge('e9', 'a2', 'e')],
    );
    const codes = codesOf(validateAiFlow(flow));
    expect(codes).toContain('self-loop');
    expect(codes).toContain('unknown-endpoint');
  });

  it('options.graph 会透传下去：设计器草稿态要能关掉孤立节点提示', () => {
    const flow = def(
      [
        node('s', 'start'),
        node('a', 'llm', { model: 'm' }),
        node('lone', 'llm', { model: 'm' }),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'a'), edge('e2', 'a', 'e')],
    );
    expect(codesOf(validateAiFlow(flow))).not.toContain('isolated-node');
    const strict = validateAiFlow(flow, undefined, {
      graph: { allowIsolatedNodes: false },
    });
    expect(codesOf(strict)).toContain('isolated-node');
  });

  it('allowCycles 把环从 error 降为 warning：agent 自循环是正常画法，运行器有 maxSteps 兜底', () => {
    const cyclic = def(
      [
        node('s', 'start'),
        node('a', 'llm', { model: 'm' }),
        node('b', 'llm', { model: 'm' }),
        node('e', 'end'),
      ],
      [
        edge('e1', 's', 'a'),
        edge('e2', 'a', 'b'),
        edge('e3', 'b', 'a'),
        edge('e4', 'b', 'e'),
      ],
    );
    const strict = validateAiFlow(cyclic);
    expect(codesOf(strict, 'error')).toContain('cycle');
    expect(strict.ok).toBe(false);

    const relaxed = validateAiFlow(cyclic, undefined, { allowCycles: true });
    expect(codesOf(relaxed, 'warning')).toContain('cycle');
    expect(codesOf(relaxed, 'error')).not.toContain('cycle');
    expect(relaxed.ok).toBe(true);
  });
});

describe('已知节点类型的三种入参形态（类型收窄回归）', () => {
  const ragFlow = () =>
    def(
      [node('s', 'start'), node('r', 'rag'), node('e', 'end')],
      [edge('e1', 's', 'r'), edge('e2', 'r', 'e')],
    );

  const ragHandler: AiNodeHandler = {
    kind: 'rag',
    run: () => ({ status: 'advance' }),
  };

  const builtinKinds = builtinAiNodeHandlers.map((handler) => handler.kind);

  it('不传注册表时只认内置八种，rag 报 unknown-kind —— 这是缺省口径', () => {
    const result = validateAiFlow(ragFlow());
    expect(codesOf(result, 'error')).toContain('unknown-kind');
    expect(
      result.errors.find((issue) => issue.code === 'unknown-kind')?.message,
    ).toContain('rag');
  });

  it('注册表形态只需要 has 一个方法：设计器常常只有现成注册表，不该被迫造完整处理器', () => {
    const registry = {
      has: (kind: string) => kind === 'rag' || builtinKinds.includes(kind),
    };
    expect(validateAiFlow(ragFlow(), registry).ok).toBe(true);
  });

  it('handler 数组形态取 item.kind：漏了这一步会把所有自定义节点误报成未注册', () => {
    const handlers = [...builtinAiNodeHandlers, ragHandler];
    expect(validateAiFlow(ragFlow(), handlers).ok).toBe(true);
  });

  it('kind 字符串数组形态直接当集合用：宿主只有类型清单（画布物料表）时也能校验', () => {
    const kinds = [...builtinKinds, 'rag'];
    expect(validateAiFlow(ragFlow(), kinds).ok).toBe(true);
  });

  it('显式传 null 时内置类型也算未知 —— 空注册表不等于放行，否则接线漏了也一路绿灯', () => {
    const result = validateAiFlow(validFlow(), null);
    expect(codesOf(result, 'error')).toEqual([
      'unknown-kind',
      'unknown-kind',
      'unknown-kind',
    ]);
  });

  it('把校验选项当成注册表递进来要说清该放第几个参数', () => {
    // 真实事故：示例页写成 validateAiFlow(flow, { knownInputs: [...] })，
    // 拿到的是 `registry.map is not a function` + 整页渲染不出来，跟签名毫无关系
    const misuse = {
      knownInputs: ['原始文本'],
    } as unknown as readonly string[];
    expect(() => validateAiFlow(validFlow(), misuse)).toThrow(/第三个参数/u);
    // 空图同样拦：误用与图里有什么无关，等 nodes 非空才报等于把早退路径留成盲区
    expect(() => validateAiFlow(def([], []), misuse)).toThrow(/第三个参数/u);
  });

  it('allowUnknownKinds 只降级不豁免：消息会说明将走兜底处理器', () => {
    const relaxed = validateAiFlow(ragFlow(), undefined, {
      allowUnknownKinds: true,
    });
    const issue = expectCodes(relaxed, 'unknown-kind')[0];
    expect(issue?.level).toBe('warning');
    expect(issue?.message).toContain('兜底');
    expect(relaxed.ok).toBe(true);
  });
});

describe('graph 看不懂的业务语义', () => {
  it('条件分支指向别处的边要报 dangling-branch：悄悄当成没命中的话，流程会走一条图上没有的路线', () => {
    const flow = def(
      [
        node('s', 'start'),
        node('c', 'condition', {
          branches: [{ edgeId: 'e9', expression: 'true' }],
        }),
        node('a', 'llm', { model: 'm' }),
        node('e', 'end'),
      ],
      [edge('e2', 'c', 'a'), edge('e1', 's', 'c'), edge('e9', 'a', 'e')],
    );
    const hits = expectCodes(validateAiFlow(flow), 'dangling-branch');
    expect(hits[0]?.nodeIds).toEqual(['c']);
    expect(hits[0]?.message).toContain('e9');
  });

  it('分支表达式编译不过报 bad-expression，且只解析不求值', () => {
    const flow = def(
      [
        node('s', 'start'),
        node('c', 'condition', {
          branches: [{ edgeId: 'e2', expression: 'score >' }],
          defaultEdgeId: 'e3',
        }),
        node('a', 'llm', { model: 'm' }),
        node('b', 'llm', { model: 'm' }),
        node('e', 'end'),
      ],
      [
        edge('e1', 's', 'c'),
        edge('e2', 'c', 'a'),
        edge('e3', 'c', 'b'),
        edge('e4', 'a', 'e'),
        edge('e5', 'b', 'e'),
      ],
    );
    const hits = expectCodes(validateAiFlow(flow), 'bad-expression');
    expect(hits.some((issue) => issue.message.includes('编译不过'))).toBe(true);
  });

  it('引用还没产出的变量不算坏表达式：草稿态求值会把整张图误报一遍', () => {
    const flow = def(
      [
        node('s', 'start'),
        node('c', 'condition', {
          branches: [{ edgeId: 'e2', expression: '尚不存在.字段 > 3' }],
        }),
        node('a', 'llm', { model: 'm' }),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'c'), edge('e2', 'c', 'a'), edge('e3', 'a', 'e')],
    );
    const result = validateAiFlow(flow);
    expect(codesOf(result)).not.toContain('bad-expression');
    expect(result.ok).toBe(true);
  });

  it('空条件却有多条出边只给 warning：运行时全部放行，是「画了一半」而不是「坏了」', () => {
    const flow = def(
      [
        node('s', 'start'),
        node('c', 'condition', {}),
        node('a', 'llm', { model: 'm' }),
        node('b', 'llm', { model: 'm' }),
        node('e', 'end'),
      ],
      [
        edge('e1', 's', 'c'),
        edge('e2', 'c', 'a'),
        edge('e3', 'c', 'b'),
        edge('e4', 'a', 'e'),
        edge('e5', 'b', 'e'),
      ],
    );
    const issue = expectCodes(validateAiFlow(flow), 'bad-expression').find(
      (item) => item.level === 'warning',
    );
    expect(issue?.message).toContain('全部放行');
  });

  it('transform 缺表达式是 error（运行时会直接失败），有表达式则只编译不求值', () => {
    const missing = def(
      [node('s', 'start'), node('t', 'transform', {}), node('e', 'end')],
      [edge('e1', 's', 't'), edge('e2', 't', 'e')],
    );
    expect(
      expectCodes(validateAiFlow(missing), 'bad-expression')[0]?.message,
    ).toContain('缺少 expression');

    const broken = def(
      [
        node('s', 'start'),
        node('t', 'transform', { expression: '(a + b' }),
        node('e', 'end'),
      ],
      [edge('e1', 's', 't'), edge('e2', 't', 'e')],
    );
    expect(codesOf(validateAiFlow(broken), 'error')).toContain(
      'bad-expression',
    );

    const fine = def(
      [
        node('s', 'start'),
        node('t', 'transform', { expression: 'a.b + 1' }),
        node('e', 'end'),
      ],
      [edge('e1', 's', 't'), edge('e2', 't', 'e')],
    );
    expect(validateAiFlow(fine, undefined, { knownInputs: ['a'] }).ok).toBe(
      true,
    );
  });

  it('工具名要么不查、要查就必须注册：llm 的 tools 与 tool 节点共用同一条 unknown-tool', () => {
    const flow = def(
      [
        node('s', 'start'),
        node('a', 'llm', { model: 'm', tools: ['lookup'] }),
        node('t', 'tool', { tool: 'ghost' }),
        node('u', 'tool', {}),
        node('e', 'end'),
      ],
      [
        edge('e1', 's', 'a'),
        edge('e2', 'a', 't'),
        edge('e3', 't', 'u'),
        edge('e4', 'u', 'e'),
      ],
    );
    // 没注 tools 时只拦「压根没填名字」这种本地就能判定的错，引用谁不去判
    const blind = validateAiFlow(flow);
    const blindHits = expectCodes(blind, 'unknown-tool');
    expect(blindHits.map((issue) => issue.nodeIds?.[0])).toEqual(['u']);
    expect(blindHits[0]?.message).toContain('没有填写工具名');

    const result = validateAiFlow(flow, undefined, {
      tools: { get: (name) => (name === 'lookup' ? lookupTool : undefined) },
    });
    const hits = expectCodes(result, 'unknown-tool');
    expect(hits.map((issue) => issue.nodeIds?.[0])).toEqual(['t', 'u']);
    expect(hits[0]?.message).toContain('ghost');
    expect(hits[1]?.message).toContain('没有填写工具名');
  });

  it('人工确认节点没有出边是 error：续跑之后流程就此断掉', () => {
    const flow = def(
      [node('s', 'start'), node('h', 'human', { resumeLabel: '请确认' })],
      [edge('e1', 's', 'h')],
    );
    expect(
      expectCodes(validateAiFlow(flow), 'human-no-exit')[0]?.nodeIds,
    ).toEqual(['h']);

    const withExit = def(
      [node('s', 'start'), node('h', 'human', {}), node('e', 'end')],
      [edge('e1', 's', 'h'), edge('e2', 'h', 'e')],
    );
    expect(validateAiFlow(withExit).ok).toBe(true);
  });

  it('没有 end 节点报 no-end：运行结果收不了口，面板上只会一直是运行中', () => {
    const flow = def(
      [node('s', 'start'), node('a', 'llm', { model: 'm' })],
      [edge('e1', 's', 'a')],
    );
    expect(codesOf(validateAiFlow(flow), 'error')).toContain('no-end');
  });
});

describe('模板变量的来源判定', () => {
  it('既不在入参也不是任何节点产物才报 unknown-input，且只是 warning', () => {
    const flow = def(
      [
        node('s', 'start'),
        node('a', 'llm', { model: 'm', prompt: '基于 {{ 用户诉求 }} 写' }),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'a'), edge('e2', 'a', 'e')],
    );
    const issue = expectCodes(validateAiFlow(flow), 'unknown-input')[0];
    expect(issue?.level).toBe('warning');
    expect(issue?.message).toContain('{{ 用户诉求 }}');
    expect(issue?.nodeIds).toEqual(['a']);
  });

  it('args 里的字符串模板同样参与检查，非字符串原样放过', () => {
    const flow = def(
      [
        node('s', 'start'),
        node('a', 'llm', { model: 'm' }),
        node('t', 'tool', {
          args: { q: '{{ 检索词 }}', topK: 5 },
          tool: 'lookup',
        }),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'a'), edge('e2', 'a', 't'), edge('e3', 't', 'e')],
    );
    expect(
      expectCodes(validateAiFlow(flow), 'unknown-input')[0]?.nodeIds,
    ).toEqual(['t']);
    expect(
      validateAiFlow(flow, undefined, { knownInputs: ['检索词'] }).warnings,
    ).toEqual([]);
  });

  it('上游节点的产物键（含 a.b 形式的根名）算已知，取根这一段来比', () => {
    const flow = def(
      [
        node('s', 'start'),
        node('a', 'llm', { model: 'm' }),
        node('b', 'llm', { model: 'm', prompt: '续写 {{ a.title }}' }),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'a'), edge('e2', 'a', 'b'), edge('e3', 'b', 'e')],
    );
    expect(codesOf(validateAiFlow(flow))).not.toContain('unknown-input');
  });

  it('显式 outputKey 参与判定，缺省键名按 kind 分叉（tool 用工具名、human 带后缀）', () => {
    const flow = def(
      [
        node('s', 'start'),
        node('t', 'tool', { tool: 'lookup' }),
        node('h', 'human', {}),
        node('b', 'llm', {
          model: 'm',
          prompt: '{{ lookup }} / {{ h_human }} / {{ 别的 }}',
        }),
        node('e', 'end'),
      ],
      [
        edge('e1', 's', 't'),
        edge('e2', 't', 'h'),
        edge('e3', 'h', 'b'),
        edge('e4', 'b', 'e'),
      ],
    );
    const hits = expectCodes(validateAiFlow(flow), 'unknown-input');
    expect(hits[0]?.message).toContain('{{ 别的 }}');
    expect(hits.map((issue) => issue.message).join(',')).not.toContain(
      '{{ lookup }}',
    );
  });
});

describe('产物键冲突', () => {
  it('同一个工具调两次天然互相覆盖，必须报出来 —— 键名冲突是后跑的悄悄赢', () => {
    const flow = def(
      [
        node('s', 'start'),
        node('t1', 'tool', { tool: 'lookup' }),
        node('t2', 'tool', { tool: 'lookup' }),
        node('e', 'end'),
      ],
      [edge('e1', 's', 't1'), edge('e2', 't1', 't2'), edge('e3', 't2', 'e')],
    );
    const issue = expectCodes(validateAiFlow(flow), 'output-key-conflict')[0];
    expect(issue?.level).toBe('warning');
    expect(issue?.nodeIds).toEqual(['t1', 't2']);
    expect(issue?.message).toContain('lookup');
  });

  it('显式 outputKey 不同的同名节点不该被误判成冲突', () => {
    const flow = def(
      [
        node('s', 'start'),
        node('a', 'llm', { model: 'm', outputKey: '第一段' }),
        node('b', 'llm', { model: 'm', outputKey: '第二段' }),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'a'), edge('e2', 'a', 'b'), edge('e3', 'b', 'e')],
    );
    expect(codesOf(validateAiFlow(flow))).not.toContain('output-key-conflict');
  });
});

describe('结果汇总口径', () => {
  it('ok 只看有没有 error，warning 单独一份：调用方自己决定拦不拦', () => {
    const flow = def(
      [
        node('s', 'start'),
        node('a', 'llm', { model: 'm', prompt: '{{ 没配 }}' }),
        node('e', 'end'),
      ],
      [edge('e1', 's', 'a'), edge('e2', 'a', 'e')],
    );
    const result = validateAiFlow(flow);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.issues).toHaveLength(1);
  });

  it('校验器不改图：传进来的定义一个字段都不动（只报告，修复属于设计器）', () => {
    const flow = validFlow();
    const snapshot = JSON.parse(JSON.stringify(flow)) as AiFlowDefinition;
    validateAiFlow(flow, undefined, { knownInputs: ['原始文本'] });
    expect(flow).toEqual(snapshot);
  });
});
