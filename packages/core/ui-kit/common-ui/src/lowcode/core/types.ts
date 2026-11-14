import type { ExpressionValue } from '@antdv/graph';

/**
 * 低代码的领域形状 —— 本包唯一的类型源。
 *
 * 分层位置：`core/*` 是纯 TypeScript，不认识 vue、不认识 shadcn-ui、不认识浏览器。
 * 因此这里的「组件」只用 `MaterialComponent` 这个最弱的形状表达，真正的 Vue 类型由
 * 组件层（`components/*`、`presets/*`）在用的时候收敛，避免 core 反过来牵住 vue。
 *
 * 本文件**不做**的事：不校验、不求值、不登记物料。它只是形状。
 * 校验在 `dsl.ts` 的 `validatePageSchema`，求值在 `binding.ts`，登记在 `registry.ts`。
 *
 * 与 workflow-ui 一致的口径：所有用户数据都是 `Record<string, unknown>`，
 * 全链路不出现 `any`，把「宿主传进来什么形状」的不确定性留在运行边界上处理。
 */

/** 节点 id：设计器里由 `@antdv/graph` 的 `createGraphId()` 生成，进 CSS 选择器与 `data-*` 不用转义 */
export type NodeId = string;

/**
 * 一个组件实例。低代码的全部真相都在这棵树里，运行期不存在第二份「真实组件树」。
 */
export interface NodeSchema {
  id: NodeId;
  /** 物料 type，必须能在组件注册表里查到；查不到时渲染占位而不是崩 */
  type: string;
  /** 静态值或 `{{ expr }}` 绑定串，由 `binding.resolveProps` 解释 */
  props?: Record<string, unknown>;
  /** 默认插槽的子节点 */
  children?: NodeSchema[];
  /** 具名插槽：slot 名 -> 子节点列表 */
  slots?: Record<string, NodeSchema[]>;
  /** 受限表达式（graph 语法，不是 JS）；为假时整节点不渲染 */
  condition?: string;
  /**
   * 事件名 -> 动作串。动作文法见 `binding.parseEventAction`：
   * `set:form.name` / `push:list` / `refresh:users` / `emit:submit`。
   */
  events?: Record<string, string>;
}

/**
 * 一份页面。`version` 是宿主存 Schema 时要带上的字段：
 * 低代码的产物是数据，数据会跨版本被旧页面引用，版本号让宿主能做迁移而不是猜。
 */
export interface PageSchema {
  dataSources?: DataSourceSpec[];
  id: string;
  name: string;
  state?: Record<string, unknown>;
  /** 根级节点列表：页面可以有多个并列根（栅格行、标签页） */
  tree: NodeSchema[];
  version: number;
}

/** 数据源类别。`(string & {})` 让宿主能接自己的取数器而不必改本包 */
export type DataSourceKind = 'function' | 'rest' | 'static' | (string & {});

export interface DataSourceSpec {
  /** 供 `refresh(id)` 与表达式引用，页内唯一 */
  id: string;
  kind: DataSourceKind;
  /** 展示名，大纲/属性面板里用 */
  name?: string;
  /**
   * 取回的数据写回 scope 的路径（`a.b[0].c` 语法）。
   * 省略时数据只留在 runner 的 state 里，由 `{{ $ds.id.data }}` 取用。
   */
  path?: string;
  /** 值支持 `{{ }}` 绑定，装载时按当前 scope 求值 */
  params?: Record<string, unknown>;
  /** rest */
  url?: string;
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  body?: unknown;
  /** static：直接给值，值本身支持 `{{ }}` */
  data?: unknown;
  /** function：已注册的处理器名（`configureLowcode({ datasourceHandlers })`） */
  handler?: string;
  /** function：没注册处理器时退化为受限表达式求值 */
  expression?: string;
  /** 依赖的数据源 id；未就绪时不抢跑 */
  dependsOn?: string[];
  /** 进页面即装载，缺省 `true`；设为 `false` 表示由事件 `refresh:id` 手动触发 */
  auto?: boolean;
  timeoutMs?: number;
}

/** 属性面板可渲染的字段类型。同样留 `(string & {})` 给宿主扩展 */
export type PropMetaKind =
  | 'boolean'
  | 'color'
  | 'expression'
  | 'json'
  | 'number'
  | 'select'
  | 'string'
  | 'textarea'
  | (string & {});

export interface PropOption {
  label: string;
  value: boolean | number | string;
}

/** 一个可编辑属性。属性面板完全由它驱动，不认得 Vue 组件 */
export interface PropMeta {
  key: string;
  label: string;
  kind: PropMetaKind;
  /** 新建物料实例时的初值，也是 Inspector 在值为 `undefined` 时的显示值 */
  default?: unknown;
  description?: string;
  /** 面板分组，宿主可做折叠；缺省单组 */
  group?: string;
  /** select 类字段的候选 */
  options?: PropOption[];
  placeholder?: string;
}

export interface ComponentEventMeta {
  /** 事件名，与 `NodeSchema.events` 的键对应 */
  name: string;
  label?: string;
  description?: string;
  /**
   * 该事件是否构成双向绑定的一侧（`v-model` 语义）。
   * 例如 input 的 `update:modelValue`：值从 `{{ form.name }}` 读、经 `set:form.name` 写回。
   */
  twoWay?: boolean;
}

