/**
 * 受限表达式求值器。
 *
 * 存在的理由只有一条：**条件分支的表达式来自用户输入**，不能 `eval`、不能
 * `new Function`。所以这里自己写词法 + 递归下降，语法刻意小于 JS ——
 * 没有赋值、没有函数定义、没有 `await`、没有成员链上的原型跳转。
 *
 * 求值语义与 JS 的差异都写在函数注释里，不做"惊喜"处理。
 */

export class GraphExpressionError extends Error {
  constructor(
    message: string,
    readonly position: number,
    readonly source: string,
  ) {
    super(
      `${message}（列 ${position}：${source.slice(Math.max(0, position - 12), position + 12)}）`,
    );
    this.name = 'GraphExpressionError';
  }
}

export type ExpressionValue = unknown;
export type ExpressionFunction = (
  ...args: ExpressionValue[]
) => ExpressionValue;

export interface EvaluatorOptions {
  /** 追加 / 覆盖内置函数；注册表是实例级的，不会污染别的调用方 */
  functions?: Record<string, ExpressionFunction>;
  /** 属性访问守卫，返回 false 表示禁止读取（默认只拦原型链逃逸） */
  canReadProperty?: (name: string) => boolean;
}

/** 禁止的属性名：只拦原型链逃逸，其余成员照常读取 */
const BLOCKED_PROPERTIES = new Set(['__proto__', 'constructor', 'prototype']);

type Token = {
  kind: 'ident' | 'number' | 'op' | 'string';
  pos: number;
  value: string;
};

const OPERATORS = [
  '===',
  '!==',
  '&&',
  '||',
  '==',
  '!=',
  '<=',
  '>=',
  '=>',
  '<',
  '>',
  '(',
  ')',
  '[',
  ']',
  '.',
  ',',
  '?',
  ':',
  '+',
  '-',
  '*',
  '/',
  '%',
  '!',
];

function isIdentStart(char: string) {
  return /[\p{L}\p{Nl}_$]/u.test(char);
}

function isIdentPart(char: string) {
  return /[\p{L}\p{N}_$\d]/u.test(char);
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  while (cursor < input.length) {
    const char = input[cursor]!;

    if (/\s/.test(char)) {
      cursor += 1;
      continue;
    }

    // 数字：整数与小数，不支持 0x / 1e3 —— 条件表达式里出现这种写法基本是手滑
    if (
      /\d/.test(char) ||
      (char === '.' && /\d/.test(input[cursor + 1] ?? ''))
    ) {
      const start = cursor;
      while (cursor < input.length && /[\d.]/.test(input[cursor]!)) cursor += 1;
      const raw = input.slice(start, cursor);
      if ((raw.match(/\./g) ?? []).length > 1) {
        throw new GraphExpressionError('非法数字', start, input);
      }
      tokens.push({ kind: 'number', pos: start, value: raw });
      continue;
    }

    if (char === "'" || char === '"') {
      const quote = char;
      const start = cursor;
      cursor += 1;
      let out = '';
      let closed = false;
      while (cursor < input.length) {
        const current = input[cursor]!;
        if (current === '\\' && cursor + 1 < input.length) {
          const next = input[cursor + 1]!;
          out += next === 'n' ? '\n' : next === 't' ? '\t' : next;
          cursor += 2;
          continue;
        }
        if (current === quote) {
          cursor += 1;
          closed = true;
          break;
        }
        out += current;
        cursor += 1;
      }
      if (!closed)
        throw new GraphExpressionError('字符串没有闭合', start, input);
      tokens.push({ kind: 'string', pos: start, value: out });
      continue;
    }

    if (isIdentStart(char)) {
      const start = cursor;
      while (cursor < input.length && isIdentPart(input[cursor]!)) cursor += 1;
      tokens.push({
        kind: 'ident',
        pos: start,
        value: input.slice(start, cursor),
      });
      continue;
    }

    const operator = OPERATORS.find((candidate) =>
      input.startsWith(candidate, cursor),
    );
    if (!operator)
      throw new GraphExpressionError(`无法识别的字符 "${char}"`, cursor, input);
    // `=>` 属于箭头函数语法，本求值器不支持函数字面量，明确拒绝而不是当 `=` `>` 吞掉
    if (operator === '=>')
      throw new GraphExpressionError('不支持箭头函数', cursor, input);
    tokens.push({ kind: 'op', pos: cursor, value: operator });
    cursor += operator.length;
  }

  return tokens;
}

