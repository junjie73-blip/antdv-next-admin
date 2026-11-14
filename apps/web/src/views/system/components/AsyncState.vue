<script setup lang="ts">
import { Alert } from '@antdv/common-ui';
import { Button, Spinner } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';

/**
 * 异步区块的三态外壳：加载 / 错误 / 空，成功时渲染默认插槽。
 *
 * 页面不再各写一份 `v-if="loading"`：加载态、错误可重试、空态文案与成功态
 * 统一在这里闭环；父级只需给出 `loading / error / empty` 三个布尔事实。
 */
defineOptions({ name: 'SystemAsyncState' });

withDefaults(
  defineProps<{
    empty?: boolean;
    emptyText?: string;
    error?: string;
    loading?: boolean;
  }>(),
  { empty: false, emptyText: '暂无数据', error: '', loading: false },
);

const emit = defineEmits<{ retry: [] }>();

const stateClassName = cn(
  'flex min-h-40 flex-col items-center justify-center gap-3',
);
const hintClassName = cn('text-muted-foreground text-sm');
const emptyIconClassName = cn('text-muted-foreground size-8');
</script>

<template>
  <div v-if="loading" :class="stateClassName" role="status" aria-live="polite">
    <Spinner class="size-6 text-primary" />
    <span :class="hintClassName">正在加载数据…</span>
  </div>

  <div v-else-if="error" :class="stateClassName">
    <Alert type="error" show-icon :message="`数据加载失败：${error}`" />
    <Button variant="outline" size="sm" @click="emit('retry')">重新加载</Button>
  </div>

  <div v-else-if="empty" :class="stateClassName">
    <slot name="empty">
      <Icon icon="carbon:data-view" :class="emptyIconClassName" />
      <span :class="hintClassName">{{ emptyText }}</span>
    </slot>
  </div>

  <slot v-else></slot>
</template>
