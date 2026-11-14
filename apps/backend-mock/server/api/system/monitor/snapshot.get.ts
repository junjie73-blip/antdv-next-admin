import { healthOf, MONITOR_SNAPSHOT } from '../../../utils/db/monitor';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 服务监控快照：资源、进程、数据库、缓存、队列一次取全，页面只负责分区渲染 */
export default defineMockRoute({
  handler({ query }) {
    const environment = String(query.environment ?? 'production');
    return success(
      {
        ...MONITOR_SNAPSHOT,
        environment,
        health: healthOf(MONITOR_SNAPSHOT.healthScore),
      },
      '获取系统监控快照成功',
    );
  },
  method: 'GET',
  path: '/system/monitor/snapshot',
});
