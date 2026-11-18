/**
 * 仪表盘统计：全部由持久化记录聚合而来，不再在请求里造随机数。
 * 口径：用户数 / 启用用户数 / 任务总数 / 已完成任务累计收入 / 近 7 天操作日志量。
 */

import { countByDay, lastNDays } from '../../utils/derive';
import { OPER_LOG_DB } from '../../utils/db/log';
import { TASK_DB } from '../../utils/db/task';
import { USER_DB } from '../../utils/db/user';
import { success } from '../../utils/response';
import { defineMockRoute } from '../../utils/runtime';

export default defineMockRoute({
  handler() {
    const days = lastNDays(7);
    const daily = countByDay(days, OPER_LOG_DB.map((log) => log.operTime));

    return success(
      {
        totalUsers: USER_DB.length,
        activeUsers: USER_DB.filter((user) => user.status === 1).length,
        totalOrders: TASK_DB.length,
        revenue: TASK_DB.filter((task) => task.status === 'done').length * 1200,
        chartData: days.map((date, i) => ({ date, value: daily[i]! })),
      },
      '获取仪表盘数据成功',
    );
  },
  method: 'GET',
  path: '/dashboard/stats',
});
