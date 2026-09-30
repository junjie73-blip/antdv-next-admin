<script setup lang="ts">
import { Icon } from '@iconify/vue'

import { useUserStore } from '~/stores/modules/user'

const userStore = useUserStore()
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-gray-200/70 bg-white dark:border-gray-800 dark:bg-gray-900">
    <div class="relative flex items-center gap-6 px-6 py-6">
      <a-avatar
        :size="80"
        :src="userStore.avatar"
        class="bg-slate-100 text-2xl text-slate-600 ring-2 ring-gray-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-gray-800"
      >
        {{ userStore.username?.charAt(0)?.toUpperCase() || 'U' }}
      </a-avatar>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-100">
            {{ userStore.userInfo?.realname || userStore.username || '用户' }}
          </h2>
          <a-tag v-for="role in userStore.roles" :key="role" color="blue">{{ role }}</a-tag>
        </div>
        <div class="mt-1 text-sm text-gray-500 dark:text-gray-400">@{{ userStore.username }}</div>

        <div class="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-400">
          <span v-if="userStore.email" class="inline-flex items-center gap-1">
            <Icon icon="carbon:email" /> {{ userStore.email }}
          </span>
          <span v-if="userStore.phone" class="inline-flex items-center gap-1">
            <Icon icon="carbon:phone" /> {{ userStore.phone }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
