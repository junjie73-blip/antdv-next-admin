<script setup lang="ts">
import type { ModalWrapperProps } from '../types';

import { computed } from 'vue';

import { ScrollArea } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

const props = withDefaults(defineProps<ModalWrapperProps>(), {
  footerOffset: 0,
  useWrapper: true,
});

/**
 * 高度策略：
 * - 显式传了 `height`：固定高度；
 * - 否则不再用 `windowHeight - 200` 这种拍脑袋的像素估值 —— 外层 BasicModal 的
 *   DialogContent 已改成 `flex flex-col + max-h-[90vh]`，这里只负责"填满头部与底部
 *   之间的剩余空间（`flex-1 min-h-0`）"并由内部 ScrollArea 精确滚动。
 *
 * 关键：滚动必须发生在 reka 的 viewport 上，不能挂在外层 root。之前把
 * `overflow-auto` 写在 `<ScrollArea>` 的根节点上，结果是 root 自己滚、
 * viewport 永远 `scrollHeight === clientHeight`：自绘滚动条不出现、长表单看着
 * 像被截断、滚轮也只在半个容器里生效。现在外层只负责定高 + `overflow-hidden`，
 * 内层 `h-full` 的 ScrollArea 拿到确定高度，viewport 成为唯一的滚动盒。
 */
const wrapperStyle = computed(() => {
  if (!props.useWrapper) return {};
  if (props.height) {
    return { height: `${props.height}px` };
  }
  return {
    flex: '1 1 auto',
    minHeight: props.minHeight ? `${props.minHeight}px` : '200px',
  };
});

const bodyStyle = computed(() => ({ ...props.bodyStyle }));
</script>

<template>
  <div
    :class="cn('modal-wrapper relative flex min-h-0 flex-col')"
    :style="wrapperStyle"
  >
    <div
      v-if="loading"
      :class="
        cn(
          'modal-loading-mask',
          'absolute inset-0 z-10 flex items-center justify-center',
          'bg-background/80 supports-[backdrop-filter]:bg-background/60 backdrop-blur-sm',
        )
      "
    >
      <div :class="cn('flex flex-col items-center gap-2')">
        <div
          :class="
            cn(
              'text-primary animate-spin border-2 border-t-transparent h-8 w-8 rounded-full border-current/20',
            )
          "
        ></div>
        <span v-if="loadingTip" :class="cn('text-muted-foreground text-sm')">{{
          loadingTip
        }}</span>
      </div>
    </div>

    <div
      :class="
        cn(
          'modal-body relative flex min-h-0 flex-1 flex-col',
          // 溢出交给内层 viewport；未定高（useWrapper=false）时退回整块滚动
          props.useWrapper ? 'overflow-hidden!' : 'overflow-y-auto',
        )
      "
    >
      <!--
        高度链用 flex 撑，不用百分比：
        - 弹窗要"跟着内容长、最多 90vh"，所以内容必须留在正常流里；用 absolute
          定位层会让它脱离文档流，容器只剩 minHeight，弹窗反而塌陷成一小条。
        - reka 的 viewport 默认 `size-full`（height:100%），父级高度来自 flex 时
          百分比会退化成 auto，viewport 被内容撑高、外层 overflow-hidden 直接裁掉。
          这里用 viewportStyle 把它改成 `flex: 1 1 auto; min-height: 0; height: auto`，
          让它成为 flex 链上唯一可收缩、可滚动的节点；ScrollArea 根节点同样 flex-1。
        - 自绘滚动条设 `type=auto`，只在内容溢出时出现。
      -->
      <ScrollArea
        v-if="props.useWrapper"
        class="flex min-h-0 flex-1 flex-col"
        :style="bodyStyle"
        :viewport-style="{ height: 'auto', flex: '1 1 auto', minHeight: 0 }"
        type="auto"
        scrollbar-class="p-0 data-[orientation=vertical]:w-1.5 data-[orientation=horizontal]:h-1.5"
        thumb-class="bg-muted-foreground/60 hover:bg-muted-foreground/80 transition-colors"
      >
        <div class="p-6">
          <slot></slot>
        </div>
      </ScrollArea>
      <!-- 调用方自带滚动（useWrapper=false）：这层不接管高度，内容自然撑开 -->
      <div v-else :style="bodyStyle" class="p-6">
        <slot></slot>
      </div>
    </div>
  </div>
</template>
