import dayjs from 'dayjs';

import { pickTaskFields, TASK_DB } from '../../../utils/db/task';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 编辑任务：只覆盖请求体里出现的字段，`updatedAt` 由服务端刷新 */
export default defineMockRoute({
  handler({ params, data }) {
    const index = TASK_DB.findIndex((task) => task.id === Number(params.id));
    if (index === -1) return bizError(404, '任务不存在');

    const updated = {
      ...TASK_DB[index]!,
      ...pickTaskFields(data),
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    };
    TASK_DB[index] = updated;
    return success(updated, '更新任务成功');
  },
  method: 'PUT',
  path: '/demo/task/:id',
});
