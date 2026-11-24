import { resolveAccount } from '../../../utils/accounts';
import {
  accountPersons,
  APPROVAL_DB,
  summarizeApprovals,
} from '../../../utils/db/approval';
import { paginateList } from '../../../utils/pagination';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 我的审批列表：状态 / 关键词 / 审批视角四路筛选 + 统一分页，附带统计 */
export default defineMockRoute({
  handler({ headers, query }) {
    const keyword = String(query.keyword ?? '')
      .trim()
      .toLowerCase();
    const mine = String(query.mine ?? '');
    const username = resolveAccount(headers).profile.username;
    const persons = accountPersons(username);

    const filtered = APPROVAL_DB.filter((row) => {
      const matchKeyword =
        !keyword ||
        [row.code, row.title, row.type, row.applicant, row.approver].some(
          (field) => field.toLowerCase().includes(keyword),
        );
      const matchStatus = !query.status || row.status === String(query.status);
      const matchMine =
        mine === 'pending'
          ? row.status === 'pending' && row.approver === persons.approver
          : mine === 'initiated'
            ? row.applicant === persons.applicant
            : true;
      return matchKeyword && matchStatus && matchMine;
    });

    return success(
      {
        ...paginateList(filtered, query),
        stats: summarizeApprovals(username),
      },
      '获取审批单据成功',
    );
  },
  method: 'GET',
  path: '/approval/mine/list',
});
