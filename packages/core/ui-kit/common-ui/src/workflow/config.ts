import type { WorkflowEngine } from './core/engine';
import type {
  AssigneeResolver,
  EngineOptions,
  WorkflowDefinition,
  WorkflowNodeHandler,
  WorkflowStoreAdapter,
} from './core/types';

import { createWorkflowEngine } from './core/engine';
import { createMemoryWorkflowStore } from './core/store';

/**
 * 全局接线点。
 *
 * 存在的理由是本仓库的一条硬规矩：**子包不许 import 宿主的 `~/stores` / `~/api`**。
 * 所以宿主把自己的存储实现、组织架构查询、自定义节点类型在这里注进来，
 * 引擎反过来用它们；反过来 import 会让 turbo 建不出依赖图（两个包互相声明依赖直接整体失败）。
 *
 * 与 `createWorkflowEngine(options)` 的分工：引擎只认显式 options（单测里没有全局态），
 * `createConfiguredWorkflowEngine()` 才读这里的运行时配置。
 */
export interface WorkflowRuntimeConfig {
  /** 注入的审批人解析策略，按 strategy 名覆盖内置 */
  assigneeResolvers: Record<string, AssigneeResolver>;
  /** 注入的自定义节点处理器，按 kind 覆盖内置 */
  handlers: WorkflowNodeHandler[];
  /** 审批节点解析不出办理人时的处置 */
  onEmptyAssignees: 'fail' | 'initiator' | 'skip';
  /** 单次推进的步数上限 */
  maxSteps: number;
  /** 待阅/待办的默认页长，列表组件与 composable 共用 */
  pageSize: number;
  /** 超时轮询间隔（ms）；0 表示宿主自己驱动 `tick()` */
  pollMs: number;
  /** 存储实现；缺省内存版，接入真实接口时在这里替换 */
  store: undefined | WorkflowStoreAdapter;
}

const DEFAULT_RUNTIME: WorkflowRuntimeConfig = {
  assigneeResolvers: {},
  handlers: [],
  onEmptyAssignees: 'fail',
  maxSteps: 200,
  pageSize: 20,
  pollMs: 0,
  store: undefined,
};

let runtime: WorkflowRuntimeConfig = { ...DEFAULT_RUNTIME };

export function getWorkflowRuntime(): WorkflowRuntimeConfig {
  return runtime;
}

/** 增量合并，返回合并后的配置；多次调用是叠加而不是替换 */
export function configureWorkflow(
  partial: Partial<WorkflowRuntimeConfig>,
): WorkflowRuntimeConfig {
  runtime = {
    ...runtime,
    ...partial,
    assigneeResolvers: {
      ...runtime.assigneeResolvers,
      ...partial.assigneeResolvers,
    },
    handlers: [...runtime.handlers, ...(partial.handlers ?? [])],
  };
  return runtime;
}

/** 单测与多实例宿主用它隔离全局态 */
export function resetWorkflowRuntime(): void {
  runtime = { ...DEFAULT_RUNTIME };
}

/**
 * 按运行时配置造引擎。
 * `overrides` 优先级高于全局配置，便于同一个应用里并存"接了库的"和"纯内存的"引擎。
 */
export function createConfiguredWorkflowEngine(
  definition: WorkflowDefinition,
  overrides: Omit<EngineOptions, 'definition'> = {},
): WorkflowEngine {
  return createWorkflowEngine({
    ...overrides,
    assigneeResolvers: {
      ...runtime.assigneeResolvers,
      ...overrides.assigneeResolvers,
    },
    definition,
    handlers: [...runtime.handlers, ...(overrides.handlers ?? [])],
    maxSteps: overrides.maxSteps ?? runtime.maxSteps,
    onEmptyAssignees: overrides.onEmptyAssignees ?? runtime.onEmptyAssignees,
    store: overrides.store ?? runtime.store ?? createMemoryWorkflowStore(),
  });
}
