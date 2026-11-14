/**
 * `@antdv/common-ui/lowcode` —— 低代码搭建：Schema 渲染 + 组件物料注册表 + 属性面板。
 *
 * 分层与依赖口径（与 `@antdv/common-ui/workflow` 同一套骨架）：
 * - `core/*` 是纯 TypeScript 运行时，不认识 vue 也不认识 shadcn-ui，可以被 Node 侧
 *   （保存前体检、Schema 迁移脚本、批量生成页面）直接复用；
 * - `components/*` 只画在 core 的形状上，全部基础控件来自 `@antdv/shadcn-ui`，不引入第二个 UI 库；
 *   本包里唯一允许出现的裸标签是表单元素与容器 `div`，视觉全部走 Tailwind 工具类 + shadcn token；
 * - 受限表达式与 id 生成来自 `@antdv/graph`：绑定语法与流程图条件语法是同一套，
 *   学习一次两处通用，也让「表达式能不能跑」只有一个裁判；
 * - 不 import 宿主的 `~/api` / `~/stores` / `~/locales`：取数器、物料、宿主变量一律经
 *   `configureLowcode()` 注入，core 只消费注入的适配器。
 */

export {
  type InspectorChange,
  LowCodeInspector,
} from './components/LowCodeInspector';

export {
  LowCodeOutline,
  type OutlineDropPayload,
  type OutlineMovePayload,
} from './components/LowCodeOutline';

export { LowCodePalette } from './components/LowCodePalette';

export { LowCodeRenderer } from './components/LowCodeRenderer';

export {
  useLowcodeContext,
  useLowcodePage,
  type UseLowcodePageOptions,
  type UseLowcodePageReturn,
} from './composables/use-lowcode-page';

export {
  configureLowcode,
  type CreateContextOptions,
  createLowcodeContext,
  DEFAULT_DATASOURCE_TIMEOUT_MS,
  getLowcodeEvaluator,
  getLowcodeRegistry,
  getLowcodeRunner,
  getLowcodeRuntime,
  LOWCODE_CONTEXT_KEY,
  type LowcodeContext,
  type LowcodeRuntimeConfig,
  type LowcodeRuntimeConfigOverrides,
  resetLowcodeRuntime,
} from './config';

export {
  applyEventAction,
  bareExpression,
  type BindingOptions,
  deletePath,
  evalCondition,
  type EventActionInput,
  type EventActionResult,
  getPath,
  isBindingString,
  LowCodeBindingError,
  mergeContext,
  mergePath,
  type ModelBinding,
  parseEventAction,
  parsePath,
  pushPath,
  referencedKeys,
  resolveProps,
  resolveValue,
  setPath,
  twoWayBindingsOf,
  unsafePathMessage,
} from './core/binding';

export {
  createDataSourceRunner,
  DataSourceError,
  type DataSourceErrorCode,
  type DataSourceRunner,
  type DataSourceRunnerOptions,
  type DataSourceRunState,
  DEFAULT_FETCH_TIMEOUT_MS,
} from './core/datasource';

export {
  cloneNode,
  cloneSchema,
  cloneTree,
  collectIds,
  collectNodes,
  containsId,
  createNodeId,
  DEFAULT_MAX_DEPTH,
  type DslErrorCode,
  duplicateNode,
  expressionsIn,
  findNode,
  fromFlatList,
  insertNode,
  locateNode,
  LowCodeDslError,
  maxDepthOf,
  moveNode,
  NODE_ID_PREFIX,
  type NodeHit,
  patchNode,
  removeNode,
  type RemoveResult,
  type RenewResult,
  renewSubtreeIds,
  shiftNode,
  siblingsOf,
  toFlatList,
  type ValidateOptions,
  validatePageSchema,
  type ValidateRegistry,
  type ValidationResult,
  walkSchema,
} from './core/dsl';

export {
  type ComponentRegistry,
  createComponentRegistry,
  createMaterialNode,
  DEFAULT_MATERIAL_GROUP,
  initialPropsOf,
  LowCodeRegistryError,
  type MaterialGroup,
  propMetaOf,
  type RegistryOptions,
} from './core/registry';

export * from './core/types';

export {
  builtinMaterialMetas,
  builtinMaterials,
  MATERIAL_GROUP_BASIC,
  MATERIAL_GROUP_FORM,
  MATERIAL_GROUP_LAYOUT,
} from './presets/basic-materials';
export {
  DEMO_DATASOURCE_MEMBERS,
  DEMO_DATASOURCE_ROLES,
  DEMO_DATASOURCE_SUMMARY,
  DEMO_DATASOURCE_SYNC,
  DEMO_PAGE_ID,
  demoPageSchema,
} from './presets/demo-page';
export {
  type DndCarrier,
  type DndPayload,
  LOWCODE_DND_MIME,
  readDndPayload,
  writeDndData,
} from './utils/dnd';
export {
  INDENT_CLASSES,
  indentClass,
  type LabelRegistry,
  nodeLabel,
} from './utils/node-label';
