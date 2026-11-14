import type { AiOutputFormat, AiOutputSchema } from './types';

import { AiFlowError } from './errors';

/**
 * 模型文本 → 结构化值的解析层。
 *
 * 分层位置：`core/output-parser.ts`，纯函数，不 import vue、不碰运行态。
 * 这里**不做**的事：不猜模型想表达什么、不做自动纠错、不调用任何 schema 库。
 * 解析不出来就抛带 code 的可诊断错误，让运行器按节点重试策略处理 ——
 * 静默返回 `undefined` 会让三个节点之后的一次 `transform` 报「读不到属性」，
 * 排查的人会先去查那个无辜的下游节点。
 */

/** 出错信息里最多带这么长的原文片段：够定位，又不会把整段回答灌进日志 */
const SNIPPET = 160;

function snippet(text: string): string {
  const flat = text.replaceAll(/\s+/gu, ' ').trim();
  return flat.length > SNIPPET ? `${flat.slice(0, SNIPPET)}…` : flat;
}

export interface ParseOptions {
  /** outputFormat='regex' 时当模式串用 */
  expression?: string;
  flags?: string;
  /** 取全部匹配而不是第一个 */
  global?: boolean;
  schema?: AiOutputSchema;
}

/** 'text'：只做换行符归一，其余原样交给下游 */
export function parseText(text: string): string {
  return (text ?? '').replaceAll(/\r\n?/gu, '\n');
}

