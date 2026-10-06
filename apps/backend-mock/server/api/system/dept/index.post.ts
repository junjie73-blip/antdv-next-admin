import type { DeptRecord } from '../../../utils/db/dept';

import dayjs from 'dayjs';

import { nextDeptId } from '../../../utils/db/dept';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ data }) {
    const newDept: DeptRecord = {
      id: nextDeptId(),
      parentId: Number(data.parentId ?? 0),
      name: String(data.name || ''),
      code: String(data.code || ''),
      leader: String(data.leader || ''),
      phone: String(data.phone || ''),
      sortOrder: Number(data.sortOrder ?? 0),
      status: (data.status as 0 | 1) ?? 1,
      remark: String(data.remark || ''),
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      userCount: 0,
      children: [],
    };

    return success(newDept, '新增部门成功');
  },
  method: 'POST',
  path: '/system/dept',
});
