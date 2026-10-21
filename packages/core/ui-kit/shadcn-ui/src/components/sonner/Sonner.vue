<script lang="ts" setup>
import type { CSSProperties } from 'vue';
import type { ToasterProps } from 'vue-sonner';

import { Toaster as Sonner } from 'vue-sonner';

import { cn } from '@antdv/shared/utils/cn';
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from '@lucide/vue';

const props = defineProps<ToasterProps>();

/**
 * sonner 的样式契约：它只认 CSS 变量，不认 Tailwind 工具类。
 *
 * 层级不用在这里操心：vue-sonner 自己给 `[data-sonner-toaster]` 钉了
 * `z-index: 999999999`（本仓库最大的实值是 9999 的路由进度条与锁屏），
 * 而每条 toast 的 `--z-index` 由 sonner 写成 `toasts.length - index`，
 * 在父级上设 `--z-index` 会被那条内联值直接盖掉 —— 所以不要在这里加，
 * 加了自己看着"层级提高了"，实际一个像素都没变（e2e 里按实值断言兜住）。
 *
 * 四种类型的规范色走 `--{type}-{bg,border,text}` 这一组，它们**只在
 * `[data-rich-colors='true']` 下被消费**，所以模板里 `rich-colors` 必须固定打开
 * （要排在 `v-bind` 之后才压得过 props 的默认 false）。不开富色时 sonner 只画图标、
 * 底色一律 `--normal-bg`，四种类型就是一模一样的白块。
 *
 * 底色一律从 `--popover` 派生而非钉死实色：弹层 portal 到 body，落在
 * `.dark` / `[data-theme]` 的作用域里，换明暗换主题都自动跟上。
 */
const toasterVars = {
  '--normal-bg': 'hsl(var(--popover))',
  '--normal-text': 'hsl(var(--popover-foreground))',
  '--normal-border': 'hsl(var(--border))',
  '--border-radius': 'var(--radius)',

  '--success-bg':
    'color-mix(in oklab, hsl(var(--success)) 12%, hsl(var(--popover)))',
  '--success-border':
    'color-mix(in oklab, hsl(var(--success)) 35%, hsl(var(--popover)))',
  '--success-text': 'hsl(var(--success))',

  '--info-bg': 'color-mix(in oklab, hsl(var(--info)) 12%, hsl(var(--popover)))',
  '--info-border':
    'color-mix(in oklab, hsl(var(--info)) 35%, hsl(var(--popover)))',
  '--info-text': 'hsl(var(--info))',

  '--warning-bg':
    'color-mix(in oklab, hsl(var(--warning)) 16%, hsl(var(--popover)))',
  '--warning-border':
    'color-mix(in oklab, hsl(var(--warning)) 40%, hsl(var(--popover)))',
  '--warning-text': 'hsl(var(--warning))',

  '--error-bg':
    'color-mix(in oklab, hsl(var(--destructive)) 12%, hsl(var(--popover)))',
  '--error-border':
    'color-mix(in oklab, hsl(var(--destructive)) 35%, hsl(var(--popover)))',
  '--error-text': 'hsl(var(--destructive))',
} satisfies CSSProperties;
</script>

<template>
  <Sonner
    v-bind="props"
    :class="cn('toaster group', props.class)"
    :style="{ ...toasterVars, ...(props.style ?? {}) }"
    rich-colors
  >
    <template #success-icon>
      <CircleCheckIcon class="size-4" />
    </template>
    <template #info-icon>
      <InfoIcon class="size-4" />
    </template>
    <template #warning-icon>
      <TriangleAlertIcon class="size-4" />
    </template>
    <template #error-icon>
      <OctagonXIcon class="size-4" />
    </template>
    <template #loading-icon>
      <div>
        <Loader2Icon class="size-4 animate-spin" />
      </div>
    </template>
    <template #close-icon>
      <XIcon class="size-4" />
    </template>
  </Sonner>
</template>
