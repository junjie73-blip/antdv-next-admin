<script setup lang="ts">
import type { AiChatTransport } from '@antdv/common-ui';

import { AiChat, PageHeader } from '@antdv/common-ui';
import { chatWithAi } from '~/api/ai-chat';

defineOptions({ name: 'TemplateChat' });

const examples = [
  '工作流引擎怎么接？',
  '报表设计器支持哪些图表？',
  '低代码搭建能导出什么？',
];

const send: AiChatTransport = async (messages) => {
  const res = await chatWithAi(messages);
  return res.content;
};
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <PageHeader
      description="基于 shadcn-vue 官方 Message 与 MessageScroller 原语组合的对话面板，已接入 Mock 传输层，可演示完整收发闭环。"
      icon="carbon:chat"
      title="Chat"
    />
    <div class="min-h-0 flex-1">
      <AiChat
        :examples="examples"
        :send="send"
        title="AI 对话"
        welcome="我能帮你写代码、查资料、梳理思路。"
      />
    </div>
  </div>
</template>
