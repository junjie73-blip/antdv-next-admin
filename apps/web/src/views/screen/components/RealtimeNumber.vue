<script setup lang="ts">
import { cn } from '@antdv/shared/cn';
import { CountTo } from '~/components/business/CountTo';

defineOptions({ name: 'RealtimeNumber' });

const props = withDefaults(
  defineProps<{
    /** 数值 */
    value: number;
    /** 前缀 */
    prefix?: string;
    /** 后缀 */
    suffix?: string;
    /** 动画时长(ms) */
    duration?: number;
  }>(),
  {
    suffix: '',
    duration: 2000,
  },
);

const containerClassName = cn('flex items-baseline gap-1');
const valueClassName = cn('text-3xl leading-none font-black tabular-nums');
const suffixClassName = cn('text-sm text-blue-300/60');
</script>

<template>
  <div :class="containerClassName">
    <span v-if="prefix" class="mr-0.5 text-sm text-blue-300/50">{{
      prefix
    }}</span>
    <CountTo
      :end-val="value"
      :class="valueClassName"
      :duration="duration"
      :decimals="0"
      separator=","
    />
    <span :class="suffixClassName">{{ suffix }}</span>
  </div>
</template>
