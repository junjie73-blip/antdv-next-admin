import { authenticate, issueToken } from '../../utils/accounts';
import { bizError, success } from '../../utils/response';
import { defineMockRoute } from '../../utils/runtime';

/**
 * 登录：账号表见 `server/utils/accounts.ts`（`admin/admin123` 全通，`custom/custom123` 只给一小部分菜单）。
 * 密码错误时 HTTP 仍是 200，只有信封 `code` 非 200 —— 前端按 `code` 判成败。
 */
export default defineMockRoute({
  handler({ data }) {
    const username = typeof data.username === 'string' ? data.username : '';
    const password = typeof data.password === 'string' ? data.password : '';

    const account = authenticate(username, password);
    if (!account) return bizError(400, '用户名或密码错误');

    return success(
      {
        user: {
          ...account.profile,
          permissions: account.permissions,
          roles: account.roles,
          token: issueToken(account),
        },
      },
      '登录成功',
    );
  },
  method: 'POST',
  path: '/auth/login',
});
