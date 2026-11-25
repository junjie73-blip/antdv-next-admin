import type {
  GraphDefinition,
  GraphEdge,
  GraphIssue,
  GraphNode,
} from '@antdv/graph';

/**
 * AI 编排的领域形状。
 *
 * 分层位置：`core/types.ts` 是本包类型的唯一出处，纯 TS，不 import vue。
 *
 * 两条边界：
 * 1. 与 `@antdv/graph` 是「复用骨架、不共用语义」—— 顶点/边/位置与受限表达式都来自 graph，
 *    但 `type` 与 `data` 里装什么由本包解释；
 * 2. 与审批流 **沿用同一套图骨架，但不共享节点语义** ——
 *    审批流的「加签/会签/驳回」和这里的「模型/工具/流式 token」没有任何理由出现在同一个类型里，
 *    两边各自演进，谁也不会因为一个字段名牵制对方。
 */

/**
 * 内置节点类型。尾部 `(string & {})` 保留自定义节点字面量的扩展口径：
 * 宿主注册自定义处理器时可以直接写 `'rag'`、`'agent'` 这样的字面量而不必改本包，
 * 同时八个内置值仍然享有自动补全。
 */
export type AiNodeKind =
  | 'condition'
  | 'end'
  | 'human'
  | 'llm'
  | 'prompt'
  | 'start'
  | 'tool'
  | 'transform'
  | (string & {});

/**
 * 节点输出解析口径。模型给的是一段自由文本，下游要的是结构：
 * 与其让每个宿主自己 `JSON.parse` 然后在线上炸掉，不如把四种最常见的收口成枚举，
 * 解析失败在**节点级**变成可诊断错误（能重试、能在时间线上看到）。
 */
export type AiOutputFormat = 'json' | 'lines' | 'regex' | 'text';

export type AiRunStatus =
  | 'awaiting'
  | 'canceled'
  | 'failed'
  | 'running'
  | 'succeeded';

/**
 * 节点在一次运行里的状态。
 * `awaiting` 与 `running` 分开，是因为人工确认节点挂起时整条 run 是静止的，
 * 运行面板要能一眼区分「正在等模型」和「正在等人」。
 */
export type AiNodeStatus =
  | 'awaiting'
  | 'canceled'
  | 'failed'
  | 'pending'
  | 'running'
  | 'skipped'
  | 'succeeded';

/**
 * 节点负载。每个字段都可被注册表里的处理器解释；本包不认识任何具体模型名。
 *
 * 刻意不做的事：不放 `apiKey` / `baseUrl`。凭据属于宿主与 Provider 之间的事，
 * 写进流程图等于把密钥存进数据库并画在画布上。
 */
export interface AiNodeData extends Record<string, unknown> {
  /** tool 节点：入参模板。字符串值走 `{{ 变量 }}` 渲染，其余原样透传 */
  args?: Record<string, unknown>;
  /** condition 节点：按声明顺序取第一条命中的分支 */
  branches?: Array<{ edgeId: string; expression: string }>;
  /** condition 节点所有分支都不命中时走的边 */
  defaultEdgeId?: string;
  /** transform 的表达式 / condition 的单表达式简写 / outputFormat='regex' 的模式串 */
  expression?: string;
  /** llm 节点：读哪些上游产物作为上下文；缺省读本节点的直接前驱 */
  inputKeys?: string[];
  /** llm 最大输出 token */
  maxTokens?: number;
  /** llm 节点使用的模型；缺省回落 Provider/运行时配置的默认模型 */
  model?: string;
  /** 输出写回运行态的键名；缺省用节点 id */
  outputKey?: string;
  outputFormat?: AiOutputFormat;
  /** prompt / llm 节点的用户段模板；llm 缺省时靠 inputKeys 取上下文 */
  prompt?: string;
  /** 失败重试次数（不含首次执行）；与 retryDelayMs 一起构成指数退避 */
  retries?: number;
  /** 人工确认节点挂起时给运行面板看的提示语 */
  resumeLabel?: string;
  /** parseBySchema 用的极简结构约束 */
  schema?: AiOutputSchema;
  /** 走 provider.stream 逐段产出（需要 provider 实现 stream）。注册自定义 kind 时同样可用 */
  stream?: boolean;
  /** 单次执行的超时（ms）；缺省用运行器级 timeoutMs */
  timeoutMs?: number;
  /** tool 节点：调用哪个工具；llm 节点此处忽略 */
  tool?: string;
  /** llm 节点可用的工具名（function-calling），交给 runToolLoop 消费 */
  tools?: string[];
  /** 重试首跳延迟（ms），第 n 次重试等待 retryDelayMs * 2^(n-1) */
  retryDelayMs?: number;
  /** llm 节点的系统段 */
  system?: string;
  /** llm 采样温度 */
  temperature?: number;
  /** prompt 节点的 few-shot 示例，展开成真正的多轮对话而不是糊进 system */
  fewShot?: FewShotExample[];
  /** llm 节点带 tools 时允许的工具往返轮数上限；缺省用注册表配置 */
  maxIterations?: number;
}

