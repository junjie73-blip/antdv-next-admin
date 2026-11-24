import { resolveAccount } from '../../utils/accounts';
import {
  decorateProject,
  ownersForAccount,
  PROJECT_DB,
} from '../../utils/db/project';
import { paginateList } from '../../utils/pagination';
import { success } from '../../utils/response';
import { defineMockRoute } from '../../utils/runtime';

/** 项目列表：状态/优先级/关键词/我的项目四种过滤，分页走统一 paginateList */
export default defineMockRoute({
  handler({ headers, query }) {
    const keyword = String(query.keyword ?? '')
      .trim()
      .toLowerCase();
    const mine =
      String(query.mine ?? '') === 'true' || String(query.mine ?? '') === '1';
    const owners = mine
      ? ownersForAccount(resolveAccount(headers).profile.username)
      : [];

    const filtered = PROJECT_DB.filter((project) => {
      const matchKeyword =
        !keyword ||
        [project.name, project.code, project.owner, project.description].some(
          (value) => value.toLowerCase().includes(keyword),
        );
      const matchStatus =
        !query.status || project.status === String(query.status);
      const matchPriority =
        !query.priority || project.priority === String(query.priority);
      const matchOwner = !mine || owners.includes(project.owner);
      return matchKeyword && matchStatus && matchPriority && matchOwner;
    }).map(decorateProject);

    return success(paginateList(filtered, query), '获取项目列表成功');
  },
  method: 'GET',
  path: '/project/list',
});
