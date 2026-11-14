import type { ExpressionEvaluator, ExpressionValue } from '@antdv/graph';

import type {
  BindingContext,
  ComponentMeta,
  EventAction,
  EventActionKind,
  NodeSchema,
  ScopePath,
} from './types';

import { createExpressionEvaluator } from '@antdv/graph';

/**
 * 绑定求值：把 Schema 里的字符串翻译成 scope 上的读写。
 *
 * 分层位置：`core/`，纯 TS。表达式的**语法**完全复用 `@antdv/graph` 的受限求值器
 * （`compile/evaluate/register/resolveTemplate/test`，不是 eval，`__proto__` /
 * `constructor` / `prototype` 读被挡），本文件只补低代码需要的三件事：
 * `{{ }}` 的类型保留规则、scope 的**路径读写**、以及事件动作的文法。
 *
 * 本文件**不做**的事：不认识 Vue 组件、不认识物料、不取数（`datasource.ts`）、
 * 不解释 Schema 结构（`dsl.ts`）。
 */

/** 只拦原型链逃逸，其余属性名照常读写 —— 与 graph 的 BLOCKED_PROPERTIES 同一份名单 */
export const FORBIDDEN_SEGMENTS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/** 整体就是一个 `{{ expr }}`：求值后保留原始类型（`{{ 1 + 1 }}` 是数字 2 而不是 '2'） */
const WHOLE_TEMPLATE = /^\{\{\s*([\S\s]+?)\s*\}\}$/u;

/** 任意位置的 `{{ expr }}` 插值，与 graph `resolveTemplate` 的正则同构 */
const ANY_TEMPLATE = /\{\{\s*([\S\s]+?)\s*\}\}/gu;

/** 兜底写法：`{{ a ?? '未填' }}`。graph 的语法里没有 `??`，插值层自己拆 */
const NULLISH_SEPARATOR = '??';

export type BindingErrorCode = 'invalid-path' | 'unsafe-path';

export class LowCodeBindingError extends Error {
  readonly code: BindingErrorCode;

  constructor(code: BindingErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'LowCodeBindingError';
  }

  static is(error: unknown): error is LowCodeBindingError {
    return error instanceof LowCodeBindingError;
  }
}

/* -------------------------------- 路径 -------------------------------- */

/**
 * scope 路径的段形式。
 *
 * 判 `typeof path !== 'string'` 而不是 `Array.isArray`：后者不会把 `readonly []` 从负分支里收窄，
 * 于是调用方拿到一堆「可能是数组」的假报错。
 */
export function parsePath(path: ScopePath): Array<number | string> {
  if (typeof path === 'number') return [path];
  if (typeof path !== 'string') return [...path];
  const text = path.trim();
  if (!text) return [];
  const segments: Array<number | string> = [];
  let cursor = 0;
  let pending = '';

  const flush = () => {
    if (pending === '') return;
    segments.push(pending);
    pending = '';
  };

  while (cursor < text.length) {
    const char = text[cursor]!;
    if (char === '.') {
      flush();
      cursor += 1;
      continue;
    }
    if (char === '[') {
      flush();
      const close = text.indexOf(']', cursor);
      if (close === -1)
        throw new LowCodeBindingError(
          'invalid-path',
          `路径「${text}」的 "[" 没有闭合`,
        );
      const raw = text.slice(cursor + 1, close).trim();
      const quote = raw[0];
      const key = quote === "'" || quote === '"' ? raw.slice(1, -1) : raw;
      if (!key)
        throw new LowCodeBindingError(
          'invalid-path',
          `路径「${text}」里有空的 "[]"`,
        );
      segments.push(/^\d+$/u.test(key) ? Number(key) : key);
      cursor = close + 1;
      continue;
    }
    pending += char;
    cursor += 1;
  }
  flush();
  return segments;
}

/** 路径里出现原型链段时给一句人话；返回 `undefined` 表示这条路径可以用 */
export function unsafePathMessage(path: ScopePath): string | undefined {
  const segments = Array.isArray(path) ? path : parsePath(path);
  const source = Array.isArray(path) ? path.join('.') : String(path);
  for (const segment of segments) {
    const key = String(segment);
    if (FORBIDDEN_SEGMENTS.has(key))
      return `路径「${source}」禁止写入原型链属性「${key}」`;
  }
  return undefined;
}

/** 内部统一入口：字符串拆段、数组拷贝一份，别把调用方的数组当工作区改 */
function normalizeSegments(path: ScopePath): Array<number | string> {
  return parsePath(path);
}

