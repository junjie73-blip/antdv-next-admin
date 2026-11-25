import { ONLINE_DB } from '../../../utils/db/online';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ params }) {
    const tokenId = String(params.tokenId);
    const idx = ONLINE_DB.findIndex((u) => u.tokenId === tokenId);

    if (idx === -1) {
      return bizError(404, '在线用户不存在或已下线');
    }

    ONLINE_DB.splice(idx, 1);

    return success(null, '强制退出成功');
  },
  method: 'DELETE',
  path: '/system/online/:tokenId',
});
