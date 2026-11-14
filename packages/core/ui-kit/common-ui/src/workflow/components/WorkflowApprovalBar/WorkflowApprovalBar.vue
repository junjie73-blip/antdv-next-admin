<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import type { WorkflowActionName } from '../../core/types';

import { computed, ref } from 'vue';

import { Button, Input, Separator, Textarea } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

import { ACTION_LABELS } from '../../utils/labels';

/**
 * 办理条：意见 + 动作按钮。
 *
 * 三条约定，决定了它为什么长这样：
 * 1. **只发事件，不调引擎。** 动作落地由页面用 `useWorkflow` 完成，
 *    这样同一个条可以复用在"我的待办"抽屉里，也可以复用在详情页底部，互不牵连。
 * 2. **动作集合由 props 决定。** 按钮的可用性归服务端/引擎判（`node.data.actions`），
 *    组件不做二次猜测，避免出现"点了才报无权"的体验。
 * 3. **选人控件走具名插槽。** 组织架构选择器是宿主的东西（`~/api` + `~/stores`），
 *    子包不许 import；这里留 `#user-picker` 插槽，宿主塞自己的组件进来，
 *    没塞时退化成输入框（演示与单测够用）。
 */
const props = withDefaults(
  defineProps<{
    actions?: WorkflowActionName[];
    class?: HTMLAttributes['class'];
    commentPlaceholder?: string;
    /** 需要填写意见的动作；驳回默认必填，防止"无理由驳回"无法追溯 */
    requiredComment?: WorkflowActionName[];
    loading?: boolean;
    /** 按钮文案覆盖，宿主接自己的词条时传 */
    labels?: Partial<Record<WorkflowActionName, string>>;
  }>(),
  {
    actions: () => ['approve', 'reject', 'transfer', 'addSign', 'withdraw'],
    class: undefined,
    commentPlaceholder: undefined,
    labels: undefined,
    loading: false,
    requiredComment: () => ['reject'],
  },
);

const emit = defineEmits<{
  (
    event: 'action',
    payload: { action: WorkflowActionName; comment: string; users: string[] },
  ): void;
}>();

const comment = ref('');
const users = ref('');

const active = computed(() => props.actions ?? []);

function labelFor(action: WorkflowActionName): string {
  return props.labels?.[action] ?? ACTION_LABELS[action];
}

function variantFor(
  action: WorkflowActionName,
): 'default' | 'destructive' | 'outline' | 'secondary' {
  if (action === 'reject') return 'destructive';
  if (action === 'approve') return 'default';
  return 'outline';
}

const missingComment = computed(() =>
  props.requiredComment && props.requiredComment.length > 0
    ? props.requiredComment
    : ['reject'],
);

/** 必填意见没填时按钮直接不可用：组件里发"假事件"让页面去判空，是最难测的一种约定 */
function isDisabled(action: WorkflowActionName): boolean {
  if (props.loading) return true;
  if (action === 'transfer' || action === 'addSign') {
    return usersFromInput().length === 0;
  }
  return missingComment.value.includes(action) && comment.value.trim() === '';
}

function usersFromInput(): string[] {
  return users.value
    .split(/[,，\s]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function fire(action: WorkflowActionName) {
  emit('action', {
    action,
    comment: comment.value.trim(),
    users: usersFromInput(),
  });
  comment.value = '';
  users.value = '';
}

defineExpose({ comment, users });
</script>

<template>
  <div
    :class="cn('flex w-full flex-col gap-3', props.class)"
    data-slot="workflow-approval-bar"
  >
    <slot name="extra"></slot>
    <Textarea
      v-model="comment"
      :placeholder="props.commentPlaceholder ?? '审批意见'"
      :rows="2"
      data-slot="workflow-approval-comment"
      class="resize-y"
    />
    <slot name="user-picker" :users="users">
      <Input
        v-model="users"
        placeholder="转办/加签对象，多个用逗号分隔"
        data-slot="workflow-approval-users"
      />
    </slot>
    <Separator />
    <div class="flex flex-wrap items-center gap-2">
      <Button
        v-for="action in active"
        :key="action"
        :variant="variantFor(action)"
        :disabled="isDisabled(action)"
        :data-action="action"
        @click="fire(action)"
      >
        {{ labelFor(action) }}
      </Button>
    </div>
  </div>
</template>