export interface FewShotExample {
  input: string;
  output: string;
}

export interface AiFlowDefinition extends GraphDefinition<AiNodeData> {
  id: string;
  name: string;
  version: number;
}

export type AiFlowNode = GraphNode<AiNodeData>;

/* ------------------------------- Provider ------------------------------- */

export type AiMessageRole = 'assistant' | 'system' | 'tool' | 'user';

export interface AiMessage {
  content: string;
  /** 多轮工具调用时区分是哪个工具的回喂 */
  name?: string;
  role: AiMessageRole;
  /** assistant 轮里的工具请求；协议要求把它原样回喂，所以消息序列必须能带上它 */
  toolCalls?: AiToolCall[];
  /** 与 AiToolCall.id 对应，OpenAI 协议的 tool 角色要求回填 */
  toolCallId?: string;
}

export interface AiToolCall {
  /** 已解析的入参；模型给了坏 JSON 时退化成 `{ raw: "原文" }` 而不是整轮崩掉 */
  args: Record<string, unknown>;
  id: string;
  name: string;
}

export interface AiRequest {
  /** 运行器注入：取消传播的唯一通道，Provider 实现必须把它透传给真正的传输层 */
  signal?: AbortSignal;
  maxTokens?: number;
  messages: AiMessage[];
  model?: string;
  /** 发起来自哪个节点：Provider 侧记账与 scripted provider 的按节点取回复都靠它 */
  nodeId?: string;
  /** 请求里可用的工具 schema；为空表示这一轮不允许调用工具 */
  tools?: ToolSchema[];
  /** 'auto' 让模型自己决定，'none' 强制不出工具调用 */
  toolChoice?: 'auto' | 'none' | 'required';
  stream?: boolean;
  temperature?: number;
  /** 供应商私有参数（如 top_p、response_format）的透传位 */
  extra?: Record<string, unknown>;
}

export interface AiUsage {
  completion: number;
  prompt: number;
  total: number;
}

export interface AiResult {
  finishReason?: string;
  text: string;
  toolCalls?: AiToolCall[];
  usage?: AiUsage;
}

/** 流式片段：只有最后一段带 usage/finishReason，其余只有 delta */
export interface AiStreamChunk {
  delta: string;
  finishReason?: string;
  usage?: AiUsage;
}

/**
 * 模型接入契约。
 *
 * **超时、取消、用量统计由实现方负责**：运行器只做两件事 —— 把 `signal` 递进来、
 * 把 `usage` 累加起来。运行器不猜「多久算超时」，因为不同模型的合理等待时间差一个量级；
 * 也不自己做重试，重试语义挂在节点上（`retries`）才有意义。
 *
 * `stream` 是可选的：没有流式能力的供应商只实现 `invoke` 即可，运行器会自动退回非流式。
 * 传输方式（SSE / websocket / 宿主自己的通道）不在本契约里 —— 包内不建立传输连接，
 * 具体通道由宿主 Provider 实现，运行器只消费 AsyncIterable。
 */
export interface AiProvider {
  invoke: (request: AiRequest) => AiResult | Promise<AiResult>;
  stream?: (request: AiRequest) => AsyncIterable<AiStreamChunk>;
}

/* -------------------------------- 工具面 -------------------------------- */

export type ToolParamType =
  | 'array'
  | 'boolean'
  | 'number'
  | 'object'
  | 'string';

export interface ToolParam {
  description?: string;
  /** 参数名，允许 `.` 之外的常规标识符；给模型看的名字 */
  name: string;
  required?: boolean;
  type: ToolParamType;
  /** type='array' 时的元素类型 */
  items?: ToolParamType;
}

/** OpenAI function-calling 的形状。纯映射自 ToolSpec，便于单测断言 */
export interface ToolSchema {
  function: {
    description: string;
    name: string;
    parameters: {
      properties: Record<string, { description?: string; type: ToolParamType }>;
      required: string[];
      type: 'object';
    };
  };
  type: 'function';
}

/** 传给工具实现的运行上下文。刻意不给 provider，工具要模型就再走一层编排而不是反过来 */
export interface ToolContext {
  now: () => number;
  runId: string;
  signal?: AbortSignal;
  /** 当前运行态的值表，只读：工具想写回请返回 output，由节点 outputKey 落盘 */
  values: Readonly<Record<string, unknown>>;
}

export interface ToolSpec {
  description: string;
  name: string;
  parameters: ToolParam[];
  run: (
    args: Record<string, unknown>,
    ctx: ToolContext,
  ) => Promise<unknown> | unknown;
}

