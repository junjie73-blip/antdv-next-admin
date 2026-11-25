import { resolveAccount } from '../../../utils/accounts';
import { enrichRecord, ensureFlow } from '../../../utils/approval-advanced';
import { APPROVAL_DB } from '../../../utils/db/approval';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 审批详情：返回补齐后的节点进度，供详情抽屉里的 vue-flow 画布展示 */
export default defineMockRoute({
  handler({ params, headers }) {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return bizError(400, '缺少审批单据ID');
    const record = APPROVAL_DB.find((item) => item.id === id);
    if (!record) return bizError(404, '审批单据不存在或已被删除');

    ensureFlow(record);
    return success(
      enrichRecord(record, resolveAccount(headers)),
      '获取审批详情成功',
    );
  },
  method: 'GET',
  path: '/approval/mine/:id',
});
