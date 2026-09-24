<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useFullscreen } from '@vueuse/core'
import { computed } from 'vue'

import WidgetButton from './components/WidgetButton.vue'

defineOptions({ name: 'WidgetFullscreen' })

const { isFullscreen, toggle } = useFullscreen()
const icon = computed(() => (isFullscreen.value ? 'carbon:minimize' : 'carbon:maximize'))
</script>

<template>
  <WidgetButton @click="toggle()">
    <Icon :icon="icon" class="text-lg" />
  </WidgetButton>
</template>
