import dayjs from 'dayjs';

import { ONLINE_DB } from '../../../utils/db/online';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ query }) {
    const keyword = query.keyword;
    const status = query.status;
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;

    let filtered = [...ONLINE_DB];

    if (keyword) {
      const kw = String(keyword).toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.username.toLowerCase().includes(kw) ||
          u.nickname.toLowerCase().includes(kw) ||
          u.ip.includes(kw),
      );
    }

    if (status !== undefined && status !== null && status !== '') {
      filtered = filtered.filter((u) => u.status === Number(status));
    }

    // 按登录时间倒序排列
    filtered.sort(
      (a, b) => dayjs(b.loginTime).valueOf() - dayjs(a.loginTime).valueOf(),
    );

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const list = filtered.slice(start, start + pageSize);

    return success({ list, total }, '获取在线用户列表成功');
  },
  method: 'GET',
  path: '/system/online/list',
});