/* ---------------------------------- AST ---------------------------------- */

type Node =
  | { kind: 'array'; items: Node[] }
  | { kind: 'binary'; op: string; left: Node; right: Node }
  | { kind: 'call'; args: Node[]; name: string }
  | { kind: 'identifier'; name: string }
  | { kind: 'index'; object: Node; index: Node }
  | { kind: 'literal'; value: ExpressionValue }
  | { kind: 'logical'; op: '&&' | '||'; left: Node; right: Node }
  | { kind: 'member'; object: Node; property: string }
  | { kind: 'ternary'; alternate: Node; consequent: Node; test: Node }
  | { kind: 'unary'; op: '!' | '-'; operand: Node };

const BINARY_PRECEDENCE: Record<string, number> = {
  '*': 7,
  '+': 6,
  '-': 6,
  '/': 7,
  '<': 4,
  '<=': 4,
  '==': 3,
  '===': 3,
  '>': 4,
  '>=': 4,
  '!==': 3,
  '!=': 3,
  '%': 7,
};

function parseTokens(tokens: Token[]): Node {
  let cursor = 0;
  const peek = () => tokens[cursor];
  const eat = (value: string) => {
    const token = tokens[cursor];
    if (token?.kind === 'op' && token.value === value) {
      cursor += 1;
      return true;
    }
    return false;
  };
  const expect = (value: string) => {
    if (!eat(value)) {
      throw new GraphExpressionError(
        `期望 "${value}"`,
        peek()?.pos ?? tokens.length,
        '',
      );
    }
  };

  function parseExpression(): Node {
    const test = parseBinary(0);
    if (eat('?')) {
      const consequent = parseExpression();
      expect(':');
      const alternate = parseExpression();
      return { alternate, consequent, kind: 'ternary', test };
    }
    return test;
  }

  function parseBinary(minPrecedence: number): Node {
    let left = parseUnary();
    for (;;) {
      const token = peek();
      if (!token || token.kind !== 'op') break;

      if (token.value === '&&' || token.value === '||') {
        if (minPrecedence > 2) break;
        cursor += 1;
        left = {
          kind: 'logical',
          left,
          op: token.value as '&&' | '||',
          right: parseBinary(2),
        };
        continue;
      }

      const precedence = BINARY_PRECEDENCE[token.value];
      if (precedence === undefined || precedence < minPrecedence) break;
      cursor += 1;
      const right = parseBinary(precedence + 1);
      left = { kind: 'binary', left, op: token.value, right };
    }
    return left;
  }

  function parseUnary(): Node {
    const token = peek();
    if (token?.kind === 'op' && (token.value === '!' || token.value === '-')) {
      cursor += 1;
      return {
        kind: 'unary',
        op: token.value as '!' | '-',
        operand: parseUnary(),
      };
    }
    return parsePostfix(parsePrimary());
  }

  function parsePostfix(node: Node): Node {
    for (;;) {
      if (eat('.')) {
        const name = tokens[cursor];
        if (!name || (name.kind !== 'ident' && name.kind !== 'number')) {
          throw new GraphExpressionError('属性名缺失', name?.pos ?? cursor, '');
        }
        cursor += 1;
        node = { kind: 'member', object: node, property: name.value };
        continue;
      }
      if (eat('[')) {
        const index = parseExpression();
        expect(']');
        node = { kind: 'index', index, object: node };
        continue;
      }
      return node;
    }
  }

  function parsePrimary(): Node {
    const token = peek();
    if (!token)
      throw new GraphExpressionError('表达式意外结束', tokens.length, '');

    if (token.kind === 'number') {
      cursor += 1;
      return { kind: 'literal', value: Number(token.value) };
    }
    if (token.kind === 'string') {
      cursor += 1;
      return { kind: 'literal', value: token.value };
    }
    if (eat('(')) {
      const inner = parseExpression();
      expect(')');
      return inner;
    }
    if (eat('[')) {
      const items: Node[] = [];
      if (!eat(']')) {
        do items.push(parseExpression());
        while (eat(','));
        expect(']');
      }
      return { items, kind: 'array' };
    }

    if (token.kind === 'ident') {
      cursor += 1;
      const lowered = token.value;
      if (lowered === 'true') return { kind: 'literal', value: true };
      if (lowered === 'false') return { kind: 'literal', value: false };
      if (lowered === 'null') return { kind: 'literal', value: null };
      if (lowered === 'undefined') return { kind: 'literal', value: undefined };

      if (peek()?.kind === 'op' && peek()!.value === '(') {
        cursor += 1;
        const args: Node[] = [];
        if (!eat(')')) {
          do args.push(parseExpression());
          while (eat(','));
          expect(')');
        }
        return { args, kind: 'call', name: lowered };
      }
      return { kind: 'identifier', name: lowered };
    }

    throw new GraphExpressionError(`意外的 "${token.value}"`, token.pos, '');
  }

  const ast = parseExpression();
  if (cursor < tokens.length) {
    throw new GraphExpressionError(
      `多余的 "${tokens[cursor]!.value}"`,
      tokens[cursor]!.pos,
      '',
    );
  }
  return ast;
}

