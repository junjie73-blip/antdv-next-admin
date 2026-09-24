<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

import { useThemeTransition } from '~/composables/web/useThemeTransition'
import { useAppStore } from '~/stores/modules/app'

import WidgetButton from './components/WidgetButton.vue'
defineOptions({ name: 'WidgetTheme' })

const appStore = useAppStore()
const { switchThemeWithAnimation, isDarkNow } = useThemeTransition()

const isDark = computed(() => isDarkNow(appStore.themeMode))
/** 图标：暗色时显示太阳（点击切亮色），亮色时显示月亮 */
const icon = computed(() => (isDarkNow(appStore.themeMode) ? 'carbon:sun' : 'carbon:moon'))
const title = computed(() => (isDark.value ? '切换到浅色' : '切换到深色'))

function handleClick(e: MouseEvent) {
  void switchThemeWithAnimation(isDark.value ? 'light' : 'dark', e)
}
</script>

<template>
  <WidgetButton @click="(e: MouseEvent) => handleClick(e)" :title="title">
    <Icon :icon="icon" class="text-lg" />
  </WidgetButton>
</template>
