import type { AiMessage, FewShotExample } from './types';

import { createExpressionEvaluator } from '@antdv/graph';

import { AiFlowError } from './errors';

/**
 * 提示词组装。
 *
 * 分层位置：`core/prompt.ts`，纯函数，被 `prompt` / `llm` 节点处理器共用。
 * 求值走 `@antdv/graph` 的受限表达式（不是 eval、不是模板字符串），
 * 所以流程图里那个 `{{ 表达式 }}` 与审批流的条件表达式是同一套语法 —— 宿主只需要学一次。
 *
 * 这里**不做**的事：不做提示词优化、不自动补 "You are a helpful assistant"、
 * 不缓存渲染结果。缺变量一律抛错（见 `renderTemplate`），绝不静默留空 ——
 * 少一段上下文的请求照样会 200 返回，只是答案是编的，而没人会怀疑一句正常的话。
 */

const TEMPLATE_TOKEN = /\{\{\s*([^{}]*?)\s*\}\}/gu;

/** 每跑一次 render 都新建实例而不是复用 defaultEvaluator：注册表是实例级的，别污染别的调用方 */
const evaluator = createExpressionEvaluator();

export interface RenderOptions {
  /** 报错信息里带谁在渲染：节点 id 或 'prompt' */
  label?: string;
  /** 命中这些名字的变量允许缺失（例如宿主自己注入的全局变量） */
  optional?: string[];
  /** 变量表之外的常量上下文（函数、当前登录人等） */
  context?: Record<string, unknown>;
}

/** 抽出模板里用到的变量路径，Inspector 拿它提示「这个节点还缺哪几个入参」 */
export function collectVariables(template: string | undefined): string[] {
  if (!template) return [];
  const found = new Set<string>();
  for (const match of template.matchAll(TEMPLATE_TOKEN)) {
    const raw = (match[1] ?? '').split('??')[0]!.trim();
    if (!raw || /[^A-Za-z_$\u4E00-\u9FA5.0-9_\s[\]()'"]/u.test(raw)) continue;
    if (/^[A-Za-z_$][\w$]*\s*\(/u.test(raw)) continue; // 函数调用不是变量
    if (/^(['"]).*\1$/u.test(raw)) continue; // 字面量兜底
    found.add(raw);
  }
  return [...found];
}

/** 按 `.` 与 `[n]` 取值；任何一环不存在就返回 undefined */
function readPath(source: Record<string, unknown>, path: string): unknown {
  let cursor: unknown = source;
  for (const segment of path.replaceAll(/\[(\d+)\]/gu, '.$1').split('.')) {
    if (!segment) continue;
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

/**
 * 渲染 `{{ 变量 }}`。
 *
 * 判缺的口径是 `null`/`undefined` 都算缺：模型经常把「没有」写成 `null`，
 * 渲染成字符串 `"null"` 比报错更难发现。
 * `??` 兜底段与 graph 的模板语法保持一致：`{{ user.dept ?? '未分配' }}`。
 */
export function renderTemplate(
  template: string | undefined,
  values: Readonly<Record<string, unknown>>,
  options: RenderOptions = {},
): string {
  if (!template) return '';
  const optional = new Set(options.optional ?? []);
  const scope = { ...options.context, ...values };
  const missing: string[] = [];

  const rendered = template.replace(TEMPLATE_TOKEN, (token, raw: string) => {
    const [expression, fallback] = raw.split('??');
    const trimmed = (expression ?? raw).trim();

    const isCall = /^[A-Za-z_$][\w$]*\s*\(/u.test(trimmed);
    const isLiteral = /^(['"]).*\1$/u.test(trimmed);
    const declared = !isCall && !isLiteral && hasPath(scope, trimmed);

    let value: unknown;
    try {
      value = evaluator.evaluate(trimmed, scope as Record<string, unknown>);
    } catch (error) {
      throw new AiFlowError(
        `${options.label ?? 'prompt'}: 模板 "${token}" 求值失败 —— ${error instanceof Error ? error.message : String(error)}`,
        'template-expression-invalid',
      );
    }

    if (value === undefined || value === null) {
      if (fallback !== undefined) {
        const literal = fallback.trim();
        if (/^(['"]).*\1$/u.test(literal)) return literal.slice(1, -1);
        try {
          const orElse = evaluator.evaluate(
            literal,
            scope as Record<string, unknown>,
          );
          return orElse === undefined || orElse === null ? '' : String(orElse);
        } catch {
          return literal;
        }
      }
      // 变量没声明 + 也没有兜底：记下来，最后一次性报出来，别让人改一个跑一次
      if (!optional.has(trimmed) && !isCall && !isLiteral && !declared)
        missing.push(trimmed);
      return '';
    }
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  });

  if (missing.length > 0) {
    throw new AiFlowError(
      `${options.label ?? 'prompt'}: 模板缺少变量 ${[...new Set(missing)].map((name) => `{{ ${name} }}`).join('、')}`,
      'template-variable-missing',
      { details: { variables: [...new Set(missing)] } },
    );
  }
  return rendered;
}

function hasPath(scope: Record<string, unknown>, path: string): boolean {
  if (!path) return false;
  return readPath(scope, path) !== undefined;
}

export interface PromptSpec {
  fewShot?: FewShotExample[];
  /** few-shot 的引导语；不配则不输出这句 */
  fewShotIntro?: string;
  system?: string;
  /** `user` 的别名，两者都写时 user 优先 */
  template?: string;
  user?: string;
}

export interface RenderedPrompt {
  /** 直接可以塞进 AiRequest 的消息序列 */
  messages: AiMessage[];
  /** 同一段内容的纯文本形态，给日志与「看看最终提示词」的界面用 */
  text: string;
  /** 模板里真实用到的变量名，节点校验入参时比对 */
  variables: string[];
}

/**
 * 系统段 + few-shot + 用户段的组装。
 *
 * few-shot 展开成**一轮轮真对话**而不是拼进 system 字符串：主流模型对多轮示例的遵循度
 * 明显好于把示例糊在一段里，而且这样宿主换成 chat 或 completion 接口时只需要改 provider。
 */
export function renderPrompt(
  spec: PromptSpec,
  values: Readonly<Record<string, unknown>>,
  options: RenderOptions = {},
): RenderedPrompt {
  const messages: AiMessage[] = [];
  const parts: string[] = [];
  const variables: string[] = [
    ...collectVariables(spec.system),
    ...collectVariables(spec.user ?? spec.template),
  ];

  const system = renderTemplate(spec.system, values, options);
  if (system) {
    messages.push({ content: system, role: 'system' });
    parts.push(system);
  }

  if (spec.fewShot?.length) {
    const intro = renderTemplate(spec.fewShotIntro, values, options);
    if (intro) parts.push(intro);
    for (const example of spec.fewShot) {
      const input = renderTemplate(example.input, values, options);
      const output = renderTemplate(example.output, values, options);
      messages.push(
        { content: input, role: 'user' },
        { content: output, role: 'assistant' },
      );
      variables.push(
        ...collectVariables(example.input),
        ...collectVariables(example.output),
      );
    }
  }

  const user = renderTemplate(spec.user ?? spec.template, values, options);
  if (user) {
    messages.push({ content: user, role: 'user' });
    parts.push(user);
  }

  return {
    messages,
    text: parts.join('\n\n'),
    variables: [...new Set(variables)],
  };
}
