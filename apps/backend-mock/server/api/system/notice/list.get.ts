import dayjs from 'dayjs';

import { NOTICE_DB } from '../../../utils/db/notice';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ query }) {
    const keyword = query.keyword;
    const type = query.type;
    const status = query.status;
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;

    let filtered = [...NOTICE_DB];

    if (keyword) {
      const kw = String(keyword).toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(kw) ||
          n.content.toLowerCase().includes(kw),
      );
    }

    if (type && type !== '') {
      filtered = filtered.filter((n) => n.type === Number(type));
    }

    if (status !== undefined && status !== null && status !== '') {
      filtered = filtered.filter((n) => n.status === Number(status));
    }

    // 按发送时间倒序排列
    filtered.sort(
      (a, b) => dayjs(b.sendTime).valueOf() - dayjs(a.sendTime).valueOf(),
    );

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const list = filtered.slice(start, start + pageSize);

    return success({ list, total }, '获取消息通知列表成功');
  },
  method: 'GET',
  path: '/system/notice/list',
});
