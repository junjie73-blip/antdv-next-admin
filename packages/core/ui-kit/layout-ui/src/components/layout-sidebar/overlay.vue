<script setup lang="ts">
import type { LayoutOverlayConfig, LayoutTone } from '../../layout';

import { computed } from 'vue';

import { onKeyStroke } from '@vueuse/core';

import { LAYOUT_DRAWER_WIDTH } from '../../layout';
import { useLayoutStyle } from '../../hooks/use-layout';

defineOptions({ name: 'LayoutOverlay' });

/**
 * 窄屏 / 浮层形态下的侧栏容器。
 *
 * 迁移前用的是 antd `Drawer`（`placement=left`、`has-header=false`、`closable=false`、
 * body `padding:0 + display:flex`）：没有标题栏、没有关闭叉，点遮罩或按 Esc 收起，
 * 里面整列放侧栏。这里用等价的自绘壳替换，保持那三点行为：
 * 宽度取 `LAYOUT_DRAWER_WIDTH`、无头无叉、内容不留额外内边距（菜单那一列自带 px-2 py-3）。
 *
 * 没用 shadcn 的 `Sheet`：它自带右上角关闭叉且没有开关，
 * 而迁移后的外壳必须与迁移前逐像素对齐（用户认的是"那条抽屉没有标题栏"）。
 */
const props = withDefaults(
  defineProps<LayoutOverlayConfig & { tone?: LayoutTone }>(),
  { tone: () => ({}), width: undefined },
);

const emit = defineEmits<{ 'update:open': [open: boolean] }>();

const style = useLayoutStyle(() => props.tone);

function close() {
  emit('update:open', false);
}

/** 默认宽度与偏好里的抽屉宽度同源 */
const panelWidth = computed(() => props.width ?? LAYOUT_DRAWER_WIDTH);

// 已收起时不再产生第二次关闭事件：浮层是 v-if 渲染的，按 Esc 时可能已经关了
onKeyStroke('Escape', () => {
  if (props.open) close();
});
</script>

<template>
  <Teleport to="body">
    <div v-if="props.open" data-layout-overlay>
      <!-- 遮罩：点它就收起，与迁移前 antd Drawer 的 maskClosable 默认行为一致 -->
      <div
        data-layout-overlay-mask
        class="fixed inset-0 z-40 bg-black/45"
        @click="close"
      ></div>

      <section
        data-layout-overlay-panel
        :class="style.overlayClass()"
        :style="{ width: `${panelWidth}px` }"
      >
        <slot></slot>
      </section>
    </div>
  </Teleport>
</template>
