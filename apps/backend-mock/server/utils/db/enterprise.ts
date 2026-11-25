/**
 * 报表演示数据集。
 *
 * 固定种子常量：页面刷新、重启 mock 服务、跑单测，看到的是同一批记录，方便把
 * 「筛选 / 排序 / 分页 / 统计」写成可断言的纯函数。
 *
 * 数据只留在 backend-mock 子包，web 侧一律经 `~/api/enterprise` 取，
 * 页面里不再内嵌假数据 —— 这样换成真实后端时只换 handler，不动页面。
 */

export interface ReportDataset {
  fields: string[];
  id: string;
  name: string;
  rows: number;
  type: 'rest' | 'sample' | 'sql';
  updatedAt: string;
}

export const REPORT_DATASETS: ReportDataset[] = [
  {
    id: 'DS-01',
    name: '销售订单数据',
    type: 'sample',
    rows: 180,
    fields: ['日期', '区域', '渠道', 'GMV', '订单数', '转化率', '毛利率'],
    updatedAt: '2026-11-10 08:30',
  },
  {
    id: 'DS-02',
    name: '增长转化漏斗',
    type: 'rest',
    rows: 5,
    fields: ['阶段', '人数', '转化率'],
    updatedAt: '2026-11-09 17:20',
  },
  {
    id: 'DS-03',
    name: '系统监控指标',
    type: 'sql',
    rows: 5,
    fields: ['指标', '实例', '数值', '采集时间'],
    updatedAt: '2026-11-09 16:00',
  },
  {
    id: 'DS-04',
    name: '费用明细',
    type: 'sample',
    rows: 5,
    fields: ['单号', '部门', '费用类型', '金额', '状态'],
    updatedAt: '2026-11-08 11:45',
  },
];

export interface ChartWidget {
  id: string;
  insight: string;
  kind: string;
  source: string;
  title: string;
}

export const CHART_WIDGETS: ChartWidget[] = [
  {
    id: 'WG-01',
    title: '今日 GMV',
    kind: '指标卡',
    source: '销售订单数据',
    insight: 'GMV 环比保持增长，海外与华中贡献明显。',
  },
  {
    id: 'WG-02',
    title: '平均转化率',
    kind: '指标卡',
    source: '销售订单数据',
    insight: '转化率较上周提升 1.8 个百分点。',
  },
  {
    id: 'WG-03',
    title: 'GMV 趋势',
    kind: '趋势面积图',
    source: '销售订单数据',
    insight: '周末流量抬升明显，建议提前备货。',
  },
  {
    id: 'WG-04',
    title: '区域销售排行',
    kind: '排行柱状图',
    source: '销售订单数据',
    insight: '华东连续三周居首，西南增速最快。',
  },
  {
    id: 'WG-05',
    title: '渠道结构',
    kind: '占比环图',
    source: '销售订单数据',
    insight: '自然流量占比升至 42%。',
  },
  {
    id: 'WG-06',
    title: '增长转化漏斗',
    kind: '转化漏斗',
    source: '增长转化漏斗',
    insight: '留资到试用环节流失最大。',
  },
  {
    id: 'WG-07',
    title: 'AI 经营洞察',
    kind: 'AI 洞察',
    source: '销售订单数据',
    insight: '建议对高毛利区域追加投放预算。',
  },
];

/** 归一化分页参数：非法值、负数、超大页都收敛到安全区间 */
export function paginate<T>(
  items: T[],
  pageNum?: unknown,
  pageSize?: unknown,
): { list: T[]; pageNum: number; pageSize: number; total: number } {
  const requestedPage = Number(pageNum);
  const requestedSize = Number(pageSize);
  const page =
    Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.floor(requestedPage)
      : 1;
  const size =
    Number.isFinite(requestedSize) && requestedSize > 0
      ? Math.min(Math.floor(requestedSize), 200)
      : 10;
  const total = items.length;
  const start = (page - 1) * size;
  return {
    list: items.slice(start, start + size),
    pageNum: page,
    pageSize: size,
    total,
  };
}
