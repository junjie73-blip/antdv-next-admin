import dayjs from 'dayjs';

import { NOTICE_DB } from '../../../utils/db/notice';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler() {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    let count = 0;

    for (const notice of NOTICE_DB) {
      if (notice.status === 0) {
        notice.status = 1;
        notice.readTime = now;
        count++;
      }
    }

    return success({ count }, `已将${String(count)}条消息标记为已读`);
  },
  method: 'PUT',
  path: '/system/notice/read-all',
});
