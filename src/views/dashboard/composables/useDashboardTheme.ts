import { computed, type ComputedRef } from 'vue'

import { useAppStore } from '~/stores'

export function useDashboardTheme(): { isDark: ComputedRef<boolean> } {
  const appStore = useAppStore()
  const isDark = computed(() => appStore.themeMode === 'dark')
  return { isDark }
}
