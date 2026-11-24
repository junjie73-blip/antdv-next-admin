import {
  MEMBER_ROLE_OPTIONS,
  PHASE_TEMPLATE,
  PROJECT_PRIORITY_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  TASK_STATUS_OPTIONS,
} from '../../utils/db/project';
import { success } from '../../utils/response';
import { defineMockRoute } from '../../utils/runtime';

/** 各页面共用的选项源：状态枚举、优先级、成员角色、阶段模板 */
export default defineMockRoute({
  handler() {
    return success({
      memberRoles: MEMBER_ROLE_OPTIONS,
      phaseTemplate: PHASE_TEMPLATE.map((item) => ({
        isMilestone: item.isMilestone,
        name: item.name,
      })),
      priorities: PROJECT_PRIORITY_OPTIONS,
      projectStatuses: PROJECT_STATUS_OPTIONS,
      taskStatuses: TASK_STATUS_OPTIONS,
    });
  },
  method: 'GET',
  path: '/project/options',
});
