import { success } from '../../utils/response';
import { defineMockRoute } from '../../utils/runtime';

interface ChatMessage {
  content: string;
  role: 'assistant' | 'user';
}

/**
 * 单轮对话 Mock：不接真实大模型，按关键词返回贴近业务的示例回答，
 * 让「模板中心 / Chat」「AI 开发 / Chat」两个入口都有可演示的闭环。
 * 接入真实模型时，只需把前端 `chatWithAi` 的实现换掉即可。
 */
function buildReply(messages: ChatMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const question = lastUser?.content?.trim() ?? '';
  if (!question) return '你好，有什么可以帮你的吗？';

  if (/^(你好|您好|hi|hello|在吗|hi )/i.test(question)) {
    return '你好！我是本平台的 AI 助手，可以帮你梳理需求、生成代码片段、解释后台模块。试着问我「工作流引擎怎么接？」';
  }
  if (/工作流|流程|审批|节点/.test(question)) {
    return [
      '工作流引擎提供了流程设计、列表与监控台：',
      '- 流程列表：新建 / 启停 / 删除流程定义',
      '- 流程监控台：实例吞吐、耗时排行、告警',
      '',
      '你可以从「企业能力 → 工作流引擎」进入。需要我给出一段调用示例吗？',
    ].join('\n');
  }
  if (/报表|图表|大屏|可视化/.test(question)) {
    return '报表设计器支持拖拽配置图表、绑定数据集并一键预览。数据集由 `/enterprise/report/datasets` 下发，目前内置了「销售分析」「用户增长」两套示例。';
  }
  if (/低代码|表单|拖拽|页面搭建/.test(question)) {
    return '低代码搭建可用拖拽方式生成表单与页面，导出的 schema 与本项目表单组件兼容。入口在「模板中心 → 低代码设计器」。';
  }
  return [
    `你问的是：「${question}」`,
    '',
    '这是来自 Mock 服务的示例回复（未接入真实大模型）。把前端 `chatWithAi` 换成真实模型接口即可获得真实回答。',
  ].join('\n');
}

export default defineMockRoute({
  handler({ data }) {
    const messages = Array.isArray(data.messages)
      ? (data.messages as ChatMessage[])
      : [];
    return success({ content: buildReply(messages) }, 'ok');
  },
  method: 'POST',
  path: '/ai/chat',
  title: 'AI 对话',
});
