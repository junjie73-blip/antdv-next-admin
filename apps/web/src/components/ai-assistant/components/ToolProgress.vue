<script setup lang="ts">
/** 工具执行过程：状态标签常显，明细用 shadcn-vue Collapsible 折叠 */
import type { ToolComponentProps } from 'vue-llm';

import { computed, ref } from 'vue';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';

defineOptions({ name: 'CopilotToolProgress' });

const props = defineProps<ToolComponentProps & { class?: string }>();

const open = ref(false);

const STATUS: Record<string, { icon: string; label: string; tone: string }> = {
  error: { icon: 'carbon:error', label: '失败', tone: 'text-destructive' },
  pending: { icon: 'carbon:time', label: '待确认', tone: 'text-warning' },
  result: { icon: 'carbon:checkmark', label: '完成', tone: 'text-success' },
  running: { icon: 'carbon:progress-bar-round', label: '执行中', tone: 'text-primary' },
  streaming: { icon: 'carbon:progress-bar-round', label: '准备中', tone: 'text-primary' },
};

const status = computed(() => STATUS[props.state] ?? STATUS.running!);
const steps = computed(() => {
  const label: Record<string, string> = {
    confirm_action: '核对影响范围',
    fill_form_fields: '读取上下文并推断字段',
    generate_form: '生成表单 Schema',
    navigate_to: '定位目标页面',
    search_table: '读取当前页数据 → 发现匹配项 → 生成筛选视图',
  };
  return (label[props.toolName] ?? '执行工具').split(' → ');
});

const json = (value: unknown) => {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value);
  }
};
</script>

<template>
  <Collapsible v-model:open="open" :class="cn('w-full rounded-lg border bg-card/80 text-sm', props.class)">
    <CollapsibleTrigger
      class="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50"
      :aria-label="`${toolName} 执行详情`"
    >
      <Icon icon="carbon:tools" class="size-3.5 shrink-0 text-muted-foreground" />
      <span class="font-mono text-xs text-foreground">{{ toolName }}</span>
      <span :class="cn('ml-auto inline-flex items-center gap-1 text-xs', status.tone)">
        <Icon
          :icon="state === 'running' || state === 'streaming' ? 'carbon:progress-bar-round' : status.icon"
          :class="state === 'running' || state === 'streaming' ? 'animate-spin' : ''"
          class="size-3.5"
        />
        {{ status.label }}
      </span>
      <Icon
        icon="carbon:chevron-down"
        :class="cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')"
      />
    </CollapsibleTrigger>

    <CollapsibleContent class="space-y-2 border-t border-border px-3 py-2">
      <ol class="space-y-1">
        <li
          v-for="(step, index) in steps"
          :key="step"
          class="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <span
            :class="cn(
              'flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px]',
              index === 0 ? 'border-primary bg-primary/10 text-primary' : 'border-border',
            )"
          >{{ index + 1 }}</span>
          {{ step }}
        </li>
      </ol>
      <pre class="max-h-28 overflow-auto rounded-md bg-muted/60 p-2 text-[11px] leading-relaxed">{{ json(args) }}</pre>
      <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
    </CollapsibleContent>
  </Collapsible>
</template>
