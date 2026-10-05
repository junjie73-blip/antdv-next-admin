<script setup lang="ts">
import { onBeforeUnmount, onMounted, provide, ref } from 'vue'

defineOptions({ name: 'ScreenLayout' })

/** ⭐ 大屏根元素 ref，供全屏功能定位 */
const rootRef = ref<HTMLElement>()

/** 通过 provide 让子组件拿到根元素 */
provide('screen-root-ref', rootRef)

const props = withDefaults(
  defineProps<{
    /** 是否强制全局深色 */
    dark?: boolean
  }>(),
  { dark: true },
)

const DARK_CLASS = 'screen-dark'

onMounted(() => {
  if (props.dark) document.documentElement.classList.add(DARK_CLASS)
})

onBeforeUnmount(() => {
  document.documentElement.classList.remove(DARK_CLASS)
})
</script>

<template>
  <div ref="rootRef" class="screen-root">
    <div class="screen-bg" aria-hidden="true" />
    <div class="screen-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.screen-root {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #050b1a;
  color: #d1e3ff;
  overflow: hidden;
  z-index: 100;
}

/* ⭐ 进入全屏后：由浏览器接管，去掉 fixed 定位避免冲突 */
.screen-root:fullscreen,
.screen-root:-webkit-full-screen {
  position: relative;
  inset: auto;
}

.screen-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 15% 15%, rgba(41, 110, 255, 0.15), transparent 45%),
    radial-gradient(circle at 85% 85%, rgba(0, 224, 255, 0.08), transparent 45%),
    linear-gradient(180deg, #050b1a 0%, #060f24 100%);
}
.screen-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(64, 158, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(64, 158, 255, 0.05) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(ellipse at center, #000 30%, transparent 85%);
}

.screen-body {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>

<style>
.screen-dark {
  color-scheme: dark;
}
.screen-dark body {
  background: #050b1a;
}
</style>
