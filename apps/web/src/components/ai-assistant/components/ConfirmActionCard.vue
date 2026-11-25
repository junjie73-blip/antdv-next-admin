<script setup lang="ts">
/** Human-in-the-loop：危险操作必须人工确认，默认取消 */
import type { ToolComponentProps } from 'vue-llm';

import { ref } from 'vue';

import { Button } from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';

defineOptions({ name: 'CopilotConfirmAction' });

const props =
  defineProps<
    ToolComponentProps<{ title: string; impact: string; risks?: string[] }>
  >();

const decided = ref<'cancelled' | 'confirmed' | null>(null);

function cancel() {
  decided.value = 'cancelled';
  props.addResult({ cancelled: true, reason: '用户取消' } as never);
}

/** 通用 HITL：只记录用户决策，不代业务系统执行写操作 */
function confirm() {
  decided.value = 'confirmed';
  props.addResult({
    confirmed: true,
    note: '已确认；请到对应业务页面执行操作',
  } as never);
}
</script>

<template>
  <div class="w-full rounded-xl border border-warning/40 bg-warning/5 p-3">
    <div class="flex items-start gap-2">
      <Icon icon="carbon:warning" class="mt-0.5 size-4 shrink-0 text-warning" />
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold text-foreground">
          {{ args?.title ?? '危险操作确认' }}
        </p>
        <p class="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {{ args?.impact ?? '该操作会影响线上数据，请确认影响范围。' }}
        </p>
        <ul v-if="args?.risks?.length" class="mt-2 space-y-1">
          <li
            v-for="risk in args.risks"
            :key="risk"
            class="flex items-start gap-1.5 text-[11px] text-warning"
          >
            <Icon icon="carbon:warning-alt" class="mt-0.5 size-3 shrink-0" />
            {{ risk }}
          </li>
        </ul>
      </div>
    </div>

    <div v-if="!decided" class="mt-3 flex items-center justify-end gap-2">
      <Button variant="ghost" size="sm" class="h-7 text-xs" @click="cancel">
        取消
      </Button>
      <Button
        variant="destructive"
        size="sm"
        class="h-7 text-xs"
        @click="confirm"
      >
        我已确认
      </Button>
    </div>
    <p v-else class="mt-2 text-[11px] text-muted-foreground">
      {{
        decided === 'confirmed'
          ? '已记录确认，请到业务页面执行操作。'
          : '已取消，未产生任何写操作。'
      }}
    </p>
  </div>
</template>
