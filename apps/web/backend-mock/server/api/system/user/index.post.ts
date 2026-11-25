/**
 * 新增用户：真实写入用户表；头像按用户 id 生成确定性地址，
 * 不再用随机头像库。时间取请求真实时间（业务写入），其余字段来自入参。
 */
import { userSaveRequestSchema } from '../../../contracts/models';
import { PermissionCode, requirePermission } from '../../../contracts/permissions';
import { validate } from '../../../contracts/validation';
import dayjs from 'dayjs';

import {
  DEPT_LIST,
  nextUserId,
  ROLE_OPTIONS,
  USER_DB,
} from '../../../utils/db/user';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/**
 * 新增用户（POST /api/system/user）
 *
 * @description 入参经 `userSaveRequestSchema` 校验：用户名与昵称为必填，邮箱 / 手机号有格式约束。
 * 服务端解析部门与角色名称，id 由服务端生成，时间由服务端写入。
 *
 * @tag 系统管理 / 用户管理
 * @permission system:user:add
 *
 * @example 请求
 * ```json
 * { "username": "zhangsan", "nickname": "张三", "email": "zhangsan@example.com", "deptId": 2, "roleId": 3, "status": 1 }
 * ```
 */
export default defineMockRoute({
  handler(context) {
    requirePermission(context, PermissionCode.USER_ADD);
    const data = validate(userSaveRequestSchema, context.data, 'body');

    const dept = DEPT_LIST.find((d) => d.id === data.deptId);
    const role = ROLE_OPTIONS.find((r) => r.value === data.roleId);
    const id = nextUserId();
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

    const newUser = {
      id,
      username: data.username,
      nickname: data.nickname,
      email: data.email ?? '',
      phone: data.phone ?? '',
      gender: data.gender ?? 1,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=user_${id}`,
      status: data.status ?? 1,
      deptId: data.deptId ?? 0,
      deptName: dept?.name ?? '',
      roles: data.roles ?? (role ? [role.label] : []),
      remark: data.remark ?? '',
      createdAt: now,
      updatedAt: now,
    };

    USER_DB.push(newUser);

    return success(newUser, '新增用户成功');
  },
  method: 'POST',
  path: '/system/user',
});
