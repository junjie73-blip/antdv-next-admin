import type { PostRecord } from '../../../utils/db/post';

import dayjs from 'dayjs';

import { DEPT_MAP, nextPostId, POST_DB } from '../../../utils/db/post';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ data }) {
    const newPost: PostRecord = {
      id: nextPostId(),
      name: String(data.name || ''),
      code: String(data.code || ''),
      deptId: Number(data.deptId || 0),
      deptName: DEPT_MAP[Number(data.deptId)] || '',
      sortOrder: Number(data.sortOrder ?? 0),
      status: (data.status as 0 | 1) ?? 1,
      remark: String(data.remark || ''),
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      userCount: 0,
      userIds: [],
    };

    POST_DB.push(newPost);

    return success(newPost, '新增岗位成功');
  },
  method: 'POST',
  path: '/system/post',
});
