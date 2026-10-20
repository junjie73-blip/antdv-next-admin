<script lang="ts" setup>
// CSS 副作用导入的类型声明只能引用、不能复制：下游按源码消费本包时看不到 common-ui 的 tsconfig include。
// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="../../types/css.d.ts" />
import type { CSSProperties } from 'vue';
import type { ToasterProps } from 'vue-sonner';

import { computed } from 'vue';
import { Toaster as SonnerToaster } from 'vue-sonner';
import 'vue-sonner/style.css';

import { cn } from '@antdv/shared/utils/cn';
import { CheckIcon, Loader2Icon, XIcon } from '@lucide/vue';

/**
 * 主题化的 toast 容器：props / 事件 / 插槽与 vue-sonner 的 `Toaster` 完全同形，
 * 只在外壳上覆写一层样式，任何 `ToasterProps` 都能原样透传，宿主不必知道这层存在。
 *
 * 为什么不直接给 `@antdv/shadcn-ui` 的 `Toaster` 加 CSS 覆盖：
 * 那只组件把 `rich-colors` 写死在 `v-bind` 之后（外部传不进来），四枚状态图标也是
 * 写死的 `<template #xxx-icon>`（外部传不进去，SFC 不转发插槽）。要在不改它源码的
 * 前提下换掉这两样，只能用选择器去赌它内部用了哪几个 lucide 图标 —— 子包一升级
 * 就失效。所以样式层自建：底座仍然直接用 vue-sonner，与 shadcn-ui 的组件清单解耦，
 * 那边新增/删除/迭代任何组件都不会波及这里。
 */
const props = defineProps<ToasterProps>();

/**
 * sonner 的样式契约：底色/边框/正文只认 `--normal-*` 这组 CSS 变量，不认 Tailwind 工具类。
 *
 * 层级不用在这里操心：vue-sonner 自己给 `[data-sonner-toaster]` 钉了
 * `z-index: 999999999`（本仓库最大的实值是 9999 的路由进度条与锁屏），
 * 而每条 toast 的 `--z-index` 由 sonner 写成 `toasts.length - index`，
 * 在父级上设 `--z-index` 会被那条内联值直接盖掉 —— 所以不要在这里加，
 * 加了自己看着"层级提高了"，实际一个像素都没变（e2e 里按实值断言兜住）。
 *
 * 底色一律 `--app-popover`，四种类型共用，**不做富色**：`rich-colors` 一旦打开，
 * sonner 就用 `[data-rich-colors='true'][data-type='xxx']` 把整块底色换成
 * `--{type}-bg`，并顺带把 `[data-description]` 的颜色改成 `inherit`（描述跟着变彩）。
 * 轻提示与通知的正文是给用户读的，底色染成琥珀/红色会让文字对比度掉下去，
 * 状态只体现在左侧那枚实色圆徽上（见下面的四个状态插槽）。
 *
 * 底色从 token 派生而非钉死实色：弹层 portal 到 body，落在 `.dark` / `[data-theme]`
 * 的作用域里，换明暗换主题都自动跟上。
 */
const toasterVars = {
  '--normal-bg': 'var(--app-popover)',
  '--normal-text': 'var(--app-popover-foreground)',
  '--normal-border': 'var(--app-border)',
  '--border-radius': 'var(--app-border-radius)',
} satisfies CSSProperties;

/**
 * 各部件的微调用 `toastOptions.classes`（sonner 把它拼到对应 `[data-*]` 元素上）。
 *
 * 全部带 `!`：sonner 的内置规则是 `[data-sonner-toast][data-styled='true'] [data-icon]`
 * 这类三选择器特异度，且写在包内 CSS 里，不带 important 的工具类压不住。
 * `icon` 那档要把 16px 的方框放大到 20px，圆徽才有实色底可铺；
 * `description` 和 `closeButton` 走中性灰，正文与标题保持 `--app-popover-foreground`。
 */
const toasterClasses = {
  icon: 'size-5!',
  description: 'mt-0.5 text-muted-foreground!',
  closeButton:
    'border-0! bg-transparent! text-muted-foreground! hover:bg-accent! hover:text-foreground!',
} satisfies NonNullable<ToasterProps['toastOptions']>['classes'];

/**
 * 宿主给的 `toast-options` 与默认样式逐档合并，且**宿主优先**：
 * 整体替换会让传 `{ duration: 1000 }` 这种单档配置顺手把我们的配色全丢掉。
 */
const toastOptions = computed<ToasterProps['toastOptions']>(() => ({
  ...props.toastOptions,
  classes: { ...toasterClasses, ...props.toastOptions?.classes },
}));

