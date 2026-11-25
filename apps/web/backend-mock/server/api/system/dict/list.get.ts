import { DICT_TYPE_DB } from '../../../utils/db/dict';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ query }) {
    const keyword = query.keyword;
    const page = Number(query.pageNum ?? query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;

    let filtered = [...DICT_TYPE_DB];

    if (keyword) {
      const kw = String(keyword).toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.typeName.toLowerCase().includes(kw) ||
          d.typeCode.toLowerCase().includes(kw),
      );
    }

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const list = filtered.slice(start, start + pageSize);

    return success({ list, total }, '获取字典列表成功');
  },
  method: 'GET',
  path: '/system/dict/list',
});
