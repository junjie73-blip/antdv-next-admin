<script setup lang="ts">
import { computed } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';

import { useGlobalConfig } from '../config-provider';

const props = withDefaults(
  defineProps<{
    description?: string;
    icon?: string;
    title?: string;
  }>(),
  {
    description: '',
    icon: 'ant-design:inbox-outlined',
    title: undefined,
  },
);

/** 标题兜底到全局词条，切语言时这里跟着变 */
const globalConfig = useGlobalConfig();
const title = computed(() => props.title ?? globalConfig.emptyText);
</script>

<template>
  <div class="flex flex-col items-center justify-center px-6 py-16 text-center">
    <!-- 一律走语义 token：写死 gray-50/gray-900 的空状态在深色下是黑底黑字 -->
    <div
      class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-3xl text-muted-foreground"
    >
      <Icon :icon="icon" />
    </div>
    <p class="text-base font-medium text-foreground">{{ title }}</p>
    <p v-if="description" class="mt-1 text-sm text-muted-foreground">
      {{ description }}
    </p>
    <slot></slot>
  </div>
</template>