const toasterStyle = computed<CSSProperties>(
  () => ({ ...toasterVars, ...(props.style ?? {}) }) as CSSProperties,
);
</script>

<template>
  <SonnerToaster
    v-bind="props"
    :class="cn('antdv-toaster', props.class)"
    :style="toasterStyle"
    :toast-options="toastOptions"
  >
    <!--
      状态徽标：实色圆底 + 反白笔画，色板取 `--app-{success,warning,info,destructive}`
      （这四个是刻意与主题预设解耦的语义色，换主色也不跟着变）。
      勾与叉用 @lucide/vue 现成图标；感叹号与信息符没有"只有笔画、不带外框"的
      lucide 图标（`CircleAlert` / `Info` 都自带一圈），画进圆底就成了框中框，
      所以这两枚直接手写 path —— 竖笔 + 端点，`stroke-linecap: round` 把零长度
      的 `h.01` 渲染成圆点。

      四档都写成"具名插槽 + 默认内容"，宿主传同名插槽即可替换徽标，不必改这里。
    -->
    <template #success-icon>
      <slot name="success-icon">
        <span
          class="flex size-full items-center justify-center rounded-full bg-success text-white"
        >
          <CheckIcon class="size-3" :stroke-width="3" />
        </span>
      </slot>
    </template>
    <template #info-icon>
      <slot name="info-icon">
        <span
          class="flex size-full items-center justify-center rounded-full bg-info text-white"
        >
          <svg
            class="size-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M12 6.5h.01" />
            <path d="M12 10.5v7" />
          </svg>
        </span>
      </slot>
    </template>
    <template #warning-icon>
      <slot name="warning-icon">
        <span
          class="flex size-full items-center justify-center rounded-full bg-warning text-white"
        >
          <svg
            class="size-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M12 6.5v7" />
            <path d="M12 17.5h.01" />
          </svg>
        </span>
      </slot>
    </template>
    <template #error-icon>
      <slot name="error-icon">
        <span
          class="flex size-full items-center justify-center rounded-full bg-destructive text-white"
        >
          <XIcon class="size-3" :stroke-width="3" />
        </span>
      </slot>
    </template>
    <template #loading-icon>
      <slot name="loading-icon">
        <Loader2Icon class="size-5 animate-spin" />
      </slot>
    </template>
    <template #close-icon>
      <slot name="close-icon">
        <XIcon class="size-3.5" />
      </slot>
    </template>
  </SonnerToaster>
</template>

<style>
/*
 * 关闭按钮收纳到卡片内侧。
 *
 * 颜色走变量、尺寸走工具类（见上面的 toasterVars / toasterClasses），只有这个几何量
 * 两者都表达不了：sonner 把位移量做成 `--toast-close-button-transform` 变量，
 * 由四条按朝向的规则各自赋值，所以这里也只能按朝向重写四条，并把选择器写在
 * `.antdv-toaster`（本包自己的钩子）上，不依赖 shadcn-ui 的任何类名。
 *
 * sonner 默认把 ✕ 钉在角落再 `translate(±35%, ±35%)` 让它骑在边框上（半里半外），
 * 那是"贴纸"画法；通知的规范图里它落在卡片内部右上角。
 *
 * 选择器按按钮自己的 `data-close-button-position` 分四种朝向 ——
 * 注意**不是** toaster 的 `data-x/y-position`：那个是整只的位置，
 * 而按钮落在卡片哪个角由 `closeButtonPosition` 单独决定，两者互不跟随。
 * 库里的规则是 `[data-sonner-toaster] [data-close-button-position='xxx']`（特异度 0-2-0），
 * 这里多带一个 `.antdv-toaster[data-sonner-toaster]` 凑到 0-3-0 压住它，
 * 只改位移量，`left/right/top/bottom` 仍交给原规则，换朝向时不用跟着搬。
 */
.antdv-toaster[data-sonner-toaster] [data-close-button-position='top-right'] {
  --toast-close-button-transform: translate(-8px, 8px);
}
.antdv-toaster[data-sonner-toaster] [data-close-button-position='top-left'] {
  --toast-close-button-transform: translate(8px, 8px);
}
.antdv-toaster[data-sonner-toaster]
  [data-close-button-position='bottom-right'] {
  --toast-close-button-transform: translate(-8px, -8px);
}
.antdv-toaster[data-sonner-toaster] [data-close-button-position='bottom-left'] {
  --toast-close-button-transform: translate(8px, -8px);
}
</style>
