<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/utils/cn'

defineOptions({
  name: 'LayoutFooter',
})

const currentYear = new Date().getFullYear()
const appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Next Admin'

const footerClassName = computed(() =>
  cn(
    'h-8 px-4 flex items-center justify-center',
    'text-xs text-gray-500 dark:text-gray-400',
    'bg-white dark:bg-gray-800',
    'border-t border-gray-200 dark:border-gray-700',
  ),
)
</script>

<template>
  <footer :class="footerClassName">
    <span>
      Copyright © {{ currentYear }}
      <a
        href="https://github.com/antdv-next"
        target="_blank"
        class="text-primary hover:underline"
      >
        {{ appTitle }}
      </a>
      . All rights reserved.
    </span>
  </footer>
</template>