/** 物料元数据：属性面板与物料面板的唯一数据源 */
export interface ComponentMeta {
  /** 全局唯一，`NodeSchema.type` 就是它 */
  type: string;
  name: string;
  /** 物料面板分组；缺省归入 `DEFAULT_MATERIAL_GROUP` */
  group?: string;
  description?: string;
  /** 必给：面板按它出表单，没有属性的物料也应是空数组而不是 undefined */
  props: PropMeta[];
  /** 可承载的具名插槽；渲染器只透传这里声明过的，其余原样透传 */
  slots?: string[];
  events?: ComponentEventMeta[];
  /** 是否允许放子节点；大纲与面板据此决定能否往里拖 */
  container?: boolean;
  /** 新建实例的 props 初值；优先于 `props[].default` */
  initialProps?: Record<string, unknown>;
  /** 该物料下允许的最大子树深度，覆盖全局上限 */
  maxDepth?: number;
}

/**
 * 组件对象在 core 里的形状：只承诺「一个对象」，具体是 SFC / defineComponent / 函数式组件
 * 由组件层收敛。这样 `core/registry.ts` 不 import vue，Node 侧脚本可以直接复用注册表逻辑。
 */
export type MaterialComponent = object;

/** 组件 + 元数据成对登记，杜绝「注册了组件但面板里没有元数据」的半截状态 */
export interface MaterialEntry {
  component: MaterialComponent;
  meta: ComponentMeta;
}

/** 渲染器抛出的事件；`dispatch` 与宿主的埋点都吃这个形状 */
export interface LowcodeEventPayload {
  name: string;
  nodeId: string;
  /** Vue 事件参数：单参直接给值，多参给数组 */
  payload: unknown;
  /** 由 `events` 里的 `set:` 动作解析出来的写回路径，便于宿主埋点 */
  path?: string;
}

export type IssueLevel = 'error' | 'warning';

export type IssueCode =
  | 'bad-expression'
  | 'depth-limit'
  | 'duplicate-datasource'
  | 'duplicate-id'
  | 'empty-tree'
  | 'invalid-datasource'
  | 'invalid-node'
  | 'unknown-datasource'
  | 'unknown-dependency'
  | 'unknown-slot'
  | 'unknown-type'
  | 'unsafe-path';

/** 与 workflow-ui 的 `WorkflowIssue` 同一口径：设计期体检的输出，不带异常语义 */
export interface LowcodeIssue {
  code: IssueCode;
  level: IssueLevel;
  message: string;
  dataSourceId?: string;
  nodeId?: string;
}

/** 树被拍平后的一行，大纲组件与宿主搜索都用它 */
export interface FlatNode {
  /** 从根开始的缩进层，根级为 0 */
  depth: number;
  /** 所在父节点 id；根级为 undefined */
  parentId: string | undefined;
  /** 所在插槽名；`children` 里为 undefined */
  slot: string | undefined;
  /** 在该列表中的下标，同层重排要用 */
  index: number;
  /** 从根到自身的 id 链（含自身） */
  trail: string[];
  node: NodeSchema;
  /** 展示名，由 `toFlatList({ labelOf })` 填入；大纲与搜索直接渲染它 */
  label?: string;
}

/** 遍历上下文，与 `FlatNode` 同义但不带 node，方便 `walkSchema` 的回调签名 */
export type WalkContext = Omit<FlatNode, 'node'>;

/** 增删改的落点描述；`position` 缺省 `'inside'` */
export interface InsertTarget {
  /** 参照节点 id：`before`/`after` 用它定位同层下标 */
  refId?: string;
  /** 目标父节点 id；省略时由 `refId` 推断，两者都省略即根级 */
  parentId?: string;
  position?: 'after' | 'before' | 'inside';
  /** 目标插槽名；缺省 `'children'` */
  slot?: string;
}

/** 事件动作的解析结果，见 `binding.parseEventAction` */
export type EventActionKind =
  | 'emit'
  | 'evaluate'
  | 'merge'
  | 'push'
  | 'refresh'
  | 'remove'
  | 'set';

export interface EventAction {
  kind: EventActionKind;
  /** 目标 scope 路径（`refresh:` 时是数据源 id，`emit:` 时是宿主事件名） */
  arg: string;
  /** `set:path=<expr>` 的表达式部分 */
  expression?: string;
  /** 原始串，出问题时回显给设计器 */
  raw: string;
  /** 文法不认识时给的原因；不为空表示这条动作不该执行 */
  error?: string;
}

/** 表达式求值的基础上下文：宿主注入的只读变量 + 页面 scope */
export type BindingContext = Record<string, ExpressionValue>;

/**
 * scope 路径：`a.b[0].c` 的字符串写法，或者已经拆好的段数组。
 * 三处（绑定、数据源 `path`、事件动作）都用它，所以形状只在这里定义一次。
 */
export type ScopePath = number | readonly (number | string)[] | string;

/**
 * 注入取数器的入参：`url` 与 `params` 都已经按当前 scope 求值过，
 * 宿主的 fetcher 只负责发请求，不再认识绑定语法。
 */
export interface FetchInput {
  body?: unknown;
  headers?: Record<string, string>;
  method: string;
  params: Record<string, unknown>;
  timeoutMs: number;
  url: string;
}

/**
 * 唯一的取数出口。
 * 本包不许 import 宿主的 `~/api`，也不自带请求层（那是 `@antdv/request` 的活），
 * 所以 `rest` 数据源全靠这里注入；没注入时 runner 报 `no-fetcher` 而不是给空数据。
 */
export type DataSourceFetcher = (
  input: FetchInput,
) => Promise<unknown> | unknown;

/** `kind: 'function'` 的处理器上下文：能读 scope、能算表达式，但不能碰 Vue */
export interface DataSourceFunctionContext {
  evaluate: (expression: string) => unknown;
  params: Record<string, unknown>;
  scope: Record<string, unknown>;
  spec: DataSourceSpec;
}

export type DataSourceFunction = (
  context: DataSourceFunctionContext,
) => Promise<unknown> | unknown;
