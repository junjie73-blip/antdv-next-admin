import { POST_DB } from '../../../utils/db/post';
import { paginateList } from '../../../utils/pagination';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ query }) {
    const name = query.name;
    const deptId = query.deptId;
    const status = query.status;

    let filtered = [...POST_DB];

    if (name) {
      const kw = String(name).toLowerCase();
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(kw));
    }

    if (deptId !== undefined && deptId !== null && deptId !== '') {
      filtered = filtered.filter((p) => p.deptId === Number(deptId));
    }

    if (status !== undefined && status !== null && status !== '') {
      filtered = filtered.filter((p) => p.status === Number(status));
    }

    // 表格配了 :api 就完全信任后端分页，这里必须按 pageNum/pageSize 切片
    return success(paginateList(filtered, query), '获取岗位列表成功');
  },
  method: 'GET',
  path: '/system/post/list',
});
