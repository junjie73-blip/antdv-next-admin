<script setup lang="ts">
/**
 * 系统设置已并入「系统配置」的「参数设置」面板（见 system/config/index.vue
 * 内嵌的 SettingsPanel），本页仅保留一个重定向壳，承接历史直达链接，
 * 避免旧书签 / 标签页 404 或 403。实际的键值型 CRUD 逻辑全部迁移到
 * components/SettingsPanel.vue，不再在此重复实现。
 */
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
onMounted(() => router.replace('/system/config'));
</script>

<template><div data-page-view></div></template>
