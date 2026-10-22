<script setup lang="ts">
import type { PageHeaderProps } from './types';

import { IconifyIcon as Icon } from '@antdv/icons/icon';

defineOptions({ name: 'PageHeader' });

const props = withDefaults(defineProps<PageHeaderProps>(), {
  description: '',
  icon: '',
  title: '',
});
</script>

<template>
  <!--
    页头：标题 + 说明 + 右侧操作区。

    两条刻意的设计：
    1. **自己不带外边距与内边距**。路由页根容器的内边距归布局管（见
       `views/__tests__/page-root-padding.spec.ts`），页与页之间的竖向节奏靠根容器上的
       `space-y-*`；这里再加一份 `mb-*` 就会和 `space-y` 叠成两种间距。
    2. **操作区在窄屏折到下一行而不是挤压标题**。后台页头右侧通常是 2-4 颗按钮，
       标题被挤成三行的页面看起来就不像成品。
  -->
  <header
    class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3"
    data-page="header"
  >
    <div class="flex min-w-0 flex-1 items-center gap-3">
      <span
        v-if="props.icon"
        class="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl"
        data-page="header-icon"
      >
        <Icon :icon="props.icon" class="size-5" />
      </span>
      <div class="min-w-0">
        <h1
          class="text-foreground truncate text-xl leading-tight font-semibold tracking-tight sm:text-2xl"
          data-page="header-title"
        >
          <slot name="title">{{ props.title }}</slot>
        </h1>
        <p
          v-if="props.description || $slots.description"
          class="text-muted-foreground mt-1 truncate text-sm"
          data-page="header-desc"
        >
          <slot name="description">{{ props.description }}</slot>
        </p>
      </div>
    </div>

    <div
      v-if="$slots.extra"
      class="flex shrink-0 flex-wrap items-center gap-2"
      data-page="header-extra"
    >
      <slot name="extra"></slot>
    </div>
  </header>
</template>
