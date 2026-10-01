<template>
  <a-drawer
    v-model:open="open"
    :title="report?.report_name ?? '报表查看'"
    :width="1200"
    :destroy-on-close="true"
    :body-style="{ padding: '16px 20px' }"
    @after-open-change="onOpenChange"
  >
    <!-- 自定义头部操作 -->
    <template #extra>
      <a-space v-if="report">
        <a-button size="small" @click="runReport" :loading="loading">
          <template #icon><Icon icon="lucide:refresh-cw" /></template>
          刷新
        </a-button>
        <a-dropdown v-permission="REPORT_PERMS.viewer.export">
          <a-button type="primary" size="small">
            <template #icon><Icon icon="lucide:download" /></template>
            导出
          </a-button>
          <template #popupRender>
            <a-menu @click="handleExportMenu">
              <a-menu-item v-for="t in EXPORT_TYPES" :key="t.key">
                <Icon :icon="t.icon" class="mr-2" />
                {{ t.label }}
              </a-menu-item>
              <a-menu-divider />
              <a-menu-item key="excel-async">
                <Icon icon="lucide:cloud-download" class="mr-2" />
                Excel（异步）
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </a-space>
    </template>

    <a-spin :spinning="loading">
      <template v-if="report">
        <!-- 描述 -->
        <p v-if="report.description" class="mb-4 text-sm text-gray-500">
          {{ report.description }}
        </p>

        <!-- 参数区 -->
        <div v-if="paramDefs.length > 0" class="mb-4 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
          <div class="mb-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon icon="lucide:filter" class="h-4 w-4 text-gray-400" />
              <span class="text-sm font-medium text-gray-700">查询条件</span>
            </div>
            <a-button type="link" size="small" @click="runReport">应用</a-button>
          </div>

          <a-row :gutter="[16, 16]">
            <a-col v-for="def in paramDefs" :key="def.name" :xs="24" :sm="12" :md="8">
              <div class="mb-1 text-sm text-gray-600">
                {{ def.label ?? def.name }}
                <span v-if="def.required" class="text-red-500">*</span>
              </div>
              <a-input
                v-if="def.type === 'string'"
                v-model:value="params[def.name]"
                :placeholder="`请输入${def.label ?? def.name}`"
                allow-clear
              />
              <a-input-number
                v-else-if="def.type === 'number'"
                v-model:value="params[def.name]"
                class="w-full"
                :placeholder="`请输入${def.label ?? def.name}`"
              />
              <a-date-picker
                v-else-if="def.type === 'date'"
                v-model:value="params[def.name]"
                class="w-full"
                value-format="YYYY-MM-DD"
              />
              <Select
                v-else-if="def.type === 'enum'"
                v-model:value="params[def.name]"
                :options="def.options ?? []"
                allow-clear
                class="w-full"
              />
              <a-input v-else v-model:value="params[def.name]" />
            </a-col>
          </a-row>
        </div>

        <!-- Tabs：图表 / 数据 -->
        <a-tabs v-model:activeKey="activeTab">
          <a-tab-pane v-if="report.config?.chart" key="chart" tab="数据可视化">
            <div v-if="result && result.rows.length > 0" class="h-80">
              <ReportChart
                :type="report.config.chart.type"
                :x-field="report.config.chart.xField"
                :y-field="report.config.chart.yField"
                :series-field="report.config.chart.seriesField"
                :rows="result.rows"
                height="100%"
              />
            </div>
            <a-empty v-else description="暂无数据" />
          </a-tab-pane>

          <a-tab-pane key="table" tab="数据明细">
            <template v-if="result && result.rows.length > 0">
              <!-- 统计信息 -->
              <div class="mb-3 flex items-center gap-3 text-xs text-gray-500">
                <span>共 {{ result.total }} 行</span>
                <span>耗时 {{ result.duration }}ms</span>
              </div>

              <a-table
                :columns="displayColumns"
                :data-source="displayRows"
                :pagination="false"
                :scroll="{ x: 'max-content', y: 400 }"
                size="small"
                row-key="_rowKey"
                bordered
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.dataIndex">
                    <span v-if="column.type === 'number'">
                      {{ formatNumber(record[column.dataIndex]) }}
                    </span>
                    <span v-else>{{ record[column.dataIndex] ?? '—' }}</span>
                  </template>
                </template>
              </a-table>

              <!-- 分页 -->
              <div class="mt-3 flex justify-end">
                <a-pagination
                  v-model:current="pageNum"
                  v-model:page-size="pageSize"
                  :total="result.rows.length"
                  :show-size-changer="true"
                  :page-size-options="['20', '50', '100', '200']"
                  size="small"
                />
              </div>
            </template>

            <a-empty v-else-if="!loading" description="暂无数据" />
          </a-tab-pane>
        </a-tabs>
      </template>

      <a-empty v-else-if="!loading" description="报表不存在" />
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message, Select } from 'antdv-next'
import { computed, ref, watch } from 'vue'

