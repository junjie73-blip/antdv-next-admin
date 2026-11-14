export type AiChatRole = 'assistant' | 'user';

export interface AiChatMessage {
  content: string;
  createdAt?: number;
  id: string;
  role: AiChatRole;
}

/**
 * 传输层契约：本组件不依赖任何后端 / 模型 SDK，只把历史消息交给外部 `send`
 * 并拿回助手文本。页面侧用 `~/api` 走项目自己的代理即可，接真实大模型时
 * 只替换这一处实现。
 */
export type AiChatTransport = (
  messages: Array<Pick<AiChatMessage, 'content' | 'role'>>,
) => Promise<string>;
