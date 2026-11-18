/**
 * 新增用户：真实写入用户表；头像按用户 id 生成确定性地址，
 * 不再用随机头像库。时间取请求真实时间（业务写入），其余字段来自入参。
 */
import dayjs from 'dayjs';

import {
  DEPT_LIST,
  nextUserId,
  ROLE_OPTIONS,
  USER_DB,
} from '../../../utils/db/user';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ data }) {
    const dept = DEPT_LIST.find((d) => d.id === data.deptId);
    const role = ROLE_OPTIONS.find((r) => r.value === data.roleId);
    const id = nextUserId();
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

    const newUser = {
      id,
      username: String(data.username || ''),
      nickname: String(data.nickname || ''),
      email: String(data.email || ''),
      phone: String(data.phone || ''),
      gender: 1,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=user_${id}`,
      status: (data.status as 0 | 1) ?? 1,
      deptId: Number(data.deptId || 0),
      deptName: dept?.name || '',
      roles: role ? [role.label] : [],
      remark: String(data.remark || ''),
      createdAt: now,
      updatedAt: now,
    };

    USER_DB.push(newUser);

    return success(newUser, '新增用户成功');
  },
  method: 'POST',
  path: '/system/user',
});
