import dayjs from 'dayjs';

import { NOTICE_DB } from '../../../utils/db/notice';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id);
    const notice = NOTICE_DB.find((n) => n.id === id);

    if (!notice) {
      return bizError(404, '通知不存在');
    }

    notice.status = 1;
    notice.readTime = dayjs().format('YYYY-MM-DD HH:mm:ss');

    return success(notice, '标记已读成功');
  },
  method: 'PUT',
  path: '/system/notice/read/:id',
});
