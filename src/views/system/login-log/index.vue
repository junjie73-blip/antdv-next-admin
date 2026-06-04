<script setup lang="tsx">
import type { DescriptionItem } from '@/components/business/Description'
import type { FormSchema } from '@/components/business/Form'
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { ref } from 'vue'
import {
  getLoginLogList,
  getLoginLogStats,
} from '@/api/system'
import { Description as DetailDescription } from '@/components/business/Description'
import { BasicDrawer, useDrawer } from '@/components/business/Drawer'
import { BasicTable, useTable } from '@/components/business/Table'
import { cn } from '@/utils/cn'
import { exportToExcel } from '@/utils/excel'
import { usePrint } from '@/utils/print'

defineOptions({ name: 'SystemLoginLog' })

interface LoginLogRecord {
  id: number
  username: string
  loginAccount: string
  ip: string
  location: string
  browser: string
  os: string
  status: 'success' | 'fail'
  message: string
  loginTime: string
  duration: number
  userAgent: string
}

const containerClassName = cn('space-y-4')
const cardClassName = cn('shadow-sm')
const statsGridClassName = cn('grid', 'grid-cols-4', 'gap-4')
const tagClassName = cn('inline-flex', 'items-center', 'gap-1')
const actionClassName = cn('flex', 'items-center', 'justify-center')
const btnClassName = cn('!px-0.5')
const dividerClassName = cn('mx-0')
const failCardClassName = cn('border-red-200', 'dark:border-red-900')

// 统计数据 — 从 API 获取
const todayLoginCount = ref(0)
const weekLoginCount = ref(0)
const monthLoginCount = ref(0)
const todayFailCount = ref(0)

const viewingRecord = ref<LoginLogRecord | null>(null)

const [drawerRegister, drawerMethods] = useDrawer()
const [tableRegister, tableMethods] = useTable()

// 加载统计数据
async function loadStats() {
  try {
    const res = await getLoginLogStats()
    const data = res.data || {}
    todayLoginCount.value = data.todayCount || 0
    weekLoginCount.value = data.weekCount || 0
    monthLoginCount.value = data.monthCount || 0
    todayFailCount.value = data.todayFailCount || 0
  }
  catch (e) {
    console.error('获取统计失败', e)
  }
}

loadStats()

