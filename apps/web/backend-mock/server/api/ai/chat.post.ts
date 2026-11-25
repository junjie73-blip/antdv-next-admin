import { resolveAccount } from '../../utils/accounts';
import { findKnowledge, findModel } from '../../utils/db/ai';
import {
  aiPolicySnapshot,
  isPolicyEnabled,
  maskPolicySnapshot,
  recordAiCall,
} from '../../utils/db/security-advanced';
import { success } from '../../utils/response';
import { defineMockRoute } from '../../utils/runtime';
import {
  assessPrompt,
  isRateLimited,
  moderateOutput,
} from '../../utils/security/ai-guard';

/** 单账号调用窗口（Mock 进程内；生产应由网关或 Redis 承担） */
const callHistory = new Map<string, number[]>();

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
    return '你好！我是本平台的 AI 助手，可以帮你梳理需求、生成代码片段、解释后台模块。试着问我「审批流怎么配置？」';
  }
  if (/工作流|流程|审批|节点/.test(question)) {
    return [
      '审批流提供发起、分组与监控：',
      '- 我的审批：发起单据、处理待办、查看节点流转与驳回重提',
      '- 流程分组 / 流程监控：配置审批层级与超时自动审批、查看流转记录',
      '',
      '你可以从「审批流」分组进入。需要我给出一段调用示例吗？',
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
    '这是来自 Mock 服务的示例回复。接真实模型时只需替换服务端的 buildReply 接线点，前端对话、安全网关与审计链路都不用改。',
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
  handler(context) {
    const payload = context.data as ChatPayload;
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    const actor = resolveAccount(context.headers).profile.username;
    const traceId = context.traceId ?? 'unknown';
    const aiPolicies = aiPolicySnapshot();
    const maskPolicies = maskPolicySnapshot();
    const prompt = messages
      .filter((item) => item?.role === 'user')
      .map((item) => String(item.content ?? ''))
      .join('\n');

    // 1) 输入网关：提示词注入检测 + PII 脱敏，判定结果同步写入 AI 调用审计
    const guard = assessPrompt(prompt, aiPolicies, maskPolicies);
    if (guard.action === 'block') {
      const content = `请求未通过 AI 安全网关：${guard.reasons.join('；') || '命中高风险规则'}。请调整提问后重试。`;
      if (isPolicyEnabled('call_audit'))
        recordAiCall({
          action: 'block',
          actor,
          categories: guard.categories,
          level: guard.level,
          prompt: guard.maskedPrompt,
          traceId,
        });
      return success(
        {
          blocked: true,
          categories: guard.categories,
          content,
          risk: guard.level,
        },
        'ok',
      );
    }

    // 2) 频率限制：策略阈值可在「安全中心 → AI 安全策略」实时调整
    const ratePolicy = aiPolicies.find((item) => item.key === 'rate_limit');
    if (ratePolicy?.enabled) {
      const now = Date.now();
      const history = (callHistory.get(actor) ?? []).filter(
        (at) => now - at < 60_000,
      );
      if (isRateLimited(history, now, ratePolicy.threshold)) {
        if (isPolicyEnabled('call_audit'))
          recordAiCall({
            action: 'block',
            actor,
            categories: ['调用限流'],
            level: 'medium',
            prompt: guard.maskedPrompt,
            traceId,
          });
        return success(
          {
            blocked: true,
            categories: ['调用限流'],
            content: '调用过于频繁，请稍后再试。',
            risk: 'medium',
          },
          'ok',
        );
      }
      history.push(now);
      callHistory.set(actor, history);
    }

    // 3) 用脱敏后的提示词调用模型，避免明文 PII 被回显或发送给下游
    const safeMessages = messages.map((item) =>
      item.role === 'user' ? { ...item, content: guard.maskedPrompt } : item,
    );
    // ↓↓↓ 接真实模型时替换这一行为 provider.invoke(...) 的结果（见文件顶部说明）↓↓↓
    const reply = buildReply(safeMessages);

    const notes = resolveSourceNotes(payload);
    const rawContent =
      notes.length > 0 ? `${reply}\n\n[来源] ${notes.join(' ｜ ')}` : reply;

    // 4) 输出审核：密钥 / 脚本片段一律不让前端渲染
    const moderated = moderateOutput(rawContent, aiPolicies, maskPolicies);
    const categories = [
      ...new Set([...guard.categories, ...moderated.categories]),
    ];
    if (isPolicyEnabled('call_audit'))
      recordAiCall({
        action:
          guard.action === 'mask' || moderated.categories.length > 0
            ? 'mask'
            : 'pass',
        actor,
        categories,
        level: guard.level === 'low' ? moderated.level : guard.level,
        prompt: guard.maskedPrompt,
        traceId,
      });

    // 返回结构保持 { content } 兼容老调用方，新增字段仅用于安全态展示
    return success(
      {
        blocked: false,
        categories,
        content: moderated.text,
        risk: guard.level === 'low' ? moderated.level : guard.level,
      },
      'ok',
    );
  },
  method: 'POST',
  path: '/ai/chat',
  title: 'AI 对话',
});
