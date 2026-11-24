import { findKnowledge, findModel } from '../../utils/db/ai';
import { success } from '../../utils/response';
import { defineMockRoute } from '../../utils/runtime';

interface ChatMessage {
  content: string;
  role: 'assistant' | 'user';
}

interface ChatPayload extends Record<string, unknown> {
  knowledgeId?: number;
  messages?: ChatMessage[];
  modelId?: number;
}

/**
 * 单轮对话接入适配层（backend-mock 实现）。
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ 接真实模型的唯一改动点：把下面 buildReply(...) 这一行替换成真实调用。       │
 * │                                                                          │
 * │ 方案 A（推荐，前端零接触密钥）：                                           │
 * │   const provider = createFetchAiProvider({                                │
 * │     baseUrl: process.env.AI_GATEWAY_URL,  // 网关地址在服务端配置          │
 * │     fetcher: (url, init) => serverFetch(url, init), // 凭据在服务端 fetcher │
 * │   });                                                                    │
 * │   const result = await provider.invoke({                                 │
 * │     messages: toAiMessages(messages),                                    │
 * │     model: resolvedModel.code,                                           │
 * │     signal: ...                                                          │
 * │   });                                                                    │
 * │   const content = result.text;                                           │
 * │                                                                          │
 * │ 方案 B：把本接口升级为模型网关代理，后端用服务端托管的 key 转发请求。        │
 * │ 两种方案的密钥都只存在于服务端；本 mock 绝不联网、绝不读 env 里的 key。     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * 目前行为：保留原关键词回复，另外从 db 读「已启用的模型 / 知识库」配置，
 * 让请求带上 modelId / knowledgeId 时在回复末尾追加来源标注 —— 这是接线点的
 * 可观测样板，不代表已经接了真实模型或向量检索。
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
    '这是来自 Mock 服务的示例回复。当前可通过「AI 开发 → 模型供应商 / 模型列表」配置网关与模型，接线指引见 apps/web/src/views/ai/README.md。',
  ].join('\n');
}

/**
 * 从 db 配置解析来源标注：只认「在线模型 / 启用知识库」，id 不存在或已停用时静默忽略，
 * 保证老调用方（不发 modelId/knowledgeId）拿到的回复与改造前完全一致。
 */
function resolveSourceNotes(payload: ChatPayload): string[] {
  const notes: string[] = [];

  const modelId = Number(payload.modelId);
  if (Number.isFinite(modelId) && modelId > 0) {
    const model = findModel(modelId);
    if (model && model.status === 'online') {
      notes.push(
        `模型：${model.name}（${model.providerName} · ${model.code}）`,
      );
    }
  }

  const knowledgeId = Number(payload.knowledgeId);
  if (Number.isFinite(knowledgeId) && knowledgeId > 0) {
    const knowledge = findKnowledge(knowledgeId);
    if (knowledge && knowledge.status === 'enabled') {
      notes.push(
        `知识库：${knowledge.name}（文档 ${knowledge.docs} · 已向量化 ${knowledge.vectors}）`,
      );
    }
  }

  return notes;
}

export default defineMockRoute({
  handler({ data }) {
    const payload = data as ChatPayload;
    const messages = Array.isArray(payload.messages) ? payload.messages : [];

    // ↓↓↓ 接真实模型时替换这一行为 provider.invoke(...) 的结果（见文件顶部说明）↓↓↓
    const reply = buildReply(messages);

    const notes = resolveSourceNotes(payload);
    const content =
      notes.length > 0 ? `${reply}\n\n[来源] ${notes.join(' ｜ ')}` : reply;

    // 返回结构保持 { content }，Chat 页与「模板中心 / Chat」共用，不改契约。
    return success({ content }, 'ok');
  },
  method: 'POST',
  path: '/ai/chat',
  title: 'AI 对话',
});