/* -------------------------------- 内置函数 -------------------------------- */

function toNumber(value: ExpressionValue): number {
  if (value === null || value === undefined || value === '') return Number.NaN;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

function stringify(value: ExpressionValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      // 循环引用（表单里选中的部门树会指回父节点）不该让整个条件求值崩掉
      return '[object]';
    }
  }
  return String(value);
}

function isEmpty(value: ExpressionValue): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (value instanceof Map || value instanceof Set) return value.size === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

const BUILTINS: Record<string, ExpressionFunction> = {
  abs: (v) => Math.abs(toNumber(v)),
  bool: (v) => Boolean(v),
  ceil: (v) => Math.ceil(toNumber(v)),
  /** 返回第一个非空值；全空则 undefined */
  coalesce: (...args) => args.find((value) => !isEmpty(value)),
  contains: (v, needle) =>
    Array.isArray(v)
      ? v.includes(needle)
      : stringify(v).includes(stringify(needle)),
  endsWith: (v, suffix) => stringify(v).endsWith(stringify(suffix)),
  floor: (v) => Math.floor(toNumber(v)),
  isEmpty: (v) => isEmpty(v),
  isNotEmpty: (v) => !isEmpty(v),
  len: (v) =>
    Array.isArray(v) || typeof v === 'string' ? v.length : stringify(v).length,
  lower: (v) => stringify(v).toLowerCase(),
  max: (...args) => Math.max(...args.map((v) => toNumber(v))),
  min: (...args) => Math.min(...args.map((v) => toNumber(v))),
  number: (v) => toNumber(v),
  round: (v) => Math.round(toNumber(v)),
  startsWith: (v, prefix) => stringify(v).startsWith(stringify(prefix)),
  string: (v) => stringify(v),
  trim: (v) => stringify(v).trim(),
  upper: (v) => stringify(v).toUpperCase(),
};

/* -------------------------------- 求值 -------------------------------- */

/**
 * 松比较，但比 JS 收敛：
 * - `null` 与 `undefined` 视为相等（表单里"没填"有两种写法，条件不该区分）；
 * - 其余跨类型比较走数值化，`'1' == 1` 成立、`'' == 0` 不成立；
 * - 引用相等之外的隐式装箱一律不做。
 */
function looseEquals(left: ExpressionValue, right: ExpressionValue): boolean {
  if (left === right) return true;
  if (left == null && right == null) return true;
  if (left == null || right == null) return false;
  return toNumber(left) === toNumber(right);
}

