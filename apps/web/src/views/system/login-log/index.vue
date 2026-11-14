<script setup lang="ts">
/**
 * 登录日志已并入「系统日志」的「登录日志」标签页（见 views/system/log）。
 * 这里只做重定向，保留历史直达链接不 404；功能与代码都在 system/log 一处维护。
 */
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
onMounted(() => router.replace('/system/log'));
</script>

<template>
  <div data-page-view></div>
</template>
