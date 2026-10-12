import { TASK_DB } from '../../../utils/db/task';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/**
 * 任务列表：分页 + 关键词 + 状态/优先级筛选。
 *
 * `total` 必须是**筛选后**的条数，不是库的总数 —— 否则分页器按全量算页数，
 * 筛完只剩两条也能翻出第五页的空表。
 */
export default defineMockRoute({
  handler({ query }) {
    const keyword = query.keyword;
    const status = query.status;
    const priority = query.priority;
    const page = Number(query.pageNum ?? query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;

    let filtered = [...TASK_DB];

    if (keyword) {
      const kw = String(keyword).toLowerCase();
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(kw) ||
          task.owner.toLowerCase().includes(kw) ||
          task.remark.toLowerCase().includes(kw),
      );
    }
    if (status) {
      filtered = filtered.filter((task) => task.status === String(status));
    }
    if (priority) {
      filtered = filtered.filter((task) => task.priority === String(priority));
    }

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const list = filtered.slice(start, start + pageSize);

    return success({ list, total }, '获取任务列表成功');
  },
  method: 'GET',
  path: '/demo/task/list',
});
