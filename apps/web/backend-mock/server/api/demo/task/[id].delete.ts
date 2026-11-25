import { TASK_DB } from '../../../utils/db/task';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/**
 * 删除任务。
 *
 * `useCRUD` 的批量删除在不传 `onBatchDelete` 时就是逐条调这里，
 * 所以后端不必单独开一个批量接口。
 */
export default defineMockRoute({
  handler({ params }) {
    const index = TASK_DB.findIndex((task) => task.id === Number(params.id));
    if (index === -1) return bizError(404, '任务不存在');

    TASK_DB.splice(index, 1);
    return success(null, '删除任务成功');
  },
  method: 'DELETE',
  path: '/demo/task/:id',
});