function readProperty(
  target: ExpressionValue,
  property: string,
  canRead: (name: string) => boolean,
): ExpressionValue {
  if (!canRead(property)) return undefined;
  if (target === null || target === undefined) return undefined;
  if (
    property === 'length' &&
    (typeof target === 'string' || Array.isArray(target))
  ) {
    return target.length;
  }
  if (target instanceof Map) return target.get(property);
  if (typeof target !== 'object' && typeof target !== 'function') {
    return (target as Record<string, ExpressionValue>)[property];
  }
  return (target as Record<string, ExpressionValue>)[property];
}

function evalNode(
  node: Node,
  ctx: Record<string, ExpressionValue>,
  functions: Record<string, ExpressionFunction>,
  canRead: (name: string) => boolean,
): ExpressionValue {
  switch (node.kind) {
    case 'identifier': {
      if (Object.prototype.hasOwnProperty.call(ctx, node.name))
        return ctx[node.name];
      // 未声明的标识符按 undefined 处理而不是抛错：条件表达式经常引用"这一步还没写入的字段"，
      // 抛错会让上游一个可选节点直接把整条流程炸掉。
      return undefined;
    }
    case 'literal': {
      return node.value;
    }
    case 'array': {
      return node.items.map((item) => evalNode(item, ctx, functions, canRead));
    }
    case 'member': {
      return readProperty(
        evalNode(node.object, ctx, functions, canRead),
        node.property,
        canRead,
      );
    }
    case 'index': {
      const target = evalNode(node.object, ctx, functions, canRead);
      const key = evalNode(node.index, ctx, functions, canRead);
      if (target === null || target === undefined) return undefined;
      if (typeof key === 'string' && !canRead(key)) return undefined;
      if (target instanceof Map) return target.get(key);
      return (target as Record<number | string, ExpressionValue>)[
        key as number | string
      ];
    }
    case 'call': {
      const fn = functions[node.name];
      if (!fn) throw new GraphExpressionError(`未知函数 "${node.name}"`, 0, '');
      return fn(
        ...node.args.map((arg) => evalNode(arg, ctx, functions, canRead)),
      );
    }
    case 'unary': {
      const value = evalNode(node.operand, ctx, functions, canRead);
      return node.op === '!' ? !value : -toNumber(value);
    }
    case 'logical': {
      // 短路：右侧根本不参与求值，这是 `x != null && x.len > 3` 能成立的前提
      const left = evalNode(node.left, ctx, functions, canRead);
      if (node.op === '&&')
        return left ? evalNode(node.right, ctx, functions, canRead) : left;
      return left ? left : evalNode(node.right, ctx, functions, canRead);
    }
    case 'ternary': {
      return evalNode(node.test, ctx, functions, canRead)
        ? evalNode(node.consequent, ctx, functions, canRead)
        : evalNode(node.alternate, ctx, functions, canRead);
    }
    case 'binary': {
      const left = evalNode(node.left, ctx, functions, canRead);
      const right = evalNode(node.right, ctx, functions, canRead);
      switch (node.op) {
        case '+': {
          // `+` 在两侧都是数字时才做算术，否则按字符串拼接 ——
          // 与 JS 唯一的差别是这里不会把 `'1' + 1` 悄悄算成 `2`。
          if (typeof left === 'number' && typeof right === 'number')
            return left + right;
          return `${stringify(left)}${stringify(right)}`;
        }
        case '-': {
          return toNumber(left) - toNumber(right);
        }
        case '*': {
          return toNumber(left) * toNumber(right);
        }
        case '/': {
          return toNumber(left) / toNumber(right);
        }
        case '%': {
          return toNumber(left) % toNumber(right);
        }
        case '==': {
          return looseEquals(left, right);
        }
        case '!=': {
          return !looseEquals(left, right);
        }
        case '===': {
          return left === right;
        }
        case '!==': {
          return left !== right;
        }
        case '<': {
          return toNumber(left) < toNumber(right);
        }
        case '>': {
          return toNumber(left) > toNumber(right);
        }
        case '<=': {
          return toNumber(left) <= toNumber(right);
        }
        case '>=': {
          return toNumber(left) >= toNumber(right);
        }
        default: {
          throw new GraphExpressionError(`不支持的运算符 "${node.op}"`, 0, '');
        }
      }
    }
    default: {
      throw new GraphExpressionError('未知语法节点', 0, '');
    }
  }
}

