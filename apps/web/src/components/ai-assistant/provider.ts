/**
 * Copilot 的 LLM Provider：实现 vue-llm 的 LLMProvider 契约。
 *
 * 当前后端是 mock，所以这里用「本地意图规则 + /ai/chat 回复」拼装流式 chunk，
 * 让工具调用 / Generative UI 走真实链路。接真模型时只替换本文件，
 * useChat / 工具 / 组件契约都不动。
 */
import type {
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  ChatStreamResult,
  LLMProvider,
} from 'vue-llm';

import { chatWithAi } from '~/api/ai-chat';

function lastUserText(request: ChatRequest): string {
  for (let index = request.messages.length - 1; index >= 0; index -= 1) {
    const message = request.messages[index]!;
    if (message.role !== 'user') continue;
    if (typeof message.content === 'string') return message.content;
    return message.content
      .filter((part: { type: string }) => part.type === 'text')
      .map((part: { type: string; text?: string }) => (part.type === 'text' ? part.text ?? '' : ''))
      .join('');
  }
  return '';
}

function pushText(controller: ReadableStreamDefaultController<ChatStreamChunk>, text: string) {
  controller.enqueue({ type: 'text-delta', text });
}

/** 从 System Prompt 里取页面上下文，避免给出「当前页面 · page」这类错误描述 */
function pageContextOf(request: ChatRequest) {
  const system = request.messages.find((message) => message.role === 'system');
  const content = typeof system?.content === 'string' ? system.content : '';
  return {
    title: /你是\s*(.+?)\s*页面的 Copilot/u.exec(content)?.[1] ?? '',
    entity: /当前实体：\s*(.+?)。/u.exec(content)?.[1] ?? '',
  };
}

function emitToolCall(
  controller: ReadableStreamDefaultController<ChatStreamChunk>,
  toolCallId: string,
  toolName: string,
  args: Record<string, unknown>,
) {
  controller.enqueue({ type: 'tool-call-start', toolCallId, toolName });
  controller.enqueue({ type: 'tool-call-delta', toolCallId, args: JSON.stringify(args) });
  controller.enqueue({ type: 'tool-call-end', toolCallId });
}

export function createCopilotProvider(): LLMProvider {
  return {
    id: 'antdv-copilot-mock',
    supportsStreaming: true,

    validateConfig() {
      // mock provider 不需要外部凭证
    },

    async chat(request: ChatRequest): Promise<ChatStreamResult> {
      const text = lastUserText(request);
      const response: Promise<ChatResponse> = Promise.resolve({
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      });

      const stream = new ReadableStream<ChatStreamChunk>({
        async start(controller) {
          controller.enqueue({ type: 'message-start', id: `copilot_${Date.now()}` });

          try {
            if (/(重启|重试|restart)/iu.test(text)) {
              pushText(
                controller,
                '写操作不会由我直接执行。请到对应业务页面的操作入口确认后再处理；需要我先帮你筛选当前页数据吗？',
              );
            } else if (/(失败|异常|错误|failed)/iu.test(text)) {
              // 通用表格工具：读取当前页注册的数据，不绑定任何具体业务接口
              emitToolCall(controller, `search_${Date.now()}`, 'search_table', {
                utterance: text,
              });
            } else if (/(成功率|图表|趋势|chart)/iu.test(text)) {
              pushText(
                controller,
                '当前页面的指标卡与趋势图可以查看成功率。需要我把筛选条件整理出来，或说明某个时间范围吗？',
              );
            } else {
              const history = request.messages
                .filter((message: { role: string }) => message.role !== 'system')
                .map((message) => ({
                  content:
                    typeof message.content === 'string'
                      ? message.content
                      : message.content
                          .filter((part: { type: string }) => part.type === 'text')
                          .map((part: { type: string; text?: string }) => (part.type === 'text' ? part.text ?? '' : ''))
                          .join(''),
                  role: message.role,
                }))
                .filter((message) => message.role === 'user' || message.role === 'assistant')
                .map((message: { content: string; role: string }) => ({
                  content: message.content,
                  role: message.role as 'user' | 'assistant',
                }));
              const { title, entity } = pageContextOf(request);
              if (title && /(这个页面能做什么|页面.*做什么|能做什么)/u.test(text)) {
                pushText(
                  controller,
                  [
                    `你当前在「${title}」页面${entity && entity !== 'page' ? `（实体：${entity}）` : ''}。`,
                    '我可以读取当前页面的筛选条件与选中行，帮你概括数据、定位异常、生成表单填写建议，并在需要确认的危险操作前停下来等你确认。',
                    '你也可以点右上角 ⌘K 快速跳转到其他页面，或用输入框旁的回形针附加文件让我一起分析。',
                  ].join('\n'),
                );
              } else {
                const reply = await chatWithAi(history);
                const prefix = title ? `当前页面：${title}。` : '';
                pushText(
                  controller,
                  `${prefix}${reply.blocked ? `[安全拦截] ${reply.content}` : reply.content}`,
                );
              }
            }

            controller.enqueue({ type: 'finish', finishReason: 'stop' });
          } catch (error) {
            controller.enqueue({
              type: 'error',
              error: error instanceof Error ? error : new Error('Copilot 请求失败'),
            });
          } finally {
            controller.close();
          }
        },
      });

      return { stream, response };
    },
  };
}
