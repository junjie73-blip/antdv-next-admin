<script setup lang="ts">
import type { AiChatTransport } from '@antdv/common-ui';

import { AiChat, PageHeader } from '@antdv/common-ui';
import { chatWithAi } from '~/api/ai-chat';

defineOptions({ name: 'AiChat' });

const examples = [
  '帮我解释智能体（Agent）的工作方式',
  '知识库检索怎么接？',
  '对比一下模型供应商的计费',
];

const send: AiChatTransport = async (messages) => {
  const res = await chatWithAi(messages);
  return res.content;
};
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <PageHeader
      description="AI 开发 · 对话能力基于 shadcn-vue 官方 Message 与 MessageScroller 原语组合，传输层可替换为真实大模型。"
      icon="carbon:machine-learning"
      title="AI Chat"
    />
    <div class="min-h-0 flex-1">
      <AiChat
        :examples="examples"
        :send="send"
        title="AI Chat"
        welcome="我是你的开发助手，可以陪你设计智能体、选型模型、梳理知识库。"
      />
    </div>
  </div>
</template>
