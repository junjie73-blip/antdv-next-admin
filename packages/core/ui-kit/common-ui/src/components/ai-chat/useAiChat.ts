import type { AiChatMessage, AiChatTransport } from './types';

import { ref } from 'vue';

let seq = 0;
function uid(): string {
  seq += 1;
  return `m_${Date.now().toString(36)}_${seq}`;
}

export interface UseAiChatOptions {
  initial?: AiChatMessage[];
  send: AiChatTransport;
}

/**
 * 对话状态机：只维护消息列表 / 输入 / 加载态，不碰传输与 UI。
 * `id` 稳定生成，供 `MessageScrollerItem` 做滚动锚点与可见性追踪。
 */
export function useAiChat(options: UseAiChatOptions) {
  const messages = ref<AiChatMessage[]>(options.initial ?? []);
  const input = ref('');
  const isLoading = ref(false);
  let stopped = false;

  function push(content: string, role: AiChatMessage['role']) {
    messages.value.push({
      content,
      createdAt: Date.now(),
      id: uid(),
      role,
    });
  }

  async function send(text?: string) {
    const content = (text ?? input.value).trim();
    if (!content || isLoading.value) return;
    stopped = false;
    input.value = '';
    push(content, 'user');
    isLoading.value = true;
    const history = messages.value.map((item) => ({
      content: item.content,
      role: item.role,
    }));
    try {
      const reply = await options.send(history);
      if (!stopped) push(reply, 'assistant');
    } catch (error) {
      push(
        `请求失败：${error instanceof Error ? error.message : '未知错误'}`,
        'assistant',
      );
    } finally {
      isLoading.value = false;
    }
  }

  function retry() {
    const lastUser = [...messages.value]
      .reverse()
      .find((item) => item.role === 'user');
    if (lastUser) send(lastUser.content);
  }

  function stop() {
    stopped = true;
    isLoading.value = false;
  }

  function reset() {
    messages.value = [];
    input.value = '';
    isLoading.value = false;
  }

  return { input, isLoading, messages, reset, retry, send, stop };
}
