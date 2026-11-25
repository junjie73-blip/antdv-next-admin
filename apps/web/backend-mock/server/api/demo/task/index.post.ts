import type { TaskRecord } from '../../../utils/db/task';

import { taskSaveRequestSchema } from '../../../contracts/models';
import { PermissionCode, requirePermission } from '../../../contracts/permissions';
import { validate } from '../../../contracts/validation';
import dayjs from 'dayjs';

import { nextTaskId, pickTaskFields, TASK_DB } from '../../../utils/db/task';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/**
 * 新增任务（POST /api/demo/task）
 *
 * @description 标题必填；状态 / 优先级受枚举约束，进度 0-100，截止日期 YYYY-MM-DD。
 * id 与时间戳由服务端生成，调用方传入的 id 一律忽略。
 *
 * @tag 示例业务 / 任务
 * @permission demo:task:add
 *
 * @example 请求
 * ```json
 * { "title": "补齐表格列宽", "owner": "张三", "priority": "high", "progress": 0, "dueDate": "2026-12-01" }
 * ```
 */
export default defineMockRoute({
  handler(context) {
    requirePermission(context, PermissionCode.TASK_ADD);
    const data = validate(taskSaveRequestSchema, context.data, 'body');

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
      title: data.title,
      updatedAt: now,
    } satisfies TaskRecord;

    TASK_DB.push(record);
    return success(record, '新增任务成功');
  },
  method: 'POST',
  path: '/demo/task',
});
