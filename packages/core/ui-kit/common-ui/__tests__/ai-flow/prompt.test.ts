import { describe, expect, it } from 'vitest';

import { AiFlowError } from '../../src/ai-flow/core/errors';
import {
  collectVariables,
  renderPrompt,
  renderTemplate,
} from '../../src/ai-flow/core/prompt';

/**
 * 提示词组装（`core/prompt.ts`）。
 *
 * 这里最要命的两个失败形态是「静默留空」和「误报成坏表达式」：
 * 少一段上下文的请求照样 200 返回，只是答案是编的，而没人会怀疑一句正常的话；
 * 反过来把缺变量当成软错误吞掉，宿主线上就会出现「同一个节点今天带上文明天不带」。
 * 所以缺变量必须抛、且要一次性报全，宽松只留给「显式兜底」和「显式 optional」。
 *
 * 另外 `readPath` 里 `[数字]` 的下标解析与 `collectVariables` 的字符类都是带 `u` 标志的正则，
 * 这类正则在 `u` 模式下写错是**运行期 SyntaxError**（编译期发现不了），所以专门钉了两条。
 */

function expectPromptError(action: () => unknown, code: string) {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(AiFlowError);
  expect((caught as AiFlowError).code).toBe(code);
  return caught as AiFlowError;
}

describe('collectVariables：Inspector 用它提示还缺哪几个入参', () => {
  it('去重且保持出现顺序，中文变量名原样保留', () => {
    expect(
      collectVariables('{{ 用户诉求 }} 与 {{ 用户诉求 }} 再 {{ 上一轮 }}'),
    ).toEqual(['用户诉求', '上一轮']);
  });

  it('函数调用与字面量都不是变量：把它们当悬空变量，草稿图会被报满', () => {
    expect(collectVariables('{{ len(原文) }}')).toEqual([]);
    expect(collectVariables('{{ upper(name) }}')).toEqual([]);
    expect(collectVariables('{{ "就是句话" }}')).toEqual([]);
  });

  it('算术/比较表达式不进清单（字符类不含 + < 等运算符），校验侧因此不会误报 unknown-input', () => {
    expect(collectVariables('{{ a + b }}')).toEqual([]);
    expect(collectVariables('{{ score > 0.8 }}')).toEqual([]);
  });

  it('?? 兜底段只取真正要的变量名', () => {
    expect(collectVariables("{{ user.dept ?? '未分配' }}")).toEqual([
      'user.dept',
    ]);
  });

  it('下标路径要能被字符类放过 —— 这条钉住 u 模式正则：写坏了是 SyntaxError 而不是解析结果为空', () => {
    expect(collectVariables('{{ items[0].name }}')).toEqual(['items[0].name']);
    expect(() => collectVariables('{{ a[12][3] }}')).not.toThrow();
    expect(collectVariables('{{ a[12][3] }}')).toEqual(['a[12][3]']);
  });

  it('空模板与 undefined 都交回空数组，调用方不必先判空', () => {
    expect(collectVariables(undefined)).toEqual([]);
    expect(collectVariables('')).toEqual([]);
    expect(collectVariables('没有任何插值')).toEqual([]);
  });

  it('未闭合的花括号不当成变量：{{ 打了一半的模板 }} 后面跟文本也不炸', () => {
    expect(collectVariables('{{ 打了一半')).toEqual([]);
  });
});

