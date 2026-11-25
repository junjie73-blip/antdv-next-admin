import type { ValidateOptions } from '@antdv/graph';

import type {
  AiFlowDefinition,
  AiFlowIssue,
  AiNodeData,
  AiNodeHandler,
  AiNodeHandlerRegistry,
  ToolRegistryLike,
} from './types';

import { createExpressionEvaluator, validateGraph } from '@antdv/graph';

import { AiFlowError, errorText } from './errors';
import { collectVariables } from './prompt';
import { createAiNodeRegistry } from './registry';

/**
 * 设计期校验：把「跑起来才炸」提前变成「保存时就亮」。
 *
 * 分层位置：`core/validate.ts`，纯 TS，只读 `AiFlowDefinition`，不 import vue、不碰运行态。
 *
 * 与 `@antdv/graph` 的分工：骨架层面查得到的（重复 id、悬空边、自环、环、入口、可达性）
 * **全部复用 `validateGraph`**，这里一条都不重抄；只补 graph 看不懂的业务语义 ——
 * graph 不知道 `llm` 需要 model，也不知道 `tool` 引用的名字得先注册。
 *
 * 刻意不做的事：
 * 1. **只解析表达式、不求值。** 条件里引用尚未产出的变量在运行期按 `undefined` 处理（宽松语义，
 *    设计如此）；若为了校验去 `evaluate('score > 0.8', {})`，草稿态的图会被成片误报成坏表达式。
 * 2. 不改图、不补 id、不"顺手修复"。校验器只报告，修复属于设计器。
 * 3. 不区分草稿与发布 —— 调用方按 `level` 自己决定拦不拦，与 lowcode 的 `LowcodeIssue` 同口径。
 */

export interface ValidateAiFlowOptions {
  /**
   * 允许业务节点成环（agent 循环、重试回边靠它）。
   * 打开后 `cycle` 从 error 降为 warning：运行器有 `maxSteps` 兜失控，环本身不再是死路。
   */
  allowCycles?: boolean;
  /** 运行器配了 `fallbackHandler`（未知 kind 直通）时打开，未注册类型降为 warning */
  allowUnknownKinds?: boolean;
  /** Provider 或运行时配置的默认模型；有它就不必每个 llm 节点都写 model */
  defaultModel?: string;
  /** 透传给 `validateGraph` 的骨架选项 */
  graph?: ValidateOptions;
  /** 运行入参的变量名；模板引用它们不算悬空 */
  knownInputs?: readonly string[];
  /** provider 内部自带默认模型（宿主知道自己家的配置）时置真 */
  providerHasDefaultModel?: boolean;
  /** 工具注册表；不传则跳过未注册工具检查 */
  tools?: null | Pick<ToolRegistryLike, 'get'>;
}

/** 已知节点类型的来源：完整注册表、handler 数组、或只是一串 kind 名（设计器常只有后者） */
export type AiKindRegistry =
  | null
  | Pick<AiNodeHandlerRegistry, 'has'>
  | readonly AiNodeHandler[]
  | readonly string[]
  | undefined;

export interface ValidateAiFlowResult {
  errors: AiFlowIssue[];
  issues: AiFlowIssue[];
  ok: boolean;
  warnings: AiFlowIssue[];
}

/**
 * kind → 该 kind 实际写回 `values` 的键，必须与 `registry.ts` 里各处理器一致，
 * 否则这条 warning 会指错地方。`undefined` 表示不产出键（start / end / condition）。
 */
function outputKeyOf(
  node: AiFlowDefinition['nodes'][number],
): string | undefined {
  const data: AiNodeData = node.data ?? {};
  if (node.type === 'start' || node.type === 'end' || node.type === 'condition')
    return undefined;
  if (data.outputKey) return data.outputKey;
  // tool 缺省用工具名，于是「同一个工具调两次」天然就是覆盖冲突，正是要报出来的那种
  if (node.type === 'tool') return data.tool ?? node.id;
  // human 的产物是「人给的回答」，键名带上后缀，免得和节点自身输出混淆
  if (node.type === 'human') return `${node.id}_human`;
  return node.id;
}

/** 节点上所有会走 `{{ 变量 }}` 渲染的模板串 */
function templatesOf(data: AiNodeData): string[] {
  const found: string[] = [];
  if (typeof data.system === 'string') found.push(data.system);
  if (typeof data.prompt === 'string') found.push(data.prompt);
  for (const value of Object.values(data.args ?? {})) {
    if (typeof value === 'string') found.push(value);
  }
  return found;
}

