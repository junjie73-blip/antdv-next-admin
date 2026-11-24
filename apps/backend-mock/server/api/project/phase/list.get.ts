import {
  decoratePhase,
  PROJECT_DB,
  PROJECT_PHASE_DB,
} from '../../../utils/db/project';
import { paginateList } from '../../../utils/pagination';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 阶段/里程碑列表：里程碑页传 milestone=true，排期页不传拿全量 */
export default defineMockRoute({
  handler({ query }) {
    const projectNames = new Map(
      PROJECT_DB.map((item) => [item.id, item.name]),
    );
    const milestoneOnly = String(query.milestone ?? '') === 'true';
    const keyword = String(query.keyword ?? '')
      .trim()
      .toLowerCase();

    const filtered = PROJECT_PHASE_DB.filter((phase) => {
      const matchMilestone = !milestoneOnly || phase.isMilestone;
      const matchProject =
        !query.projectId || phase.projectId === Number(query.projectId);
      const matchStatus =
        !query.status || phase.status === String(query.status);
      const matchKeyword =
        !keyword ||
        phase.name.toLowerCase().includes(keyword) ||
        (projectNames.get(phase.projectId) ?? '')
          .toLowerCase()
          .includes(keyword);
      return matchMilestone && matchProject && matchStatus && matchKeyword;
    })
      .map((phase) => ({
        ...decoratePhase(phase),
        projectName: projectNames.get(phase.projectId) ?? '',
      }))
      .sort((a, b) => a.projectId - b.projectId || a.orderNo - b.orderNo);

    return success(paginateList(filtered, query), '获取阶段列表成功');
  },
  method: 'GET',
  path: '/project/phase/list',
});
