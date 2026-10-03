<script setup lang="ts">
import type { TreeSelectProps } from 'antdv-next'
import type { DataNode } from 'antdv-next/dist/tree/index'

import { watchDebounced } from '@vueuse/core'
import { ref } from 'vue'

import { useRequest } from '~/composables'
import { http } from '~/utils'

interface Props extends /* @vue-ignore */ TreeSelectProps {
  api: string
}

const { api, ...props } = defineProps<Props>()
const { refresh, data } = useRequest(api, {
  immediate: false,
})

watchDebounced(api, () => refresh(), { immediate: true, debounce: 200 })
</script>

<template>
  <a-tree-select v-bind="props" :tree-data="data" />
</template>
