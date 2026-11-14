<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import type { Conversation, Presence } from '../../core/types';

import { computed } from 'vue';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

import { formatListTime } from '../../utils/time';

/**
 * 会话列表：只做「画 + 回抛选中」，不取数、不动 store。
 *
 * 分工与 `useIm` 一致：列表的排序、未读数学都在 reducer 里，这里只渲染传进来的数组；
 * 一旦这里出现"自己按时间排一遍"，就等于把同一条口径写了两遍，
 * 症状是宿主换一种数据源后顺序开始打架。
 */
const props = defineProps<{
  /** 头像地址规则：包不猜宿主的存储在哪，注入函数即可；不传就退化成名字首字 */
  avatarOf?: (userId: string) => string | undefined;
  class?: HTMLAttributes['class'];
  conversations: Conversation[];
  /** 当前项：高亮只走 token 类，不自定义配色 */
  currentId?: string;
  emptyText?: string;
  loading?: boolean;
  /** 会话 id -> 最后一条摘要；列表项不认识消息表，由组合方（ImPanel / 宿主）算好传进来 */
  summaries?: Record<string, string>;
  /**
   * 当前登录人：给了就能把"头像/在线状态挂在哪个人身上"算对。
   * 不给时退化成"成员表第一个"，那是宿主自己排好序的约定。
   */
  selfId?: string;
  /** 成员 id -> 在线状态，单聊头像上的一枚小圆点 */
  presences?: Record<string, Presence>;
  /** 会话里显示头像的那个人：单聊取对方，群聊可传负责人 */
  titleOf?: (conversation: Conversation) => string;
}>();

const emit = defineEmits<{
  (event: 'select', conversationId: string): void;
}>();

const rows = computed(() => props.conversations);

function title(conversation: Conversation): string {
  if (props.titleOf !== undefined) return props.titleOf(conversation);
  return (
    conversation.title ??
    (conversation.kind === 'group' ? '群聊' : conversation.id)
  );
}

/**
 * 单聊取对方、群聊取首个成员：这里的"自己"由 `selfId` prop 决定，组件不猜当前登录人。
 *
 * 必须先排掉自己再取成员。真实宿主（与服务端的会话表同形）给的是 `[我, 对方]`，
 * 只按下标取第一个就会把头像与那枚在线圆点挂到自己身上 —— 圆点永远不亮，
 * 而组件测试的夹具恰好都把对方写在第一位，于是包内全绿、页面上看不見。
 * 没传 `selfId` 时退回旧约定（谁排第一显示谁），不破坏已经按对方排序的宿主。
 */
function avatarUser(conversation: Conversation): string {
  return (
    conversation.memberIds.find((id) => id !== props.selfId) ??
    conversation.memberIds[0] ??
    conversation.id
  );
}

function unreadVariant(unread: number): 'default' | 'secondary' {
  // 只给两档：超过 99 条时红点会变宽把标题挤走，用 secondary 收敛成视觉噪音更小的一档
  return unread > 0 ? 'default' : 'secondary';
}

/**
 * 头像地址分两个函数而不是一处 `?.()`：
 * `AvatarImage` 的 `src` 要求 `string`，模板里直接调可选链会带上 `undefined`，
 * 类型层就红 —— 拆成"有没有"与"是什么"，读起来也正好是渲染想做的两件事。
 */
function hasAvatar(conversation: Conversation): boolean {
  return props.avatarOf?.(avatarUser(conversation)) !== undefined;
}

function avatarSrc(conversation: Conversation): string {
  return props.avatarOf?.(avatarUser(conversation)) ?? '';
}
</script>

<template>
  <div
    :class="cn('flex w-full min-w-0 flex-col', props.class)"
    data-slot="im-conversation-list"
  >
    <div v-if="rows.length > 0" class="flex min-w-0 flex-col">
      <button
        v-for="conversation in rows"
        :class="
          cn(
            'flex w-full min-w-0 items-center gap-3 rounded-md px-2 py-3 text-left transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
            conversation.id === props.currentId
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-accent/60',
          )
        "
        :data-conversation-id="conversation.id"
        :data-current="conversation.id === props.currentId ? 'true' : 'false'"
        :key="conversation.id"
        type="button"
        @click="emit('select', conversation.id)"
      >
        <Avatar class="size-9">
          <AvatarImage
            v-if="hasAvatar(conversation)"
            :src="avatarSrc(conversation)"
          />
          <AvatarFallback>{{ title(conversation).slice(0, 1) }}</AvatarFallback>
        </Avatar>
        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 items-center gap-2">
            <span class="min-w-0 flex-1 truncate text-sm font-medium">
              {{ title(conversation) }}
            </span>
            <span class="shrink-0 text-muted-foreground text-xs tabular-nums">
              {{ formatListTime(conversation.lastMessageAt ?? '') }}
            </span>
          </div>
          <div class="mt-1 flex min-w-0 items-center gap-2">
            <span class="min-w-0 flex-1 truncate text-muted-foreground text-xs">
              {{ props.summaries?.[conversation.id] ?? '' }}
            </span>
            <Badge
              v-if="conversation.unread > 0"
              :variant="unreadVariant(conversation.unread)"
              class="shrink-0"
              data-unread-count
            >
              {{ conversation.unread > 99 ? '99+' : conversation.unread }}
            </Badge>
            <span
              v-else-if="
                props.presences?.[avatarUser(conversation)] === 'online'
              "
              class="bg-primary size-2 shrink-0 rounded-full"
              data-presence="online"
            ></span>
          </div>
        </div>
      </button>
    </div>
    <Empty v-else-if="!props.loading" class="border border-dashed">
      <EmptyHeader>
        <EmptyTitle>{{ props.emptyText ?? '还没有会话' }}</EmptyTitle>
        <EmptyDescription>
发起第一条消息后，这里就会出现会话。
</EmptyDescription>
      </EmptyHeader>
    </Empty>
    <p v-else class="py-6 text-center text-muted-foreground text-sm">加载中…</p>
  </div>
</template>
