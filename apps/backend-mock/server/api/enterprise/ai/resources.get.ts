import {
  AI_AGENTS,
  AI_KNOWLEDGE_BASES,
  AI_MODELS,
  AI_PROVIDERS,
  AI_STATUS_LABELS,
  selectResources,
} from '../../../utils/db/enterprise';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** AI 资源中心：Agent / 模型 / 知识库 / 供应商一次取全，前端按 Tab 切换 */
export default defineMockRoute({
  handler({ query }) {
    const filters = {
      keyword: String(query.keyword ?? ''),
      sort: String(query.sort ?? 'updated'),
      status: String(query.status ?? ''),
    };
    return success(
      {
        agents: selectResources(AI_AGENTS, filters),
        knowledgeBases: selectResources(AI_KNOWLEDGE_BASES, filters),
        models: selectResources(AI_MODELS, filters),
        providers: AI_PROVIDERS,
        statusLabels: AI_STATUS_LABELS,
      },
      '获取 AI 资源成功',
    );
  },
  method: 'GET',
  path: '/enterprise/ai/resources',
});
