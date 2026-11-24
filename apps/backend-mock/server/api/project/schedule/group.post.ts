import { assignTaskGroup, PROJECT_PHASE_DB } from '../../../utils/db/project';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/**
 * 关联任务组：把一批任务挂到某阶段，排期页调整任务归属用。
 * 写入后由 assignTaskGroup 内部触发 refreshProject 重算阶段与项目进度。
 */
export default defineMockRoute({
  handler({ data }) {
    const phaseId = Number(data.phaseId);
    if (!PROJECT_PHASE_DB.some((item) => item.id === phaseId))
      return bizError(404, '阶段不存在');
    const taskIds = Array.isArray(data.taskIds) ? data.taskIds : [];
    if (taskIds.length === 0) return bizError(400, '请选择要关联的任务');

    const result = assignTaskGroup(
      phaseId,
      taskIds,
      String(data.operator ?? '系统'),
    );
    if (!result) return bizError(404, '阶段不存在');
    if (result.assigned === 0)
      return bizError(400, '所选任务与本阶段不属于同一项目');
    return success(result, `已关联 ${result.assigned} 个任务`);
  },
  method: 'POST',
  path: '/project/schedule/group',
});
