<script setup lang="ts">
import { IconifyIcon as Icon } from '@antdv/icons/icon';
import {
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  Empty as ShadcnEmpty,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

defineOptions({ name: 'Empty' });

const props = withDefaults(
  defineProps<{
    description?: false | string;
    image?: false | string;
  }>(),
  {
    description: '暂无数据',
    image: undefined,
  },
);
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
      <EmptyDescription v-if="props.description" class="text-sm opacity-70">
        <slot name="description">{{ props.description }}</slot>
      </EmptyDescription>
      <slot name="image"></slot>
    </EmptyHeader>
    <EmptyContent v-if="$slots.default">
      <slot></slot>
    </EmptyContent>
  </ShadcnEmpty>
</template>
