import { TASK_DB } from '../../../utils/db/task';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/**
 * 任务详情。
 *
 * 示例页把它接到 `useCRUD` 的 `onFetchDetail` 上：编辑前先拉完整记录，
 * 而不是直接信任表格行数据 —— 列表接口为了省流量常会裁掉大字段（备注、明细），
 * 拿行数据回填表单就会把那些字段编辑成空。
 */
export default defineMockRoute({
  handler({ params }) {
    const record = TASK_DB.find((task) => task.id === Number(params.id));
    return record
      ? success(record, '获取任务详情成功')
      : bizError(404, '任务不存在');
  },
  method: 'GET',
  path: '/demo/task/:id',
});