/**
 * 读一条路径。
 * 遇到原型链段返回兜底值而不是抛错：读的是用户配的绑定，取不到就当没值；
 * 写是破坏性动作，所以那边才拦。
 */
export function getPath(
  target: unknown,
  path: ScopePath,
  fallback?: unknown,
): unknown {
  const segments = normalizeSegments(path);
  if (segments.some((segment) => FORBIDDEN_SEGMENTS.has(String(segment))))
    return fallback;
  let cursor: unknown = target;
  for (const segment of segments) {
    if (cursor === null || cursor === undefined) return fallback;
    if (typeof cursor !== 'object' && typeof cursor !== 'function')
      return fallback;
    cursor = (cursor as Record<number | string, unknown>)[segment];
  }
  return cursor === undefined ? fallback : cursor;
}

/**
 * 写一条路径。
 * - 中间层缺失时自动建：下一段是数字就建数组，否则建对象（`set:list[0].name` 很常见，
 *   要求宿主先把骨架搭好反而更难用）；
 * - 中间层已存在但不是对象时报错而不是静默覆盖 —— 「配置和现状不一致」必须被设计器看见；
 * - 原型链段一律拒绝。
 */
export function setPath(
  target: Record<string, unknown>,
  path: ScopePath,
  value: unknown,
): void {
  const segments = normalizeSegments(path);
  const unsafe = unsafePathMessage(segments);
  if (unsafe) throw new LowCodeBindingError('unsafe-path', unsafe);
  if (segments.length === 0)
    throw new LowCodeBindingError('invalid-path', '路径为空，无法写入');

  let cursor: Record<string, unknown> | unknown[] = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index]!;
    const nextKey = segments[index + 1]!;
    const existing = (cursor as Record<number | string, unknown>)[key];
    if (existing === null || existing === undefined) {
      const created: Record<string, unknown> | unknown[] =
        typeof nextKey === 'number' ? [] : {};
      (cursor as Record<number | string, unknown>)[key] = created;
      cursor = created;
      continue;
    }
    if (typeof existing !== 'object') {
      throw new LowCodeBindingError(
        'invalid-path',
        `路径「${segments.join('.')}」第 ${index} 段「${String(key)}」已经是${typeof existing}，没法往下钻`,
      );
    }
    cursor = existing as Record<string, unknown> | unknown[];
  }

  const last = segments[segments.length - 1]!;
  if (Array.isArray(cursor) && typeof last === 'number') {
    // 越界写：先补齐长度，否则 `arr[5] = v` 在只到 2 的数组上会留下语义不清的空洞
    while (cursor.length < last) cursor.push(undefined);
    cursor[last] = value;
    return;
  }
  (cursor as Record<number | string, unknown>)[last] = value;
}

/** 删一条路径；数组下标走 splice，免得留空洞。返回是否真的删掉了东西 */
export function deletePath(
  target: Record<string, unknown>,
  path: ScopePath,
): boolean {
  const segments = normalizeSegments(path);
  const unsafe = unsafePathMessage(segments);
  if (unsafe) throw new LowCodeBindingError('unsafe-path', unsafe);
  if (segments.length === 0) return false;
  const last = segments[segments.length - 1]!;
  const parent =
    segments.length === 1
      ? (target as unknown)
      : getPath(target, segments.slice(0, -1));
  if (parent === null || parent === undefined || typeof parent !== 'object')
    return false;
  if (Array.isArray(parent) && typeof last === 'number') {
    if (last < 0 || last >= parent.length) return false;
    parent.splice(last, 1);
    return true;
  }
  const holder = parent as Record<number | string, unknown>;
  if (!(String(last) in holder)) return false;
  delete holder[last];
  return true;
}

/** 往路径上的数组追加；当前值不是数组时按空数组处理 */
export function pushPath(
  target: Record<string, unknown>,
  path: ScopePath,
  value: unknown,
): void {
  const current = getPath(target, path);
  const list = Array.isArray(current) ? [...current] : [];
  list.push(value);
  setPath(target, path, list);
}

/** 把对象值并进路径上的对象；任一侧不是对象时按空对象处理 */
export function mergePath(
  target: Record<string, unknown>,
  path: ScopePath,
  value: unknown,
): void {
  const current = getPath(target, path);
  const holder =
    current !== null && typeof current === 'object' && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  const patch =
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  setPath(target, path, Object.assign({}, holder, patch));
}

/* ------------------------------ 表达式求值 ------------------------------ */

