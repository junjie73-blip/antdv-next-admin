import { summarizeAiOverview } from '../../utils/db/ai';
import { success } from '../../utils/response';
import { defineMockRoute } from '../../utils/runtime';

/**
 * AI 配置总览统计：各页面共用同一份数据（供应商 / 模型 / 知识库 / 编排 / 密钥待轮换）。
 * 前端页只需调用一次即可渲染 stats 卡片，不再硬编码任何数字。
 */
export default defineMockRoute({
  handler() {
    return success(summarizeAiOverview(), '获取 AI 总览成功');
  },
  method: 'GET',
  path: '/ai/overview',
  title: 'AI 配置总览',
});