/** 工具执行结果。错误被包装成值而不是抛出，好让「工具失败」在时间线上是可展示的一行 */
export interface ToolRunResult {
  error?: string;
  /** 参数校验没过：调用方（runToolLoop）会把它回喂给模型而不是中止 */
  invalid?: boolean;
  name: string;
  ok: boolean;
  output?: unknown;
}

/* ------------------------------- 极简 schema ------------------------------- */

export interface AiOutputSchema {
  items?: AiOutputSchema;
  /** type='object' 时的成员约束 */
  properties?: Record<string, AiOutputSchema>;
  required?: string[];
  type?: 'array' | 'boolean' | 'null' | 'number' | 'object' | 'string';
  enum?: unknown[];
}

/* -------------------------------- 运行态 -------------------------------- */

/**
 * 单节点运行态。纯数据：可直接 `JSON.stringify` 存库、跨进程续跑。
 * `input` 是 resume 注入的人工输入，序列化后 `resume()` 才能把同一个节点跑完。
 */
export interface NodeRunState {
  attempts: number;
  durationMs?: number;
  error?: string;
  finishedAt?: number;
  id: string;
  input?: unknown;
  kind: AiNodeKind;
  label?: string;
  output?: unknown;
  outputKey?: string;
  startedAt?: number;
  status: AiNodeStatus;
  usage?: AiUsage;
}

export interface AiLogEntry {
  at: number;
  level: 'error' | 'info' | 'warn';
  message: string;
  nodeId?: string;
}

/** 挂起点：只存一个节点就够 —— 多个人工确认并行时，后到的那个等前一个办完再进下一波 */
export interface AiAwaitingState {
  nodeId: string;
  resumeLabel?: string;
}

/**
 * 一次运行的全部状态。
 *
 * 口径：**它是纯数据，不含函数、不含 Promise**，所以宿主可以把它塞进接口、库里、
 * 甚至另一个进程，再调 `runner.resume(state, input)` 续跑。
 * `frontier` 是续跑用的游标（下一波要执行哪些节点 id），缺省为空表示已经走完。
 */
export interface AiRunState {
  awaiting?: AiAwaitingState;
  flowId: string;
  /** 当前等待继续的节点 id 列表；与 `awaiting` 的区别是它可以包含多个并行分支 */
  frontier: string[];
  finishedAt?: number;
  id: string;
  logs: AiLogEntry[];
  nodes: Record<string, NodeRunState>;
  /** end 节点交出的最终产物 */
  output?: unknown;
  startedAt: number;
  /** 已经消费过的「节点 -> 出边」次数，仅用于诊断 */
  steps: number;
  status: AiRunStatus;
  usage: AiUsage;
  values: Record<string, unknown>;
}

/* --------------------------------- 事件 --------------------------------- */

/**
 * 事件是给 UI 与埋点的单向通知，不参与推进判定（判定只认 AiRunState）。
 * 每个事件都带 runId：宿主可以把多个并发运行的事件流接到同一条通道上再按 runId 分流。
 */
export type AiFlowEvent =
  | { attempt: number; kind: 'node.started'; nodeId: string; runId: string }
  | {
      durationMs: number;
      error?: string;
      kind: 'node.finished';
      nodeId: string;
      ok: boolean;
      runId: string;
    }
  | { kind: 'node.chunk'; nodeId: string; runId: string; text: string }
  | {
      kind: 'node.output';
      nodeId: string;
      output: unknown;
      outputKey?: string;
      runId: string;
    }
  | {
      kind: 'run.awaiting';
      nodeId: string;
      resumeLabel?: string;
      runId: string;
    }
  | { kind: 'run.finished'; runId: string; status: AiRunStatus }
  | {
      kind: 'run.log';
      level: 'error' | 'info' | 'warn';
      message: string;
      nodeId?: string;
      runId: string;
    }
  | { kind: 'run.started'; flowId: string; runId: string };

export type AiEventListener = (event: AiFlowEvent) => void;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;
/** 处理器上下文里的 emit：runId 由运行器补，处理器不该关心自己跑在哪次运行里 */
export type AiNodeEmitPayload = DistributiveOmit<AiFlowEvent, 'runId'>;

/* ------------------------------- 节点处理器 ------------------------------- */

/**
 * 处理器能看到的运行现场。
 *
 * 刻意不放 `definition`/`index`：节点处理器只该关心「我这一步」，能看见整张图的处理器
 * 迟早会长出「顺手替别人跑一下」的写法，那正是我们把路由留在业务层的原因。
 */
