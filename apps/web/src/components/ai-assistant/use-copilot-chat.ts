/** useChat 的薄封装：隔离 provider 与工具配置，便于单测替换 */
import type { ChatTool, LLMProvider } from 'vue-llm';
import type { ComputedRef } from 'vue';

import { useChat } from 'vue-llm';

export interface UseCopilotChatOptions {
  provider: LLMProvider;
  system: ComputedRef<string>;
  tools: ChatTool[];
}

export function useCopilotChat(options: UseCopilotChatOptions) {
  return useChat({
    id: 'antdv-copilot',
    provider: options.provider,
    model: 'copilot-mock',
    system: options.system,
    tools: options.tools,
    maxToolRoundtrips: 3,
    onError: (error: Error) => {
      window.dispatchEvent(
        new CustomEvent('copilot:error', { detail: { message: error.message } }),
      );
    },
  });
}
