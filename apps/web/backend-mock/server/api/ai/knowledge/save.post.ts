import { saveKnowledge } from '../../../utils/db/ai';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 新建 / 编辑知识库（文档数 / 分片数 / 向量数为配置元数据，不代表已接入真实向量库） */
export default defineMockRoute({
  handler({ data }) {
    const result = saveKnowledge(data);
    if (!result.ok) return bizError(result.code, result.message);
    return success(result.data, result.message);
  },
  method: 'POST',
  path: '/ai/knowledge/save',
});
