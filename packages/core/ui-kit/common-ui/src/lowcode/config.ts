import type { ExpressionEvaluator, ExpressionFunction } from '@antdv/graph';

import type { InjectionKey } from 'vue';

import type { DataSourceRunner } from './core/datasource';
import type { ComponentRegistry } from './core/registry';
import type {
  BindingContext,
  DataSourceFetcher,
  DataSourceFunction,
  DataSourceSpec,
  LowcodeIssue,
  MaterialEntry,
} from './core/types';

import { createExpressionEvaluator } from '@antdv/graph';

import { createDataSourceRunner } from './core/datasource';
import { DEFAULT_MAX_DEPTH } from './core/dsl';
import { createComponentRegistry } from './core/registry';
import { builtinMaterials } from './presets/basic-materials';

/**
 * 全局接线点，也是本包唯一的宿主注入面。
 *
 * 存在的理由是本仓库的一条硬规矩：**子包不许 import 宿主的 `~/api` / `~/stores` / `~/locales`**。
 * 低代码需要的宿主能力恰好三样：取数（`fetcher`）、物料（`components`）、
 * 表达式里可读的环境变量（`evaluatorContext`，比如当前登录人、部门树）。
 * 都在这里注进来，core 只吃注入的适配器；反过来 import 会让 turbo 建不出依赖图。
 *
 * 与 `createLowcodeContext()` 的分工：runtime 是**声明**（一串配置），
 * context 是**装配**（注册表 + 数据源执行器 + 求值器），组件与 composable 只传 context。
 * 每次装配产出一套新实例，所以 A 页定义的 dataSources 不会漏进 B 页；
 * 确实想共享一套的宿主用 `getLowcodeRegistry()` / `getLowcodeRunner()` 自己拿。
 *
 * 本文件**不做**的事：不注册全局组件、不建 store、不碰路由、不解释 Schema。
 */

export const DEFAULT_DATASOURCE_TIMEOUT_MS = 15_000;

/** 宿主注入的一切都在这里。字段全部可选地出现在 `configureLowcode` 的入参里 */
export interface LowcodeRuntimeConfig {
  /** 物料清单（组件 + 元数据）；追加在 basic 预设之后，同 type 覆盖 */
  components: MaterialEntry[];
  /** `kind: 'function'` 数据源的处理器，按 `spec.handler` 查 */
  datasourceHandlers: Record<string, DataSourceFunction>;
  /** rest 取数的兜底超时；单个数据源可用 `timeoutMs` 覆盖 */
  datasourceTimeoutMs: number;
  /** 全局默认数据源；页面 Schema 里的 `dataSources` 在装载时增量 define 进来 */
  datasources: DataSourceSpec[];
  /** 表达式里可读的宿主变量（登录人、字典、租户…），优先级低于同名 scope 键 */
  evaluatorContext: BindingContext;
  /** 受限表达式的自定义函数，同名覆盖 graph 的内置函数 */
  expressionFunctions: Record<string, ExpressionFunction>;
  /** 唯一取数出口；不注入时 rest 数据源报 `no-fetcher` 而不是给空数据 */
  fetcher: DataSourceFetcher | undefined;
  /** 体检与渲染的嵌套上限 */
  maxDepth: number;
  /** 是否把 basic 预设装进出厂注册表；接了自己物料体系的宿主可以关掉 */
  useBuiltinMaterials: boolean;
}

export type LowcodeRuntimeConfigOverrides = Partial<LowcodeRuntimeConfig>;

/** 传给组件与 composable 的装配结果：一个页面一份，互不串味 */
export interface LowcodeContext {
  datasourceTimeoutMs: number;
  evaluator: ExpressionEvaluator;
  maxDepth: number;
  /** 物料注册表：渲染器查组件、面板查元数据都走它 */
  registry: ComponentRegistry;
  /** 渲染期问题（未知类型、表达式报错）的收集口；缺省 no-op，`useLowcodePage` 换成收集器 */
  report: (issue: LowcodeIssue) => void;
  /** 数据源执行器 */
  runner: DataSourceRunner;
  /** 表达式上下文的宿主部分，每次求值现取，便于宿主随时补变量 */
  scopeBase: () => BindingContext;
}

/** 装配上下文时可以顺手替换掉的部件，或者只对本次生效的 runtime 覆盖 */
export interface CreateContextOptions extends LowcodeRuntimeConfigOverrides {
  evaluator?: ExpressionEvaluator;
  registry?: ComponentRegistry;
  /** 只对本次装配生效的问题收集器 */
  report?: (issue: LowcodeIssue) => void;
  runner?: DataSourceRunner;
}

function createDefaultRuntime(): LowcodeRuntimeConfig {
  return {
    components: [],
    datasourceHandlers: {},
    datasourceTimeoutMs: DEFAULT_DATASOURCE_TIMEOUT_MS,
    datasources: [],
    evaluatorContext: {},
    expressionFunctions: {},
    fetcher: undefined,
    maxDepth: DEFAULT_MAX_DEPTH,
    /** 出厂就带 basic 预设：宿主一行 `configureLowcode({ fetcher })` 就能渲染示例页 */
    useBuiltinMaterials: true,
  };
}

