<script setup lang="ts">
defineOptions({ name: 'ScreenPanel' })

withDefaults(
  defineProps<{
    title: string
    loading?: boolean
  }>(),
  { loading: false },
)
</script>

<template>
  <div class="panel">
    <header class="panel__header">
      <span class="panel__mark" />
      <span class="panel__title">{{ title }}</span>
      <div class="panel__extra">
        <slot name="extra" />
      </div>
    </header>
    <div class="panel__body">
      <a-spin :spinning="loading" wrapper-class-name="panel__spin">
        <slot />
      </a-spin>
    </div>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-radius: 6px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(16, 38, 82, 0.6), rgba(8, 20, 48, 0.6));
  border: 1px solid rgba(64, 158, 255, 0.18);
}

.panel__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(64, 158, 255, 0.12);
  background: linear-gradient(90deg, rgba(30, 68, 158, 0.35), transparent 60%);
}
.panel__mark {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: linear-gradient(180deg, #4ea8ff, #1a68ff);
  box-shadow: 0 0 6px rgba(78, 168, 255, 0.9);
}
.panel__title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 1px;
  color: #d1e3ff;
}
.panel__extra {
  margin-left: auto;
  font-size: 11px;
  color: rgba(209, 227, 255, 0.6);
}

.panel__body {
  flex: 1;
  min-height: 0;
  padding: 8px;
}
.panel__body :deep(.panel__spin),
.panel__body :deep(.ant-spin-container) {
  height: 100%;
}
</style>
