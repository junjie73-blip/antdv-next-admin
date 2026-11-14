import type { MemoryTurn } from '../../src/ai-flow/core/memory';

import { describe, expect, it, vi } from 'vitest';

import {
  appendTurn,
  createSessionMemory,
  defaultSummarize,
  estimateTokens,
  selectWindow,
  totalChars,
  turnChars,
} from '../../src/ai-flow/core/memory';

/**
 * 会话记忆的窗口化与持久化外壳（`core/memory.ts`）。
 *
 * 全篇不联网、不起服务：`load` / `save` 就是这里的几个闭包，宿主接自己的会话存储时形状一致。
 * 值得测的核心理由是「静默丢历史」这类故障：裁窗顺序错了、预留算漏了，症状都是
 * 模型一脸正经地否认你们聊过 —— 比超上下文难查得多，只能靠确定性的数字断言钉住。
 */

function turn(
  content: string,
  role: MemoryTurn['role'] = 'user',
  at?: number,
): MemoryTurn {
  return { at, content, role };
}

/** 长度可控的轮次：预算口径是字符，用例里就用长度说话，别靠肉眼数 */
function turns(count: number, length = 3): MemoryTurn[] {
  return Array.from({ length: count }, (_item, index) =>
    turn(`${index}`.padEnd(length, '字'), 'user'),
  );
}

describe('预算口径与裁窗', () => {
  it('预算算的是字符而不是 token：每条消息先补 8 个框架字符，换算系数写死在 estimateTokens', () => {
    // 单条：1 个正文字符 + 8 个框架字符
    expect(turnChars(turn('甲'))).toBe(9);
    expect(totalChars([turn('甲'), turn('乙')])).toBe(18);
    expect(totalChars([])).toBe(0);
    // 中英混合按 2 字符/token 估、向上取整：宁可少给也别超上下文
    expect(estimateTokens([turn('甲乙丙')])).toBe(6);
    expect(estimateTokens([turn('甲乙丙丁')])).toBe(6);
    expect(estimateTokens([])).toBe(0);
  });

  it('selectWindow 从后往前取满为止，dropped 是留在预算外的旧轮', () => {
    const all = [turn('一二三'), turn('四五六'), turn('七八九')];
    // 每条成本 3+8=11：预算 25 只装得下最近两条
    const window = selectWindow(all, { maxChars: 25 });
    expect(window.kept).toEqual([all[1], all[2]]);
    expect(window.dropped).toEqual([all[0]]);
    expect(window.chars).toBe(22);
  });

  it('最新一条即便超预算也留着（缺省 keepLatest=true）：裁掉它等于把这一轮问答整个丢掉', () => {
    const long = turn('x'.repeat(200));
    const overBudget = selectWindow([turn('旧'), long], { maxChars: 5 });
    expect(overBudget.kept).toEqual([long]);
    expect(overBudget.chars).toBe(208);
    // 宿主明确关掉时才允许窗口为空：这对应「宁可什么都不带也别带错的」
    const strict = selectWindow([turn('旧'), long], {
      keepLatest: false,
      maxChars: 5,
    });
    expect(strict.kept).toEqual([]);
    expect(strict.chars).toBe(0);
    expect(strict.dropped).toHaveLength(2);
  });

  it('maxChars 先归一再使用：负数与小数不会算出负预算或半条消息', () => {
    const all = [turn('甲'), turn('乙')];
    // 负预算归零后仍然走 keepLatest，得到「只剩最新一条」而不是空窗
    expect(selectWindow(all, { maxChars: -100 }).kept).toEqual([all[1]]);
    // 25.7 → 25：与上面那条整数预算的行为一致
    expect(selectWindow(all, { maxChars: 25.7 }).chars).toBeLessThanOrEqual(25);
    expect(selectWindow([], { maxChars: 100 })).toEqual({
      chars: 0,
      dropped: [],
      kept: [],
    });
  });

  it('selectWindow 返回新数组且元素是原对象：改原数组会惊动一份不该动的响应式历史', () => {
    const all = [turn('甲'), turn('乙'), turn('丙')];
    const window = selectWindow(all, { maxChars: 20 });
    expect(all).toHaveLength(3);
    expect(window.kept[1]).toBe(all[2]);
    expect(window.dropped[0]).toBe(all[0]);
    expect(window.kept).not.toBe(all);
  });
});

