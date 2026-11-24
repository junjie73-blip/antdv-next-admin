import {
  MEMBER_ROLE_LABELS,
  PROJECT_DB,
  PROJECT_MEMBER_DB,
} from '../../../utils/db/project';
import { paginateList } from '../../../utils/pagination';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 项目成员：按项目 / 角色 / 关键词筛选，附带项目名和角色中文名 */
export default defineMockRoute({
  handler({ query }) {
    const projectNames = new Map(
      PROJECT_DB.map((item) => [item.id, item.name]),
    );
    const keyword = String(query.keyword ?? '')
      .trim()
      .toLowerCase();
    const filtered = PROJECT_MEMBER_DB.filter((member) => {
      const matchProject =
        !query.projectId || member.projectId === Number(query.projectId);
      const matchRole = !query.role || member.role === String(query.role);
      const matchStatus =
        !query.status || member.status === String(query.status);
      const matchKeyword =
        !keyword ||
        [member.name, member.dept, member.email].some((value) =>
          value.toLowerCase().includes(keyword),
        );
      return matchProject && matchRole && matchStatus && matchKeyword;
    })
      .map((member) => ({
        ...member,
        projectName: projectNames.get(member.projectId) ?? '',
        roleLabel: MEMBER_ROLE_LABELS[member.role] ?? member.role,
      }))
      .sort((a, b) => a.projectId - b.projectId || a.id - b.id);

    return success(paginateList(filtered, query), '获取项目成员成功');
  },
  method: 'GET',
  path: '/project/member/list',
});
