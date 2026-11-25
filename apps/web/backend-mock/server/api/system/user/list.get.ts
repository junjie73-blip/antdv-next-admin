import { userQuerySchema } from '../../../contracts/models';
import { PermissionCode, requirePermission } from '../../../contracts/permissions';
import { flattenQuery, pageOf, validate } from '../../../contracts/validation';
import { USER_DB } from '../../../utils/db/user';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/**
 * 用户列表（GET /api/system/user/list）
 *
 * @description 按关键字 / 状态 / 部门筛选并分页。分页参数 `pageNum`（兼容 `page`）+ `pageSize`，
 * 不传分页参数时兼容旧行为返回全量；传分页参数时返回 `{ list, total }`。
 *
 * @tag 系统管理 / 用户管理
 * @permission system:user:list
 *
 * @example 请求
 * `GET /api/system/user/list?pageNum=1&pageSize=10&status=1&keyword=admin`
 * @example 成功响应
 * ```json
 * { "code": 200, "data": { "list": [{ "id": 1, "username": "admin", "status": 1 }], "total": 50 }, "message": "获取用户列表成功" }
 * ```
 */
export default defineMockRoute({
  handler(context) {
    requirePermission(context, PermissionCode.USER_LIST);

    const { query } = context;
    const raw = Object.fromEntries(
      Object.entries(flattenQuery(query)).filter(
        ([, value]) => value !== undefined && value !== '',
      ),
    );
    const filter = validate(userQuerySchema, raw, 'query');
    // 显式读取 query.pageNum（前端 BasicTable 的默认字段），page 仅作兼容别名
    const hasPaging = query.pageNum !== undefined || query.page !== undefined;
    const paged = hasPaging ? pageOf(query) : null;

    let filtered = [...USER_DB];

    if (filter.keyword) {
      const kw = filter.keyword.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.username.toLowerCase().includes(kw) ||
          u.nickname.toLowerCase().includes(kw) ||
          u.email.toLowerCase().includes(kw) ||
          u.phone.includes(kw),
      );
    }

    if (filter.status !== undefined) {
      filtered = filtered.filter((u) => u.status === filter.status);
    }

    if (filter.deptId !== undefined) {
      filtered = filtered.filter((u) => u.deptId === filter.deptId);
    }

    const total = filtered.length;
    if (!paged) return success({ list: filtered, total }, '获取用户列表成功');

    const start = (paged.pageNum - 1) * paged.pageSize;
    const list = filtered.slice(start, start + paged.pageSize);
    return success({ list, total }, '获取用户列表成功');
  },
  method: 'GET',
  path: '/system/user/list',
});
