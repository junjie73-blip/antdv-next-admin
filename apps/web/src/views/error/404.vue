<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { cn } from '@antdv/shared/cn';
import { HOME_PATH, LOGIN_PATH } from '~/config/constants';
import { useUserStore } from '~/stores/modules/user';

const router = useRouter();
const userStore = useUserStore();

const containerClassName = computed(() =>
  cn(
    'flex min-h-screen flex-col items-center justify-center',
    'bg-linear-to-br from-gray-100 to-gray-200',
    'dark:from-gray-800 dark:to-gray-900',
  ),
);

function handleBack() {
  if (userStore.isLoggedIn) {
    router.push(HOME_PATH);
  } else {
    router.push(LOGIN_PATH);
  }
}
</script>

<template>
  <div :class="containerClassName">
    <div class="text-center">
      <h1 class="mb-4 text-9xl font-bold text-gray-300 dark:text-gray-600">
        404
      </h1>
      <h2 class="mb-4 text-2xl font-semibold text-gray-700 dark:text-gray-300">
        页面不存在
      </h2>
      <p class="mb-8 text-gray-500 dark:text-gray-400">
        抱歉，您访问的页面不存在
      </p>
      <a-button type="primary" size="large" @click="handleBack">
        返回首页
      </a-button>
    </div>
  </div>
</template>
