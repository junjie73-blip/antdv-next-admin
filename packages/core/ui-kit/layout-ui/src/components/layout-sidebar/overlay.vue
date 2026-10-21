<script setup lang="ts">
import type { LayoutOverlayConfig, LayoutTone } from '../../layout';

import { computed } from 'vue';

import { onKeyStroke } from '@vueuse/core';

import { useLayoutStyle } from '../../hooks/use-layout';
import { LAYOUT_DRAWER_WIDTH } from '../../layout';

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
 *
 * 开合用 `<Transition>` 做遮罩淡入 + 面板左滑（见文件末尾的样式），
 * 三个 `data-layout-*` 钩子的位置不变：包裹层还在、遮罩与面板还是那两个固定层，
 * 用例与样式覆盖照常按属性定位。
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
    <Transition appear name="layout-overlay">
      <div v-if="props.open" data-layout-overlay class="contents">
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
    </Transition>
  </Teleport>
</template>

<style scoped>
/*
 * 开合动画。
 *
 * 动画类挂在包裹层上（`display: contents`，自己不参与布局，也绝不能带 transform ——
 * 一旦祖先有变换，两个 `fixed` 子层就会改以它为包含块，遮罩不再是全屏），
 * 位移与透明度分别落在遮罩和面板两个真实绘制层上，所以选择器写的是后代。
 * `transition` 直接挂在两个子层上而不是 `-active` 类里：
 * 包裹层首次挂载就带着 `open` 时走的是 appear 档，三种档共用同一份时长与曲线。
 * 时长与外壳其它抽屉一致（200ms / ease），面板多给一点位移时间。
 */

/*
 * 包裹层自己也要有一份时长，而且要不短于子层里最长的那条。
 *
 * Vue 决定"何时把离场节点摘掉"读的是**挂动画类那一层**的过渡时长：
 * 包裹层是 `display: contents`，没有盒、既不绘制也不会派发 transitionend，
 * 时长读成 0 就等于"没有过渡"，leave 在第一帧直接把面板 detach，
 * 子层那条 240ms 的滑出根本没机会开始（enter 方向看不出问题：节点本来就在，
 * 类名摘掉后子层照样按自己的 transition 走完插值）。
 * 这里给 280ms（> 面板的 240ms），Vue 内部用兜底定时器在时长到点时 resolve，
 * 于是滑出能跑完；位移与淡入仍然只由下面两个真实绘制层承担。
 */
[data-layout-overlay] {
  transition: opacity 0.28s ease;
}

[data-layout-overlay-mask] {
  transition: opacity 0.2s ease;
}

[data-layout-overlay-panel] {
  /*
   * 静止态要写成具体的 `translateX(0)` 而不是留给默认的 `none`：
   * WebKit 不在"变换列表 ↔ none"之间插值，实测同一份动画在 Chromium/Firefox 里
   * 滑入有中间帧、Safari 内核第一帧就跳到终点（用例把它读成"面板瞬移"）。
   * 两端都是同一条 `translateX()` 函数，插值口径三家一致。
   */
  transform: translateX(0);
  transition: transform 0.24s cubic-bezier(0.32, 0.72, 0, 1);
}

.layout-overlay-enter-from [data-layout-overlay-mask],
.layout-overlay-appear-from [data-layout-overlay-mask],
.layout-overlay-leave-to [data-layout-overlay-mask] {
  opacity: 0;
}

.layout-overlay-enter-from [data-layout-overlay-panel],
.layout-overlay-appear-from [data-layout-overlay-panel],
.layout-overlay-leave-to [data-layout-overlay-panel] {
  transform: translateX(-100%);
}

/* 收起中的面板不再接收点击：它已经离开视口，但不该在动画那 240ms 里挡住内容 */
.layout-overlay-leave-active [data-layout-overlay-panel] {
  pointer-events: none;
}
</style>
