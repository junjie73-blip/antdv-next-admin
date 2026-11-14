import type { AiFetcher, OpenAiCompatibleOptions } from './core/provider';
import type { AiRunner, AiRunnerOptions } from './core/runner';
import type {
  AiNodeHandler,
  AiProvider,
  AiRequest,
  ToolRegistryLike,
  ToolSpec,
} from './core/types';

import { AiFlowError } from './core/errors';
import { createOpenAiCompatibleProvider } from './core/provider';
import { createAiRunner } from './core/runner';
import { createToolRegistry } from './core/tools';

/**
 * 全局接线点。
 *
 * 存在的理由是本仓库的一条硬规矩：**子包不许 import 宿主的 `~/api` / `~/stores`**。
 * 宿主把「用哪家模型网关」「怎么发 HTTP」「有哪些业务工具」在这里注进来，运行器反过来用它们。
 * 方向若倒过来，turbo 的依赖图直接建不出来（两个包互相声明依赖会整体失败），
 * 更麻烦的是这个包会被迫知道密钥放在哪儿 —— 而它压根不该碰密钥。
 *
 * 三条口径：
 * 1. **这里没有任何凭据字段**：没有 `apiKey`、没有隐式默认 baseUrl、不读 `import.meta.env`。
 *    Provider 由宿主构造好交进来（`configureAiFlow({ provider })`），
 *    要发 HTTP 的走 `createFetchAiProvider({ baseUrl, fetcher })`，凭据留在宿主那侧的 fetcher 里；
 * 2. `createAiRunner(options)` 只认显式 options（单测里绝不读全局态），
 *    `createConfiguredAiRunner()` 才读这里的运行时配置；
 * 3. `configureAiFlow` 是**增量合并**：多次调用叠加，方便各功能模块分别注册自己的工具与处理器。
 *
 * 刻意不做的事：不做持久化、不做「自动挑一个能用的 Provider」。缺配置就抛带下一步动作的错误。
 */

