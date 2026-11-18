/**
 * 告警处置：真实从告警表移除该条记录（SQLite 下为软删除），
 * 不再像旧实现那样只回显一个恒为 true 的响应。
 */
import { SECURITY_ALERTS } from '../../../../utils/db/security';
import { bizError, success } from '../../../../utils/response';
import { defineMockRoute } from '../../../../utils/runtime';

export default defineMockRoute({
  handler({ params }) {
    const alertId = String(params.alertId ?? '');
    const index = SECURITY_ALERTS.findIndex((alert) => alert.id === alertId);
    if (index === -1) return bizError(404, '告警不存在');

    SECURITY_ALERTS.splice(index, 1);
    return success({ success: true, message: '处置成功' }, '处置成功');
  },
  method: 'POST',
  path: '/security/alerts/:alertId/handle',
});