export interface BindingOptions {
  /** 宿主注入的只读变量（登录人、字典、当前租户…），同名键让位给 scope */
  ctx?: BindingContext;
  /** 求值器；缺省共享一份，宿主注册过自定义函数后自己传进来 */
  evaluator?: ExpressionEvaluator;
  /** 求值抛错时的回收口；不传则向上抛 */
  onError?: (message: string, source: string) => void;
}

const fallbackEvaluator = createExpressionEvaluator();

/** 求值上下文：宿主变量打底，页面 scope 覆盖同名键 */
export function mergeContext(
  scope: Record<string, unknown>,
  ctx?: BindingContext,
): Record<string, ExpressionValue> {
  const base: Record<string, ExpressionValue> = {};
  for (const [key, value] of Object.entries(ctx ?? {})) base[key] = value;
  for (const [key, value] of Object.entries(scope)) base[key] = value;
  return base;
}

export function isBindingString(value: unknown): value is string {
  return (
    typeof value === 'string' && value.includes('{{') && value.includes('}}')
  );
}

/**
 * 把「可以写 `{{ x }}` 也可以写裸 `x`」的入参统一剥成裸表达式。
 *
 * 存在的理由：`DataSourceSpec.expression` 与 `condition` 都是人手写的配置，
 * 作者会习惯性带上花括号；而 graph 的 `evaluate` 只吃裸表达式，带上花括号会直接语法报错。
 * 运行期（datasource）与体检期（dsl）都走这里，两边才不会各判各的。
 */
export function bareExpression(source: string | undefined): string {
  const text = (source ?? '').trim();
  const whole = WHOLE_TEMPLATE.exec(text);
  return (whole?.[1] ?? text).trim();
}

/** 「空」的判定与 graph 的 isEmpty 同口径：0 / false 不算空，只有 null / undefined / '' / 空集合算 */
function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (value instanceof Map || value instanceof Set) return value.size === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

function isQuotedLiteral(text: string): boolean {
  return /^(['"]).*\1$/u.test(text);
}

/**
 * `a ?? b ?? '兜底'` 的求值：**保留原始类型**，这是 `resolveTemplate` 给不了的
 * （插值结果一定是字符串）。分段规则与 graph 的 `resolveTemplate` 保持一致，
 * 所以体检（`dsl.templateParts`）和运行期不会对同一行配置给出相反结论。
 */
export function evaluateNullish(
  source: string,
  ctx: Record<string, ExpressionValue>,
  evaluator: ExpressionEvaluator,
): unknown {
  const parts = source
    .split(NULLISH_SEPARATOR)
    .map((item) => item.trim())
    .filter((item) => item !== '');
  if (parts.length <= 1) return evaluator.evaluate(source, ctx);
  for (const part of parts) {
    const value = isQuotedLiteral(part)
      ? part.slice(1, -1)
      : evaluator.evaluate(part, ctx);
    if (!isEmptyValue(value)) return value;
  }
  return undefined;
}

/**
 * 单个值的绑定解释，规则按「谁写得出来谁负责」排：
 * 1. 整串就是 `{{ expr }}` -> 返回求值结果并**保留原始类型**；
 * 2. 文本与 `{{ expr }}` 混排 -> 走 `resolveTemplate`，结果一定是字符串（拼接没有类型可言）；
 * 3. 数组与对象递归下去解释，其余值（Date、函数、类实例）原样返回。
 */
export function resolveValue(
  value: unknown,
  scope: Record<string, unknown>,
  options: BindingOptions = {},
): unknown {
  const evaluator = options.evaluator ?? fallbackEvaluator;
  const ctx = mergeContext(scope, options.ctx);
  const guard = <T>(run: () => T, fallback: T, source: string): T => {
    try {
      return run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.onError) {
        options.onError(message, source);
        return fallback;
      }
      throw error;
    }
  };

  if (typeof value === 'string') {
    const whole = WHOLE_TEMPLATE.exec(value.trim());
    const source = whole?.[1]?.trim();
    if (source)
      return guard(
        () => evaluateNullish(source, ctx, evaluator),
        undefined,
        source,
      );
    if (isBindingString(value))
      return guard(() => evaluator.resolveTemplate(value, ctx), '', value);
    return value;
  }
  if (Array.isArray(value))
    return value.map((item) => resolveValue(item, scope, options));
  if (
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>))
      out[key] = resolveValue(item, scope, options);
    return out;
  }
  return value;
}

/** 节点的全部 props 解释成「可以直接喂给组件的值」 */
export function resolveProps(
  node: NodeSchema,
  scope: Record<string, unknown>,
  options: BindingOptions = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node.props ?? {})) {
    out[key] = resolveValue(value, scope, options);
  }
  return out;
}

