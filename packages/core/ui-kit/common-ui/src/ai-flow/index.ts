/**
 * `@antdv/common-ui/ai-flow` —— AI 工作流编排：模型/工具/分支节点的运行器 + Provider 与工具注册表 + 画布与运行面板。
 *
 * 分层与依赖口径（与 `@antdv/common-ui/lowcode` 同一套骨架）：
 * - `core/*` 是纯 TypeScript 运行时，**不认识 vue、也不认识 shadcn-ui**，可以被 Node 侧
 *   （保存前体检、批处理跑图、离线回放脚本）直接复用；`core/types.ts` 是本包类型的唯一出处，
 *   `core/runner.ts` 里不许出现 `node.type === 'llm'` 这类语义分支 —— 节点语义全在 `core/registry.ts` 的条目里；
 * - `components/*` 只画在 core 的形状上，全部基础控件来自 `@antdv/shadcn-ui`，不引入第二个 UI 库；
 *   画布依赖 `@vue-flow/*` 只是为了把节点摆出来，拓扑与条件语义一律来自 `@antdv/graph`；
 * - **传输与凭据由宿主经 `configureAiFlow()` 注入**：本包不 import 宿主的 `~/api` / `~/stores`，
 *   不读环境变量里的密钥，也没有内置网关地址；要发 HTTP 就 `createFetchAiProvider({ baseUrl, fetcher })`，
 *   没有 fetcher 时抛带下一步动作的可诊断错误，而不是猜一个端点把用户数据发出去；
 * - 测试与演示页不许联网：`createScriptedProvider` 就是为此存在的离线 Provider。
 *
 * 下面按「纯运行时 → 接线点 → 视图桥接 → 组件」的顺序分组导出，每组只说明这层负责什么。
 */

/* --------------------------------- 组件 --------------------------------- */
export { AiFlowCanvas } from './components/AiFlowCanvas';

/* 画布映射是纯函数：状态→样式类名、缺省坐标兜底，组件里那些碰 VueFlow 生命周期的部分不在此列 */
export {
  AI_CANVAS_NODE_TYPE,
  AI_EDGE_STROKE,
  AI_NODE_PALETTE,
  AI_NODE_PALETTE_FALLBACK,
  AI_NODE_STATUS_RING,
  type AiCanvasEdge,
  type AiCanvasNode,
  type AiCanvasNodeData,
  nodePaletteOf,
  nodeStatusRingOf,
  toCanvasEdges,
  toCanvasNodes,
} from './components/AiFlowCanvas/to-canvas';

export { AiNodeInspector } from './components/AiNodeInspector';

export { AiRunPanel } from './components/AiRunPanel';

/* ------------------------------ 视图桥接层 ------------------------------ */
/* 组件不直接调 runner：动作期间禁用、事件缓冲上限、状态只以运行器交回的 AiRunState 为准 */
export {
  useAiFlow,
  type UseAiFlowOptions,
  type UseAiFlowReturn,
} from './composables/use-ai-flow';

/* ------------------------------- 宿主接线点 ------------------------------- */
/* Provider / fetcher / 模型别名 / 工具 / 自定义处理器都从这里注入；增量合并，单测可用 reset 隔离 */
export {
  type AiFlowLimits,
  type AiFlowRuntimeConfig,
  type AiFlowRuntimeInput,
  configureAiFlow,
  createConfiguredAiRunner,
  createFetchAiProvider,
  getAiFlowProvider,
  getAiFlowRuntime,
  getAiFlowTools,
  resetAiFlowRuntime,
  resolveAiModel,
  withModelAliases,
} from './config';

/* ------------------------------ 可诊断错误 ------------------------------ */
/* 所有失败都带 `code`，UI 侧才能按类型换话术而不是甩一句 undefined is not a function */
export { AiFlowError, errorText, isAbortError } from './core/errors';

/* -------------------------------- 会话记忆 -------------------------------- */
/* 预算口径是字符而不是 token（本包不绑供应商，没有可信 tokenizer）；裁掉的旧轮压成一条摘要 */
export {
  type AppendOptions,
  appendTurn,
  createSessionMemory,
  defaultSummarize,
  estimateTokens,
  type MemoryTurn,
  selectWindow,
  type SessionMemory,
  type SessionMemoryOptions,
  totalChars,
  turnChars,
  type WindowOptions,
  type WindowResult,
} from './core/memory';

/* ------------------------------ 输出解析层 ------------------------------ */
/* 模型自由文本 → 结构值：JSON 块 / 围栏 / 行 / 命名分组正则 + 极简 schema 校验 */
export {
  extractJsonSource,
  parseBySchema,
  parseJson,
  parseLines,
  type ParseOptions,
  parseOutput,
  parseRegex,
  parseText,
  validateSchema,
} from './core/output-parser';

/* ------------------------------ 提示词组装 ------------------------------ */
/* `{{ 变量 }}` 走 @antdv/graph 的受限表达式；缺变量一律抛错，绝不静默留空 */
export {
  collectVariables,
  type PromptSpec,
  type RenderedPrompt,
  type RenderOptions,
  renderPrompt,
  renderTemplate,
} from './core/prompt';

/* -------------------------------- Provider ------------------------------- */
/* 只有两个实现：脚本回放（离线）与 OpenAI 兼容（fetcher 由宿主注入）。请求/响应映射都是纯函数 */
export {
  type AiFetcher,
  type AiFetchInit,
  type AiFetchResponse,
  type ChatRequestEnvelope,
  createOpenAiCompatibleProvider,
  createScriptedProvider,
  fromChatResponse,
  fromChatStreamChunk,
  type OpenAiCompatibleOptions,
  parseSseData,
  type ScriptedProvider,
  type ScriptedProviderOptions,
  type ScriptedResponse,
  toChatRequest,
} from './core/provider';

/* ------------------------------ 节点语义注册表 ------------------------------ */
/* 内置八种节点本身就是条目：想换掉 llm 的调用方式，注册同名 kind 覆盖即可，不必 fork 运行器 */
export {
  type AiNodeRegistry,
  buildMessages,
  builtinAiNodeHandlers,
  createAiNodeRegistry,
  isPromptOutput,
  isTruthy,
  passthroughFallbackHandler,
  type PromptOutput,
} from './core/registry';

/* --------------------------------- 运行器 --------------------------------- */
/* 只做五件事：分层调度、重试与超时、值表读写、用量记账、事件广播。时钟与 sleep 一律可注入 */
export {
  type AiRunner,
  type AiRunnerOptions,
  createAiRunner,
} from './core/runner';
/* ------------------------------ 工具与工具循环 ------------------------------ */
/* 参数强转失败是「回喂给模型重问」而不是抛异常；循环到上限抛错而不是返回半成品 */
export {
  type CoerceResult,
  coerceToolArgs,
  createToolRegistry,
  isToolRegistryLike,
  runTool,
  runToolLoop,
  type ToolRegistry,
  type ToolRegistryOptions,
  toToolSchemas,
} from './core/tools';
/* ------------------------------- 类型契约 ------------------------------- */
/* core/types.ts：节点形状、Provider 契约、运行态、事件。只有类型，所以整份透出 */
export * from './core/types';

/* ------------------------------ 设计期校验 ------------------------------ */
/* 骨架问题全部复用 @antdv/graph 的 validateGraph，这里只补它看不懂的业务语义 */
export {
  type AiKindRegistry,
  validateAiFlow,
  type ValidateAiFlowOptions,
  type ValidateAiFlowResult,
} from './core/validate';
