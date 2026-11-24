import {
  createProject,
  decorateProject,
  nextMemberId,
  PROJECT_DB,
  PROJECT_MEMBER_DB,
} from '../../utils/db/project';
import { bizError, success } from '../../utils/response';
import { defineMockRoute } from '../../utils/runtime';

/** 新建项目：同时生成阶段/里程碑模板与负责人成员，创建后即可进入排期页 */
export default defineMockRoute({
  handler({ data }) {
    const name = String(data.name ?? '').trim();
    if (!name) return bizError(400, '项目名称不能为空');
    const project = createProject(data);
    if (project.owner) {
      PROJECT_MEMBER_DB.push({
        dept: '研发组',
        email: '',
        id: nextMemberId(),
        name: project.owner,
        projectId: project.id,
        role: 'owner',
        status: 'enabled',
      });
    }
    return success(
      {
        ...decorateProject(PROJECT_DB.find((item) => item.id === project.id)!),
        memberCount: PROJECT_MEMBER_DB.filter(
          (item) => item.projectId === project.id,
        ).length,
        phaseCount: 6,
      },
      '项目创建成功，已自动生成阶段排期',
    );
  },
  method: 'POST',
  path: '/project',
});