export interface CompiledExpression {
  /** 原始文本，供设计器回显 */
  readonly source: string;
  evaluate: (ctx?: Record<string, ExpressionValue>) => ExpressionValue;
  /** 按 JS truthiness 判定，条件分支用这个 */
  test: (ctx?: Record<string, ExpressionValue>) => boolean;
}

export interface ExpressionEvaluator {
  compile: (source: string) => CompiledExpression;
  evaluate: (
    source: string,
    ctx?: Record<string, ExpressionValue>,
  ) => ExpressionValue;
  /** 注册实例级函数；同名覆盖内置，返回自身便于链式调用 */
  register: (name: string, fn: ExpressionFunction) => ExpressionEvaluator;
  /** `{{ path }}` 插值；未命中的路径渲染为空串，`{{ path ?? '兜底' }}` 支持默认值 */
  resolveTemplate: (
    template: string,
    ctx?: Record<string, ExpressionValue>,
  ) => string;
  test: (source: string, ctx?: Record<string, ExpressionValue>) => boolean;
}

/**
 * 创建一个求值器。
 *
 * 注册表是**实例级**的：AI 编排会往里塞 `llm_output()`，工作流会塞 `assignee_has_role()`，
 * 两边互不干扰，也不存在"某个包 import 了就全局改了条件语义"这种跨模块副作用。
 */
export function createExpressionEvaluator(
  options: EvaluatorOptions = {},
): ExpressionEvaluator {
  const functions: Record<string, ExpressionFunction> = {
    ...BUILTINS,
    ...options.functions,
  };
  const canRead =
    options.canReadProperty ??
    ((name: string) => !BLOCKED_PROPERTIES.has(name));
  const cache = new Map<string, Node>();

  function astOf(source: string): Node {
    const cached = cache.get(source);
    if (cached) return cached;
    const ast = parseTokens(tokenize(source));
    cache.set(source, ast);
    return ast;
  }

  function compile(source: string): CompiledExpression {
    const ast = astOf(source);
    const evaluate = (ctx: Record<string, ExpressionValue> = {}) =>
      evalNode(ast, ctx, functions, canRead);
    return { evaluate, source, test: (ctx) => Boolean(evaluate(ctx)) };
  }

  return {
    compile,
    evaluate: (source, ctx) => compile(source).evaluate(ctx),
    register(name, fn) {
      functions[name] = fn;
      // 新函数可能让此前解析通过的表达式里的调用生效，缓存的 AST 不用重建，直接复用
      return this;
    },
    resolveTemplate(template, ctx = {}) {
      return template.replaceAll(
        /\{\{\s*([\s\S]+?)\s*\}\}/gu,
        (_match, raw: string) => {
          const [expression, fallback] = raw.split('??');
          const value = compile((expression ?? raw).trim()).evaluate(ctx);
          if (!isEmpty(value)) return stringify(value);
          if (fallback === undefined) return '';
          // 兜底段允许裸字符串字面量：`{{ user.dept ?? '未分配' }}`
          const trimmed = fallback.trim();
          if (/^(['"]).*\1$/u.test(trimmed)) return trimmed.slice(1, -1);
          const evaluated = compile(trimmed).evaluate(ctx);
          return isEmpty(evaluated) ? '' : stringify(evaluated);
        },
      );
    },
    test: (source, ctx) => compile(source).test(ctx),
  };
}

/** 默认求值器：单例，供不关心自定义函数的消费方直接用 */
export const defaultEvaluator = createExpressionEvaluator();

export function evaluateExpression(
  source: string,
  ctx?: Record<string, ExpressionValue>,
): ExpressionValue {
  return defaultEvaluator.evaluate(source, ctx);
}

export function resolveTemplate(
  template: string,
  ctx?: Record<string, ExpressionValue>,
): string {
  return defaultEvaluator.resolveTemplate(template, ctx);
}
