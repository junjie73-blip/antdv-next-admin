import { resolveAccount } from '../../../utils/accounts';
import {
  isApprovalSuperAdmin,
  scanApprovalTimeouts,
} from '../../../utils/approval-advanced';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/**
 * 手动触发超时扫描（列表读取时也会自动扫描）。
 * 每个超时节点会按层级规则与单据内容自动通过或驳回，并返回本次处理明细。
 */
export default defineMockRoute({
  handler({ headers }) {
    if (!isApprovalSuperAdmin(resolveAccount(headers)))
      return bizError(403, '仅超级管理员可手动触发超时检查');
    const reminders = scanApprovalTimeouts();
    return success(
      { count: reminders.length, reminders },
      reminders.length > 0
        ? `已自动处理 ${reminders.length} 个超时节点`
        : '暂无超时节点',
    );
  },
  method: 'POST',
  path: '/approval/timeout/scan',
});
