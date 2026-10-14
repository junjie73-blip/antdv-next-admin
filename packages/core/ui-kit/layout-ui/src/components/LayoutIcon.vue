<script setup lang="ts">
import type { LayoutIconPalette } from '../layout-icon-palette';
import type { LayoutIconType } from '../layout-icons';

import { computed } from 'vue';

import {
  DEFAULT_ICON_PALETTE,
  resolveIconPalette,
} from '../layout-icon-palette';
import { LAYOUT_ICON_VIEWBOX, layoutIconRects } from '../layout-icons';

defineOptions({ name: 'LayoutIcon' });

/**
 * 布局形态示意图。
 *
 * 迁移前是一份 `.tsx`：每个形态一个函数、手写十来个 `<rect>`，
 * 颜色从 `theme.useToken()` 取 —— 一个纯图示组件因此绑死了组件库的运行时上下文，
 * 在 StyleProvider 之外调用直接抛错，也没法进单测。
 * 现在图形是数据表（`layout-icons.ts`），颜色是注入的四个主色派生值
 * （使用方从自己的主题里取，包内只认颜色）。
 *
 * 根节点保持单一、且模板根部不写注释：多根（含被注释撑出来的 fragment）会让
 * 使用方的 `class="w-24"` 没有落脚处，只能手动接 prop。
 */
const props = withDefaults(
  defineProps<{
    /** 选中态：外壳用主色铺满，未选中只是很淡的主色底 */
    active?: boolean;
    /** 深色模式下线条改中性色，主色淡底压不住深背景 */
    dark?: boolean;
    /** 主色与三个派生色，缺省退回 antd 亮色主题的那组值 */
    palette?: LayoutIconPalette;
    type: LayoutIconType;
  }>(),
  {
    active: false,
    dark: false,
    palette: undefined,
  },
);

const colors = computed(() =>
  resolveIconPalette(props.palette ?? DEFAULT_ICON_PALETTE, {
    active: props.active,
    dark: props.dark,
  }),
);

const rects = computed(() => layoutIconRects(props.type));
</script>

<template>
  <div class="aspect-4/3 w-full">
    <svg
      class="h-auto w-full"
      :viewBox="`0 0 ${LAYOUT_ICON_VIEWBOX.width} ${LAYOUT_ICON_VIEWBOX.height}`"
      role="img"
      data-layout-icon="true"
      :data-layout-icon-type="props.type"
      :data-layout-icon-active="props.active ? 'true' : 'false'"
    >
      <rect
        v-for="(item, index) in rects"
        :key="`${props.type}-${index}`"
        :fill="colors[item.fill]"
        :height="item.height"
        :rx="item.rx"
        :width="item.width"
        :x="item.x"
        :y="item.y"
      />
    </svg>
  </div>
</template>
