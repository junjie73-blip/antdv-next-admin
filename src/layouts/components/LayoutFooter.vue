<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

import { useAppStore } from '~/stores/modules/app'

defineOptions({ name: 'LayoutFooter' })

const appStore = useAppStore()

const currentYear = computed(() => new Date().getFullYear())
const showFooter = computed(() => appStore.showFooter)
const showCopyright = computed(() => appStore.showCopyright)
const company = computed(() => appStore.copyrightCompany || 'Antdv Admin')
const icp = computed(() => appStore.copyrightIcp)
</script>

<template>
  <footer
    v-if="showFooter"
    class="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-slate-100 bg-white px-4 py-3 text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500"
  >
    <template v-if="showCopyright">
      <span class="flex items-center gap-1">
        <Icon icon="carbon:copyright" class="text-sm" />
        <span>{{ currentYear }}</span>
        <a
          :href="'https://github.com/'"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-ant-primary font-medium text-slate-600 transition-colors dark:text-slate-300 dark:hover:text-blue-400"
        >
          {{ company }}
        </a>
      </span>

      <span v-if="icp" class="flex items-center gap-2">
        <span class="text-slate-300 dark:text-slate-700">·</span>
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noopener noreferrer"
          class="transition-colors hover:text-slate-600 dark:hover:text-slate-300"
        >
          {{ icp }}
        </a>
      </span>

      <span class="flex items-center gap-2">
        <span class="text-slate-300 dark:text-slate-700">·</span>
        <span>All Rights Reserved</span>
      </span>
    </template>
  </footer>
</template>
