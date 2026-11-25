import { resolveAccount } from '../../../utils/accounts';
import {
  isApprovalSuperAdmin,
  scanApprovalTimeouts,
} from '../../../utils/approval-advanced';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/**
 * 手动触发超时扫描（列表读取时也会自动扫描）。
 * 返回本次新增的提醒条数，便于超管在页面上确认结果。
 */
export default defineMockRoute({
  handler({ headers }) {
    if (!isApprovalSuperAdmin(resolveAccount(headers)))
      return bizError(403, '仅超级管理员可手动触发超时检查');
    const reminders = scanApprovalTimeouts();
    return success(
      { count: reminders.length, reminders },
      reminders.length ? `已发送 ${reminders.length} 条超时提醒` : '暂无新增超时提醒',
    );
  },
  method: 'POST',
  path: '/approval/timeout/scan',
});