describe('renderTemplate：缺变量必须抛，宽松只留给显式兜底', () => {
  it('普通插值、表达式求值、数字与对象各有口径', () => {
    expect(renderTemplate('你好 {{ 姓名 }}', { 姓名: '张三' })).toBe(
      '你好 张三',
    );
    expect(renderTemplate('{{ len(原文) }}', { 原文: 'abc' })).toBe('3');
    expect(renderTemplate('{{ 分数 }}', { 分数: 0 })).toBe('0');
    expect(renderTemplate('{{ 通过 }}', { 通过: false })).toBe('false');
    expect(renderTemplate('{{ 用户 }}', { 用户: { name: '甲' } })).toBe(
      '{"name":"甲"}',
    );
  });

  it('空模板直接返回空串，不进后面的缺变量判定', () => {
    expect(renderTemplate('', {})).toBe('');
    expect(renderTemplate(undefined, {})).toBe('');
  });

  it('缺变量一次性报全并去重，details 里带变量名列表', () => {
    const error = expectPromptError(
      () => renderTemplate('{{ a }}{{ b }}{{ a }}', {}),
      'template-variable-missing',
    );
    expect(error.message).toContain('{{ a }}');
    expect(error.message).toContain('{{ b }}');
    expect(error.details?.variables).toEqual(['a', 'b']);
  });

  it('null 也算缺，但渲染成空串而不是字符串 "null"', () => {
    expect(renderTemplate('A={{ x }}', { x: null })).toBe('A=');
    expect(renderTemplate("A={{ x ?? '缺省' }}", { x: null })).toBe('A=缺省');
  });

  it('?? 兜底：字面量剥引号，变量表达式照常求值，两边都缺就留空', () => {
    expect(renderTemplate("{{ user.dept ?? '未分配' }}", {})).toBe('未分配');
    expect(
      renderTemplate('{{ user.dept ?? 默认部门 }}', { 默认部门: '研发' }),
    ).toBe('研发');
    expect(renderTemplate('{{ user.dept ?? 没配的默认 }}', {})).toBe('');
  });

  it('optional 名单里的变量缺失时放行：宿主自己注入的全局变量不该逼着每个节点写兜底', () => {
    expect(
      renderTemplate(
        '{{ 租户 }}/{{ 姓名 }}',
        { 姓名: '甲' },
        { optional: ['租户'] },
      ),
    ).toBe('/甲');
  });

  it('context 与 values 合并，values 优先；label 会出现在错误信息里', () => {
    expect(
      renderTemplate(
        '{{ 租户 }}-{{ 姓名 }}',
        { 姓名: '甲' },
        { context: { 姓名: '乙', 租户: 'Acme' } },
      ),
    ).toBe('Acme-甲');
    const error = expectPromptError(
      () => renderTemplate('{{ 缺的 }}', {}, { label: '节点 摘要' }),
      'template-variable-missing',
    );
    expect(error.message.startsWith('节点 摘要:')).toBe(true);
  });

  it('下标路径能取值也仍能判缺 —— readPath 漏掉 [n] 时这里会误报成缺变量', () => {
    const items = [{ name: '甲' }, { name: '乙' }];
    expect(renderTemplate('第二项是 {{ items[1].name }}', { items })).toBe(
      '第二项是 乙',
    );
    expect(renderTemplate('{{ list[0] }}', { list: ['头一个'] })).toBe(
      '头一个',
    );
    expect(
      expectPromptError(
        () => renderTemplate('{{ items[3].name }}', { items }),
        'template-variable-missing',
      ).message,
    ).toContain('items[3].name');
  });

  it('语法本身就不对的模板抛 template-expression-invalid，而不是留个空串继续跑', () => {
    const error = expectPromptError(
      () => renderTemplate('{{ 分数 >}}', { 分数: 1 }),
      'template-expression-invalid',
    );
    expect(error.message).toContain('求值失败');
  });

  it('未声明的标识符在比较表达式里按 undefined 走 graph 的宽松语义：求值出了 false 就不算缺变量', () => {
    // 只有「渲染不出任何东西」才算缺；`{{ 字段 > 1 }}` 是有结果的（false），
    // 把它也报成缺变量会让所有「按分数决定文案」的草稿节点红成一片
    expect(renderTemplate('{{ 没写入的字段 > 1 }}', {})).toBe('false');
    expect(
      expectPromptError(
        () => renderTemplate('{{ 没写入的字段 }}', {}),
        'template-variable-missing',
      ).message,
    ).toContain('没写入的字段');
  });
});

describe('renderPrompt：系统段 + few-shot + 用户段', () => {
  it('只有 system 与 user 时是两条消息，text 用空行分隔', () => {
    const rendered = renderPrompt(
      { system: '你是编辑', user: '改一下 {{ 原文 }}' },
      { 原文: '甲' },
    );
    expect(rendered.messages).toEqual([
      { content: '你是编辑', role: 'system' },
      { content: '改一下 甲', role: 'user' },
    ]);
    expect(rendered.text).toBe('你是编辑\n\n改一下 甲');
  });

  it('空 system 不产生消息：多发一条空 system 会让模型以为话题重开', () => {
    expect(renderPrompt({ system: '', user: '甲' }, {}).messages).toEqual([
      { content: '甲', role: 'user' },
    ]);
  });

  it('template 是 user 的别名，两者都写时 user 优先', () => {
    expect(
      renderPrompt({ template: '走 template' }, {}).messages[0]?.content,
    ).toBe('走 template');
    expect(
      renderPrompt({ template: '走 template', user: '走 user' }, {}).messages[0]
        ?.content,
    ).toBe('走 user');
  });

  it('few-shot 展开成一轮轮真对话而不是糊进 system —— 多轮示例的遵循度明显好于拼一段', () => {
    const rendered = renderPrompt(
      {
        fewShot: [
          { input: '输入 {{ 一 }}', output: '输出 {{ 二 }}' },
          { input: '再输入', output: '再输出' },
        ],
        system: '你是助手',
        user: '最后一个',
      },
      { 一: '甲', 二: '乙' },
    );
    expect(rendered.messages.map((message) => message.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
      'assistant',
      'user',
    ]);
    expect(rendered.messages[1]).toEqual({ content: '输入 甲', role: 'user' });
    expect(rendered.messages[2]).toEqual({
      content: '输出 乙',
      role: 'assistant',
    });
  });

  it('fewShotIntro 只出现在纯文本里，不进消息序列', () => {
    const rendered = renderPrompt(
      {
        fewShot: [{ input: '问', output: '答' }],
        fewShotIntro: '看几个例子：',
      },
      {},
    );
    expect(rendered.text).toContain('看几个例子：');
    expect(rendered.messages.map((message) => message.content)).not.toContain(
      '看几个例子：',
    );
  });

  it('variables 汇总三段与 few-shot 里的变量并去重，节点校验入参就靠它', () => {
    const rendered = renderPrompt(
      {
        fewShot: [{ input: '{{ 原文 }}', output: '{{ 风格 }}' }],
        system: '风格：{{ 风格 }}',
        user: '{{ 原文 }}',
      },
      { 原文: '甲', 风格: '乙' },
    );
    expect(rendered.variables).toEqual(['风格', '原文']);
  });

  it('空 spec 交回全空而不抛：允许宿主画了个 prompt 节点还没填内容', () => {
    const rendered = renderPrompt({}, {});
    expect(rendered).toEqual({ messages: [], text: '', variables: [] });
  });

  it('缺变量同样一路抛到底，label 用调用方传进来的节点名', () => {
    const error = expectPromptError(
      () =>
        renderPrompt({ user: '{{ 缺失的变量 }}' }, {}, { label: '节点 p1' }),
      'template-variable-missing',
    );
    expect(error.message).toContain('节点 p1');
  });
});
