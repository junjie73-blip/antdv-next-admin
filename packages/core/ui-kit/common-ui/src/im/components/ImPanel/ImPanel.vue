<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import type { ImLimits } from '../../core/limits';
import type { MentionMember } from '../../core/mention';
import type { Attachment, ImMessage } from '../../core/types';
import type { UseImReturn } from '../../core/use-im';

import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@antdv/icons';
import { Badge, Button, Separator } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

import { messagesToText } from '../../core/store';
import ConversationList from '../ConversationList/ConversationList.vue';
import MessageComposer from '../MessageComposer/MessageComposer.vue';
import MessagePane from '../MessagePane/MessagePane.vue';

/**
 * 三栏式 IM 面板：会话列表 + 消息流 + 输入区，接一个现成的 `useIm` 实例。
 *
 * 分层位置：`components/` 的组合层。它**不自己造** store / transport ——
 * `im` 由宿主（或 `createConfiguredIm()`）传进来。同一份长连接通常要被页面里好几块 UI 共享，
 * 面板内部再 `new` 一套就会两条心跳互相打断（那是排查成本最高的一类线上问题）。
 *
 * 这里只做四件组合层该做的事：
 * 1. **草稿按会话分桶**：切走再切回来，没发出去的字还在。
 *    草稿刻意只活在组件里 —— 落 localStorage 属于宿主策略（有的租户要求"离开即清空"）；
 * 2. **摘要由消息表算**：列表项不认识消息表，组合层把末条压成一行字传下去；
 * 3. **诊断就地显示**：`im.error` 是一条可关的红条，不是 toast ——
 *    用哪种通知是宿主的决定，与 `core/use-im.ts` 同一口径；
 * 4. **把 `useIm` 的 ref 摊平成本地绑定**：模板只会自动解包顶层 ref，
 *    `im.status.value` 这种写法在模板里会渲染成 `[object Object]`，所以一次解构到底。
 *
 * 这一层不做什么：不发帧、不改 store、不做权限判断，也不"顺便"决定头像从哪来。
 */
const props = withDefaults(
  defineProps<{
    /** 左栏附加类：窄屏是否收起由宿主决定，包不猜布局断点 */
    asideClass?: HTMLAttributes['class'];
    avatarOf?: (userId: string) => string | undefined;
    class?: HTMLAttributes['class'];
    /** 状态机实例：一般来自 `createConfiguredIm().im` */
    im: UseImReturn;
    /** 换 `im` 实例等于换一套连接，需要重建组件，所以这里不做热替换 */
    limits?: Partial<ImLimits>;
    members?: MentionMember[];
    nameOf?: (userId: string) => string;
    emptyText?: string;
    /** 自己是谁：与 `useIm` 的 `userId` 同一个值，组件不猜 */
    selfId: string;
  }>(),
  {
    asideClass: undefined,
    avatarOf: undefined,
    class: undefined,
    limits: undefined,
    members: undefined,
    nameOf: undefined,
    emptyText: undefined,
  },
);

const emit = defineEmits<{
  (event: 'openAttachment', attachment: Attachment, message: ImMessage): void;
}>();

// 解构而不是包一层 computed：`useIm` 返回的 ref/computed 引用在整个实例生命周期内不变，
// 解构出来的还是同一批 ref，模板拿到的是自动解包后的值，改动仍然一路响应。
const {
  activeConversationId,
  connection,
  conversations,
  error,
  loadHistory,
  loadingHistory,
  messages,
  openConversation,
  presences,
  recall,
  retry,
  sendMessage,
  status,
  store,
  typing,
  typingPeers,
} = props.im;

/** 会话 id -> 未发出的草稿；切会话不丢字，是 IM 的基本礼貌 */
const drafts = ref<Record<string, string>>({});
const draft = computed({
  get: () => drafts.value[activeConversationId.value ?? ''] ?? '',
  set: (value: string) => {
    drafts.value = {
      ...drafts.value,
      [activeConversationId.value ?? '']: value,
    };
  },
});

const summaries = computed(() => {
  const out: Record<string, string> = {};
  for (const conversation of conversations.value) {
    const last = store.messagesOf(conversation.id).at(-1);
    out[conversation.id] = last === undefined ? '' : messagesToText(last);
  }
  return out;
});

const title = computed(() => {
  if (activeConversationId.value === undefined) return '未选择会话';
  const conversation =
    store.state.value.conversations[activeConversationId.value];
  if (conversation === undefined) return activeConversationId.value;
  return (
    conversation.title ??
    (conversation.kind === 'group' ? '群聊' : conversation.id)
  );
});

const typingText = computed(() => {
  const ids = typingPeers.value[activeConversationId.value ?? ''];
  if (ids === undefined || ids.length === 0) return '';
  return `${ids.map((id) => props.nameOf?.(id) ?? id).join('、')} 正在输入…`;
});

const statusLabel = computed(
  () =>
    ({ CLOSED: '已断开', CONNECTING: '连接中', OPEN: '已连接' })[status.value],
);

