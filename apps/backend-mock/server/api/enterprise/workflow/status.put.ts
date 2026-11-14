import type { WorkflowStatus } from '../../../utils/db/enterprise';

import {
  WORKFLOW_STATUS_LABELS,
  WORKFLOW_STORE,
} from '../../../utils/db/enterprise';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 启用 / 停用流程：状态值必须在枚举内，避免脏状态写进列表 */
export default defineMockRoute({
  handler({ data }) {
    const id = String(data.id ?? '');
    const status = String(data.status ?? '') as WorkflowStatus;
    if (!(status in WORKFLOW_STATUS_LABELS))
      return bizError(400, '非法的流程状态');

    const target = WORKFLOW_STORE.items.find((item) => item.id === id);
    if (!target) return bizError(404, '流程不存在或已被删除');
    target.status = status;
    return success(target, `流程已${WORKFLOW_STATUS_LABELS[status]}`);
  },
  method: 'PUT',
  path: '/enterprise/workflow/status',
});
