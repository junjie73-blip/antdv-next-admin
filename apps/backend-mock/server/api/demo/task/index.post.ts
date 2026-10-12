import type { TaskRecord } from '../../../utils/db/task';

import dayjs from 'dayjs';

import { nextTaskId, pickTaskFields, TASK_DB } from '../../../utils/db/task';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 新增任务：标题必填，进度缺省 0 */
export default defineMockRoute({
  handler({ data }) {
    const title = String(data.title || '').trim();
    if (!title) return bizError(400, '任务标题不能为空');

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const record = {
      createdAt: now,
      dueDate: dayjs().add(7, 'day').format('YYYY-MM-DD'),
      owner: '',
      priority: 'middle',
      progress: 0,
      remark: '',
      status: 'pending',
      ...pickTaskFields(data),
      id: nextTaskId(),
      title,
      updatedAt: now,
    } satisfies TaskRecord;

    TASK_DB.push(record);
    return success(record, '新增任务成功');
  },
  method: 'POST',
  path: '/demo/task',
});
