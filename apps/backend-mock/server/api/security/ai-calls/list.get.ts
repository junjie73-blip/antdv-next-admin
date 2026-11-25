import { SECURITY_AI_CALLS } from '../../../utils/db/security-advanced';
import { paginateList } from '../../../utils/pagination';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ query }) {
    const keyword = String(query.keyword ?? '').toLowerCase();
    const level = String(query.level ?? '');
    const rows = [...SECURITY_AI_CALLS]
      .filter((item) => {
        if (level && item.level !== level) return false;
        if (!keyword) return true;
        return [item.actor, item.prompt, item.traceId, item.categories.join(',')]
          .join(' ')
          .toLowerCase()
          .includes(keyword);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return success(paginateList(rows, query), 'ok');
  },
  method: 'GET',
  path: '/security/ai-calls/list',
});
