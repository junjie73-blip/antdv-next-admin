import {
  INSTANCE_STATUS_LABELS,
  paginate,
  summarizeWorkflowInstances,
  WORKFLOW_ALERTS,
  WORKFLOW_INSTANCES,
  WORKFLOW_LATENCY_RANKS,
  WORKFLOW_THROUGHPUT,
} from '../../../utils/db/enterprise';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 流程监控：实例列表 + 概览指标 + 告警 + 吞吐 + 慢节点排行 */
export default defineMockRoute({
  handler({ query }) {
    const keyword = String(query.keyword ?? '')
      .trim()
      .toLowerCase();
    const status = String(query.status ?? '');
    const environment = String(query.environment ?? '');
    const selected = WORKFLOW_INSTANCES.filter((item) => {
      if (status && item.status !== status) return false;
      if (environment && item.environment !== environment) return false;
      if (!keyword) return true;
      return [item.id, item.traceId, item.name, item.initiator]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
    const result = paginate(selected, query.pageNum, query.pageSize);
    return success(
      {
        alerts: WORKFLOW_ALERTS,
        latencyRanks: WORKFLOW_LATENCY_RANKS,
        list: result.list,
        statusLabels: INSTANCE_STATUS_LABELS,
        summary: summarizeWorkflowInstances(WORKFLOW_INSTANCES),
        throughput: WORKFLOW_THROUGHPUT,
        total: result.total,
      },
      '获取流程运行实例成功',
    );
  },
  method: 'GET',
  path: '/enterprise/workflow/instances',
});
