<script setup lang="ts">
import ControlPlanePage from './ControlPlanePage.vue';

defineOptions({ name: 'CpContext' });
</script>

<template>
  <ControlPlanePage
    kind="context"
    title="Context 治理"
    description="Token 预算、历史轮数与压缩策略，保护上下文窗口"
    icon="carbon:filter"
  />
</template>
