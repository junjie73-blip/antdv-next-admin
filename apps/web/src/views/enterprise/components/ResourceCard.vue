<script setup lang="ts">
import { Card, Tag } from '@antdv/common-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';

/**
 * 企业能力页共用的资源卡片（流程定义 / Agent / 模型 / 知识库 / 图表组件）。
 *
 * 结构对齐参考实现的卡片墙：图标 + 标题 + 状态标签 + 描述 + 标签 + 指标行 + 底部操作区。
 * 操作区留给插槽，卡片本身不猜业务动作，保持可复用。
 */
defineOptions({ name: 'EnterpriseResourceCard' });

/** 标题区点击：宿主可用来打开详情页；底部操作区不冒泡，互不干扰 */
defineEmits<{ open: [] }>();

withDefaults(
  defineProps<{
    description?: string;
    eyebrow?: string;
    icon?: string;
    metrics?: Array<{ label: string; value: string }>;
    statusLabel?: string;
    statusTone?: 'error' | 'info' | 'neutral' | 'success' | 'warning';
    tags?: string[];
    title: string;
  }>(),
  {
    description: '',
    eyebrow: '',
    icon: 'carbon:cube',
    metrics: () => [],
    statusLabel: '',
    statusTone: 'neutral',
    tags: () => [],
  },
);

const STATUS_COLOR: Record<string, string> = {
  error: 'red',
  info: 'blue',
  neutral: 'default',
  success: 'green',
  warning: 'orange',
};

const cardClassName = cn('hover:border-primary/50 shadow-sm transition-colors');
const headerClassName = cn('flex items-start justify-between gap-2');
const titleRowClassName = cn('flex items-center gap-2');
const iconClassName = cn('text-primary text-lg');
const titleClassName = cn('text-foreground truncate text-sm font-medium');
const eyebrowClassName = cn('text-muted-foreground mt-1 text-xs');
const descClassName = cn(
  'text-muted-foreground mt-3 line-clamp-2 min-h-10 text-xs/5 ',
);
const tagsClassName = cn('mt-3 flex flex-wrap gap-1');
const metricsClassName = cn(
  'border-border mt-3 grid grid-cols-3 gap-2 border-t pt-3',
);
const metricLabelClassName = cn('text-muted-foreground block truncate text-xs');
const metricValueClassName = cn(
  'text-foreground mt-0.5 block truncate text-sm font-medium tabular-nums',
);
const footerClassName = cn(
  'border-border mt-3 flex items-center justify-between gap-2 border-t pt-3',
);
</script>

<template>
  <Card :class="cardClassName">
    <div :class="[headerClassName, 'cursor-pointer']" @click="$emit('open')">
      <div class="min-w-0 flex-1">
        <div :class="titleRowClassName">
          <Icon :icon="icon" :class="iconClassName" />
          <span :class="titleClassName" :title="title">{{ title }}</span>
        </div>
        <p v-if="eyebrow" :class="eyebrowClassName">{{ eyebrow }}</p>
      </div>
      <Tag v-if="statusLabel" :color="STATUS_COLOR[statusTone]">
        {{ statusLabel }}
      </Tag>
    </div>

    <p v-if="description" :class="descClassName" :title="description">
      {{ description }}
    </p>

    <div v-if="tags.length > 0" :class="tagsClassName">
      <Tag v-for="tag in tags" :key="tag" color="blue">{{ tag }}</Tag>
    </div>

    <div v-if="metrics.length > 0" :class="metricsClassName">
      <div v-for="metric in metrics" :key="metric.label" class="min-w-0">
        <span :class="metricLabelClassName" :title="metric.label">{{
          metric.label
        }}</span>
        <span :class="metricValueClassName" :title="metric.value">{{
          metric.value
        }}</span>
      </div>
    </div>

    <div :class="footerClassName">
      <slot name="meta"></slot>
      <div class="flex shrink-0 items-center gap-1">
        <slot name="actions"></slot>
      </div>
    </div>
  </Card>
</template>
