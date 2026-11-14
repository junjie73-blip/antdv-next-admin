<script setup lang="ts">
import { computed } from 'vue';

import { Card, Statistic } from '@antdv/common-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';

/**
 * 系统管理页共用的指标卡。
 *
 * 只认设计 token 的语义色（primary / success / warning / destructive / info），
 * 不写死灰阶，也不自己造一套色板 —— 深浅主题与 13 套预设都能直接跟着切。
 */
defineOptions({ name: 'SystemMetricCard' });

const props = withDefaults(
  defineProps<{
    hint?: string;
    icon?: string;
    suffix?: string;
    title: string;
    tone?: Tone;
    value: number | string;
  }>(),
  { hint: '', icon: 'carbon:chart-line-data', suffix: '', tone: 'primary' },
);

type Tone = 'destructive' | 'info' | 'primary' | 'success' | 'warning';

const TONE_CLASS: Record<Tone, string> = {
  destructive: 'text-destructive',
  info: 'text-info',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
};

const iconClassName = computed(() =>
  cn('mr-1 text-lg', TONE_CLASS[props.tone]),
);
const cardClassName = cn('shadow-sm');
const hintClassName = cn('text-muted-foreground mt-2 text-xs');
</script>

<template>
  <Card :class="cardClassName">
    <Statistic :title="title" :value="value" :suffix="suffix">
      <template #prefix>
        <Icon :icon="icon" :class="iconClassName" />
      </template>
    </Statistic>
    <p v-if="hint" :class="hintClassName">{{ hint }}</p>
  </Card>
</template>
