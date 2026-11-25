import { loginRequestSchema } from '../../contracts/models';
import { validate } from '../../contracts/validation';
import { authenticate, issueToken } from '../../utils/accounts';
import { bizError, success } from '../../utils/response';
import { defineMockRoute } from '../../utils/runtime';

/**
 * 登录（POST /api/auth/login）
 *
 * @description 校验账号密码并下发访问令牌。请求体字段由 `loginRequestSchema` 约束；
 * 参数不合法返回 code 400 且 message 带字段路径，密码错误返回 code 400。
 * 响应体固定为 `{ code, data, message }`，链路号见响应头 `x-request-id`。
 *
 * @tag 认证
 * @permission 无（公开接口）
 *
 * @example 请求
 * ```json
 * { "username": "admin", "password": "admin123", "rememberMe": true }
 * ```
 * @example 成功响应
 * ```json
 * {
 *   "code": 200,
 *   "data": { "user": { "id": "1", "username": "admin", "token": "mock_token_admin_..." } },
 *   "message": "登录成功"
 * }
 * ```
 */
export default defineMockRoute({
  handler({ data }) {
    const input = validate(loginRequestSchema, data, 'body');

    const account = authenticate(input.username, input.password);
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
