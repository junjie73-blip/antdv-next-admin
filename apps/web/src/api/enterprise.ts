import { del, get, post, put } from './request';

/**
 * 企业能力数据接口。
 *
 * 原先五个企业示例页各自在组件里内嵌假数据（内存 store / 剧本函数 / 固定种子表），
 * 刷新即重置。这里统一走 backend-mock：列表、筛选、启停、删除都是真实请求，
 * 页面与参考实现一致地展示「加载 / 空 / 错误 / 成功」四态。
 */

export interface WorkflowDefinition {
  category: string;
  description: string;
  id: string;
  name: string;
  nodeCount: number;
  owner: string;
  runCount: number;
  status: 'disabled' | 'draft' | 'published';
  updatedAt: string;
  version: string;
}

export interface WorkflowListData {
  categories: string[];
  list: WorkflowDefinition[];
  owners: string[];
  summary: {
    disabled: number;
    draft: number;
    published: number;
    total: number;
  };
  total: number;
}

export interface WorkflowInstance {
  currentNode: string;
  duration: string;
  environment: string;
  id: string;
  initiator: string;
  name: string;
  progress: number;
  startTime: string;
  status: string;
  traceId: string;
  trigger: string;
}

export interface WorkflowMonitorData {
  alerts: Array<{
    id: string;
    level: string;
    message: string;
    time: string;
    title: string;
  }>;
  latencyRanks: Array<{ ms: number; node: string }>;
  list: WorkflowInstance[];
  statusLabels: Record<string, string>;
  summary: {
    failed: number;
    running: number;
    successRate: number;
    succeeded: number;
    total: number;
    unhandledAlerts: number;
  };
  throughput: Array<{ failed: number; success: number; time: string }>;
  total: number;
}

export interface AiResourceItem {
  description: string;
  icon: string;
  id: string;
  metrics: Array<{ label: string; value: string }>;
  name: string;
  owner: string;
  status: 'disabled' | 'draft' | 'running';
  tags: string[];
  updatedAt: string;
}

export interface AiResourcesData {
  agents: AiResourceItem[];
  knowledgeBases: AiResourceItem[];
  models: AiResourceItem[];
  providers: Array<{
    createdAt: string;
    description: string;
    id: string;
    name: string;
    protocol: string;
  }>;
  statusLabels: Record<string, string>;
}

export interface ReportResourcesData {
  datasets: Array<{
    fields: string[];
    id: string;
    name: string;
    rows: number;
    type: string;
    updatedAt: string;
  }>;
  widgets: Array<{
    id: string;
    insight: string;
    kind: string;
    source: string;
    title: string;
  }>;
}

/** 流程定义列表（分页 + 筛选 + 排序） */
export function getWorkflowList(params?: Record<string, unknown>) {
  return get<WorkflowListData>('/enterprise/workflow/list', params);
}

/** 新建或编辑流程定义 */
export function saveWorkflow(data: Record<string, unknown>) {
  return post<WorkflowDefinition>('/enterprise/workflow/save', data);
}

/** 启用 / 停用流程 */
export function updateWorkflowStatus(data: Record<string, unknown>) {
  return put<WorkflowDefinition>('/enterprise/workflow/status', data);
}

/** 删除流程定义 */
export function deleteWorkflow(id: string) {
  return del<{ id: string }>(`/enterprise/workflow/${id}`);
}

/** 流程运行实例与监控概览 */
export function getWorkflowInstances(params?: Record<string, unknown>) {
  return get<WorkflowMonitorData>('/enterprise/workflow/instances', params);
}

/** AI 资源中心：Agent / 模型 / 知识库 / 供应商 */
export function getAiResources(params?: Record<string, unknown>) {
  return get<AiResourcesData>('/enterprise/ai/resources', params);
}

/** 报表中心：数据集与图表组件 */
export function getReportDatasets() {
  return get<ReportResourcesData>('/enterprise/report/datasets');
}
