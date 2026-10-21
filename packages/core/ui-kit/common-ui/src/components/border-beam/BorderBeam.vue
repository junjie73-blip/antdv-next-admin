<script setup lang="ts">
import type { CSSProperties } from 'vue';

import type { BorderBeamProps } from './types';

import { computed } from 'vue';

import { cn } from '@antdv/shared/utils/cn';
import { radiusToRem } from '@antdv/shared/utils/radius';

defineOptions({ name: 'BorderBeam' });

const props = withDefaults(defineProps<BorderBeamProps>(), {
  borderWidth: 2,
  class: undefined,
  color: 'var(--app-primary)',
  delay: 0,
  duration: 6,
  radius: 'var(--app-border-radius)',
  size: 25,
  style: undefined,
  tailColor: 'transparent',
});

/** 数字按 px、字符串原样落进 CSS：只有 `borderWidth` 用它，圆角另有规矩 */
function toLength(value: number | string) {
  return typeof value === 'number' ? `${value}px` : value;
}

const rootStyle = computed<CSSProperties>(() => ({
  '--bb-color': props.color,
  '--bb-size': `${props.size}%`,
  '--bb-tail': props.tailColor,
  // 圆角一律 rem（`radiusToRem` 对字符串原样放行，所以 `var(--app-border-radius)` 照旧生效）
  borderRadius: radiusToRem(props.radius),
  ...props.style,
}));

const ringStyle = computed<CSSProperties>(() => ({
  padding: toLength(props.borderWidth),
}));

const spinStyle = computed<CSSProperties>(() => ({
  animationDelay: `${props.delay}s`,
  animationDuration: `${props.duration}s`,
}));
</script>

<template>
  <div
    class="border-beam"
    :class="cn('relative', props.class)"
    :style="rootStyle"
  >
    <!--
      `border-beam` 走静态 class，不进 `cn()`：tailwind-merge 会把它当成
      `border-{color}` 那一档，调用方一旦传了 `border-border` 之类的真工具类，
      同名冲突就把这个钩子类整条吃掉了。
    -->
    <slot></slot>
    <!--
      光带是铺满整圈的角度渐变（透明 → 尾色 → 头部色，只占 `--bb-size` 那一段），
      把它所在的方块转起来，光带就沿着边框跑。
      方块 `inset: -50%` 放大到容器两倍并同心，于是渐变的旋转中心永远是容器中心，
      容器扁平时光带扫过上下边的速度也均匀。
      环本身由两层 mask 相减得到（外层铺满边框盒、内层只到内容盒，`exclude` 留下
      padding 那一圈），所以 padding 直接就是光带粗细，不必算尺寸。
    -->
    <div aria-hidden="true" class="border-beam__ring" :style="ringStyle">
      <div class="border-beam__spin" :style="spinStyle"></div>
    </div>
  </div>
</template>

<style>
.border-beam__ring {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}

.border-beam__spin {
  position: absolute;
  inset: -50%;
  background-image: conic-gradient(
    from 0deg,
    transparent 0,
    transparent calc(100% - var(--bb-size)),
    var(--bb-tail) calc(100% - var(--bb-size) * 0.4),
    var(--bb-color) 100%
  );
  animation-name: border-beam-spin;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  animation-fill-mode: both;
  will-change: transform;
}

@keyframes border-beam-spin {
  to {
    transform: rotate(360deg);
  }
}

/* 动效只是装饰：系统要求减少动效时停在原位，边框仍然在，只是不跑 */
@media (prefers-reduced-motion: reduce) {
  .border-beam__spin {
    animation: none;
  }
}
</style>
