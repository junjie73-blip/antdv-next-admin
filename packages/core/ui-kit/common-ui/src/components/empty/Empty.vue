<script setup lang="ts">
import { computed } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';
import {
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  Empty as ShadcnEmpty,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

import { useGlobalConfig } from '../config-provider';

defineOptions({ name: 'Empty' });

const props = withDefaults(
  defineProps<{
    description?: false | string;
    image?: false | string;
  }>(),
  {
    description: undefined,
    image: undefined,
  },
);

/**
 * 描述文案兜底到全局配置，而不是写死中文：`locale` 换英文后这里跟着变。
 * `false` 保留原意（这一行不要），所以只兜 `undefined`。
 */
const globalConfig = useGlobalConfig();
const description = computed(() => props.description ?? globalConfig.emptyText);
</script>

<template>
  <ShadcnEmpty data-common-empty :class="cn('gap-2 py-6')">
    <EmptyHeader>
      <EmptyMedia v-if="props.image !== false" variant="icon" class="mb-1">
        <img
          v-if="props.image"
          :src="props.image"
          alt=""
          class="size-10 object-contain"
        />
        <Icon v-else icon="carbon:document-blank" class="text-2xl opacity-60" />
      </EmptyMedia>
      <EmptyDescription v-if="description" class="text-sm opacity-70">
        <slot name="description">{{ description }}</slot>
      </EmptyDescription>
      <slot name="image"></slot>
    </EmptyHeader>
    <EmptyContent v-if="$slots.default">
      <slot></slot>
    </EmptyContent>
  </ShadcnEmpty>
</template>
