import { get } from './request';

/**
 * 企业能力数据接口。
 *
 * 页面刷新、重启 mock 服务、跑单测看到的是同一批固定种子记录；
 * 这里统一走 backend-mock，把「加载 / 空 / 错误 / 成功」四态交给页面处理。
 * 换成真实后端时只换 handler，不动页面。
 */

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

/** 报表中心：数据集与图表组件 */
export function getReportDatasets() {
  return get<ReportResourcesData>('/enterprise/report/datasets');
}
