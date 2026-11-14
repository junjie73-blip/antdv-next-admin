import { post } from './request';

export interface ChatTurn {
  content: string;
  role: 'assistant' | 'user';
}

/**
 * AI 对话传输层：当前接 backend-mock 的 `/ai/chat`（关键词示例回复）。
 * 替换为真实大模型接口时，只改这一处即可，Chat 组件无需改动。
 */
export function chatWithAi(messages: ChatTurn[]): Promise<{ content: string }> {
  return post<{ content: string }>('/ai/chat', { messages });
}
