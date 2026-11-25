import { post } from './request';

export interface ChatTurn {
  content: string;
  role: 'assistant' | 'user';
}

/**
 * AI 对话传输层：当前请求 backend-mock 的 `/ai/chat`。
 *
 * `modelId` 是可选接线参数：选中「模型列表」里的模型后传给后端，回复会带来源标注；
 * 不传时行为与旧版完全一致（向后兼容），「模板中心 / Chat」入口无需改动。
 * 接真实模型时只改这一个函数的请求地址 / 协议即可，Chat 组件不用动。
 */
export interface ChatResponse {
  blocked?: boolean;
  categories?: string[];
  content: string;
  risk?: 'critical' | 'high' | 'low' | 'medium';
}

export function chatWithAi(
  messages: ChatTurn[],
  modelId?: number,
): Promise<ChatResponse> {
  return post<ChatResponse>(
    '/ai/chat',
    modelId === undefined ? { messages } : { messages, modelId },
  );
}