/**
 * 显隐判定。
 * - 没写 `condition` 视为可见：默认显示比默认隐藏符合搭建习惯，也不会「页面凭空少一块」；
 * - 裸表达式与 `{{ expr }}` 两种写法都认；
 * - 求值抛错按不可见处理并把原因交回调用方：宁可少渲染一块，也不要渲染出一个跑在半路的页面。
 */
export function evalCondition(
  condition: string | undefined,
  scope: Record<string, unknown>,
  options: BindingOptions = {},
): boolean {
  const text = condition?.trim();
  if (!text) return true;
  const evaluator = options.evaluator ?? fallbackEvaluator;
  const whole = WHOLE_TEMPLATE.exec(text);
  const source = whole?.[1]?.trim() ?? text;
  try {
    return Boolean(
      evaluateNullish(source, mergeContext(scope, options.ctx), evaluator),
    );
  } catch (error) {
    options.onError?.(
      error instanceof Error ? error.message : String(error),
      source,
    );
    return false;
  }
}

/* ---------------------------- 事件动作文法 ---------------------------- */

const ACTION_KINDS: Record<string, EventActionKind> = {
  emit: 'emit',
  evaluate: 'evaluate',
  merge: 'merge',
  push: 'push',
  refresh: 'refresh',
  remove: 'remove',
  set: 'set',
};

/**
 * 动作串文法（`NodeSchema.events` 的值）：
 *
 * | 写法 | 含义 |
 * | --- | --- |
 * | `set:form.name` | 事件入参写进 `form.name` |
 * | `set:total={{ amount * 2 }}` | 按表达式算出值再写，`$event` 是事件入参 |
 * | `push:list` | 追加到数组 |
 * | `merge:filter` | 把对象入参并进对象 |
 * | `remove:list[1]` | 删掉（数组下标走 splice，不留空洞） |
 * | `refresh:users` | 重新装载数据源 |
 * | `emit:submit` | 抛给宿主，页面自己接 |
 * | `evaluate:log('点击')` | 只求值不写回，给宿主注册的副作用函数留口子 |
 *
 * 不认识的前缀返回带 `error` 的结果而不是抛异常：设计器要能把「哪条动作写错了」显示出来，
 * 而不是点一下按钮整个页面崩掉。
 */
export function parseEventAction(raw: string): EventAction {
  const text = (raw ?? '').trim();
  if (!text) return { arg: '', error: '动作为空', kind: 'evaluate', raw };
  const colon = text.indexOf(':');
  if (colon <= 0) {
    return {
      arg: '',
      error:
        '缺少「前缀:」，可用 set / push / merge / remove / refresh / emit / evaluate',
      kind: 'evaluate',
      raw: text,
    };
  }
  const head = text.slice(0, colon).trim();
  const kind = ACTION_KINDS[head];
  if (!kind)
    return {
      arg: '',
      error: `不认识的动作「${head}」，可用 set / push / merge / remove / refresh / emit / evaluate`,
      kind: 'evaluate',
      raw: text,
    };
  let body = text.slice(colon + 1).trim();
  let expression: string | undefined;
  if (kind === 'merge' || kind === 'push' || kind === 'set') {
    const equals = body.indexOf('=');
    if (equals !== -1) {
      // 剥花括号：写配置的人会顺手带上 `{{ }}`，而下游（求值与体检）统一只吃裸表达式。
      // 留着花括号会被 `applyEventAction` 再包一层，变成 `{{ {{ x }} }}` 直接语法报错。
      expression = bareExpression(body.slice(equals + 1));
      body = body.slice(0, equals).trim();
    }
  }
  return { arg: body, expression, kind, raw: text };
}

export interface EventActionInput {
  action: EventAction;
  /** 事件入参：`set:path` 没写 `=expr` 时直接写它 */
  payload?: unknown;
  /** 目标 scope（`useLowcodePage` 交出来的那个响应式对象） */
  scope: Record<string, unknown>;
  ctx?: BindingContext;
  evaluator?: ExpressionEvaluator;
  /** `emit:` 的接线；不传则报「没有接线」而不是静默丢弃 */
  onEmit?: (name: string, payload: unknown) => void;
  /** `refresh:` 的接线；同上。返回什么不重要，动作只负责「把它点着」 */
  onRefresh?: (id: string) => unknown;
}

export interface EventActionResult {
  action: EventAction;
  /** 是否真的改动了 scope */
  changed: boolean;
  error?: string;
  /** 被写入/删除的路径，供宿主做联动与埋点 */
  path?: string;
}

