import { USER_DB } from '../../../../utils/db/user';
import { bizError, success } from '../../../../utils/response';
import { defineMockRoute } from '../../../../utils/runtime';

export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id);
    const user = USER_DB.find((u) => u.id === id);

    if (!user) {
      return bizError(404, '用户不存在');
    }

    return success(user, '获取用户详情成功');
  },
  method: 'GET',
  path: '/system/user/:id',
});
