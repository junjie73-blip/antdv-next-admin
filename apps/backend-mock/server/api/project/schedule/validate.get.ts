import { PROJECT_DB, validateProjectSchedule } from '../../../utils/db/project';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/**
 * 排期校验：返回阶段时间窗与名下任务时间不匹配的问题清单。
 * 不传 projectId 时校验全部项目；排期页与甘特图据此显示异常提示。
 */
export default defineMockRoute({
  handler({ query }) {
    const projectId = query.projectId ? Number(query.projectId) : undefined;
    if (projectId && !PROJECT_DB.some((item) => item.id === projectId))
      return bizError(404, '项目不存在');

    const projectIds = projectId
      ? [projectId]
      : PROJECT_DB.map((item) => item.id);
    const issues = projectIds.flatMap((id) => validateProjectSchedule(id));
    return success(
      { issues, total: issues.length },
      issues.length > 0 ? `发现 ${issues.length} 处排期异常` : '排期校验通过',
    );
  },
  method: 'GET',
  path: '/project/schedule/validate',
});
