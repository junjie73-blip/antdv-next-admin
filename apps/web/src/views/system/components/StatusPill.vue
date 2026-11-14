<script setup lang="ts">
import { computed } from 'vue';

import { Tag } from '@antdv/common-ui';
import { cn } from '@antdv/shared/utils/cn';

/**
 * 状态标签：把业务里的枚举值收敛到四种语义色。
 * 状态色只用于语义传达，不做视觉点缀（企业级 B 端规范）。
 */
defineOptions({ name: 'SystemStatusPill' });

const props = withDefaults(defineProps<{ label: string; tone?: Tone }>(), {
  tone: 'neutral',
});

type Tone = 'error' | 'info' | 'neutral' | 'success' | 'warning';

const COLOR: Record<Tone, string> = {
  error: 'red',
  info: 'blue',
  neutral: 'default',
  success: 'green',
  warning: 'orange',
};

const color = computed(() => COLOR[props.tone]);
const pillClassName = cn('inline-flex items-center whitespace-nowrap');
</script>

<template>
  <Tag :color="color" :class="pillClassName">{{ label }}</Tag>
</template>
