<script setup lang="tsx">
import type { DescriptionItem } from '@/components/business/Description'
import type { FormSchema } from '@/components/business/Form'
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'
import { computed, h, nextTick, ref } from 'vue'
import { getAuditLogList, exportAuditLog } from '@/api/system'
import { BasicDrawer, useDrawer } from '@/components/business/Drawer'
import { BasicTable, useTable } from '@/components/business/Table'
import { Description } from '@/components/business/Description'
import { cn } from '@/utils/cn'
import dayjs from 'dayjs'
import { message } from 'antdv-next'

defineOptions({ name: 'SystemAuditLog' })

// ========== 类型定义 ==========
interface AuditLogRecord {
  logId: string
  tenantId: string
  userId?: string | null
  username?: string | null
  operation: string
  method: string
  requestUrl: string
  requestParams?: string | null
  responseData?: string | null
  ipAddress: string
  userAgent?: string | null
  executeTime: number
  status: string
  errorMsg?: string | null
  createdAt: string
}

// ========== 样式 ==========
const containerClassName = cn('space-y-4')
const cardClassName = cn(
  'shadow-sm rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900',
)
const actionClassName = cn('flex items-center justify-center')
const btnClassName = cn('!px-0.5')

// ========== 状态映射 ==========
const statusColorMap: Record<string, string> = { '1': 'green', '0': 'red' }
const statusLabelMap: Record<string, string> = { '1': '成功', '0': '失败' }

// ========== 详情抽屉 ==========
const viewingRecord = ref<AuditLogRecord | null>(null)
const [drawerRegister, drawerMethods] = useDrawer()
const [tableRegister, tableMethods] = useTable()

// ========== 详情 Schema ==========
const detailSchemas = computed<DescriptionItem[]>(() => [
  { field: 'logId', label: '日志编号' },
  { field: 'tenantId', label: '租户ID' },
  { field: 'userId', label: '用户ID' },
  { field: 'username', label: '操作用户' },
  { field: 'operation', label: '操作描述' },
  {
    field: 'method',
    label: 'HTTP方法',
    render: (value) => h('a-tag', { color: 'blue' }, value),
  },
  {
    field: 'requestUrl',
    label: '请求URL',
    render: (value) => h('code', { class: 'break-all text-xs' }, value),
  },
  { field: 'ipAddress', label: '客户端IP' },
  {
    field: 'executeTime',
    label: '执行时间(ms)',
    render: (value) => h('span', `${value} ms`),
  },
  {
    field: 'status',
    label: '状态',
    render: (value) =>
      h(
        'a-tag',
        { color: statusColorMap[value as string] || 'default' },
        statusLabelMap[value as string] || '未知',
      ),
  },
  {
    field: 'createdAt',
    label: '创建时间',
  },
  {
    field: 'errorMsg',
    label: '错误信息',
  },
  {
    field: 'requestParams',
    label: '请求参数',
  },
  {
    field: 'responseData',
    label: '响应数据',
  },
  {
    field: 'userAgent',
    label: '用户代理',
  },
])

// ========== 搜索表单 ==========
const searchFormSchemas: FormSchema[] = [
  {
    field: 'username',
    label: '操作人',
    component: 'Input',
    componentProps: { placeholder: '请输入操作人用户名', allowClear: true },
    colProps: { span: 4 },
  },
  {
    field: 'operation',
    label: '操作描述',
    component: 'Input',
    componentProps: { placeholder: '输入操作描述关键字', allowClear: true },
    colProps: { span: 4 },
  },
  {
    field: 'method',
    label: 'HTTP方法',
    component: 'Select',
    componentProps: {
      placeholder: '选择方法',
      allowClear: true,
      options: ['GET', 'POST', 'PUT', 'DELETE'].map((m) => ({ label: m, value: m })),
    },
    colProps: { span: 4 },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    componentProps: {
      placeholder: '选择状态',
      allowClear: true,
      options: [
        { label: '成功', value: '1' },
        { label: '失败', value: '0' },
      ],
    },
    colProps: { span: 3 },
  },
  {
    field: 'dateRange',
    label: '操作时间',
    component: 'RangePicker',
    componentProps: {
      placeholder: ['开始时间', '结束时间'],
      format: 'YYYY-MM-DD HH:mm:ss',
      showTime: true,
      allowClear: true,
    },
    colProps: { span: 6 },
  },
]

