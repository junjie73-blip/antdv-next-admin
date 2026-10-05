<script setup lang="ts">
defineOptions({ name: 'ScreenRangeSwitch' })

export type TimeRange = 'today' | '7d' | '30d'

interface Option {
  label: string
  value: TimeRange
}

const props = withDefaults(
  defineProps<{
    modelValue: TimeRange
    options?: Option[]
  }>(),
  {
    options: () => [
      { label: '今日', value: 'today' },
      { label: '近7天', value: '7d' },
      { label: '近30天', value: '30d' },
    ],
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: TimeRange]
}>()

function handleClick(value: TimeRange) {
  if (value === props.modelValue) return
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="range-switch" role="radiogroup">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      role="radio"
      :aria-checked="modelValue === opt.value"
      class="range-switch__item"
      :class="{ 'is-active': modelValue === opt.value }"
      @click="handleClick(opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<style scoped>
.range-switch {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  border-radius: 4px;
  background: rgba(64, 158, 255, 0.08);
  border: 1px solid rgba(64, 158, 255, 0.25);
}

.range-switch__item {
  padding: 3px 12px;
  font-size: 12px;
  color: rgba(209, 227, 255, 0.7);
  background: transparent;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.range-switch__item:hover:not(.is-active) {
  color: #e6f4ff;
  background: rgba(64, 158, 255, 0.12);
}

/* ⭐ 选中态：主色渐变 + 发光 */
.range-switch__item.is-active {
  color: #ffffff;
  background: linear-gradient(135deg, #1a68ff, #4ea8ff);
  box-shadow: 0 0 10px rgba(78, 168, 255, 0.6);
  font-weight: 500;
}
</style>
