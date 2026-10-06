import dayjs from 'dayjs';

import { LOGIN_LOG_DB } from '../../../utils/db/login-log';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ query }) {
    const username = query.username;
    const ip = query.ip;
    const status = query.status;
    const dateRange = query.dateRange;
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;

    let filtered = [...LOGIN_LOG_DB];

    if (username) {
      const kw = String(username).toLowerCase();
      filtered = filtered.filter((l) => l.username.toLowerCase().includes(kw));
    }

    if (ip) {
      filtered = filtered.filter((l) => l.ip.includes(String(ip)));
    }

    if (status && status !== '') {
      filtered = filtered.filter((l) => l.status === status);
    }

    // dateRange 只有在"两个值"时才生效，与 legacy 一致要求数组形态
    if (dateRange && Array.isArray(dateRange) && dateRange.length === 2) {
      const start = dayjs(dateRange[0]);
      const end = dayjs(dateRange[1]);
      filtered = filtered.filter(
        (item) =>
          dayjs(item.loginTime).isAfter(start.subtract(1, 'second')) &&
          dayjs(item.loginTime).isBefore(end.add(1, 'second')),
      );
    }

    filtered.sort(
      (a, b) => dayjs(b.loginTime).valueOf() - dayjs(a.loginTime).valueOf(),
    );

    const total = filtered.length;
    const startIdx = (page - 1) * pageSize;
    const list = filtered.slice(startIdx, startIdx + pageSize);

    return success({ list, total }, '获取登录日志列表成功');
  },
  method: 'GET',
  path: '/system/login-log/list',
});