// ========== 表格列 ==========
const columns: BasicColumn[] = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    align: 'center',
    customRender: ({ index }) => index + 1,
  },
  { title: '操作描述', dataIndex: 'operation', key: 'operation', width: 200, ellipsis: true },
  { title: '操作人', dataIndex: 'username', key: 'username', width: 100, align: 'center' },
  { title: 'IP地址', dataIndex: 'ipAddress', key: 'ipAddress', width: 140, ellipsis: true },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center' },
  { title: '耗时(ms)', dataIndex: 'executeTime', key: 'executeTime', width: 90, align: 'center' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 170 },
]

// ========== 加载 API ==========
async function mockApi(params: Record<string, any>) {
  return await getAuditLogList(params)
}

// ========== 详情 ==========
function handleView(record: AuditLogRecord) {
  viewingRecord.value = null // 先清空旧数据
  nextTick(() => {
    viewingRecord.value = record // 再设置新数据
    drawerMethods.openDrawer()
  })
}

// ========== 导出 ==========
async function handleExport() {
  const searchParams = tableMethods.value?.getFormValues() || {}
  if (searchParams.dateRange && Array.isArray(searchParams.dateRange)) {
    searchParams.startTime = dayjs(searchParams.dateRange[0]).format('YYYY-MM-DD HH:mm:ss')
    searchParams.endTime = dayjs(searchParams.dateRange[1]).format('YYYY-MM-DD HH:mm:ss')
    delete searchParams.dateRange
  }
  try {
    await exportAuditLog(searchParams)
    message.success('导出任务已提交')
  } catch (e: any) {
    message.error(e?.message || '导出失败')
  }
}
</script>

<template>
  <div :class="containerClassName">
    <div :class="cardClassName">
      <div class="p-4">
        <BasicTable
          :columns="columns"
          :api="mockApi"
          :immediate="true"
          :use-search-form="true"
          :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
          :action-column="{ width: 80, title: '操作', fixed: 'right' }"
          :pagination="{ showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }"
          :scroll="{ x: 1200 }"
          :row-key="(record) => record.logId"
          @register="tableRegister"
        >
          <template #toolbar>
            <a-button @click="handleExport">
              <template #icon><Icon icon="carbon:export" /></template>
              导出
            </a-button>
          </template>

          <template #cell-status="{ record }">
            <a-tag :color="statusColorMap[record.status] || 'default'">
              {{ statusLabelMap[record.status] || '未知' }}
            </a-tag>
          </template>

          <template #cell-executeTime="{ record }">
            <span :style="{ color: record.executeTime > 500 ? 'var(--color-warning)' : 'inherit' }">
              {{ record.executeTime }} ms
            </span>
          </template>

          <template #action="{ record }">
            <div :class="actionClassName">
              <a-button type="link" :class="btnClassName" @click="() => handleView(record)">
                <template #icon><Icon icon="ant-design:eye-outlined" /></template>
                详情
              </a-button>
            </div>
          </template>
        </BasicTable>
      </div>
    </div>

    <!-- 日志详情抽屉 -->
    <BasicDrawer title="日志详情" :width="921" :show-footer="false" @register="drawerRegister">
      <Description
        v-if="viewingRecord"
        :colon="false"
        :data="viewingRecord"
        :schema="detailSchemas"
        :column="1"
        :bordered="false"
      />
    </BasicDrawer>
  </div>
</template>
