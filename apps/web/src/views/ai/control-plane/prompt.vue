<script setup lang="ts">
import ControlPlanePage from './ControlPlanePage.vue';

defineOptions({ name: 'CpPrompt' });
</script>

<template>
  <ControlPlanePage
    kind="prompt"
    title="Prompt 模板"
    description="按页维护系统提示词，支持当前路由与选中行变量注入"
    icon="carbon:document"
  />
</template>