const dismissed = ref<string | undefined>();
/** 同一句话只让关一次：关掉之后再来同样的诊断才重新显示，否则刷屏 */
const errorText = computed(() =>
  error.value === undefined || error.value === dismissed.value
    ? ''
    : error.value,
);

const isLoadingHistory = computed(
  () => loadingHistory.value[activeConversationId.value ?? ''] === true,
);

/**
 * 待发送条数必须在脚本里解包：模板只会自动解包顶层 ref，
 * `connection.pending` 是嵌在普通对象里的 computed，直接写 `connection.pending > 0`
 * 拿到的是对象比较（恒为 false），界面上"有 N 条待发送"就永远不会出现。
 */
const pendingCount = computed(() => connection.pending.value);

function closeError(): void {
  dismissed.value = error.value;
}

function onSelect(conversationId: string): void {
  openConversation(conversationId);
}

function onSend(payload: {
  attachments: Attachment[];
  mentions: string[];
  text: string;
}): void {
  sendMessage(payload);
  // 发出即清草稿：否则切回会话还能看到已经发出去的字
  drafts.value = { ...drafts.value, [activeConversationId.value ?? '']: '' };
}

// 切会话时收起上一次的诊断：旧会话的坏帧提示挂在当前会话上是误导
watch(activeConversationId, () => {
  dismissed.value = undefined;
});
</script>

<template>
  <div
    :class="
      cn(
        'flex h-full min-h-0 w-full overflow-hidden rounded-lg border border-border',
        props.class,
      )
    "
    data-slot="im-panel"
  >
    <aside
      :class="
        cn(
          'flex w-72 shrink-0 min-w-0 flex-col border-r border-border',
          props.asideClass,
        )
      "
      data-panel-aside
    >
      <div class="flex items-center gap-2 px-3 py-2">
        <h2 class="min-w-0 flex-1 truncate text-sm font-medium">会话</h2>
        <Badge
          :variant="status === 'OPEN' ? 'secondary' : 'destructive'"
          data-connection-state
        >
          {{ statusLabel }}
        </Badge>
      </div>
      <Separator />
      <ConversationList
        :avatar-of="props.avatarOf"
        class="min-h-0 flex-1 overflow-y-auto"
        :conversations="conversations"
        :current-id="activeConversationId"
        :presences="presences"
        :self-id="props.selfId"
        :summaries="summaries"
        @select="onSelect"
      />
    </aside>

    <section class="flex min-w-0 flex-1 flex-col" data-panel-main>
      <header class="flex items-center gap-2 px-3 py-2">
        <span
          class="min-w-0 flex-1 truncate text-sm font-medium"
          data-panel-title
          >{{ title }}</span>
        <span
          v-if="pendingCount > 0"
          class="text-muted-foreground text-xs tabular-nums"
          data-pending-count
        >
          {{ pendingCount }} 条待发送
        </span>
        <Button
          data-action="reconnect"
          size="icon-xs"
          type="button"
          variant="ghost"
          @click="connection.reconnect()"
        >
          <IconifyIcon icon="lucide:refresh-cw" />
          <span class="sr-only">重新连接</span>
        </Button>
      </header>
      <Separator />
      <p
        v-if="errorText !== ''"
        class="bg-destructive/10 text-destructive flex items-center gap-2 px-3 py-1.5 text-xs"
        data-panel-error
      >
        <IconifyIcon class="shrink-0" icon="lucide:triangle-alert" />
        <span class="min-w-0 flex-1 truncate">{{ errorText }}</span>
        <Button
          data-action="dismiss-error"
          size="icon-xs"
          type="button"
          variant="ghost"
          @click="closeError"
        >
          <IconifyIcon icon="lucide:x" />
          <span class="sr-only">关闭提示</span>
        </Button>
      </p>
      <MessagePane
        :avatar-of="props.avatarOf"
        class="min-h-0 flex-1"
        :empty-text="props.emptyText"
        :loading-history="isLoadingHistory"
        :members="props.members"
        :messages="messages"
        :name-of="props.nameOf"
        :self-id="props.selfId"
        @load-history="() => loadHistory()"
        @open-attachment="
          (attachment, message) => emit('openAttachment', attachment, message)
        "
        @recall="(message) => recall(message.id)"
        @retry="(message) => retry(message.id)"
      />
      <p
        v-if="typingText !== ''"
        class="px-3 pb-1 text-muted-foreground text-xs"
        data-typing
      >
        {{ typingText }}
      </p>
      <MessageComposer
        v-model="draft"
        :active="activeConversationId !== undefined"
        :limits="props.limits"
        :members="props.members"
        @send="onSend"
        @typing="() => typing()"
      >
        <template v-if="$slots.mention" #mention="slotProps">
          <slot name="mention" v-bind="slotProps"></slot>
        </template>
        <template v-if="$slots['toolbar-trailing']" #toolbar-trailing>
          <slot name="toolbar-trailing"></slot>
        </template>
        <template v-if="$slots.emoji" #emoji>
          <slot name="emoji"></slot>
        </template>
      </MessageComposer>
    </section>
  </div>
</template>
