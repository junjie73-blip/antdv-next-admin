<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useMagicKeys, whenever } from '@vueuse/core'

import WidgetButton from './components/WidgetButton.vue'

defineOptions({ name: 'WidgetSearch' })

const emit = defineEmits<{ open: [] }>()

const { meta_k, ctrl_k } = useMagicKeys()

whenever(
  () => meta_k!.value || ctrl_k!.value,
  (e) => {
    e?.preventDefault?.()
    emit('open')
  },
)
</script>

<template>
  <WidgetButton @click="emit('open')">
    <Icon icon="carbon:search" class="text-lg" />
  </WidgetButton>
</template>
