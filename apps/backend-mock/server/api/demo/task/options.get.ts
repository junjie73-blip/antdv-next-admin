import {
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
} from '../../../utils/db/task';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/**
 * 状态下拉选项：示例页按需拉取，而不是在页面里抄一份常量。
 *
 * 真实项目里这类枚举通常来自字典（`/system/dict`），这里单开一个接口是为了讲清
 * 「筛选控件的 options 由后端给」这条链路 —— 前后端各写一份状态枚举，
 * 加一个状态时必然有一边漏掉。
 */
export default defineMockRoute({
  handler() {
    return success(
      {
        priority: TASK_PRIORITY_OPTIONS,
        status: TASK_STATUS_OPTIONS,
      },
      '获取任务选项成功',
    );
  },
  method: 'GET',
  path: '/demo/task/options',
});
