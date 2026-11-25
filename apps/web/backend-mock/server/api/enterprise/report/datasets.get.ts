import { CHART_WIDGETS, REPORT_DATASETS } from '../../../utils/db/enterprise';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 报表中心：数据集清单与图表组件清单 */
export default defineMockRoute({
  handler() {
    return success(
      { datasets: REPORT_DATASETS, widgets: CHART_WIDGETS },
      '获取报表资源成功',
    );
  },
  method: 'GET',
  path: '/enterprise/report/datasets',
});
