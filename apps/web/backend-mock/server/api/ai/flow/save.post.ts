import { saveFlow } from '../../../utils/db/ai';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 新建 / 编辑编排应用元数据（图定义本身在前端画布维护，这里只管发布流转所需字段） */
export default defineMockRoute({
  handler({ data }) {
    const result = saveFlow(data);
    if (!result.ok) return bizError(result.code, result.message);
    return success(result.data, result.message);
  },
  method: 'POST',
  path: '/ai/flow/save',
});
