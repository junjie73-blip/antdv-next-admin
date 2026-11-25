import { resolveAccount } from '../../../utils/accounts';
import {
  enrichRecord,
  ensureFlow,
  isApprovalSuperAdmin,
  scanApprovalTimeouts,
} from '../../../utils/approval-advanced';
import {
  accountPersons,
  APPROVAL_DB,
  summarizeApprovals,
} from '../../../utils/db/approval';
import { paginateList } from '../../../utils/pagination';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/**
 * 我的审批列表：状态 / 关键词 / 审批视角四路筛选 + 统一分页。
 * 每次读取顺带扫描一次超时节点（每个节点只处理一次，按规则自动流转），返回行上带
 * `currentNode / currentRound / overdue / canApprove / canEdit / canResubmit`，列表页无需二次请求即可画进度。
 */
export default defineMockRoute({
  handler({ headers, query }) {
    const keyword = String(query.keyword ?? '')
      .trim()
      .toLowerCase();
    const mine = String(query.mine ?? '');
    const account = resolveAccount(headers);
    const username = account.profile.username;
    const persons = accountPersons(username);

    scanApprovalTimeouts();

    const rows = APPROVAL_DB.map((row) =>
      enrichRecord(ensureFlow(row), account),
    );
    const filtered = rows.filter((row) => {
      const matchKeyword =
        !keyword ||
        [row.code, row.title, row.type, row.applicant, row.approver].some(
          (field) => String(field).toLowerCase().includes(keyword),
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
        context: {
          applicant: persons.applicant,
          approver: persons.approver,
          isSuperAdmin: isApprovalSuperAdmin(account),
        },
      },
      '获取审批单据成功',
    );
  },
  method: 'GET',
  path: '/approval/mine/list',
});
