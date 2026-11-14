import { describe, expect, it } from 'vitest';

import { AiFlowError } from '../../src/ai-flow/core/errors';
import {
  extractJsonSource,
  parseBySchema,
  parseJson,
  parseLines,
  parseOutput,
  parseRegex,
  parseText,
  validateSchema,
} from '../../src/ai-flow/core/output-parser';

/**
 * 模型输出解析层（`core/output-parser.ts`）。
 *
 * 为什么值得逐条钉住：模型给的是自由文本，「多说两句」是常态而不是异常。
 * 严格 `JSON.parse(text)` 的失败里有一半跟结构无关，而那一半恰恰会在线上每天发生；
 * 反过来解析得太聪明又等于替模型编数据。所以宽松到「抠出最外层括号」为止的这条线，
 * 必须有用例守着，否则下一次改动只会往两个方向滑。
 *
 * 另一个口径是**解析失败必须抛带 code 的错误**、并带上原文片段：
 * 静默返回 undefined 会让三个节点之后的一次 transform 报「读不到属性」，
 * 排查的人会先去查那个无辜的下游节点。
 */

function expectParserError(action: () => unknown, code: string) {
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

describe('parseText / parseLines：最朴素的两种收口', () => {
  it('只归一换行符，其余原样保留 —— 文本格式不该顺手把空格和缩进也“整理”掉', () => {
    expect(parseText('甲\r\n乙\r丙\n丁')).toBe('甲\n乙\n丙\n丁');
    expect(parseText('')).toBe('');
    expect(parseText('  前后空格都留着  ')).toBe('  前后空格都留着  ');
  });

  it('按行拆开并丢掉空行：列表式回答（“给我 5 个标题”）最常见的形态', () => {
    expect(parseLines(' 一 \n\n 二\n三 \n')).toEqual(['一', '二', '三']);
    expect(parseLines('')).toEqual([]);
    expect(parseLines('只有我')).toEqual(['只有我']);
  });
});

describe('extractJsonSource：宽松到什么程度', () => {
  it('围栏代码块（含语言标记与前后废话）抠出主体', () => {
    expect(
      extractJsonSource(
        '好的，结果如下：\n```json\n{"title":"甲"}\n```\n希望有帮助',
      ),
    ).toBe('{"title":"甲"}');
    expect(extractJsonSource('```ts\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJsonSource('没有语言标记的 ```\n{"a":1}\n``` 也收')).toBe(
      '{"a":1}',
    );
  });

  it('散文包着 JSON 时取首尾括号之间的那一段', () => {
    expect(extractJsonSource('答案是 {"score": 0.8} 供参考')).toBe(
      '{"score": 0.8}',
    );
    expect(extractJsonSource('[1, 2, 3]')).toBe('[1, 2, 3]');
    // 值里带右花括号也不能截断：取的是**最后一个**闭合括号
    expect(extractJsonSource('前缀 {"note":"有 } 花括号"} 后缀')).toBe(
      '{"note":"有 } 花括号"}',
    );
  });

  it('一个括号都没有就原样返回主体，不替模型编结构；空输出返回 undefined', () => {
    expect(extractJsonSource('纯文本没有结构')).toBe('纯文本没有结构');
    expect(extractJsonSource('   \n  ')).toBeUndefined();
    expect(extractJsonSource('')).toBeUndefined();
  });
});

describe('parseJson', () => {
  it('三种真实形态都能解析：裸 JSON、围栏、前后带客套话', () => {
    expect(parseJson('{"a":1,"b":[1,2]}')).toEqual({ a: 1, b: [1, 2] });
    expect(parseJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJson('我算好了：{"a":1}，请查收')).toEqual({ a: 1 });
    expect(parseJson('["甲","乙"]')).toEqual(['甲', '乙']);
  });

  it('空输出与坏 JSON 都抛 output-json，且坏 JSON 的错误里带原文片段', () => {
    expect(
      expectParserError(() => parseJson(''), 'output-json').message,
    ).toContain('没有给出任何内容');

    const broken = expectParserError(() => parseJson('{"a": }'), 'output-json');
    expect(broken.message).toContain('解析失败');
    expect(broken.message).toContain('原文片段');
  });

  it('超长原文在错误里被压成一行并截断：日志不该被一整段回答灌满', () => {
    const long = `{"a": } ${'补'.repeat(300)}`;
    const message = expectParserError(
      () => parseJson(long),
      'output-json',
    ).message;
    expect(message).toContain('…');
    expect(message.length).toBeLessThan(400);
  });

  it('完全不是 JSON 的文本也报 output-json 而不是悄悄返回 undefined', () => {
    expect(
      expectParserError(() => parseJson('我不知道'), 'output-json').message,
    ).toContain('我不知道');
  });
});

describe('parseRegex：命名分组就是返回体的键', () => {
  it('有命名分组时只返回它们，不混进整段匹配', () => {
    expect(
      parseRegex('总价：128元（含税）', String.raw`总价：(?<total>\d+)元`),
    ).toEqual({ total: '128' });
  });

  it('一个命名分组都没有时退化成 { capture, match }，调用方不该拿到空对象还一头雾水', () => {
    expect(parseRegex('共 42 条记录', String.raw`(\d+)`)).toEqual({
      capture: '42',
      match: '42',
    });
  });

  it('宿主常把 /xxx/gi 整串粘进输入框：先剥字面量斜杠再拼 flags', () => {
    expect(parseRegex('第 3 条', String.raw`/(?<n>\d+)/`)).toEqual({ n: '3' });
    const all = parseRegex('a1 b2 c3', String.raw`/[a-z](\d)/g`);
    expect(all).toEqual([
      { capture: '1', match: 'a1' },
      { capture: '2', match: 'b2' },
      { capture: '3', match: 'c3' },
    ]);
  });

  it('global 走全量匹配，并且零宽模式不会把进程转死（漏了这一条就是无限循环）', () => {
    const all = parseRegex('abc', 'a?', { global: true });
    expect(Array.isArray(all)).toBe(true);
    expect(all).toHaveLength(4);
  });

  it('没命中、没模式串、模式串非法，三种失败都带 output-regex 且话术不同', () => {
    expect(
      expectParserError(
        () => parseRegex('没有数字', String.raw`(\d+)`),
        'output-regex',
      ).message,
    ).toContain('没有命中');
    expect(
      expectParserError(() => parseRegex('甲', ''), 'output-regex').message,
    ).toContain('没有配置 expression');
    expect(
      expectParserError(
        () => parseRegex('甲', '(?<a>x)(?<a>y)'),
        'output-regex',
      ).message,
    ).toContain('非法');
  });

  it('全局匹配一次都没命中时同样报错，而不是返回空数组', () => {
    expect(
      expectParserError(
        () => parseRegex('甲乙', String.raw`\d`, { global: true }),
        'output-regex',
      ).message,
    ).toContain('一次都没命中');
  });
});

describe('validateSchema：只覆盖 type / required / enum / items / properties', () => {
  it('类型都不对时短路返回一条错误：再往下查属性只会产出一堆噪音', () => {
    const errors = validateSchema('就是一段文本', {
      properties: { a: { type: 'string' } },
      required: ['a'],
      type: 'object',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('期望 object，实际是 string');
  });

  it('缺必填字段逐条列出全部问题，而不是第一条', () => {
    const errors = validateSchema(
      { b: 1 },
      {
        properties: { b: { type: 'string' } },
        required: ['title', 'body'],
        type: 'object',
      },
    );
    expect(errors).toEqual([
      '$.title 缺少必填字段',
      '$.body 缺少必填字段',
      '$.b 期望 string，实际是 number',
    ]);
  });

  it('枚举用宽松相等判断，对象成员按序列化比较', () => {
    expect(validateSchema('c', { enum: ['a', 'b'], type: 'string' })).toEqual([
      '$ 不在允许的取值里：a | b',
    ]);
    expect(validateSchema('a', { enum: ['a', 'b'], type: 'string' })).toEqual(
      [],
    );
    expect(
      validateSchema({ x: 1 }, { enum: [{ x: 1 }], type: 'object' }),
    ).toEqual([]);
  });

  it('数组逐元素带着下标路径报错，嵌套对象带点路径 —— 错误要能直接指回模型输出的位置', () => {
    const errors = validateSchema([{ name: '甲' }, { name: 2 }], {
      items: {
        properties: { name: { type: 'string' } },
        required: ['name'],
        type: 'object',
      },
      type: 'array',
    });
    expect(errors).toEqual(['$[1].name 期望 string，实际是 number']);
  });

  it('null / 数组 / 布尔的类型判定各自独立，别把 null 当 object', () => {
    expect(validateSchema(null, { type: 'null' })).toEqual([]);
    expect(validateSchema(null, { type: 'object' })).toEqual([
      '$ 期望 object，实际是 null',
    ]);
    expect(validateSchema([], { type: 'array' })).toEqual([]);
    expect(validateSchema(false, { type: 'boolean' })).toEqual([]);
  });

  it('不声明 type 时不做类型判定，只做声明过的那几项', () => {
    expect(validateSchema(42, {})).toEqual([]);
  });
});

describe('parseBySchema', () => {
  it('先解析再校验，通过时原样交回解析结果', () => {
    expect(
      parseBySchema('{"title":"甲"}', { required: ['title'], type: 'object' }),
    ).toEqual({ title: '甲' });
  });

  it('校验失败抛 output-schema，错误里带全部问题', () => {
    const error = expectParserError(
      () =>
        parseBySchema('{"title":1,"body":2}', {
          properties: { body: { type: 'string' }, title: { type: 'string' } },
          type: 'object',
        }),
      'output-schema',
    );
    expect(error.message).toContain('title 期望 string');
    expect(error.message).toContain('body 期望 string');
  });

  it('已经是结构值（宿主自己塞进来的）就跳过 JSON 解析，不再二次 stringify 一遍', () => {
    const value = { title: '甲' };
    expect(
      parseBySchema(value as unknown as string, {
        required: ['title'],
        type: 'object',
      }),
    ).toBe(value);
  });
});

describe('parseOutput 按 format 分发', () => {
  it('undefined 与 text 等价：没配格式的节点该拿到原始文本，而不是报错', () => {
    expect(parseOutput(undefined, '甲\r\n乙')).toBe('甲\n乙');
    expect(parseOutput('text', '甲\r\n乙')).toBe('甲\n乙');
  });

  it('json + schema 走 schema 那条路，错误码是 output-schema 而不是 output-json', () => {
    expectParserError(
      () =>
        parseOutput('json', '{"a":1}', {
          schema: { required: ['b'], type: 'object' },
        }),
      'output-schema',
    );
    expect(
      parseOutput('json', '{"a":1}', {
        schema: { required: ['a'], type: 'object' },
      }),
    ).toEqual({ a: 1 });
  });

  it('regex 需要节点把模式串放在 expression 里，缺了就报可诊断错误而不是拿空串去匹配', () => {
    expect(
      parseOutput('regex', '第 7 号', { expression: '第 (?<no>\\d+) 号' }),
    ).toEqual({ no: '7' });
    expect(
      expectParserError(() => parseOutput('regex', '第 7 号'), 'output-regex')
        .message,
    ).toContain('没有配置 expression');
  });

  it('lines 交回的是字符串数组，下游 transform 可以直接求长度', () => {
    expect(parseOutput('lines', '甲\n乙\n')).toHaveLength(2);
  });
});
