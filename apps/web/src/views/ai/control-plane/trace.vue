<script setup lang="ts">
import ControlPlanePage from './ControlPlanePage.vue';

defineOptions({ name: 'CpTrace' });
</script>

<template>
  <ControlPlanePage
    kind="trace"
    title="调用 Trace"
    description="工具调用、耗时与 Token 消耗，按 traceId 串联完整链路"
    icon="carbon:chart-line-data"
  />
</template>