let runtime: LowcodeRuntimeConfig = createDefaultRuntime();

/* ------------------------------ 全局单例 ------------------------------ */

let sharedEvaluator: ExpressionEvaluator = createEvaluator(runtime);
let sharedRegistry: ComponentRegistry = createRegistry(runtime);
let sharedRunner: DataSourceRunner = createRunner(runtime);

export function getLowcodeRuntime(): LowcodeRuntimeConfig {
  return runtime;
}

/** 全局注册表；`configureLowcode` 之后是新的实例，别长期持有旧引用 */
export function getLowcodeRegistry(): ComponentRegistry {
  return sharedRegistry;
}

export function getLowcodeRunner(): DataSourceRunner {
  return sharedRunner;
}

export function getLowcodeEvaluator(): ExpressionEvaluator {
  return sharedEvaluator;
}

/**
 * 增量合并，返回合并后的运行时。
 * 语义刻意分两档：标量字段直接覆盖，`components` / `datasources` / 各映射表是**叠加** ——
 * 宿主通常在 app 入口配一次、页面再补一次，谁都不希望后者把前者清空。
 */
export function configureLowcode(
  partial: LowcodeRuntimeConfigOverrides = {},
): LowcodeRuntimeConfig {
  runtime = {
    ...runtime,
    ...partial,
    components: [...runtime.components, ...(partial.components ?? [])],
    datasourceHandlers: {
      ...runtime.datasourceHandlers,
      ...partial.datasourceHandlers,
    },
    datasources: [...runtime.datasources, ...(partial.datasources ?? [])],
    evaluatorContext: {
      ...runtime.evaluatorContext,
      ...partial.evaluatorContext,
    },
    expressionFunctions: {
      ...runtime.expressionFunctions,
      ...partial.expressionFunctions,
    },
  };
  sharedEvaluator = createEvaluator(runtime);
  sharedRegistry = createRegistry(runtime);
  sharedRunner = createRunner(runtime);
  return runtime;
}

/** 单测与多实例宿主用它隔离全局态；回到出厂配置（含 basic 预设物料） */
export function resetLowcodeRuntime(): void {
  runtime = createDefaultRuntime();
  sharedEvaluator = createEvaluator(runtime);
  sharedRegistry = createRegistry(runtime);
  sharedRunner = createRunner(runtime);
}

/* -------------------------------- 装配 -------------------------------- */

function createEvaluator(source: LowcodeRuntimeConfig): ExpressionEvaluator {
  // 每次装配新建一份：注册自定义函数是实例级行为，不该污染别的页面
  return createExpressionEvaluator({
    functions: { ...source.expressionFunctions },
  });
}

function createRegistry(source: LowcodeRuntimeConfig): ComponentRegistry {
  const registry = createComponentRegistry();
  const entries = source.useBuiltinMaterials
    ? [...builtinMaterials, ...source.components]
    : source.components;
  registry.registerAll(entries);
  return registry;
}

function createRunner(source: LowcodeRuntimeConfig): DataSourceRunner {
  return createDataSourceRunner({
    // 传函数而不是快照：宿主可以随时往 evaluatorContext 里补变量
    context: () => source.evaluatorContext,
    datasources: source.datasources,
    evaluator: createEvaluator(source),
    fetcher: source.fetcher,
    functions: () => source.datasourceHandlers,
    timeoutMs: source.datasourceTimeoutMs,
  });
}

/**
 * 把 runtime 装配成一份上下文。
 * `overrides` 只影响这一次装配，不改全局 —— 演示页与生产页可以在同一个应用里并存。
 */
export function createLowcodeContext(
  overrides: CreateContextOptions = {},
): LowcodeContext {
  const merged: LowcodeRuntimeConfig = {
    ...runtime,
    ...overrides,
    components: [...runtime.components, ...(overrides.components ?? [])],
    datasourceHandlers: {
      ...runtime.datasourceHandlers,
      ...overrides.datasourceHandlers,
    },
    datasources: [...runtime.datasources, ...(overrides.datasources ?? [])],
    evaluatorContext: {
      ...runtime.evaluatorContext,
      ...overrides.evaluatorContext,
    },
    expressionFunctions: {
      ...runtime.expressionFunctions,
      ...overrides.expressionFunctions,
    },
  };
  return {
    datasourceTimeoutMs: merged.datasourceTimeoutMs,
    evaluator: overrides.evaluator ?? createEvaluator(merged),
    maxDepth: merged.maxDepth,
    registry: overrides.registry ?? createRegistry(merged),
    report: overrides.report ?? (() => {}),
    runner: overrides.runner ?? createRunner(merged),
    scopeBase: () => merged.evaluatorContext,
  };
}

/**
 * 组件层的取用顺序：`context` prop -> `provide/inject` -> 现装一份。
 * key 放在这里而不是 core，是为了让 core 完全不认识 vue。
 */
export const LOWCODE_CONTEXT_KEY: InjectionKey<LowcodeContext> = Symbol(
  'antdv-lowcode-context',
);
