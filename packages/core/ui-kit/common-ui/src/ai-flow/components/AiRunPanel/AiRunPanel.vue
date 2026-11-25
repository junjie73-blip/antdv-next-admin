<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import type {
  AiFlowDefinition,
  AiFlowEvent,
  AiNodeStatus,
  AiRunState,
  AiRunStatus,
} from '../../core/types';

import { computed, nextTick, ref, watch } from 'vue';

import {
  Badge,
  Button,
  Progress,
  Separator,
  Switch,
  Textarea,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

import { errorText } from '../../core/errors';

/**
 * 运行面板：一次 AI 编排运行的控制台。
 *
 * 分层位置：`components/AiRunPanel`，纯展示 + 三个动作 emit（跑 / 续 / 取消）。
 * 它**不调运行器**：所有状态都从 props 进来，动作以事件出去，
 * 所以同一个面板既能接 `useAiFlow`，也能被宿主拿去做「历史运行回放」。
 *
 * 三件必须在这儿做的事：
 * 1. 流式 token 实时追加 —— 用户等大模型时最缺的就是「还在动」的证据；
 * 2. `awaiting` 时把输入框摆出来，并把节点上的 `resumeLabel` 当提示语，
 *    否则挂起在界面上表现为「卡住」，人不知道该干什么；
 * 3. 用量与步数摆显眼 —— 一个画错的循环烧掉的 token 只有在这儿才看得见。
 *
 * 刻意不做的事：不发起请求、不拼提示词、不解释节点语义（哪些字段该显示属于 Inspector），
 * 也不做「自动滚动到底」以外的滚动策略。
 */
const props = defineProps<{
  class?: HTMLAttributes['class'];
  /** 用于把节点 id 翻成人类标题 */
  flow?: AiFlowDefinition;
  /** 出错时传入 `useAiFlow` 的 error；没有则不显示错误条 */
  error?: unknown;
  /** 事件流（含 chunk）；面板自己只从里面取 chunk 与 log */
  events?: AiFlowEvent[];
  running?: boolean;
  state?: AiRunState;
}>();

const emit = defineEmits<{
  cancel: [];
  resume: [value: unknown];
  run: [];
  select: [nodeId: string];
}>();

const STATUS_VARIANT: Record<
  AiRunStatus,
  'default' | 'destructive' | 'outline' | 'secondary'
> = {
  awaiting: 'secondary',
  canceled: 'outline',
  failed: 'destructive',
  running: 'default',
  succeeded: 'default',
};

const NODE_VARIANT: Record<
  AiNodeStatus,
  'default' | 'destructive' | 'outline' | 'secondary'
> = {
  awaiting: 'secondary',
  canceled: 'outline',
  failed: 'destructive',
  pending: 'outline',
  running: 'default',
  skipped: 'secondary',
  succeeded: 'default',
};

const STATUS_TEXT: Record<AiRunStatus, string> = {
  awaiting: '等待人工确认',
  canceled: '已取消',
  failed: '失败',
  running: '运行中',
  succeeded: '成功',
};

const labels = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {};
  for (const node of props.flow?.nodes ?? [])
    map[node.id] = node.label ?? node.id;
  return map;
});

const status = computed<AiRunStatus>(() => props.state?.status ?? 'running');

/**
 * 节点列表有两个来源：有 `flow` 时按图的声明顺序（还没跑的节点也列出来，设计态一眼能看全），
 * 只有 `state` 时（历史回放，宿主手里没留着图）退化成按运行态列。
 */
const rows = computed(() => {
  const state = props.state;
  if (!state) return [];
  const fromFlow = (props.flow?.nodes ?? []).map((node) => ({
    id: node.id,
    label: node.label ?? node.id,
    status: state.nodes[node.id]?.status ?? ('pending' as AiNodeStatus),
  }));
  if (fromFlow.length > 0) {
    return status.value === 'running'
      ? fromFlow.filter((row) => row.status !== 'pending')
      : fromFlow;
  }
  return Object.values(state.nodes).map((node) => ({
    id: node.id,
    label: node.label ?? labels.value[node.id] ?? node.id,
    status: node.status,
  }));
});

/** chunk 按节点归拢：多个并发节点同时流式时，混在一条文本里就分不出谁是谁了 */
const streamByNode = computed<Record<string, string>>(() => {
  const acc: Record<string, string> = {};
  for (const event of props.events ?? []) {
    if (event.kind !== 'node.chunk') continue;
    acc[event.nodeId] = (acc[event.nodeId] ?? '') + event.text;
  }
  return acc;
});

const progress = computed(() => {
  const state = props.state;
  if (!state || (props.flow?.nodes.length ?? 0) === 0) return 0;
  const done = Object.values(state.nodes).filter(
    (node) =>
      node.status === 'succeeded' ||
      node.status === 'skipped' ||
      node.status === 'failed',
  ).length;
  return Math.round((done / (props.flow?.nodes.length ?? 1)) * 100);
});

const awaiting = computed(() => props.state?.awaiting);

/**
 * 面板有没有「这一次运行」可说。
 *
 * `status` 在没有 state 时兜底成 `running`（运行中的一切 UI 都靠它），但那是**语义占位**，
 * 不是给眼睛看的：页面刚打开、一次都没跑过时，徽标写着「运行中」是最容易被误读的假信号。
 * 所以这一层单独判，宁可显示「未运行」。
 */
const hasRun = computed(() => props.state !== undefined);

