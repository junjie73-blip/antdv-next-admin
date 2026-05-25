<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/modules/app'
import { cn } from '@/utils/cn'

defineOptions({
  name: 'LayoutFooter',
})

const appStore = useAppStore()

const currentYear = new Date().getFullYear()
const appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Next Admin'

const isGeekStyle = computed(() => appStore.themeStyle === 'geek')

const footerClassName = computed(() =>
  cn(
    'h-8 px-4 flex items-center justify-center flex-shrink-0',
    'text-xs text-gray-500 dark:text-gray-400',
    isGeekStyle.value
      ? 'bg-[#0a0a0a] border-[#1a1a1a] text-gray-500'
      : 'bg-white dark:bg-gray-800',
    isGeekStyle.value
      ? 'border-t border-[#1a1a1a]'
      : 'border-t border-gray-200 dark:border-gray-700',
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
      . 版权所有.
    </span>
  </footer>
</template>
