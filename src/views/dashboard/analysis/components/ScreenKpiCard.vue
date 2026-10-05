<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

import type { KpiItem } from '../api'

defineOptions({ name: 'ScreenKpiCard' })

const props = defineProps<{ item: KpiItem }>()

const trendUp = computed(() => props.item.trend >= 0)
</script>

<template>
  <div class="kpi">
    <div class="kpi__info">
      <div class="kpi__title">{{ item.title }}</div>
      <div class="kpi__value">
        {{ item.value }}
        <span v-if="item.trendLabel" class="kpi__unit">{{ item.trendLabel }}</span>
      </div>
      <div class="kpi__trend" :class="trendUp ? 'is-up' : 'is-down'">
        <Icon :icon="trendUp ? 'carbon:arrow-up' : 'carbon:arrow-down'" />
        <span>{{ Math.abs(item.trend) }}%</span>
        <span class="kpi__trend-label">较昨日</span>
      </div>
    </div>
    <div class="kpi__icon">
      <Icon :icon="item.icon" />
    </div>
  </div>
</template>

<style scoped>
.kpi {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(30, 68, 158, 0.35), rgba(10, 25, 65, 0.6));
  border: 1px solid rgba(64, 158, 255, 0.2);
  overflow: hidden;
}

/* 四角描边发光 */
.kpi::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 6px;
  pointer-events: none;
  background:
    linear-gradient(90deg, rgba(78, 168, 255, 0.7), transparent 30%) top left / 60% 1px no-repeat,
    linear-gradient(180deg, rgba(78, 168, 255, 0.7), transparent 60%) top left / 1px 60% no-repeat,
    linear-gradient(270deg, rgba(78, 168, 255, 0.5), transparent 30%) bottom right / 60% 1px no-repeat,
    linear-gradient(0deg, rgba(78, 168, 255, 0.5), transparent 60%) bottom right / 1px 60% no-repeat;
}

.kpi__title {
  font-size: 13px;
  color: rgba(209, 227, 255, 0.7);
  letter-spacing: 1px;
}
.kpi__value {
  margin-top: 6px;
  font-size: 28px;
  font-weight: 700;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 14px rgba(78, 168, 255, 0.55);
  line-height: 1.1;
}
.kpi__unit {
  font-size: 12px;
  font-weight: 400;
  margin-left: 4px;
  color: rgba(209, 227, 255, 0.6);
}
.kpi__trend {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}
.kpi__trend.is-up {
  color: #4ade80;
}
.kpi__trend.is-down {
  color: #f87171;
}
.kpi__trend-label {
  color: rgba(209, 227, 255, 0.5);
}

.kpi__icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  border-radius: 8px;
  color: #4ea8ff;
  background: rgba(64, 158, 255, 0.12);
  border: 1px solid rgba(64, 158, 255, 0.3);
  box-shadow: inset 0 0 12px rgba(78, 168, 255, 0.15);
}
</style>
