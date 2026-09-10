<script setup lang="ts">
import type { DescriptionItem } from '@/components/business/Description'
import type { FormSchema } from '@/components/business/Form'
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'
import { nextTick, ref } from 'vue'
import { getLoginLogList, exportLoginLog } from '@/api/system'
import { Description } from '@/components/business/Description'
import { BasicDrawer, useDrawer } from '@/components/business/Drawer'
import { BasicTable, useTable } from '@/components/business/Table'
import { cn } from '@/utils/cn'
import dayjs from 'dayjs'
import { message } from 'antdv-next'

defineOptions({ name: 'SystemLoginLog' })

// ========== 类型定义（与后端字段驼峰映射） ==========
interface LoginLogRecord {
  logId: string
  tenantId: string
  userId?: string | null
  username: string
  ipAddress: string
  userAgent?: string | null
  status: string // '0' 失败，'1' 成功
  message?: string | null
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

// ========== 表格实例 ==========
const [tableRegister, tableMethods] = useTable()
const [drawerRegister, drawerMethods] = useDrawer()
const viewingRecord = ref<LoginLogRecord | null>(null)

// ========== 搜索表单 ==========
const searchFormSchemas: FormSchema[] = [
  {
    field: 'username',
    label: '用户名',
    component: 'Input',
    componentProps: { placeholder: '请输入用户名', allowClear: true },
    colProps: { span: 6 },
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
    colProps: { span: 6 },
  },
  {
    field: 'dateRange',
    label: '登录时间',
    component: 'RangePicker',
    componentProps: {
      placeholder: ['开始时间', '结束时间'],
      format: 'YYYY-MM-DD HH:mm:ss',
      showTime: true,
      allowClear: true,
    },
    colProps: { span: 8 },
  },
]

// ========== 详情 Schema ==========
const detailSchemas: DescriptionItem[] = [
  { field: 'logId', label: '日志编号' },
  { field: 'tenantId', label: '租户ID' },
  { field: 'userId', label: '用户ID' },
  { field: 'username', label: '用户名' },
  { field: 'ipAddress', label: 'IP地址' },
  {
    field: 'status',
    label: '状态',
  },
  { field: 'message', label: '消息' },
  {
    field: 'createdAt',
    label: '登录时间',
  },
  {
    field: 'userAgent',
    label: 'User-Agent',
  },
]

// ========== 表格列 ==========
const columns: BasicColumn[] = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    align: 'center',
    dataIndex: 'logId',
    customRender: ({ index }) => index + 1,
  },
  { title: '用户名', dataIndex: 'username', key: 'username', width: 120, align: 'center' },
  { title: 'IP地址', dataIndex: 'ipAddress', key: 'ipAddress', width: 140, ellipsis: true },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center' },
  { title: '消息', dataIndex: 'message', key: 'message', width: 200, ellipsis: true },
  { title: '登录时间', dataIndex: 'createdAt', key: 'createdAt', width: 170 },
]

// ========== 数据加载 ==========
async function mockApi(params: Record<string, any>) {
  return await getLoginLogList(params)
}

// ========== 详情 ==========
function handleView(record: LoginLogRecord) {
  viewingRecord.value = null
  nextTick(() => {
    viewingRecord.value = record
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
    await exportLoginLog(searchParams)
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

    <!-- 详情抽屉 -->
    <BasicDrawer
      title="登录日志详情"
      :width="640"
      :show-footer="false"
      @register="drawerRegister"
      @close="viewingRecord = null"
    >
      <Description
        v-if="viewingRecord"
        :key="viewingRecord.logId"
        :data="viewingRecord"
        :schema="detailSchemas"
        :column="1"
      />
    </BasicDrawer>
  </div>
</template>
