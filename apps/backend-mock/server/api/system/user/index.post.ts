import { faker } from '@faker-js/faker/locale/zh_CN';
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

    const newUser = {
      id: nextUserId(),
      username: String(data.username || ''),
      nickname: String(data.nickname || ''),
      email: String(data.email || ''),
      phone: String(data.phone || ''),
      gender: 1,
      avatar: faker.image.avatar(),
      status: (data.status as 0 | 1) ?? 1,
      deptId: Number(data.deptId || 0),
      deptName: dept?.name || '',
      roles: role ? [role.label] : [],
      remark: String(data.remark || ''),
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    };

    USER_DB.push(newUser);

    return success(newUser, '新增用户成功');
  },
  method: 'POST',
  path: '/system/user',
});