const resumeText = ref('');
/**
 * 解析方式是面板自己的状态，不做成 prop：要不要按 JSON 解读是「这一次输入」的属性，
 * 宿主预先配置反而怪。缺省按纯字符串交给 `resume` —— 人在确认框里打的多半是「同意」。
 */
const parseJson = ref(false);
const logViewport = ref<HTMLElement>();

watch(
  () => props.events?.length ?? 0,
  async () => {
    await nextTick();
    const el = logViewport.value;
    if (el) el.scrollTop = el.scrollHeight;
  },
);

function submitResume(): void {
  const raw = resumeText.value.trim();
  resumeText.value = '';
  if (!parseJson.value) {
    emit('resume', raw);
    return;
  }
  try {
    emit('resume', JSON.parse(raw));
  } catch {
    // 人在确认框里打的多半是「同意」而不是 JSON：解析失败就原样交出去，而不是报错卡住
    emit('resume', raw);
  }
}

const errorTextOf = computed(() =>
  props.error === undefined ? '' : errorText(props.error),
);
</script>

<template>
  <div
    :class="
      cn(
        'flex w-full flex-col gap-3 rounded-md border bg-card p-4',
        props.class,
      )
    "
    data-slot="ai-run-panel"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <Badge v-if="!hasRun" data-slot="ai-run-panel-status" variant="outline">
          未运行
        </Badge>
        <Badge
          v-else
          data-slot="ai-run-panel-status"
          :variant="STATUS_VARIANT[status]"
        >
          {{ STATUS_TEXT[status] }}
        </Badge>
        <span class="font-mono text-muted-foreground text-xs">{{
          state?.id ?? '-'
        }}</span>
      </div>
      <div class="flex items-center gap-2">
        <Button
          :disabled="running"
          data-action="run"
          size="sm"
          variant="outline"
          @click="emit('run')"
        >
          运行
        </Button>
        <Button
          :disabled="!running"
          data-action="cancel"
          size="sm"
          variant="outline"
          @click="emit('cancel')"
        >
          取消
        </Button>
      </div>
    </div>

    <Progress :model-value="progress" class="h-1.5" />

    <div
      class="flex flex-wrap gap-3 text-muted-foreground text-xs"
      data-slot="ai-run-panel-usage"
    >
      <span>入参 token {{ state?.usage.prompt ?? 0 }}</span>
      <span>出参 token {{ state?.usage.completion ?? 0 }}</span>
      <span>合计 {{ state?.usage.total ?? 0 }}</span>
      <span>波次 {{ state?.steps ?? 0 }}</span>
    </div>

    <p
      v-if="errorTextOf"
      class="break-all rounded-md border-destructive bg-destructive/10 p-2 text-destructive text-xs"
      data-slot="ai-run-panel-error"
    >
      {{ errorTextOf }}
    </p>

    <ul class="flex flex-col gap-1" data-slot="ai-run-panel-nodes">
      <li v-for="row in rows" :key="row.id">
        <Button
          variant="ghost"
          class="flex h-auto w-full items-center justify-between gap-2 px-1 py-0.5 text-left"
          type="button"
          @click="emit('select', row.id)"
        >
          <span class="truncate text-sm">{{ row.label }}</span>
          <Badge :variant="NODE_VARIANT[row.status]">{{ row.status }}</Badge>
        </Button>
        <p
          v-if="streamByNode[row.id]"
          class="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 font-mono text-xs"
          data-slot="ai-run-panel-stream"
        >
          {{ streamByNode[row.id] }}
        </p>
      </li>
      <li v-if="rows.length === 0" class="text-muted-foreground text-sm">
        还没有节点执行过。
      </li>
    </ul>

    <div
      v-if="awaiting"
      class="flex flex-col gap-2 rounded-md border border-warning bg-warning/10 p-3"
      data-slot="ai-run-panel-awaiting"
    >
      <p class="text-sm">
        {{ awaiting.resumeLabel ?? '需要人工确认后才能继续' }}
      </p>
      <p class="font-mono text-muted-foreground text-xs">
        {{ labels[awaiting.nodeId] ?? awaiting.nodeId }}
      </p>
      <Textarea v-model="resumeText" :rows="2" data-field="resume-input" />
      <div class="flex items-center justify-between gap-2">
        <label class="flex items-center gap-2 text-muted-foreground text-xs">
          <Switch v-model="parseJson" />
          按 JSON 解析
        </label>
        <Button data-action="resume" size="sm" @click="submitResume">
          提交并继续
        </Button>
      </div>
    </div>

    <Separator />

    <div
      ref="logViewport"
      class="max-h-48 overflow-auto rounded-md bg-muted p-2 font-mono text-xs"
      data-slot="ai-run-panel-logs"
    >
      <p v-for="(log, index) in state?.logs ?? []" :key="`${log.at}-${index}`">
        <span class="opacity-60">{{ log.level }}</span> {{ log.message }}
      </p>
      <p v-if="(state?.logs ?? []).length === 0" class="opacity-60">
        暂无日志。
      </p>
    </div>

    <div
      v-if="state?.output !== undefined"
      class="flex flex-col gap-1"
      data-slot="ai-run-panel-output"
    >
      <span class="text-muted-foreground text-xs">最终输出</span>
      <pre class="max-h-48 overflow-auto whitespace-pre-wrap text-xs">{{
        state?.output
      }}</pre>
    </div>
  </div>
</template>
