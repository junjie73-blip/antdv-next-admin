import type { AiRequest } from '../../src/ai-flow/core/types';

import { describe, expect, it } from 'vitest';

import { createScriptedProvider } from '../../src/ai-flow/core/provider';

/**
 * 脚本 Provider（`createScriptedProvider`）。
 *
 * 它是示例页与包内测试的"模型"，所以它自己的匹配规则必须有测试：
 * 规则错了不会让任何一条运行器用例会红，表现是**示例页的分支只走一条**、
 * 或者下游节点拿到一句属于上游的回复（那句还完全正常，没人会怀疑）。
 */

function request(nodeId: string, content: string): AiRequest {
  return { messages: [{ content, role: 'user' }], nodeId };
}

/**
 * `AiProvider.invoke` 允许同步返回（脚本 Provider 就是），所以这里统一 `await` 取值，
 * 而不是用 `expect(...).resolves` —— 后者拿到同步对象会直接报
 * "You must provide a Promise to expect() when using .resolves"。
 */
async function textOf(
  provider: ReturnType<typeof createScriptedProvider>,
  req: AiRequest,
): Promise<string> {
  const result = await provider.invoke(req);
  return result.text;
}

/** 演示页同款夹具：同一个 classify 节点内按关键词分流，另有一条默认回复 */
function triage() {
  return createScriptedProvider({
    responses: [
      {
        contains: '退款',
        id: 'classify',
        text: 'REFUND',
        usage: { completion: 12, prompt: 88, total: 100 },
      },
      {
        contains: '物流',
        id: 'classify',
        text: 'LOGISTICS',
        usage: { completion: 12, prompt: 80, total: 92 },
      },
      { id: 'classify', text: 'OTHER' },
      { id: 'reply', text: 'REPLY' },
    ],
  });
}

describe('createScriptedProvider 的匹配顺序', () => {
  it('同节点内按文本分流优先于那条默认回复 —— 反过来写，示例页的分支就永远只走一条', async () => {
    const provider = triage();
    expect(
      await textOf(provider, request('classify', '这笔退款怎么还没到账')),
    ).toBe('REFUND');
    expect(await textOf(provider, request('classify', '物流一直不动'))).toBe(
      'LOGISTICS',
    );
    // 两个关键词都没提 -> 吃该节点的默认回复
    expect(await textOf(provider, request('classify', '就想问一句'))).toBe(
      'OTHER',
    );
  });

  it('写了 id 的条目不许跨节点按文本命中：下游复述了上游关键词也不能抢走上游的回复', async () => {
    const provider = triage();
    // reply 的 prompt 里通常原样带着「退款」二字，但它拿到的必须是 reply 自己那条
    expect(
      await textOf(
        provider,
        request('reply', '原话：这笔退款怎么还没到账；分诊：refund'),
      ),
    ).toBe('REPLY');
  });

  it('不写 id 的 contains 条目才是跨节点的分流规则', async () => {
    const provider = createScriptedProvider({
      responses: [
        { contains: '紧急', text: 'URGENT' },
        { id: 'other', text: 'DEFAULT' },
      ],
    });
    expect(await textOf(provider, request('anything', '这里很紧急'))).toBe(
      'URGENT',
    );
    expect(await textOf(provider, request('other', '普通请求'))).toBe(
      'DEFAULT',
    );
  });

  it('usage 原样透出，没写就按长度估算：面板上那两个数字要能对上账', async () => {
    const provider = triage();
    const written = await provider.invoke(request('classify', '退款'));
    expect(written.usage).toEqual({ completion: 12, prompt: 88, total: 100 });
    const estimated = await provider.invoke(request('reply', '一句话'));
    // 估算值不属于"界面口径"，只要求它是三个非负数且合计自洽
    expect(estimated.usage?.total).toBe(
      (estimated.usage?.prompt ?? 0) + (estimated.usage?.completion ?? 0),
    );
  });

  it('一条都配不上（配置为空）时报 scripted-no-response；只有一条时它按位置兜住所有节点', async () => {
    const empty = createScriptedProvider({ responses: [] });
    expect(() => empty.invoke(request('这个节点', '内容'))).toThrow(
      /没有匹配到预置回复/u,
    );
    expect(() => empty.invoke(request('这个节点', '内容'))).toThrow(
      /已配置 0 条/u,
    );
    // 「一个夹具喂多个节点」靠的就是最后那条按位置兜底：id 对不上也能发出去，这是既有口径
    const single = createScriptedProvider({
      responses: [{ id: '别的节点', text: 'X' }],
    });
    expect(await textOf(single, request('这个节点', '内容'))).toBe('X');
  });

  it('fallback 兜住所有未命中，`fail: N` 前 N 次抛错用来演重试退避', async () => {
    const provider = createScriptedProvider({
      fallback: { text: 'FALLBACK' },
      responses: [{ fail: 2, id: 'a', text: 'A' }],
    });
    expect(() => provider.invoke(request('a', 'x'))).toThrow(/还剩 1 次/u);
    expect(() => provider.invoke(request('a', 'x'))).toThrow(/还剩 0 次/u);
    expect(await textOf(provider, request('a', 'x'))).toBe('A');
    expect(await textOf(provider, request('没配的节点', 'x'))).toBe('FALLBACK');
  });

  it('stream 按 chunkSize 切片，最后一片带 finishReason 与 usage：面板的逐字流与记账靠这两件事', async () => {
    const provider = createScriptedProvider({
      chunkSize: 2,
      responses: [{ id: 'a', text: '一二三四五' }],
    });
    const seen: string[] = [];
    let tail: undefined | { finishReason?: string; usage?: { prompt: number } };
    for await (const chunk of provider.stream?.(request('a', 'x')) ?? []) {
      seen.push(chunk.delta);
      if (chunk.finishReason) tail = chunk;
    }
    expect(seen).toEqual(['一二', '三四', '五', '']);
    expect(tail?.finishReason).toBe('stop');
    expect(tail?.usage?.prompt).toBeGreaterThan(0);
  });

  it('calls 留下全部请求（含失败的）：单测与示例页都靠它数"到底调了几次模型"', async () => {
    const provider = createScriptedProvider({
      responses: [{ fail: 1, id: 'a', text: 'A' }],
    });
    expect(() => provider.invoke(request('a', '第一句'))).toThrow();
    await provider.invoke(request('a', '第二句'));
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[0]?.messages[0]?.content).toBe('第一句');
    provider.reset();
    expect(provider.calls).toHaveLength(0);
  });
});
