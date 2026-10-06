import { NOTICE_DB } from '../../../utils/db/notice';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id);
    const idx = NOTICE_DB.findIndex((n) => n.id === id);

    if (idx === -1) {
      return bizError(404, '通知不存在');
    }

    NOTICE_DB.splice(idx, 1);

    return success(null, '删除通知成功');
  },
  method: 'DELETE',
  path: '/system/notice/:id',
});
