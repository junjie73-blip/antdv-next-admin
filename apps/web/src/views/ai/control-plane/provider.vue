<script setup lang="ts">
import ControlPlanePage from './ControlPlanePage.vue';

defineOptions({ name: 'CpProvider' });
</script>

<template>
  <ControlPlanePage
    kind="provider"
    title="Provider 管理"
    description="模型接入、协议与 API Key 引用；密钥只存环境变量名与末四位"
    icon="carbon:api"
  />
</template>
