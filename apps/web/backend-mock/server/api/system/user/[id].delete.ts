import { PermissionCode, requirePermission } from '../../../contracts/permissions';
import { positiveInt, validate } from '../../../contracts/validation';
import { USER_DB } from '../../../utils/db/user';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/**
 * 删除用户（DELETE /api/system/user/:id）
 *
 * @description 服务端鉴权 + 路径参数校验；资源不存在返回 code 404。
 *
 * @tag 系统管理 / 用户管理
 * @permission system:user:remove
 *
 * @example 请求 `DELETE /api/system/user/12`
 */
export default defineMockRoute({
  handler(context) {
    requirePermission(context, PermissionCode.USER_REMOVE);
    const id = validate(positiveInt('用户 id'), context.params.id, 'params');
    const idx = USER_DB.findIndex((u) => u.id === id);

    if (idx === -1) return bizError(404, '用户不存在');

    USER_DB.splice(idx, 1);

    return success(null, '删除用户成功');
  },
  method: 'DELETE',
  path: '/system/user/:id',
});