describe('追加一轮并顺手裁窗', () => {
  it('没超预算就原样返回：不生成摘要、元素引用不变', () => {
    const all = [turn('甲'), turn('乙')];
    const result = appendTurn(all, turn('丙'), { maxChars: 400 });
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(all[0]);
    expect(result[2]!.content).toBe('丙');
    // 预算宽裕时不该冒出一条 system 摘要
    expect(result.some((item) => item.role === 'system')).toBe(false);
  });

  it('超预算时先落摘要再裁旧轮：顺序反了会有一段历史既不在窗口里也没进摘要', () => {
    const all = turns(10, 25);
    const latest = turn('z'.repeat(25));
    const result = appendTurn(all, latest, { maxChars: 200 });
    // 预留 120 后正文只能占 80 字符 → 只留得下最近两条，其余 9 轮全部进摘要
    expect(result.map((item) => item.role)).toEqual(['system', 'user', 'user']);
    expect(result[1]).toBe(all[9]);
    expect(result[2]).toBe(latest);
    expect(result[0]!.content).toContain('【历史摘要 · 9 轮】');
  });

  it('已有的摘要被并进新摘要的 carryover，不会滚成两条 system：聊久了上下文里只有一句「我们之前聊过」', () => {
    // 首条 system 就是「已有摘要」的识别方式，宿主存的摘要轮次必须带这个角色
    const old = turn('旧摘要', 'system');
    const all = [old, ...turns(5, 30)];
    const result = appendTurn(all, turn('新的一轮'), { maxChars: 100 });
    const systemLines = result.filter((item) => item.role === 'system');
    expect(systemLines).toHaveLength(1);
    // carryover 拼在新摘要最前面，旧摘要的文字不会被丢掉
    expect(result[0]!.content.startsWith('旧摘要 【历史摘要')).toBe(true);
    expect(result[1]).toBe(all[4]);
  });

  it('summarize 返回 undefined 时只留窗口，不硬塞一条空摘要', () => {
    const result = appendTurn(turns(8, 30), turn('最后一轮'), {
      maxChars: 120,
      summarize: () => undefined,
    });
    expect(result.every((item) => item.role === 'user')).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result.at(-1)!.content).toBe('最后一轮');
  });

  it('摘要自己也要占预算：有旧摘要时按它的实际长度扣，没有时预留 120 防振荡', () => {
    const all = turns(6, 30);
    const withoutSummary = appendTurn(all, turn('最后一轮'), { maxChars: 200 });
    // 同样内容换成「带一条短摘要的历史」：预留变小，窗口能多留几轮
    const withSummary = appendTurn(
      [turn('短摘要', 'system'), ...all],
      turn('最后一轮'),
      { maxChars: 200 },
    );
    expect(withSummary.length).toBeGreaterThan(withoutSummary.length);
    expect(withSummary[0]!.role).toBe('system');
  });

  it('defaultSummarize 只取每轮首行、单行超 40 字符截断、总长 600 封顶', () => {
    const summary = defaultSummarize([
      turn('第一行\n第二行别带进摘要', 'user'),
      turn('短', 'assistant'),
    ]);
    expect(summary.role).toBe('system');
    expect(summary.content).toBe(
      '【历史摘要 · 2 轮】user: 第一行 / assistant: 短',
    );

    const longLine = defaultSummarize([turn('长'.repeat(60))]);
    expect(longLine.content).toContain(`${'长'.repeat(40)}…`);
    expect(longLine.content).not.toContain('长'.repeat(41));

    const huge = defaultSummarize(turns(60, 60));
    expect(huge.content.length).toBeLessThanOrEqual(600);
  });
});

