<script setup lang="ts">
import { Icon } from '@iconify/vue'

import WidgetButton from './components/WidgetButton.vue'

defineOptions({ name: 'WidgetPreferences' })

const emit = defineEmits<{ open: [] }>()
</script>

<template>
  <WidgetButton @click="emit('open')">
    <Icon icon="carbon:settings" class="text-lg" />
  </WidgetButton>
</template>
