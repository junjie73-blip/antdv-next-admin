import { SETTINGS_DB } from '../../../utils/db/settings';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ query }) {
    const keyword = query.keyword;
    const type = query.type;
    const enabled = query.enabled;
    const page = Number(query.pageNum ?? query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;

    let filtered = [...SETTINGS_DB];

    if (keyword) {
      const kw = String(keyword).toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.key.toLowerCase().includes(kw) || s.name.toLowerCase().includes(kw),
      );
    }

    if (type && type !== '') {
      filtered = filtered.filter((s) => s.type === type);
    }

    if (enabled !== undefined && enabled !== null && enabled !== '') {
      filtered = filtered.filter(
        (s) => s.enabled === (enabled === 'true' || enabled === '1'),
      );
    }

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const list = filtered.slice(start, start + pageSize);

    return success({ list, total }, '获取配置列表成功');
  },
  method: 'GET',
  path: '/system/settings/list',
});