export interface AiNodeHandlerContext {
  /** 取消信号：任何耗时操作（Provider、工具）都要把它传下去 */
  abort: AbortSignal;
  data: AiNodeData;
  emit: (payload: AiNodeEmitPayload) => void;
  /** graph 的受限表达式求值，上下文是 `{ ...evaluatorContext, ...values }` */
  evaluate: (expression: string) => unknown;
  /** resume 注入的人工输入；未注入时为 undefined */
  input: unknown;
  invoke: (request: Omit<AiRequest, 'nodeId' | 'signal'>) => Promise<AiResult>;
  node: AiFlowNode;
  now: () => number;
  outgoingEdges: GraphEdge[];
  provider: AiProvider;
  /** `{{ 变量 }}` 渲染；缺变量抛可诊断错误（附节点 id 与变量名），绝不静默留空 */
  render: (template: string) => string;
  runId: string;
  /** 指数退避用的等待；测试里注入假时钟即可确定化 */
  sleep: (ms: number) => Promise<void>;
  state: AiRunState;
  /** provider 未实现 stream 时抛错，调用方须先判 `provider.stream` */
  stream: (
    request: Omit<AiRequest, 'nodeId' | 'signal'>,
  ) => AsyncIterable<AiStreamChunk>;
  tools?: ToolRegistryLike;
  /** 运行态值表；处理器只读它，写回通过返回 output 由运行器落到 outputKey */
  values: Readonly<Record<string, unknown>>;
  /** 直接前驱产物的键名列表（前驱的 outputKey，没配则用前驱节点 id）；llm 缺省上下文来自它 */
  directKeys?: string[];
  /** 用 timeoutMs 包住一段异步工作；不传 ms 时走运行器级默认。到点 abort 并抛 AiFlowError */
  withTimeout: <T>(task: () => Promise<T>, ms?: number) => Promise<T>;
  /** `render` / `evaluate` 的实际取值域：`{ ...evaluatorContext, ...values }` */
  scope: Readonly<Record<string, unknown>>;
}

export type AiNodeResult =
  /** 立刻继续。`nextEdgeIds` 让网关类节点自己决定走哪条出边，缺省走全部出边 */
  | {
      nextEdgeIds?: string[];
      output?: unknown;
      outputKey?: string;
      status: 'advance';
    }
  /** 挂起等 `resume(runState, input)`：运行态整体序列化落库，不占内存计时器 */
  | { output?: unknown; status: 'finish' }
  /** 结束整条运行并交出产物 */
  | { outputKey?: string; resumeLabel?: string; status: 'await' }
  | { reason: string; status: 'fail' }
  /** 什么也不做地前进（分支未命中时的空转），不写值 */
  | { status: 'skip' };

export interface AiNodeHandler {
  kind: AiNodeKind;
  run: (ctx: AiNodeHandlerContext) => AiNodeResult | Promise<AiNodeResult>;
}

/** 注册表条目形状与本包其他域的注册表保持一致 */
export interface AiNodeHandlerRegistry {
  get: (kind: string) => AiNodeHandler | undefined;
  has: (kind: string) => boolean;
  list: () => AiNodeHandler[];
  register: (handler: AiNodeHandler) => void;
  unregister: (kind: string) => boolean;
}

/** 工具循环的请求。`registry` 不在里面：循环由注册表自己的 `runToolLoop` 执行，避免互相引用 */
export interface ToolLoopRequest {
  ctx: ToolContext;
  invoke: (request: AiRequest) => AiResult | Promise<AiResult>;
  maxIterations?: number;
  messages: AiMessage[];
  model?: string;
  nodeId?: string;
  /** 每轮都合并进请求体的节点级参数（tools / temperature 等） */
  request?: Partial<AiRequest>;
}

export interface ToolLoopResult {
  /** 实际发生的模型往返次数 */
  iterations: number;
  /** 含 assistant 工具请求与 tool 回喂的完整对话，可直接续跑 */
  messages: AiMessage[];
  result: AiResult;
  toolResults: ToolRunResult[];
}

/** 运行器用到、也是宿主自定义工具循环要用到的工具面，抽成接口避免类型互相绑死 */
export interface ToolRegistryLike {
  get: (name: string) => ToolSpec | undefined;
  list: () => ToolSpec[];
  runTool: (
    name: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
  ) => Promise<ToolRunResult>;
  runToolLoop: (request: ToolLoopRequest) => Promise<ToolLoopResult>;
  schemas: (names?: string[]) => ToolSchema[];
}

/* --------------------------------- 校验 --------------------------------- */

export type AiIssueCode =
  | 'bad-expression'
  | 'dangling-branch'
  | 'empty-flow'
  | 'human-no-exit'
  | 'missing-model'
  | 'no-end'
  | 'output-key-conflict'
  | 'unknown-input'
  | 'unknown-kind'
  | 'unknown-tool'
  | GraphIssue['code'];

export interface AiFlowIssue extends Omit<GraphIssue, 'code'> {
  code: AiIssueCode;
}
