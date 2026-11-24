import dayjs from 'dayjs';

import {
  decorateProject,
  pickProjectFields,
  PROJECT_DB,
  refreshProject,
} from '../../utils/db/project';
import { bizError, success } from '../../utils/response';
import { defineMockRoute } from '../../utils/runtime';

/** 编辑项目基础信息：不直接写 progress（进度只能由任务操作汇总出来） */
export default defineMockRoute({
  handler({ data, params }) {
    const index = PROJECT_DB.findIndex((item) => item.id === Number(params.id));
    if (index === -1) return bizError(404, '项目不存在');

    const current = PROJECT_DB[index]!;
    const patch = pickProjectFields(data as Record<string, unknown>);
    if (patch.planEndDate && patch.planEndDate < current.startDate)
      return bizError(400, '计划交付日期不能早于开始日期');

    PROJECT_DB[index] = {
      ...current,
      ...patch,
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    };
    refreshProject(current.id);
    return success(
      decorateProject(PROJECT_DB.find((item) => item.id === current.id)!),
      '更新项目成功',
    );
  },
  method: 'PUT',
  path: '/project/:id',
});