function toKindChecker(registry: AiKindRegistry): (kind: string) => boolean {
  if (!registry) return () => false;
  // 三种入参形态是有意设计，签名不动；只有注册表形态带 `has`，先用 `in` 收窄联合类型再调用
  if ('has' in registry) return (kind) => registry.has(kind);
  // 把 `ValidateAiFlowOptions` 当成注册表递进来是最顺手的一种误用（第二个和第三个参数挨着），
  // 而它在这里的报错是 `registry.map is not a function` —— 一句和签名毫无关系的话，
  // 页面还整块渲染不出来。宁可在这里说清该放哪儿。
  if (!Array.isArray(registry)) {
    throw new AiFlowError(
      'validateAiFlow 的第二个参数是节点类型注册表（handler 数组 / kind 名数组 / 带 has 的注册表），' +
        '传进来的是校验选项：把它们放到第三个参数 —— validateAiFlow(flow, undefined, options)',
      'validate-registry-arg',
    );
  }
  const kinds = new Set(
    registry.map((item) => (typeof item === 'string' ? item : item.kind)),
  );
  return (kind) => kinds.has(kind);
}

/**
 * 表达式解析器：模块级单例，只用 `compile`（词法 + 语法），从不求值。
 *
 * 因此这张函数表永远只有内置的那些 —— 宿主在运行时往自己求值器实例里注册的业务函数
 * **不参与**校验。反过来才可怕：某个只在特定页面注册的函数让校验通过，换处又报未知函数。
 */
let parser: ReturnType<typeof createExpressionEvaluator> | undefined;

function checkExpression(source: string | undefined): string | undefined {
  if (source === undefined) return undefined;
  if (!source.trim()) return '表达式为空';
  parser ??= createExpressionEvaluator();
  try {
    parser.compile(source);
    return undefined;
  } catch (error) {
    return errorText(error);
  }
}

/**
 * 校验一张 AI 流程图。
 *
 * @param flow 待校验的图
 * @param registry 已知节点类型来源；不传则只认本包内置八种
 * @param options 见 `ValidateAiFlowOptions`
 */
