/**
 * 表格演示列表：从真实存储做分页查询。
 *
 * 旧实现每次请求现造 pageSize 行、`total` 恒写死 100；
 * 现在 list 与 total 都来自实际持久化记录，翻页语义跟其它列表接口一致。
 */

import { TABLE_DEMO_DB } from '../../utils/db/table-rows';
import { paginateList } from '../../utils/pagination';
import { success } from '../../utils/response';
import { defineMockRoute } from '../../utils/runtime';

export default defineMockRoute({
  handler({ query }) {
    const page = Number(query.pageNum ?? query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;
    const { list, total } = paginateList([...TABLE_DEMO_DB], {
      pageNum: page,
      pageSize,
    });

    return success({ list, page, pageSize, total }, '获取表格数据成功');
  },
  method: 'GET',
  path: '/table/list',
});
