<template>
  <a-drawer
    v-model:open="open"
    title="审批流程"
    :width="1200"
    :destroy-on-close="true"
    @after-open-change="onOpenChange"
  >
    <a-spin :spinning="loading">
      <!-- detail 和 detail.nodes 都就绪才渲染 -->
      <div v-if="detail" class="space-y-4">
        <a-descriptions :column="2" size="small" bordered>
          <a-descriptions-item label="申请标题" :span="2">
            {{ detail.title }}
          </a-descriptions-item>
          <a-descriptions-item label="申请人">
            {{ detail.applicantName ?? '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="当前审批部门">
            {{ detail.currentDeptName ?? '-' }}
          </a-descriptions-item>
        </a-descriptions>

        <div>
          <div class="border-ant-primary mt-2 mb-3 border-l-4 pl-2 text-sm font-semibold text-gray-800">
            审批流转路径
          </div>
          <!-- 关键：用 `?? []` 保证 props 一定是数组 -->
          <ApprovalFlowChart :key="requestId ?? 'empty'" :nodes="detail.nodes ?? []" />
        </div>
      </div>

      <a-empty v-else-if="!loading" description="暂无数据" />
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import type { ApprovalFlowDetail } from '../types'

import { getApprovalFlowDetail } from '../api'
import ApprovalFlowChart from './ApprovalFlowChart.vue'

defineOptions({ name: 'ApprovalFlowDrawer' })

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ requestId?: string }>()

const loading = ref(false)
const detail = ref<ApprovalFlowDetail | null>(null)

watch(
  () => props.requestId,
  async (id) => {
    if (!id || !open.value) return
    await fetchDetail(id)
  },
)

async function fetchDetail(id: string) {
  loading.value = true
  try {
    const { data } = await getApprovalFlowDetail(id)
    // 兜底：确保 nodes 一定是数组
    detail.value = data ? { ...data, nodes: Array.isArray(data.nodes) ? data.nodes : [] } : null
  } catch {
    detail.value = null
  } finally {
    loading.value = false
  }
}

async function onOpenChange(val: boolean) {
  if (val && props.requestId) {
    await fetchDetail(props.requestId)
  } else if (!val) {
    detail.value = null
  }
}
</script>
