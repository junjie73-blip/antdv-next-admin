import dayjs from 'dayjs';

import {
  nextPhaseId,
  PROJECT_DB,
  PROJECT_PHASE_DB,
} from '../../../utils/db/project';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 新增阶段/里程碑：排期页与里程碑页共用，项目必须已存在 */
export default defineMockRoute({
  handler({ data }) {
    const name = String(data.name ?? '').trim();
    if (!name) return bizError(400, '阶段名称不能为空');
    const projectId = Number(data.projectId);
    const project = PROJECT_DB.find((item) => item.id === projectId);
    if (!project) return bizError(404, '项目不存在');
    const startDate = String(data.startDate || project.startDate);
    const endDate = String(data.endDate || project.planEndDate);
    if (dayjs(endDate).isBefore(dayjs(startDate), 'day'))
      return bizError(400, '阶段结束日期不能早于开始日期');

    const phase = {
      endDate,
      id: nextPhaseId(),
      isMilestone:
        String(data.isMilestone) === 'true' || data.isMilestone === true,
      name,
      orderNo:
        Number(data.orderNo) ||
        PROJECT_PHASE_DB.filter((item) => item.projectId === projectId).length +
          1,
      owner: String(data.owner || project.owner),
      progress: 0,
      projectId,
      remark: String(data.remark ?? ''),
      startDate,
      status: 'pending' as const,
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    };
    PROJECT_PHASE_DB.push(phase);
    return success(phase, '阶段创建成功');
  },
  method: 'POST',
  path: '/project/phase',
});
