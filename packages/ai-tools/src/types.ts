/**
 * 工具层契约。这一层只描述「能力」，不持有任何框架实例。
 *
 * 硬约束：本文件及整个 @antdv/ai-tools 不得 import pinia / vue-router /
 * 任何 @antdv/* UI 包。运行时能力全部由 apps/web 实现 ToolRuntime 后注入。
 */

/** 路由上下文快照：Copilot 的「当前状态」唯一来源 */
export interface AiContextSnapshot {
  /** 路由 name，未命名时为 path */
  route: string;
  /** 页面展示名，用于上下文 Chip */
  title: string;
  /** 业务实体名，来自 route.meta.aiContext.entity */
  entity?: string;
  /** 当前页声明的可筛选字段字典 */
  fields?: AiFieldDescriptor[];
  /** 当前页允许的工具白名单 */
  tools?: string[];
  /** 表格选中行（已脱敏） */
  selectedRows?: Record<string, unknown>[];
  /** 当前筛选条件 */
  filters?: Record<string, unknown>;
  /** 可跳转的受控目标 */
  links?: AiLinkDescriptor[];
}

export interface AiFieldDescriptor {
  key: string;
  label: string;
  type?: 'boolean' | 'date' | 'number' | 'string';
  /** 可选枚举，供自然语言匹配 */
  options?: Array<{ label: string; value: unknown }>;
}

export interface AiLinkDescriptor {
  name: string;
  intent: string;
  /** 目标路由 name，禁止自由拼 path */
  routeName: string;
}

/** 表格句柄：由应用层包装 BasicTable 方法后注入 */
export interface TableHandle {
  id: string;
  applyQuery(query: TableQuery): Promise<void> | void;
  currentQuery?(): TableQuery;
  rows?(): Record<string, unknown>[];
}

export interface TableQuery {
  filters: FilterSpec[];
  sorts: SortSpec[];
  /** 自然语言里的「前 N 个 / top N」，由表格适配层决定是否应用 */
  limit?: number;
}

export interface FilterSpec {
  field: string;
  op: 'contains' | 'eq' | 'gt' | 'lt' | 'in';
  value: unknown;
}

export interface SortSpec {
  field: string;
  order: 'asc' | 'desc';
}

/** 表单句柄：由应用层包装 BasicForm / Modal 后注入 */
export interface FormHandle {
  id: string;
  open(schema: JsonSchemaObject): Promise<void> | void;
  fill(values: Record<string, unknown>): Promise<void> | void;
  values?(): Record<string, unknown>;
}

/** 只描述 form-ui component 白名单可消费的 Schema 子集 */
export interface JsonSchemaObject {
  type: 'object';
  title?: string;
  properties: Record<
    string,
    {
      type: 'string' | 'number' | 'boolean' | 'array';
      title: string;
      description?: string;
      enum?: unknown[];
      default?: unknown;
      /** form-ui 组件名，如 Input / Select / InputNumber */
      component?: string;
    }
  >;
  required?: string[];
}

export interface NavigateIntent {
  routeName: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
}

/** 危险操作的确认描述，由 Generative UI 渲染成确认卡片 */
export interface ToolConfirmation {
  title: string;
  impact: string;
  risks: string[];
  /** 默认取消：用户未响应时不得执行 */
  defaultAction: 'cancel';
}

export interface ToolOutcome<T = unknown> {
  ok: boolean;
  data?: T;
  message: string;
  confirmation?: ToolConfirmation;
  traceId: string;
}

export interface ToolAuditEvent {
  tool: string;
  args: Record<string, unknown>;
  result: 'success' | 'cancelled' | 'error';
  ms: number;
  traceId: string;
  route: string;
}

/** 工具唯一依赖的运行时接口 */
export interface ToolRuntime {
  context(): AiContextSnapshot;
  table(target?: string): TableHandle | undefined;
  form(target?: string): FormHandle | undefined;
  navigate(intent: NavigateIntent): Promise<ToolOutcome>;
  audit(event: ToolAuditEvent): void;
}
