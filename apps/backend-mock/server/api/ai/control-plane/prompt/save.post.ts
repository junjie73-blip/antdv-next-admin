import { savePrompt } from '../../../../utils/db/ai-control-plane';
import { bizError, success } from '../../../../utils/response';
import { defineMockRoute } from '../../../../utils/runtime';

export default defineMockRoute({
  handler({ data }) {
    try {
      return success(savePrompt(data as never), 'Prompt 模板已保存');
    } catch (error) {
      return bizError(400, error instanceof Error ? error.message : '保存失败');
    }
  },
  method: 'POST',
  path: '/ai/control-plane/prompt/save',
});