describe('带持久化的会话记忆', () => {
  function storage(initial: MemoryTurn[] = []) {
    const saved: MemoryTurn[][] = [];
    let stored = initial.map((item) => ({ ...item }));
    const load = vi.fn(async () => stored.map((item) => ({ ...item })));
    const save = vi.fn(async (turnsArg: MemoryTurn[]) => {
      saved.push(turnsArg);
      stored = turnsArg.map((item) => ({ ...item }));
    });
    return { load, saved, save, stored: () => stored };
  }

  it('load 只跑一次，之后的追加都在内存里；save 收到的是拷贝，改不动内部窗口', async () => {
    const bag = storage([turn('历史一轮')]);
    const memory = createSessionMemory({
      load: bag.load,
      maxChars: 500,
      save: bag.save,
    });

    await memory.append('user', '新的一轮', 123);
    await memory.append('assistant', '回复');
    expect(bag.load).toHaveBeenCalledTimes(1);
    expect(bag.save).toHaveBeenCalledTimes(2);
    expect(memory.turns().map((item) => item.content)).toEqual([
      '历史一轮',
      '新的一轮',
      '回复',
    ]);
    // append 的 role/content/at 原样落进轮次，时间线由宿主给时间戳
    expect(memory.turns()[1]).toEqual({
      at: 123,
      content: '新的一轮',
      role: 'user',
    });

    const handed = bag.saved.at(-1)!;
    // 交给宿主的是一条条拷贝：宿主存完顺手改一下（比如补时间戳）不该反过来改内存窗口
    expect(handed[0]).not.toBe(memory.turns()[0]);
    handed[0]!.content = '被外部改写过';
    expect(memory.turns()[0]!.content).toBe('历史一轮');
  });

  it('turns()/messages() 是快照：外部 push 或改数组都影响不到内部，也不会漏出 at 之外的字段', async () => {
    const bag = storage();
    const memory = createSessionMemory({
      load: bag.load,
      maxChars: 500,
      save: bag.save,
    });
    await memory.append('user', '甲', 9);
    // 取出来的是拷贝：UI 里 sort/push 一下不该改到内存窗口
    memory.turns().push(turn('伪造的一轮'));
    expect(memory.turns()).toHaveLength(1);

    expect(memory.messages()).toEqual([{ content: '甲', role: 'user' }]);
    // at 只活在记忆里，Provider 收到的消息序列不带它
    expect(memory.messages()[0]).not.toHaveProperty('at');
    expect(memory.turns()[0]).toHaveProperty('at', 9);
  });

  it('clear 清空内存窗口并写回存储，之后接着追加不会把旧历史捡回来', async () => {
    const bag = storage([turn('旧历史')]);
    const memory = createSessionMemory({
      load: bag.load,
      maxChars: 500,
      save: bag.save,
    });
    await memory.append('user', '甲');
    await memory.clear();
    expect(memory.turns()).toEqual([]);
    expect(bag.stored()).toEqual([]);

    await memory.append('user', '乙');
    expect(memory.turns().map((item) => item.content)).toEqual(['乙']);
  });

  it('读历史失败不退化成崩溃：console.warn 留原因，按空历史继续跑', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const memory = createSessionMemory({
      load: async () => {
        throw new Error('会话存储挂了');
      },
      maxChars: 500,
      save: async () => undefined,
    });

    expect(memory.turns()).toEqual([]);
    await memory.append('user', '新的一轮');
    expect(memory.turns().map((item) => item.content)).toEqual(['新的一轮']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]!.join(' ')).toContain('会话存储挂了');
    warn.mockRestore();
  });

  it('ready() 可重复调用且共享同一次加载；没配 load 之前窗口就是空数组', async () => {
    const bag = storage([turn('历史')]);
    const memory = createSessionMemory({
      load: bag.load,
      maxChars: 500,
      save: async () => undefined,
    });
    expect(memory.turns()).toEqual([]);

    await Promise.all([memory.ready(), memory.ready()]);
    expect(bag.load).toHaveBeenCalledTimes(1);
    // ready 之后才看得到历史：没看过 UI 的调用方不该被半截状态误导
    expect(memory.turns()).toHaveLength(1);
  });

  it('两个会话各拿自己的存储，互不串台：记忆隔离靠注入，不靠模块级单例', async () => {
    const a = storage();
    const b = storage();
    const memoryA = createSessionMemory({
      load: a.load,
      maxChars: 500,
      save: a.save,
    });
    const memoryB = createSessionMemory({
      load: b.load,
      maxChars: 500,
      save: b.save,
    });

    await memoryA.append('user', '只有甲知道');
    expect(memoryA.turns()).toHaveLength(1);
    // 乙连 load 都没被触发：没读过任何一轮，自然也不可能被甲写脏
    expect(b.load).not.toHaveBeenCalled();
    expect(memoryB.turns()).toEqual([]);
    expect(b.stored()).toEqual([]);
  });

  it('窗口超限时代码路径照样写回存储：宿主重启后拿到的就是裁过的那份', async () => {
    const bag = storage(turns(10, 30));
    const memory = createSessionMemory({
      load: bag.load,
      maxChars: 160,
      save: bag.save,
    });
    const window = await memory.append('user', '最后一轮', 1);
    expect(window[0]!.role).toBe('system');
    expect(totalChars(window)).toBeLessThanOrEqual(
      160 + window[0]!.content.length,
    );
    // 写回的是裁完的结果，而不是原始 11 轮
    expect(bag.stored()).toHaveLength(window.length);
    expect(bag.stored()[0]!.role).toBe('system');
  });
});
