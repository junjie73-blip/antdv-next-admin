<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useDateFormat, useFullscreen, useNow } from '@vueuse/core'
import { inject, type Ref } from 'vue'

defineOptions({ name: 'ScreenHeader' })

withDefaults(
  defineProps<{
    title: string
    subtitle?: string
  }>(),
  { subtitle: '' },
)

/** 每秒自动更新 */
const now = useNow({ interval: 1000 })
const dateText = useDateFormat(now, 'YYYY-MM-DD HH:mm:ss')
const weekdayText = useDateFormat(now, 'dddd', { locales: 'zh-CN' })

/** ⭐ 从 ScreenLayout 注入的大屏根元素 ref */
const rootRef = inject<Ref<HTMLElement | undefined>>('screen-root-ref')

/**
 * ⭐ 关键：把 target 指向大屏根元素
 * 全屏时只放大 screen-root，浏览器地址栏/其他标签页不受影响
 */
const { isFullscreen, toggle } = useFullscreen(rootRef)
</script>

<template>
  <header class="screen-header">
    <div class="brand">
      <span class="brand__mark" />
      <span class="brand__title">{{ title }}</span>
      <span v-if="subtitle" class="brand__subtitle">{{ subtitle }}</span>
    </div>

    <div class="clock">
      <span class="clock__time">{{ dateText }}</span>
      <span class="clock__weekday">{{ weekdayText }}</span>
    </div>

    <div class="actions">
      <button type="button" class="screen-btn" :class="{ 'is-active': isFullscreen }" @click="toggle">
        <Icon :icon="isFullscreen ? 'carbon:minimize' : 'carbon:maximize'" />
        <span>{{ isFullscreen ? '退出全屏' : '全屏' }}</span>
      </button>
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.screen-header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  border-bottom: 1px solid rgba(64, 158, 255, 0.15);
  background: linear-gradient(180deg, rgba(10, 30, 75, 0.55), transparent);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand__mark {
  width: 4px;
  height: 18px;
  border-radius: 2px;
  background: linear-gradient(180deg, #4ea8ff, #1a68ff);
  box-shadow: 0 0 8px rgba(78, 168, 255, 0.8);
}
.brand__title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #e6f4ff;
  text-shadow: 0 0 12px rgba(78, 168, 255, 0.6);
}
.brand__subtitle {
  font-size: 11px;
  letter-spacing: 3px;
  color: rgba(78, 168, 255, 0.75);
  text-transform: uppercase;
}

.clock {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.clock__time {
  font-size: 14px;
  color: #d1e3ff;
  letter-spacing: 1px;
  font-variant-numeric: tabular-nums;
}
.clock__weekday {
  font-size: 12px;
  color: rgba(209, 227, 255, 0.6);
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
}

/* ⭐ 大屏通用按钮样式：玻璃态 + 发光 */
.screen-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  color: #a7c5ff;
  background: rgba(64, 158, 255, 0.08);
  border: 1px solid rgba(64, 158, 255, 0.25);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}
.screen-btn:hover {
  color: #e6f4ff;
  border-color: rgba(64, 158, 255, 0.6);
  background: rgba(64, 158, 255, 0.16);
  box-shadow: 0 0 10px rgba(78, 168, 255, 0.35);
}
.screen-btn.is-active {
  color: #e6f4ff;
  border-color: rgba(78, 168, 255, 0.8);
  background: rgba(64, 158, 255, 0.22);
  box-shadow: 0 0 12px rgba(78, 168, 255, 0.5);
}
</style>
