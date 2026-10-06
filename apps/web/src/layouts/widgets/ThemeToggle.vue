<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useColorMode } from '@vueuse/core'
import { computed, watch } from 'vue'

import { useAppStore } from '~/stores/modules/app'
import { cn } from '~/utils/cn'

defineOptions({ name: 'ThemeToggle' })

const appStore = useAppStore()

const { store } = useColorMode({
  initialValue: appStore.themeMode,
  emitAuto: true,
  selector: 'html',
  attribute: 'class',
})

/* ---------- 双向同步 ---------- */
watch(
  store,
  (val) => {
    if (val && val !== appStore.themeMode) {
      appStore.updateSetting({ theme: val })
    }
  },
  { immediate: true },
)

watch(
  () => appStore.themeMode,
  (val) => {
    if (val && val !== store.value) {
      store.value = val
    }
  },
)

/* ---------- 选项 ---------- */
const options = [
  { value: 'light' as const, label: '浅色', icon: 'carbon:sun' },
  { value: 'dark' as const, label: '深色', icon: 'carbon:moon' },
  { value: 'auto' as const, label: '跟随系统', icon: 'carbon:contrast' },
]

const current = computed(() => appStore.themeMode)

/* ============================================================
 * ⭐ SettingDrawer 里切换：不走动画，直接生效
 * ============================================================
 *  useColorMode 的 store 是 ref，赋值后同步更新 html.dark class
 */
function handleChange(mode: 'light' | 'dark' | 'auto') {
  if (mode === current.value) return

  // 直接写 store → useColorMode 同步改 html class
  store.value = mode

  // 同步到 appStore
  appStore.updateSetting({ theme: mode })
}
</script>

<template>
  <div class="grid grid-cols-3 gap-2">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      :class="
        cn(
          'relative flex h-16 flex-col items-center justify-center gap-1.5 rounded-lg border',
          'cursor-pointer transition-all duration-200',
          current === opt.value
            ? 'border-ant-primary bg-ant-primary/5 text-ant-primary border-2'
            : 'hover:border-ant-primary/40 border-slate-200 bg-white text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
        )
      "
      @click="handleChange(opt.value)"
    >
      <Icon :icon="opt.icon" class="text-xl" />
      <span class="text-[11px] font-medium">{{ opt.label }}</span>
    </button>
  </div>
</template>
