<template>
  <a-modal v-model:open="open" title="数据预览" :width="960" :footer="null" @cancel="handleCancel">
    <a-spin :spinning="loading">
      <!-- 参数 -->
      <div v-if="(dataset?.params ?? []).length > 0" class="mb-4 rounded-lg border border-gray-200 bg-gray-50/50 p-3">
        <a-row :gutter="[12, 12]">
          <a-col v-for="def in dataset!.params" :key="def.name" :xs="24" :sm="12" :md="8">
            <div class="mb-1 text-xs text-gray-600">{{ def.name }}</div>
            <a-input v-model:value="params[def.name]" size="small" />
          </a-col>
        </a-row>
        <div class="mt-3 flex justify-end">
          <a-button size="small" type="primary" :loading="loading" @click="runPreview"> 查询 </a-button>
        </div>
      </div>

      <!-- 结果信息 -->
      <div v-if="result" class="mb-2 text-xs text-gray-500">
        共 {{ result.rows.length }} 行 · 耗时 {{ result.duration }}ms
      </div>

      <!-- 表格 -->
      <div class="max-h-96 overflow-auto">
        <a-table
          v-if="result && result.rows.length > 0"
          :columns="tableColumns"
          :data-source="tableRows"
          :pagination="false"
          size="small"
          :scroll="{ x: 'max-content' }"
          row-key="_rowKey"
        />
        <a-empty v-else-if="!loading" description="暂无数据" />
      </div>
    </a-spin>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { testDataset } from '~/api/report'

import type { DatasetRecord } from '../types'

defineOptions({ name: 'DatasetPreview' })

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  dataset: DatasetRecord | null
}>()

const loading = ref(false)
const result = ref<{
  rows: any[]
  duration: number
  fields: Array<{ name: string; label?: string }>
} | null>(null)

const params = ref<Record<string, any>>({})

const tableColumns = computed(() => {
  if (!result.value) return []
  return result.value.fields.map((f) => ({
    title: f.label ?? f.name,
    dataIndex: f.name,
    key: f.name,
  }))
})

const tableRows = computed(() => {
  if (!result.value) return []
  return result.value.rows.map((r, i) => ({ ...r, _rowKey: i }))
})

watch(
  () => [open.value, props.dataset] as const,
  async ([val, ds]) => {
    if (!val || !ds) return
    const defs = (ds as any).params ?? []
    const init: Record<string, any> = {}
    for (const d of defs) if (d.defaultValue !== undefined) init[d.name] = d.defaultValue
    params.value = init
    await runPreview()
  },
)

async function runPreview() {
  if (!props.dataset) return
  loading.value = true
  try {
    const res = await testDataset(props.dataset.dataset_id, {
      params: params.value,
      limit: 100,
    })
    result.value = {
      rows: res.rows ?? [],
      duration: res.duration ?? 0,
      fields: res.fields ?? [],
    }
  } finally {
    loading.value = false
  }
}

function handleCancel() {
  result.value = null
}
</script>