/** 'lines'：按行拆开，丢掉空行与首尾空白。列表式回答（"给我 5 个标题"）最常用 */
export function parseLines(text: string): string[] {
  return parseText(text)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * 从 ```json 围栏或首尾括号里把 JSON 抠出来。
 *
 * 为什么要宽松：模型几乎总会在 JSON 前后多说两句（"好的，这是结果：```json…```"），
 * 严格 `JSON.parse(text)` 的失败率高达一半，而那部分错误跟结构一点关系都没有。
 * 但只放宽到「抠出最外层括号」为止 —— 再往后就是替模型编数据了。
 */
export function extractJsonSource(text: string): string | undefined {
  const raw = (text ?? '').replaceAll(/\r\n?/gu, '\n').trim();
  if (!raw) return undefined;

  const fenced =
    /```(?:json|javascript|ts|typescript)?\s*\n?([\s\S]*?)```/u.exec(raw);
  const body = (fenced?.[1] ?? raw).trim();

  const starts = [body.indexOf('{'), body.indexOf('[')].filter((i) => i >= 0);
  if (starts.length === 0) return body;
  const first = Math.min(...starts);
  const open = body[first];
  const close = open === '{' ? '}' : ']';
  const last = body.lastIndexOf(close);
  if (last <= first) return body;
  return body.slice(first, last + 1);
}

/** 'json'：解析不出结构就抛 `output-json`，附带原文片段 */
export function parseJson(text: string): unknown {
  const source = extractJsonSource(text);
  if (!source) {
    throw new AiFlowError('output-json: 模型没有给出任何内容', 'output-json');
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AiFlowError(
      `output-json: 解析失败（${reason}）；原文片段：${snippet(text)}`,
      'output-json',
    );
  }
}

/**
 * 'regex'：命名分组是返回体的键。
 * 一个命名分组都没有时退化成 `{ match, capture }`，避免调用方拿到一个空对象还不知道为什么。
 */
export function parseRegex(
  text: string,
  pattern: string,
  options: { flags?: string; global?: boolean } = {},
): unknown {
  if (!pattern) {
    throw new AiFlowError(
      'output-regex: 节点没有配置 expression 作为模式串',
      'output-regex',
    );
  }
  let expression: RegExp;
  try {
    // 宿主常把 `/xxx/gi` 整串粘进输入框，先剥掉字面量斜杠再拼 flags，比报错友好
    const literal = /^\/([\s\S]+)\/([a-z]*)$/iu.exec(pattern.trim());
    const source = literal?.[1] ?? pattern;
    // 字面量自带的 flags 优先于 options.flags：粘了 `/x/gi` 又勾了全局，不该拼出第二份 i
    const flags = literal ? (literal[2] ?? '') : (options.flags ?? '');
    const wantGlobal = !!options.global || flags.includes('g');
    // 补 g 之前先看一眼：flags 里已经有 g 时再拼一次会让 RegExp 直接抛 "Invalid flags 'gg'"
    expression = new RegExp(
      source,
      wantGlobal && !flags.includes('g') ? `${flags}g` : flags,
    );
  } catch (error) {
    throw new AiFlowError(
      `output-regex: 模式串 "${pattern}" 非法（${error instanceof Error ? error.message : String(error)}）`,
      'output-regex',
    );
  }

  const collect = (match: RegExpExecArray) => {
    const groups = match.groups ?? {};
    if (Object.keys(groups).length > 0) return { ...groups };
    return { capture: match[1] ?? match[0], match: match[0] };
  };

  if (!expression.global) {
    const single = expression.exec(text ?? '');
    if (!single) {
      throw new AiFlowError(
        `output-regex: 模式串 "${pattern}" 在模型输出里没有命中；原文片段：${snippet(text ?? '')}`,
        'output-regex',
      );
    }
    return collect(single);
  }

  const all: unknown[] = [];
  expression.lastIndex = 0;
  for (;;) {
    const each = expression.exec(text ?? '');
    if (!each) break;
    all.push(collect(each));
    // 零宽匹配不前进就会死循环，手动补一格
    if (each.index === expression.lastIndex) expression.lastIndex += 1;
  }
  if (all.length === 0) {
    throw new AiFlowError(
      `output-regex: 模式串 "${pattern}" 在模型输出里一次都没命中；原文片段：${snippet(text ?? '')}`,
      'output-regex',
    );
  }
  return all;
}

function typeOfValue(value: unknown): AiOutputSchema['type'] {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const kind = typeof value;
  if (kind === 'number') return 'number';
  if (kind === 'string') return 'string';
  if (kind === 'boolean') return 'boolean';
  return 'object';
}

/**
 * 极小的结构校验：只覆盖 `type` / `required` / `enum` / `items` / `properties`。
 *
 * 为什么不用 JSON Schema 库：本包依赖是固定的那十个，为一个「模型输出够不够格」的判断
 * 引 30KB 校验器不划算；而且这里要的是**逐条错误信息回喂给模型**的能力，
 * 通用库抛的第一条断言反而不够用。
 */
export function validateSchema(
  value: unknown,
  schema: AiOutputSchema,
  path = '$',
): string[] {
  const errors: string[] = [];

  const actual = typeOfValue(value);
  if (schema.type && schema.type !== actual) {
    errors.push(`${path} 期望 ${schema.type}，实际是 ${actual}`);
    // 类型都不对，再往下查属性只会产出一堆噪音
    return errors;
  }

  if (schema.enum && !schema.enum.some((item) => sameValue(item, value))) {
    errors.push(
      `${path} 不在允许的取值里：${schema.enum.map((item) => String(item)).join(' | ')}`,
    );
  }

  if (actual === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (record[key] === undefined) errors.push(`${path}.${key} 缺少必填字段`);
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (record[key] !== undefined)
        errors.push(...validateSchema(record[key], sub, `${path}.${key}`));
    }
  }

  if (actual === 'array' && schema.items) {
    const list = value as unknown[];
    list.forEach((item, index) => {
      errors.push(
        ...validateSchema(
          item,
          schema.items as AiOutputSchema,
          `${path}[${index}]`,
        ),
      );
    });
  }

  return errors;
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left !== typeof right) return false;
  if (left && right && typeof left === 'object') {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return false;
}

/** 先按 JSON 解析、再按 schema 校验；失败错误里带全部问题而不是第一条 */
export function parseBySchema(text: string, schema: AiOutputSchema): unknown {
  const value = typeof text === 'string' ? parseJson(text) : text;
  const errors = validateSchema(value, schema);
  if (errors.length > 0) {
    throw new AiFlowError(
      `output-schema: 模型输出不满足约定结构 —— ${errors.join('；')}`,
      'output-schema',
    );
  }
  return value;
}

/**
 * 按节点声明的 format 分发。
 * `undefined` 与 `'text'` 等价：没配格式的节点就该拿到原始文本，而不是报错。
 */
export function parseOutput(
  format: AiOutputFormat | undefined,
  text: string,
  options: ParseOptions = {},
): unknown {
  switch (format) {
    case 'json': {
      return options.schema
        ? parseBySchema(text, options.schema)
        : parseJson(text);
    }
    case 'lines': {
      return parseLines(text);
    }
    case 'regex': {
      return parseRegex(text, options.expression ?? '', {
        flags: options.flags,
        global: options.global,
      });
    }
    case 'text':
    default: {
      return parseText(text);
    }
  }
}
