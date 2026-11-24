import { summarizeInstances } from '../../../utils/db/approval';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 监控看板统计：运行中 / 今日完结 / 平均耗时 / 异常 */
export default defineMockRoute({
  handler() {
    return success(summarizeInstances(), '获取监控统计成功');
  },
  method: 'GET',
  path: '/approval/monitor/summary',
});
