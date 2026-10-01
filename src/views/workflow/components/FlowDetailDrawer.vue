<template>
  <a-drawer
    v-model:open="open"
    title="流程详情"
    :width="960"
    :destroy-on-close="true"
    @after-open-change="onOpenChange"
  >
    <a-spin :spinning="loading">
      <template v-if="detail">
        <!-- 头部信息 -->
        <a-descriptions :column="2" size="small" bordered class="mb-4">
          <a-descriptions-item label="标题" :span="2">
            {{ detail.title }}
          </a-descriptions-item>
          <a-descriptions-item label="来源">
            <a-tag :color="SOURCE_MAP[detail.source]?.color">
              {{ SOURCE_MAP[detail.source]?.label }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="流程标识">
            {{ detail.defKey }}
          </a-descriptions-item>
          <a-descriptions-item label="发起人">
            {{ detail.initiatorName || '—' }}
          </a-descriptions-item>
          <a-descriptions-item label="发起时间">
            {{ dayjs(detail.createdAt).format('YYYY-MM-DD HH:mm:ss') }}
          </a-descriptions-item>
          <a-descriptions-item label="状态" :span="2">
            <StatusTag :status="detail.status" type="instance" />
          </a-descriptions-item>
        </a-descriptions>
        <!-- Tabs -->
        <a-tabs v-model:activeKey="activeTab">
          <a-tab-pane key="diagram" tab="审批流转路径">
            <ApprovalFlowChart v-if="detail.source === 'approval'" :nodes="detail.nodes ?? []" />
            <BpmnDiagram
              v-else-if="detail.definition"
              :definition="detail.definition"
              :node-status="detail.nodeStatus ?? {}"
            />
            <a-empty v-else description="暂无流程图" />
          </a-tab-pane>

          <a-tab-pane key="timeline" tab="操作记录">
            <div v-if="detail.logs && detail.logs?.length === 0">
              <a-empty description="暂无记录" />
            </div>
            <div v-else class="max-w-3xl">
              <a-timeline>
                <a-timeline-item v-for="log in detail.logs" :key="log.id" :color="getTimelineColor(log.action)">
                  <div class="flex items-center gap-2">
                    <span class="font-medium">
                      {{ log.nodeName ?? log.actionLabel ?? log.action }}
                    </span>
                    <a-tag v-if="log.actionLabel" size="small">
                      {{ log.actionLabel }}
                    </a-tag>
                    <span class="text-xs text-gray-400">
                      {{ dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss') }}
                    </span>
                  </div>
                  <div class="mt-1 text-sm text-gray-600">
                    <div v-if="log.operatorName">操作人：{{ log.operatorName }}</div>
                    <div v-if="log.remark" class="mt-1 rounded bg-gray-50 p-2">
                      {{ log.remark }}
                    </div>
                  </div>
                </a-timeline-item>
              </a-timeline>
            </div>
          </a-tab-pane>

          <a-tab-pane key="form" tab="表单数据">
            <a-descriptions v-if="formEntries.length > 0" :column="2" bordered size="small">
              <a-descriptions-item v-for="[key, value] in formEntries" :key="key" :label="String(key)">
                {{ formatValue(value) }}
              </a-descriptions-item>
            </a-descriptions>
            <a-empty v-else description="暂无表单数据" />
          </a-tab-pane>
        </a-tabs>
      </template>

      <a-empty v-else-if="!loading" description="暂无数据" />
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { FlowDetail, TodoSource } from '~/api/workflow'

import { getCenterDetail } from '~/api/workflow'
import StatusTag from '~/components/common/StatusTag.vue'
import dayjs from '~/utils/dayjs'

import ApprovalFlowChart from './ApprovalFlowChart.vue'
import BpmnDiagram from './BpmnDiagram.vue'

defineOptions({ name: 'FlowDetailDrawer' })

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  source: TodoSource | null
  instanceId: string | null
}>()

const loading = ref(false)
const detail = ref<FlowDetail | null>(null)
const activeTab = ref('diagram')

const SOURCE_MAP: Record<string, { label: string; color: string }> = {
  approval: { label: '审批', color: 'blue' },
  workflow: { label: '工作流', color: 'purple' },
}

const formEntries = computed(() => {
  const data = detail.value?.formData ?? {}
  return Object.entries(data)
})

async function fetchDetail() {
  if (!props.source || !props.instanceId) return
  loading.value = true
  try {
    const res: any = await getCenterDetail(props.source, props.instanceId)
    detail.value = res.data
  } catch {
    detail.value = null
  } finally {
    loading.value = false
  }
}

function onOpenChange(val: boolean) {
  if (val) {
    activeTab.value = 'diagram'
    fetchDetail()
  } else {
    detail.value = null
  }
}

function getTimelineColor(action: string) {
  if (action === 'REJECT' || action === 'reject') return 'red'
  if (action === 'APPROVE' || action === 'complete') return 'green'
  return 'blue'
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// 外部修改 instanceId 时，如果抽屉已开，重新拉数据
watch(
  () => [props.source, props.instanceId] as const,
  () => {
    if (open.value) fetchDetail()
  },
)
</script>
