import dayjs from 'dayjs';

import {
  decoratePhase,
  PROJECT_PHASE_DB,
  PROJECT_TASK_DB,
  reschedulePhase,
  validatePhaseSchedule,
} from '../../../utils/db/project';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 编辑阶段排期 / 名称 / 负责人；日期改动会写入进度流水 */
export default defineMockRoute({
  handler({ data, params }) {
    const id = Number(params.id);
    const current = PROJECT_PHASE_DB.find((phase) => phase.id === id);
    if (!current) return bizError(404, '阶段不存在');

    const startDate = String(data.startDate ?? current.startDate);
    const endDate = String(data.endDate ?? current.endDate);
    if (endDate < startDate)
      return bizError(400, '阶段结束日期不能早于开始日期');

    reschedulePhase(id, startDate, endDate, String(data.operator ?? '系统'));
    const index = PROJECT_PHASE_DB.findIndex((phase) => phase.id === id);
    PROJECT_PHASE_DB[index] = {
      ...PROJECT_PHASE_DB[index]!,
      name: String(data.name ?? current.name),
      owner: String(data.owner ?? current.owner),
      remark: String(data.remark ?? current.remark),
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    };
    const updated = PROJECT_PHASE_DB.find((phase) => phase.id === id)!;
    // 排期调整后立刻校验与名下任务的匹配度，问题随响应返回给前端提示
    const issues = validatePhaseSchedule(updated, PROJECT_TASK_DB);
    return success(
      { ...decoratePhase(updated), scheduleIssues: issues },
      issues.length > 0
        ? `阶段排期已更新，但发现 ${issues.length} 处时间不匹配`
        : '阶段排期已更新',
    );
  },
  method: 'PUT',
  path: '/project/phase/:id',
});
