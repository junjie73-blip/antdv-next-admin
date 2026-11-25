import { resolveAccount } from '../../utils/accounts';
import { success } from '../../utils/response';
import { defineMockRoute } from '../../utils/runtime';

/**
 * 会话信息：读的是**请求头里那个 token 对应的人**，不是写死的常量。
 *
 * 识别不了 token（未登录直接打接口、或手工造的假 token）时回落到默认账号 ——
 * mock 允许匿名浏览数据，但真实会话一定按 token 分档。
 */
export default defineMockRoute({
  handler({ headers }) {
    const account = resolveAccount(headers);
    return success(
      {
        user: {
          ...account.profile,
          permissions: account.permissions,
          roles: account.roles,
        },
      },
      '获取用户信息成功',
    );
  },
  method: 'GET',
  path: '/auth/user-info',
});
