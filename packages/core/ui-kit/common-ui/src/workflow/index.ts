/**
 * `@antdv/common-ui/workflow` —— 企业级工作流（审批流）能力。
 *
 * 分层与依赖口径：
 * - `core/*` 是纯 TypeScript 运行时，不认识 vue 也不认识 shadcn-ui，可以被 Node 侧（服务端校验、
 *   批处理脚本）直接复用；
 * - `components/*` 只是画在 core 的形状上，全部基础控件来自 `@antdv/shadcn-ui`，不引入任何其他 UI 库；
 * - 图骨架与条件表达式来自 `@antdv/graph`，两个模块共享同一份 DAG 语义而不是各写一遍；
 * - 本包不 import 宿主的 `~/api` / `~/stores` / `~/locales`：需要宿主能力时走 `configureWorkflow()`
 *   注入（存储适配器、审批人解析策略、自定义节点处理器）。
 */

export { WorkflowApprovalBar } from './components/WorkflowApprovalBar';

export {
  assigneeHint,
  nodeSummaryOf,
  nodeToneOf,
  toCanvasEdges,
  toCanvasNodes,
  type WorkflowCanvasNodeData,
  WorkflowDefinitionDesigner,
} from './components/WorkflowDefinitionDesigner';

export { WorkflowNodeInspector } from './components/WorkflowNodeInspector';

export { WorkflowTaskList } from './components/WorkflowTaskList';

export { WorkflowTimeline } from './components/WorkflowTimeline';

export {
  useWorkflow,
  type UseWorkflowOptions,
  type UseWorkflowReturn,
} from './composables/use-workflow';

export {
  OPEN_TASK_STATUSES,
  useWorkflowTasks,
  type UseWorkflowTasksOptions,
  type UseWorkflowTasksReturn,
} from './composables/use-workflow-tasks';

export {
  configureWorkflow,
  createConfiguredWorkflowEngine,
  getWorkflowRuntime,
  resetWorkflowRuntime,
  type WorkflowRuntimeConfig,
} from './config';

// 自定义存储适配器需要同一个"代理安全"的深拷贝：直接 structuredClone 宿主传回的
// reactive 对象会抛 DataCloneError，这是写适配器最容易踩的一次坑
export { cloneDeep } from './core/clone';

// 设计器层：纯函数（core/designer）+ 画布（components/WorkflowDefinitionDesigner）
export * from './core/designer';

export {
  type ActionInput,
  type AddSignInput,
  createWorkflowEngine,
  type DriveOutcome,
  type RejectInput,
  type StartInput,
  SYSTEM_NODE,
  type TransferInput,
  validateWorkflowDefinition,
  type WorkflowEngine,
  WorkflowEngineError,
  type WorkflowIssue,
  type WorkflowIssueCode,
} from './core/engine';

export {
  builtinAssigneeResolvers,
  resolveAssignees,
  resolveAssigneeSet,
} from './core/policies';

export {
  builtinNodeHandlers,
  createNodeHandlerRegistry,
  isTruthy,
  type NodeHandlerRegistry,
  toTaskDrafts,
} from './core/registry';

export {
  createMemoryWorkflowStore,
  type MemoryWorkflowStore,
} from './core/store';
export * from './core/types';
export {
  ACTION_LABELS,
  INSTANCE_STATUS_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_VARIANTS,
} from './utils/labels';
