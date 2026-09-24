<script setup lang="ts">
import { Button, message, Spin } from 'antdv-next'
import { ref, watch } from 'vue'

import { previewGenCode } from '~/api/generator'

import type { TemplateKey } from '../types'

import { codeBlockClassName, TEMPLATE_TABS } from '../constants'

defineOptions({ name: 'GeneratorCodePreview' })

const props = defineProps<{ tableId: string }>()

const activeTab = ref<TemplateKey>(TEMPLATE_TABS[0].key)
const loading = ref(false)
const code = ref('')

async function fetchCode() {
  loading.value = true
  try {
    const res = await previewGenCode(props.tableId, activeTab.value)
    code.value = res.data.code
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.tableId, activeTab.value] as const,
  () => {
    if (props.tableId) void fetchCode()
  },
  { immediate: true },
)

function handleTabChange(key: string) {
  activeTab.value = key as TemplateKey
}

async function handleCopy() {
  await navigator.clipboard.writeText(code.value)
  message.success('已复制到剪贴板')
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <a-tabs :active-key="activeTab" type="card" size="small" @change="handleTabChange">
        <a-tab-pane v-for="tab in TEMPLATE_TABS" :key="tab.key" :tab="tab.label" />
      </a-tabs>
      <Button size="small" @click="handleCopy">复制</Button>
    </div>

    <Spin :spinning="loading">
      <pre :class="codeBlockClassName"><code>{{ code }}</code></pre>
    </Spin>
  </div>
</template>