/**
 * 执行一条动作。异常一律收敛成 `error`：一次点击不该把页面打崩，
 * 但错误必须能被 `useLowcodePage` 收集成可读列表（设计器里就是「事件配置有问题」）。
 */
export function applyEventAction(input: EventActionInput): EventActionResult {
  const { action, scope } = input;
  const evaluator = input.evaluator ?? fallbackEvaluator;
  const fail = (error: string): EventActionResult => ({
    action,
    changed: false,
    error,
  });
  if (action.error) return fail(action.error);

  const ctx = mergeContext(scope, input.ctx);
  // `$event` / `$payload` 是两个别名：写表达式的人习惯哪个就用哪个
  ctx.$event = input.payload;
  ctx.$payload = input.payload;

  try {
    if (action.kind === 'emit') {
      if (!input.onEmit)
        return fail(`emit:${action.arg} 没有接线：调用方需要传 onEmit`);
      input.onEmit(action.arg, input.payload);
      return { action, changed: false };
    }
    if (action.kind === 'refresh') {
      if (!input.onRefresh)
        return fail(`refresh:${action.arg} 没有接线：调用方需要传 onRefresh`);
      void input.onRefresh(action.arg);
      return { action, changed: false };
    }
    if (action.kind === 'evaluate') {
      evaluator.evaluate(action.arg || action.raw, ctx);
      return { action, changed: false };
    }
    if (!action.arg) return fail('动作缺少目标路径');
    const unsafe = unsafePathMessage(action.arg);
    if (unsafe) return fail(unsafe);

    if (action.kind === 'remove') {
      const changed = deletePath(scope, action.arg);
      return { action, changed, path: action.arg };
    }
    const value = action.expression
      ? resolveValue(`{{ ${action.expression} }}`, scope, {
          ctx: { ...input.ctx, $event: input.payload, $payload: input.payload },
          evaluator,
        })
      : input.payload;
    if (action.kind === 'set') setPath(scope, action.arg, value);
    else if (action.kind === 'push') pushPath(scope, action.arg, value);
    else mergePath(scope, action.arg, value);
    return { action, changed: true, path: action.arg };
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/* ---------------------------- 双向绑定映射 ---------------------------- */

export interface ModelBinding {
  /** 组件抛出的事件名，例如 `update:modelValue` */
  event: string;
  /** 写回的 scope 路径 */
  path: string;
  /** 读值用的 props 键（就是写着 `{{ path }}` 的那个键） */
  prop: string;
}

/**
 * 从节点里还原「哪些事件构成 v-model 语义」。
 *
 * 判据不需要额外字段：`props` 里整体写成 `{{ form.name }}` 的表达式，
 * 与 `events` 里 `set:form.name` 指向同一条路径时，就是一对双向绑定 ——
 * 读走插值、写走动作，两边本来就在 Schema 里，不必再造一个 `model` 键。
 * `meta` 只用来做否决：组件明确声明某事件不是双向（`twoWay: false`）时不配对，
 * 免得把「点击行选中」这类事件误判成绑定。
 */
export function twoWayBindingsOf(
  node: NodeSchema,
  meta?: ComponentMeta,
): ModelBinding[] {
  const writers = new Map<string, string>();
  for (const [event, action] of Object.entries(node.events ?? {})) {
    const parsed = parseEventAction(action);
    if (parsed.kind === 'set' && !parsed.expression && !parsed.error)
      writers.set(parsed.arg, event);
  }

  const out: ModelBinding[] = [];
  for (const [key, value] of Object.entries(node.props ?? {})) {
    if (typeof value !== 'string') continue;
    const source = WHOLE_TEMPLATE.exec(value.trim())?.[1]?.trim();
    if (!source || source.includes(NULLISH_SEPARATOR)) continue;
    const event = writers.get(source);
    if (!event) continue;
    if (
      meta?.events?.some((item) => item.name === event && item.twoWay === false)
    )
      continue;
    out.push({ event, path: source, prop: key });
  }
  return out;
}

/** 列出表达式里出现过的标识符（含函数名），属性面板用来提示「这段依赖哪些 scope 键」 */
export function referencedKeys(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(ANY_TEMPLATE)) {
    const raw = match[1];
    if (!raw) continue;
    for (const token of raw.matchAll(/[A-Za-z_$][\w$]*/gu)) {
      const name = token[0]!;
      if (!FORBIDDEN_SEGMENTS.has(name)) names.add(name);
    }
  }
  return [...names].toSorted();
}