const searchFormSchemas: FormSchema[] = [
  {
    field: 'username',
    label: '用户名',
    component: 'Input',
    componentProps: {
      placeholder: '请输入用户名',
      allowClear: true,
    },
    colProps: { span: 6 },
  },
  {
    field: 'ip',
    label: '登录IP',
    component: 'Input',
    componentProps: {
      placeholder: '请输入IP地址',
      allowClear: true,
    },
    colProps: { span: 6 },
  },
  {
    field: 'status',
    label: '登录状态',
    component: 'Select',
    componentProps: {
      placeholder: '选择登录状态',
      allowClear: true,
      options: [
        { label: '全部', value: '' },
        { label: '成功', value: 'success' },
        { label: '失败', value: 'fail' },
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
    colProps: { span: 6 },
  },
]

const detailSchemas: DescriptionItem[] = [
  { field: 'id', label: '日志编号' },
  { field: 'username', label: '用户名' },
  { field: 'loginAccount', label: '登录账号' },
  { field: 'ip', label: 'IP 地址' },
  { field: 'location', label: '登录地点' },
  { field: 'browser', label: '浏览器' },
  { field: 'os', label: '操作系统' },
  {
    field: 'status',
    label: '登录状态',
    render: value => (
      <a-tag color={value === 'success' ? 'green' : 'red'}>
        {value === 'success' ? '成功' : '失败'}
      </a-tag>
    ),
  },
  { field: 'message', label: '登录消息' },
  { field: 'loginTime', label: '登录时间' },
  {
    field: 'duration',
    label: '登录耗时',
    render: (value) => {
      const ms = value as number
      const color = ms > 1000 ? 'red' : ms > 500 ? 'orange' : 'green'
      return (
        <a-tag color={color}>
          {ms}
          {' '}
          ms
        </a-tag>
      )
    },
  },
  {
    field: 'userAgent',
    label: 'User-Agent',
    render: value => (
      <a-typography-paragraph
        copyable={{ text: value as string }}
        ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
        style={{ margin: 0, maxWidth: 480 }}
        code
      >
        {(value as string) || '-'}
      </a-typography-paragraph>
    ),
  },
]

// API 适配层
async function mockApi(params: Record<string, any>) {
  const res = await getLoginLogList(params)
  // 兼容 mock 直接返回完整响应或已解包的数据
  const data = res?.data ?? res
  return { items: data?.list || [], total: data?.total || 0 }
}

function handleView(record: LoginLogRecord | any) {
  viewingRecord.value = record as LoginLogRecord
  drawerMethods.openDrawer()
}

function handleDelete(record: LoginLogRecord | any) {
  // Mock 环境下仅做前端删除反馈，实际应调用 delete API
  message.success(`已删除日志 #${record.id}`)
  tableMethods.value?.reload()
}

function handleBatchDelete() {
  const selectedRows = (tableMethods.value?.getSelectRows?.() || []) as LoginLogRecord[]
  if (selectedRows.length === 0) {
    message.warning('请先选择要删除的日志')
    return
  }
  message.success(`批量删除 ${selectedRows.length} 条日志成功`)
  tableMethods.value?.reload()
}

function handleExport() {
  const selectedRows = (tableMethods.value?.getSelectRows?.() || []) as LoginLogRecord[]
  const dataToExport = selectedRows.length > 0 ? selectedRows : []

  exportToExcel({
    filename: '登录日志',
    sheetName: '登录日志',
    columns: [
      { header: '日志编号', key: 'id', width: 10 },
      { header: '用户名', key: 'username', width: 12 },
      { header: '登录账号', key: 'loginAccount', width: 14 },
      { header: 'IP地址', key: 'ip', width: 16 },
      { header: '登录地点', key: 'location', width: 18 },
      { header: '浏览器', key: 'browser', width: 20 },
      { header: '操作系统', key: 'os', width: 16 },
      { header: '登录状态', key: 'status', width: 10 },
      { header: '登录消息', key: 'message', width: 24 },
      { header: '登录耗时(ms)', key: 'duration', width: 12 },
      { header: '登录时间', key: 'loginTime', width: 20 },
    ],
    data: dataToExport.map(i => ({
      ...i,
      status: i.status === 'success' ? '成功' : '失败',
    })),
  })
}

function handlePrint() {
  usePrint({
    title: '登录日志',
    target: '.ant-card-body',
  })
}

function handleClear() {
  message.success('日志清空成功')
  tableMethods.value?.reload()
}

const columns: BasicColumn[] = [
  { title: '#', key: 'index', width: 60, align: 'center', customRender: ({ index }) => index + 1 },
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70, align: 'center' },
  { title: '用户名', dataIndex: 'username', key: 'username', width: 110, align: 'center' },
  { title: '登录账号', dataIndex: 'loginAccount', key: 'loginAccount', width: 120, align: 'center' },
  { title: '登录IP', dataIndex: 'ip', key: 'ip', width: 140, align: 'center' },
  { title: '登录地点', dataIndex: 'location', key: 'location', width: 130, ellipsis: true },
  { title: '浏览器', dataIndex: 'browser', key: 'browser', width: 150, ellipsis: true },
  { title: '操作系统', dataIndex: 'os', key: 'os', width: 140, ellipsis: true },
  { title: '登录状态', dataIndex: 'status', key: 'status', width: 90, align: 'center' },
  { title: '登录消息', dataIndex: 'message', key: 'message', width: 200, ellipsis: true },
  { title: '登录时间', dataIndex: 'loginTime', key: 'loginTime', width: 170 },
]
</script>

<template>
  <div :class="containerClassName">
    <!-- 统计卡片区域 -->
    <div :class="statsGridClassName">
      <a-card
        :class="cardClassName"
        size="small"
      >
        <a-statistic
          title="今日登录次数"
          :value="todayLoginCount"
          suffix="次"
        >
          <template #prefix>
            <Icon
              icon="carbon:login"
              class="text-blue-500 text-lg mr-1"
            />
          </template>
        </a-statistic>
      </a-card>
      <a-card
        :class="cardClassName"
        size="small"
      >
        <a-statistic
          title="本周登录次数"
          :value="weekLoginCount"
          suffix="次"
        >
          <template #prefix>
            <Icon
              icon="carbon:calendar"
              class="text-green-500 text-lg mr-1"
            />
          </template>
        </a-statistic>
      </a-card>
      <a-card
        :class="cardClassName"
        size="small"
      >
        <a-statistic
          title="本月登录次数"
          :value="monthLoginCount"
          suffix="次"
        >
          <template #prefix>
            <Icon
              icon="carbon:chart-line-data"
              class="text-orange-500 text-lg mr-1"
            />
          </template>
        </a-statistic>
      </a-card>
      <a-card
        :class="[cardClassName,
                 failCardClassName]"
        size="small"
      >
        <a-statistic
          title="今日失败次数"
          :value="todayFailCount"
          suffix="次"
          :value-style="{ color: '#cf1322' }"
        >
          <template #prefix>
            <Icon
              icon="carbon:error"
              class="text-red-500 text-lg mr-1"
            />
          </template>
        </a-statistic>
      </a-card>
    </div>

    <!-- 表格区域 -->
    <a-card
      title="登录日志"
      :class="cardClassName"
    >
      <BasicTable
        :columns="columns"
        :api="mockApi"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
        :action-column="{ width: 180, title: '操作', fixed: 'right' }"
        :row-selection="{ type: 'checkbox' }"
        :pagination="{ showSizeChanger: true,
                       pageSizeOptions: ['10',
                                         '20',
                                         '50'] }"
        :scroll="{ x: 1600 }"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button @click="handleExport">
            <template #icon>
              <Icon icon="carbon:export" />
            </template>
            导出
          </a-button>
          <a-button @click="handlePrint">
            <template #icon>
              <Icon icon="carbon:printer" />
            </template>
            打印
          </a-button>
          <a-button
            danger
            @click="handleBatchDelete"
          >
            <template #icon>
              <Icon icon="ant-design:delete-outlined" />
            </template>
            批量删除
          </a-button>
          <a-popconfirm
            title="确定要清空所有登录日志吗？此操作不可恢复！"
            @confirm="handleClear"
          >
            <a-button danger>
              <template #icon>
                <Icon icon="carbon:trash-can" />
              </template>
              清空
            </a-button>
          </a-popconfirm>
        </template>

        <template #cell-status="{ record }">
          <a-tag :color="record.status === 'success' ? 'green' : 'red'">
            <span :class="tagClassName">
              <Icon :icon="record.status === 'success' ? 'carbon:checkmark-outline' : 'carbon:close-outline'" />
              {{ record.status === 'success' ? '成功' : '失败' }}
            </span>
          </a-tag>
        </template>

        <template #action="{ record }">
          <div :class="actionClassName">
            <a-button
              type="link"
              :class="btnClassName"
              @click="() => handleView(record)"
            >
              <template #icon>
                <Icon icon="ant-design:eye-outlined" />
              </template>
              详情
            </a-button>
            <a-divider
              type="vertical"
              :class="dividerClassName"
            />
            <a-popconfirm
              :title="`确定要删除日志 #${record.id} 吗？`"
              @confirm="() => handleDelete(record)"
            >
              <a-button
                type="link"
                danger
                :class="btnClassName"
              >
                <template #icon>
                  <Icon icon="ant-design:delete-outlined" />
                </template>
                删除
              </a-button>
            </a-popconfirm>
          </div>
        </template>
      </BasicTable>
    </a-card>

    <!-- 详情抽屉 -->
    <BasicDrawer
      title="登录日志详情"
      :width="640"
      :show-footer="false"
      @register="drawerRegister"
    >
      <DetailDescription
        v-if="viewingRecord"
        :data="viewingRecord"
        :schema="detailSchemas"
        :column="1"
        bordered
      />

      <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <a-alert
          message="提示：如发现异常登录记录，请及时修改密码并联系安全管理人员"
          type="warning"
          show-icon
        />
      </div>
    </BasicDrawer>
  </div>
</template>