export function validateAiFlow(
  flow: AiFlowDefinition,
  registry: AiKindRegistry = createAiNodeRegistry(),
  options: ValidateAiFlowOptions = {},
): ValidateAiFlowResult {
  const issues: AiFlowIssue[] = [];
  // 参数形态先判：空图也要能报出「选项放错位置」，否则误用得等图非空才看得见
  const hasKind = toKindChecker(registry);
  const push = (
    code: AiFlowIssue['code'],
    level: AiFlowIssue['level'],
    message: string,
    extra: { edgeIds?: string[]; nodeIds?: string[] } = {},
  ) => {
    issues.push({ code, level, message, ...extra });
  };

  if (flow.nodes.length === 0) {
    push(
      'empty-flow',
      'error',
      `流程图 "${flow.name || flow.id}" 没有任何节点`,
    );
    return summarize(issues);
  }

  /* 1. 骨架：完全交给 graph */
  for (const issue of validateGraph(flow, options.graph)) {
    if (issue.code === 'cycle' && options.allowCycles) {
      push(
        'cycle',
        'warning',
        `${issue.message}（已开启 allowCycles：运行器用 maxSteps 兜失控，请确认回边有出口）`,
        { nodeIds: issue.nodeIds },
      );
      continue;
    }
    push(issue.code, issue.level, issue.message, {
      edgeIds: issue.edgeIds,
      nodeIds: issue.nodeIds,
    });
  }

  const edgeIdsByNode = new Map<string, Set<string>>();
  for (const node of flow.nodes) edgeIdsByNode.set(node.id, new Set());
  for (const edge of flow.edges) edgeIdsByNode.get(edge.source)?.add(edge.id);

  /* 2. 模板变量：运行入参 + 所有节点的产物键 */
  const knownInputs = new Set(options.knownInputs ?? []);
  const produced = new Set<string>();
  for (const node of flow.nodes) {
    const key = outputKeyOf(node);
    if (key) produced.add(key.split('.')[0] ?? key);
  }

  const keysSeen = new Map<string, string[]>();

  for (const node of flow.nodes) {
    const data: AiNodeData = node.data ?? {};
    const label = node.label ?? node.id;
    const edges = edgeIdsByNode.get(node.id) ?? new Set<string>();

    if (!hasKind(node.type)) {
      push(
        'unknown-kind',
        options.allowUnknownKinds ? 'warning' : 'error',
        `节点 "${label}" 的类型 "${node.type}" 没有注册处理器${
          options.allowUnknownKinds
            ? '，将走运行器的兜底处理器'
            : '，运行时只能由兜底处理器接管'
        }`,
        { nodeIds: [node.id] },
      );
    }

    const key = outputKeyOf(node);
    if (key) {
      const holders = keysSeen.get(key);
      if (holders) holders.push(node.id);
      else keysSeen.set(key, [node.id]);
    }

    switch (node.type) {
      case 'condition': {
        for (const branch of data.branches ?? []) {
          if (!branch.edgeId || !edges.has(branch.edgeId)) {
            push(
              'dangling-branch',
              'error',
              `条件节点 "${label}" 的分支指向了不属于本节点的连线 "${branch.edgeId}"`,
              { nodeIds: [node.id] },
            );
          }
          const failure = checkExpression(branch.expression);
          if (failure) {
            push(
              'bad-expression',
              'error',
              `条件节点 "${label}" 的分支表达式编译不过：${failure}`,
              { nodeIds: [node.id] },
            );
          }
        }
        if (data.defaultEdgeId && !edges.has(data.defaultEdgeId)) {
          push(
            'dangling-branch',
            'error',
            `条件节点 "${label}" 的默认连线 "${data.defaultEdgeId}" 不是本节点的出边`,
            { nodeIds: [node.id] },
          );
        }
        const shorthand = checkExpression(data.expression);
        if (shorthand) {
          push(
            'bad-expression',
            'error',
            `条件节点 "${label}" 的表达式编译不过：${shorthand}`,
            { nodeIds: [node.id] },
          );
        }
        if (
          !data.branches?.length &&
          !data.expression &&
          !data.defaultEdgeId &&
          edges.size > 1
        ) {
          push(
            'bad-expression',
            'warning',
            `条件节点 "${label}" 没有任何条件却有 ${edges.size} 条出边，运行时会全部放行`,
            { nodeIds: [node.id] },
          );
        }
        break;
      }
      case 'transform': {
        if (data.expression) {
          const failure = checkExpression(data.expression);
          if (failure) {
            push(
              'bad-expression',
              'error',
              `transform 节点 "${label}" 的表达式编译不过：${failure}`,
              { nodeIds: [node.id] },
            );
          }
        } else {
          push(
            'bad-expression',
            'error',
            `transform 节点 "${label}" 缺少 expression，运行时会直接失败`,
            { nodeIds: [node.id] },
          );
        }
        break;
      }
      case 'llm': {
        if (
          !data.model &&
          !options.defaultModel &&
          !options.providerHasDefaultModel
        ) {
          push(
            'missing-model',
            'error',
            `llm 节点 "${label}" 没有 model，Provider 与运行时也都没有默认模型`,
            { nodeIds: [node.id] },
          );
        }
        for (const name of data.tools ?? []) {
          if (options.tools && !options.tools.get(name)) {
            push(
              'unknown-tool',
              'error',
              `llm 节点 "${label}" 引用了未注册的工具 "${name}"`,
              {
                nodeIds: [node.id],
              },
            );
          }
        }
        break;
      }
      case 'tool': {
        if (!data.tool) {
          push('unknown-tool', 'error', `tool 节点 "${label}" 没有填写工具名`, {
            nodeIds: [node.id],
          });
        } else if (options.tools && !options.tools.get(data.tool)) {
          push(
            'unknown-tool',
            'error',
            `tool 节点 "${label}" 引用了未注册的工具 "${data.tool}"`,
            {
              nodeIds: [node.id],
            },
          );
        }
        break;
      }
      case 'human': {
        // 挂起不是终点：resume 之后必须有人接着跑，否则续跑语义无处落地
        if (edges.size === 0) {
          push(
            'human-no-exit',
            'error',
            `人工确认节点 "${label}" 没有出边，续跑后流程会就此中断`,
            { nodeIds: [node.id] },
          );
        }
        break;
      }
      default: {
        break;
      }
    }

    for (const template of templatesOf(data)) {
      for (const variable of collectVariables(template)) {
        const root = variable.split('.')[0] ?? variable;
        if (knownInputs.has(root) || produced.has(root)) continue;
        push(
          'unknown-input',
          'warning',
          `节点 "${label}" 的模板引用了未知变量 "{{ ${variable} }}"：既不在运行入参里，也不是任何节点的产物`,
          { nodeIds: [node.id] },
        );
      }
    }
  }

  for (const [conflicted, holders] of keysSeen) {
    if (holders.length < 2) continue;
    push(
      'output-key-conflict',
      'warning',
      `产物键 "${conflicted}" 被 ${holders.length} 个节点写入，后跑的覆盖先跑的`,
      { nodeIds: holders },
    );
  }

  if (!flow.nodes.some((node) => node.type === 'end')) {
    push(
      'no-end',
      'error',
      `流程图 "${flow.name || flow.id}" 没有 end 节点，运行结果无法收口`,
    );
  }

  return summarize(issues);
}

function summarize(issues: AiFlowIssue[]): ValidateAiFlowResult {
  const errors = issues.filter((issue) => issue.level === 'error');
  return {
    errors,
    issues,
    ok: errors.length === 0,
    warnings: issues.filter((issue) => issue.level === 'warning'),
  };
}
