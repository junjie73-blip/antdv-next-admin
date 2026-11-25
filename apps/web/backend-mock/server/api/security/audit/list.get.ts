/** 全链路审计台账：服务端筛选 + 分页，响应内容已在写入时脱敏 */
import { SECURITY_AUDITS } from '../../../utils/db/security-advanced';
import { paginateList } from '../../../utils/pagination';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ query }) {
    const keyword = String(query.keyword ?? '').toLowerCase();
    const result = String(query.result ?? '');
    const risk = String(query.risk ?? '');
    const rows = [...SECURITY_AUDITS]
      .filter((item) => {
        if (result && item.result !== result) return false;
        if (risk && item.risk !== risk) return false;
        if (!keyword) return true;
        return [item.actor, item.action, item.path, item.ip, item.detail].some(
          (field) => field.toLowerCase().includes(keyword),
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return success(paginateList(rows, query), 'ok');
  },
  method: 'GET',
  path: '/security/audit/list',
});