import { executeReport, exportReport, getReportDetail, type ExportType } from '~/api/report'
import { REPORT_PERMS } from '~/enums/permissions'

import ReportChart from './ReportChart.vue'

defineOptions({ name: 'ReportViewerDrawer' })

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  /** 报表编码 */
  reportCode: string | null
}>()

const loading = ref(false)
const report = ref<any>(null)
const result = ref<any>(null)
const params = ref<Record<string, any>>({})
const pageNum = ref(1)
const pageSize = ref(50)
const activeTab = ref('chart')

const EXPORT_TYPES = [
  { key: 'excel', label: 'Excel', icon: 'lucide:file-spreadsheet' },
  { key: 'csv', label: 'CSV', icon: 'lucide:file-text' },
  { key: 'pdf', label: 'PDF', icon: 'lucide:file-type' },
  { key: 'html', label: 'HTML', icon: 'lucide:file-code' },
] as const

const paramDefs = computed(() => {
  return report.value?.params ?? report.value?.dataset?.params ?? []
})

const displayColumns = computed(() => {
  if (!result.value) return []
  return result.value.columns.map((c: any) => ({
    title: c.label,
    dataIndex: c.key,
    key: c.key,
    type: c.type,
    align: c.type === 'number' ? 'right' : 'left',
  }))
})

const displayRows = computed(() => {
  if (!result.value) return []
  const start = (pageNum.value - 1) * pageSize.value
  return result.value.rows
    .slice(start, start + pageSize.value)
    .map((r: any, i: number) => ({ ...r, _rowKey: start + i }))
})

async function loadReport() {
  if (!props.reportCode) return
  loading.value = true
  try {
    report.value = await getReportDetail(props.reportCode).catch(() => null)
    // 初始化参数
    const init: Record<string, any> = {}
    for (const d of paramDefs.value) {
      if (d.defaultValue !== undefined) init[d.name] = d.defaultValue
    }
    params.value = init

    // 默认 tab
    activeTab.value = report.value?.config?.chart ? 'chart' : 'table'

    await runReport()
  } finally {
    loading.value = false
  }
}

async function runReport() {
  if (!props.reportCode) return
  loading.value = true
  try {
    const res = await executeReport(props.reportCode, params.value)
    result.value = res
    pageNum.value = 1
  } finally {
    loading.value = false
  }
}

async function handleExportMenu({ key }: { key: string }) {
  if (!props.reportCode) return
  if (key === 'excel-async') {
    await exportReport(props.reportCode, 'excel', params.value, true)
    message.success('导出任务已提交，请到导出任务页面下载')
    return
  }
  await exportReport(props.reportCode, key as ExportType, params.value)
  message.success('导出成功')
}

function formatNumber(val: any) {
  if (val === null || val === undefined) return '—'
  const n = Number(val)
  if (isNaN(n)) return String(val)
  return n.toLocaleString('zh-CN')
}

function onOpenChange(val: boolean) {
  if (val) {
    loadReport()
  } else {
    report.value = null
    result.value = null
    params.value = {}
    pageNum.value = 1
  }
}

// 外部 reportCode 变化时，如果抽屉已打开，重新拉数据
watch(
  () => props.reportCode,
  () => {
    if (open.value) loadReport()
  },
)
</script>
