<script setup lang="ts">
import type { AiChatTransport } from '@antdv/common-ui';
import type { AiModel } from '~/api/ai';

import { computed, onMounted, ref } from 'vue';

import { AiChat, PageHeader } from '@antdv/common-ui';
import { message } from '@antdv/popup-ui';
import { NativeSelect } from '@antdv/shadcn-ui';
import { getAiModelList } from '~/api/ai';
import { chatWithAi } from '~/api/ai-chat';

defineOptions({ name: 'AiChat' });

/** 只列在线模型：下拉选项来自 /ai/model/list，不在页面里硬编码模型名 */
const models = ref<AiModel[]>([]);
const selectedModelId = ref('');
const selectedModel = computed(() =>
  models.value.find((model) => String(model.id) === selectedModelId.value),
);

const examples = [
  '帮我解释智能体（Agent）的工作方式',
  '知识库检索怎么接？',
  '对比一下模型供应商的计费',
  '当前选用的模型适合处理哪些任务？',
];

const welcome = computed(() => {
  const suffix = selectedModel.value
    ? ` 当前选用：${selectedModel.value.name}（${selectedModel.value.providerName}）。`
    : ' 可先在「模型列表」配置网关与模型。';
  return `我是你的开发助手，可以陪你设计智能体、选型模型、梳理知识库。${suffix}`;
});

async function loadModels() {
  try {
    const result = await getAiModelList({
      pageNum: 1,
      pageSize: 200,
      status: 'online',
    });
    models.value = result.list;
    if (!selectedModelId.value && result.list.length > 0) {
      selectedModelId.value = String(result.list[0]!.id);
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载模型列表失败');
  }
}

const send: AiChatTransport = async (messages) => {
  const modelId = selectedModelId.value
    ? Number(selectedModelId.value)
    : undefined;
  const res = await chatWithAi(messages, modelId);
  return res.content;
};

onMounted(loadModels);
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <PageHeader
      description="AI 开发 · 对话能力基于 shadcn-vue 官方 Message 与 MessageScroller 原语组合；模型在「模型列表」配置后可在下方选择，传输层已预留真实网关接线点。"
      icon="carbon:machine-learning"
      title="AI Chat"
    />
    <div class="flex items-center gap-3 px-1 pb-2 text-sm">
      <span class="text-muted-foreground">当前模型</span>
      <NativeSelect
        v-model="selectedModelId"
        class="min-w-52"
        aria-label="选择模型"
      >
        <option value="">默认（不指定）</option>
        <option
          v-for="model in models"
          :key="model.id"
          :value="String(model.id)"
        >
          {{ model.name }} · {{ model.providerName }}
        </option>
      </NativeSelect>
      <span v-if="selectedModel" class="text-muted-foreground text-xs">
        {{ selectedModel.context }} 上下文 · {{ selectedModel.protocol }}
      </span>
    </div>
    <div class="min-h-0 flex-1">
      <AiChat
        :examples="examples"
        :send="send"
        :welcome="welcome"
        title="AI Chat"
      />
    </div>
  </div>
</template>
