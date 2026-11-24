<script setup lang="ts">
import type { AiChatMessage, AiChatTransport } from './types';

import {
  Avatar,
  AvatarFallback,
  Bubble,
  BubbleContent,
  Button,
  Marker,
  MarkerContent,
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  Spinner,
  Textarea,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import {
  ArrowUpIcon,
  CopyIcon,
  RefreshCcwIcon,
  SparklesIcon,
  SquareIcon,
} from '@lucide/vue';

import Markdown from './Markdown.vue';
import { useAiChat } from './useAiChat';

/**
 * AI 对话面板（自定义封装，位于 common-ui）。
 *
 * 展示层全部由 shadcn-vue 官方原语拼装：
 * - `MessageScrollerProvider / MessageScroller / Viewport / Content / Item / Button`
 *   负责滚动锚定、自动跟随直播边缘、跳到最新；
 * - `Message / MessageAvatar / MessageContent / MessageFooter` 负责单行消息布局；
 * - `Bubble / BubbleContent` 负责气泡表面，`Marker` 负责「正在思考」状态行；
 * - `Textarea / Button / Avatar / Spinner` 负责输入与操作。
 *
 * 这些原语都来自 `@antdv/shadcn-ui`（shadcn-vue 组件层），本文件只做业务组合，
 * 不重复造轮子；传输层由调用方通过 `send` 注入，组件不绑定任何后端。
 */
const props = withDefaults(
  defineProps<{
    examples?: string[];
    initial?: AiChatMessage[];
    send: AiChatTransport;
    title?: string;
    welcome?: string;
  }>(),
  {
    examples: () => [],
    title: 'AI 对话',
    welcome: '我能帮你写代码、查资料、梳理思路。',
  },
);

const { input, isLoading, messages, retry, send, stop } = useAiChat({
  initial: props.initial,
  send: props.send,
});

function submit() {
  const text = input.value.trim();
  if (!text || isLoading.value) return;
  send(text);
}

function onExample(example: string) {
  send(example);
}

function copy(content: string) {
  void navigator.clipboard?.writeText(content);
}
</script>

<template>
  <!--
    布局内容区经 Scrollbar 包了一层「按内容撑高」的 view，页面根上的 h-full
    只能拿到内容高度（仓库里 IM 面板同样改用明确高度，见 enterprise/im）。
    所以这里自己给一个视口相对高度：消息区 flex-1 才有可分配空间，
    输入区才会贴在可视区底部而不是浮在半屏中间。
  -->
  <div
    class="flex h-[calc(100vh-13rem)] min-h-[420px] flex-col"
    data-ai-chat-root
  >
    <!-- Provider 只提供 context、不渲染 DOM；高度约束必须落在真实容器上 -->
    <MessageScrollerProvider auto-scroll default-scroll-position="last-anchor">
      <div class="min-h-0 flex-1">
        <MessageScroller>
          <MessageScrollerViewport>
            <MessageScrollerContent
              :class="cn('mx-auto w-full max-w-3xl px-4 py-6')"
            >
              <!-- 空状态：欢迎语 + 示例问题 -->
              <MessageScrollerItem
                v-if="messages.length === 0"
                message-id="empty"
              >
                <div class="flex flex-col items-center gap-4 py-12 text-center">
                  <div
                    class="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
                  >
                    <SparklesIcon class="size-6" />
                  </div>
                  <div>
                    <p class="text-base font-medium">{{ title }}</p>
                    <p class="mt-1 text-sm text-muted-foreground">
                      {{ welcome }}
                    </p>
                  </div>
                  <div
                    v-if="examples.length"
                    class="flex flex-wrap justify-center gap-2"
                  >
                    <button
                      v-for="example in examples"
                      :key="example"
                      type="button"
                      class="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
                      @click="onExample(example)"
                    >
                      {{ example }}
                    </button>
                  </div>
                </div>
              </MessageScrollerItem>

              <!-- 消息行：Message 管布局，Bubble 管表面 -->
              <MessageScrollerItem
                v-for="message in messages"
                :key="message.id"
                :message-id="message.id"
                :scroll-anchor="message.role === 'user'"
              >
                <Message :align="message.role === 'user' ? 'end' : 'start'">
                  <MessageAvatar>
                    <Avatar class="size-8">
                      <AvatarFallback>
                        {{ message.role === 'user' ? 'ME' : 'AI' }}
                      </AvatarFallback>
                    </Avatar>
                  </MessageAvatar>
                  <MessageContent>
                    <Bubble
                      :variant="message.role === 'user' ? 'default' : 'muted'"
                    >
                      <BubbleContent>
                        <Markdown :content="message.content" />
                      </BubbleContent>
                    </Bubble>
                    <MessageFooter>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="复制"
                        title="复制"
                        @click="copy(message.content)"
                      >
                        <CopyIcon />
                      </Button>
                      <Button
                        v-if="message.role === 'assistant'"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="重新生成"
                        title="重新生成"
                        @click="retry"
                      >
                        <RefreshCcwIcon />
                      </Button>
                    </MessageFooter>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>

              <!-- 流式状态行 -->
              <MessageScrollerItem v-if="isLoading" message-id="loading">
                <Marker role="status">
                  <MarkerContent>
                    <Spinner class="size-4" />
                    <span>正在思考…</span>
                  </MarkerContent>
                </Marker>
              </MessageScrollerItem>
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton direction="end" />
        </MessageScroller>
      </div>
    </MessageScrollerProvider>

    <!-- 输入区 -->
    <div class="shrink-0 px-4 pb-4">
      <form
        class="mx-auto w-full max-w-3xl rounded-xl border border-input bg-background p-2 shadow-sm"
        @submit.prevent="submit"
      >
        <Textarea
          v-model="input"
          placeholder="输入消息，Enter 发送，Shift + Enter 换行"
          class="max-h-40 min-h-20 resize-none border-none bg-transparent shadow-none focus-visible:ring-0"
          @keydown.enter.exact.prevent="submit"
        />
        <div class="flex items-center justify-between pt-1">
          <span class="text-xs text-muted-foreground">
            AI 可能出错，请核实关键信息
          </span>
          <Button
            v-if="isLoading"
            type="button"
            size="icon"
            variant="secondary"
            aria-label="停止生成"
            @click="stop"
          >
            <SquareIcon class="size-4" />
          </Button>
          <Button v-else type="submit" size="icon" :disabled="!input.trim()">
            <ArrowUpIcon class="size-4" />
          </Button>
        </div>
      </form>
    </div>
  </div>
</template>