/** 运行器级兜底参数；节点上的同名字段优先级更高 */
export interface AiFlowLimits {
  maxConcurrency?: number;
  maxSteps?: number;
  /** 工具循环的默认往返轮数上限 */
  maxToolIterations?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

/** `configureAiFlow()` 的入参：`tools` 允许写成 ToolSpec 数组或现成的注册表 */
export interface AiFlowRuntimeInput extends Omit<
  Partial<AiFlowRuntimeConfig>,
  'tools'
> {
  tools?: ToolRegistryLike | ToolSpec[];
}

export interface AiFlowRuntimeConfig {
  /** 求值器能看到的宿主上下文（租户、时区、特性开关）。只放常量级配置，不放用户数据 */
  evaluatorContext: Record<string, unknown>;
  /** 注入的 HTTP 传输；`createFetchAiProvider` 缺省取这里，宿主也可以直接给自己的 Provider 用 */
  fetcher?: AiFetcher;
  /** 追加/覆盖内置节点处理器，同 kind 后注册者胜 */
  handlers: AiNodeHandler[];
  limits: AiFlowLimits;
  /**
   * 模型别名表：`{ default: '宿主家的主力模型', fast: '...' }`。
   *
   * 为什么要别名：图里写死模型名等于把流程图和某家供应商绑死，换模型要重画一遍图；
   * 别名让「画布上的语义」和「实际模型 id」在宿主侧一处映射即可。
   */
  models: Record<string, string>;
  provider?: AiProvider;
  /** 宿主直接交来的工具注册表（自带工具循环实现）；给了它就忽略 `toolSpecs` */
  toolRegistry?: ToolRegistryLike;
  /** 以 ToolSpec 数组形式注入的工具，多次调用叠加 */
  toolSpecs: ToolSpec[];
}

const DEFAULT_LIMITS: Required<Omit<AiFlowLimits, 'timeoutMs'>> & {
  timeoutMs?: number;
} = {
  maxConcurrency: 4,
  maxSteps: 100,
  maxToolIterations: 5,
  retryDelayMs: 200,
};

function defaultRuntime(): AiFlowRuntimeConfig {
  return {
    evaluatorContext: {},
    handlers: [],
    limits: { ...DEFAULT_LIMITS },
    models: {},
    toolSpecs: [],
  };
}

let runtime: AiFlowRuntimeConfig = defaultRuntime();

export function getAiFlowRuntime(): AiFlowRuntimeConfig {
  return runtime;
}

/** 增量合并，返回合并后的配置 */
export function configureAiFlow(
  partial: AiFlowRuntimeInput = {},
): AiFlowRuntimeConfig {
  const { tools, ...rest } = partial;
  runtime = {
    ...runtime,
    ...rest,
    evaluatorContext: {
      ...runtime.evaluatorContext,
      ...partial.evaluatorContext,
    },
    handlers: [...runtime.handlers, ...(partial.handlers ?? [])],
    limits: { ...runtime.limits, ...partial.limits },
    models: { ...runtime.models, ...partial.models },
  };
  // `tools` 两种写法都收：数组是「再加几个工具」，注册表是「工具循环我自己实现」
  if (Array.isArray(tools)) {
    runtime.toolSpecs = [...runtime.toolSpecs, ...tools];
    runtime.toolRegistry = undefined;
  } else if (tools) {
    runtime.toolRegistry = tools;
  }
  return runtime;
}

/** 单测与多实例宿主用它隔离全局态 */
export function resetAiFlowRuntime(): void {
  runtime = defaultRuntime();
}

/** 别名 → 真实模型 id；不在表里就原样返回 */
export function resolveAiModel(model: string | undefined): string | undefined {
  if (!model) return undefined;
  return runtime.models[model] ?? model;
}

/**
 * 把别名解析挂到 Provider 上，而不是改节点对 `model` 的读法。
 *
 * 这样处理器完全不知道有别名这回事：宿主换供应商只动配置，`core/` 一行都不用改。
 */
export function withModelAliases(provider: AiProvider): AiProvider {
  if (Object.keys(runtime.models).length === 0) return provider;
  const resolve = (request: AiRequest): AiRequest => ({
    ...request,
    model: resolveAiModel(request.model),
  });
  // 先取出 stream 再判空：否则闭包里 `provider.stream?.()` 的返回值会带 undefined，类型收窄不掉
  const stream = provider.stream;
  return {
    invoke: (request) => provider.invoke(resolve(request)),
    stream: stream ? (request) => stream(resolve(request)) : undefined,
  };
}

/** 运行时配置的 Provider；没注入时给可诊断错误，而不是 undefined 让运行器炸在深处 */
export function getAiFlowProvider(): AiProvider {
  if (!runtime.provider) {
    throw new AiFlowError(
      '尚未注入 AI Provider：宿主侧调用 configureAiFlow({ provider })，' +
        '或用 createFetchAiProvider({ baseUrl, fetcher }) 造一个 OpenAI 兼容的' +
        '（fetcher 必须由宿主提供：本包不带默认网关地址，也不读任何环境变量里的密钥）',
      'provider-not-configured',
    );
  }
  return withModelAliases(runtime.provider);
}

/**
 * 造一个走 HTTP 的 Provider —— 本包里唯一真正发请求的构造路径。
 *
 * `baseUrl` / `fetcher` 缺省时报错而不是猜默认值：猜端点等于把用户数据发给某个第三方，
 * 而且线上出问题时没人能从错误里看出究竟是「没配 fetcher」还是「模型不听话」。
 */
export function createFetchAiProvider(
  options: OpenAiCompatibleOptions = {},
): AiProvider {
  const fetcher = options.fetcher ?? runtime.fetcher;
  if (!fetcher) {
    throw new AiFlowError(
      'createFetchAiProvider 需要 fetcher（configureAiFlow({ fetcher }) 或参数里直接传）：' +
        '本包不自带网络实现，也不读环境变量里的密钥',
      'provider-fetcher-missing',
    );
  }
  const baseUrl = options.baseUrl;
  if (!baseUrl) {
    throw new AiFlowError(
      'createFetchAiProvider 需要 baseUrl：默认端点等于把流量发给一个猜出来的网关',
      'provider-base-url-missing',
    );
  }
  return withModelAliases(
    createOpenAiCompatibleProvider({
      ...options,
      baseUrl,
      fetcher,
      model: options.model ?? runtime.models.default,
    }),
  );
}

/**
 * 按运行时配置造运行器。
 *
 * `overrides` 优先级高于全局配置，于是同一个应用里可以并存「接了真供应商的」和「脚本回放的」运行器
 * —— 后者是单测与 Storybook 的全部需要。
 */
export function createConfiguredAiRunner(
  overrides: Partial<AiRunnerOptions> = {},
): AiRunner {
  const limits = { ...DEFAULT_LIMITS, ...runtime.limits };
  return createAiRunner({
    ...overrides,
    defaultModel: overrides.defaultModel ?? runtime.models.default,
    evaluatorContext: {
      ...runtime.evaluatorContext,
      ...overrides.evaluatorContext,
    },
    handlers: [...runtime.handlers, ...(overrides.handlers ?? [])],
    maxConcurrency: overrides.maxConcurrency ?? limits.maxConcurrency,
    maxSteps: overrides.maxSteps ?? limits.maxSteps,
    provider: overrides.provider ?? getAiFlowProvider(),
    retryDelayMs: overrides.retryDelayMs ?? limits.retryDelayMs,
    timeoutMs: overrides.timeoutMs ?? limits.timeoutMs,
    tools:
      overrides.tools ??
      runtime.toolRegistry ??
      createToolRegistry({
        maxIterations: limits.maxToolIterations,
        tools: runtime.toolSpecs,
      }),
  });
}

/** 画布/面板组件在没有显式传入 runner 时的兜底；单独导出免得调用方去拼上面那一长串 */
/** 运行时里的工具注册表；画布与面板组件在没有显式传入 runner 时的兜底 */
export function getAiFlowTools(): ToolRegistryLike {
  return (
    runtime.toolRegistry ?? createToolRegistry({ tools: runtime.toolSpecs })
  );
}
