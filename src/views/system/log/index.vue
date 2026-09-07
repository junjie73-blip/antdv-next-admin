<script setup lang="tsx">
import type { DescriptionItem } from '@/components/business/Description'
import type { FormSchema } from '@/components/business/Form'
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'

import { computed, ref } from 'vue'
import { deleteOperLog, getOperLogList } from '@/api/system'
import { BasicDrawer, useDrawer } from '@/components/business/Drawer'
import { BasicTable, useTable } from '@/components/business/Table'
import { cn } from '@/utils/cn'
import { exportToExcel } from '@/utils/excel'

defineOptions({ name: 'SystemLog' })

// 操作日志类型
interface OperLogRecord {
  id: number
  operName: string
  operType: string
  title: string
  method: string
  requestMethod: string
  operatorType: number
  operUrl: string
  operIp: string
  operLocation: string
  operParam: string
  jsonResult: string | null
  status: number
  errorMsg: string
  operTime: string
  costTime: number
}

// 登录日志类型
interface LoginLogRecord {
  id: number
  userName: string
  ipaddr: string
  loginLocation: string
  browser: string
  os: string
  status: number
  msg: string
  loginTime: string
}

// 样式变量
const containerClassName = cn('space-y-4')
const cardClassName = cn('shadow-sm rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900')
const filterBarClassName = cn('flex items-center gap-3 flex-wrap px-6 py-4 border-b border-gray-100 dark:border-gray-800')
const dividerClassName = cn('mx-0')
const actionClassName = cn('flex items-center justify-center')
const btnClassName = cn('!px-0.5')

// 标签页
const activeTab = ref(0)
const tabItems = [
  { key: 0, label: '操作日志' },
  { key: 1, label: '登录日志' },
  { key: 2, label: '错误日志' },
]

const tabClassName = (active: boolean) => cn(
  'px-5 py-3 text-sm font-medium cursor-pointer border-b-2 transition-colors duration-150 bg-transparent border-t-0 border-l-0 border-r-0 font-[inherit]',
  active
    ? 'text-ant-primary border-ant-primary'
    : 'text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300',
)

// 操作类型映射
const operTypeColorMap: Record<string, string> = {
  其他: 'default',
  登录: 'blue',
  新增: 'green',
  修改: 'blue',
  删除: 'red',
  授权: 'cyan',
  导出: 'orange',
  导入: 'purple',
  强退: 'magenta',
  生成代码: 'geekblue',
  清空数据: 'volcano',
}

const statusColorMap: Record<number, string> = { 0: 'green', 1: 'red' }
const statusLabelMap: Record<number, string> = { 0: '成功', 1: '失败' }

const operatorTypeLabelMap: Record<number, string> = { 1: '后台用户', 2: '手机端用户' }

// 操作日志
const viewingRecord = ref<OperLogRecord | null>(null)
const [drawerRegister, drawerMethods] = useDrawer()
const [tableRegister, tableMethods] = useTable()

// 登录日志
const [loginTableRegister, loginTableMethods] = useTable()

const operTypeOptions = [
  { label: '其他', value: '其他' }, { label: '登录', value: '登录' },
  { label: '新增', value: '新增' }, { label: '修改', value: '修改' },
  { label: '删除', value: '删除' }, { label: '授权', value: '授权' },
  { label: '导出', value: '导出' }, { label: '导入', value: '导入' },
  { label: '强退', value: '强退' }, { label: '生成代码', value: '生成代码' },
  { label: '清空数据', value: '清空数据' },
]

const searchFormSchemas: FormSchema[] = [
  {
    field: 'operName', label: '操作人', component: 'Input',
    componentProps: { placeholder: '请输入操作人名称', allowClear: true },
    colProps: { span: 6 },
  },
  {
    field: 'operType', label: '操作类型', component: 'Select',
    componentProps: { placeholder: '选择操作类型', allowClear: true, options: operTypeOptions },
    colProps: { span: 6 },
  },
  {
    field: 'status', label: '状态', component: 'Select',
    componentProps: { placeholder: '选择状态', allowClear: true, options: [{ label: '成功', value: 0 }, { label: '失败', value: 1 }] },
    colProps: { span: 6 },
  },
  {
    field: 'dateRange', label: '操作时间', component: 'RangePicker',
    componentProps: { placeholder: ['开始时间', '结束时间'], format: 'YYYY-MM-DD HH:mm:ss', showTime: true, allowClear: true },
    colProps: { span: 6 },
  },
]

// 登录日志搜索表单
const loginSearchFormSchemas: FormSchema[] = [
  {
    field: 'userName', label: '用户名', component: 'Input',
    componentProps: { placeholder: '请输入用户名', allowClear: true },
    colProps: { span: 6 },
  },
  {
    field: 'ipaddr', label: 'IP地址', component: 'Input',
    componentProps: { placeholder: '请输入IP地址', allowClear: true },
    colProps: { span: 6 },
  },
  {
    field: 'status', label: '状态', component: 'Select',
    componentProps: { placeholder: '选择状态', allowClear: true, options: [{ label: '成功', value: 0 }, { label: '失败', value: 1 }] },
    colProps: { span: 6 },
  },
  {
    field: 'dateRange', label: '登录时间', component: 'RangePicker',
    componentProps: { placeholder: ['开始时间', '结束时间'], format: 'YYYY-MM-DD HH:mm:ss', showTime: true, allowClear: true },
    colProps: { span: 6 },
  },
]

// 操作日志详情 schema
const detailSchemas: DescriptionItem[] = [
  { field: 'id', label: '日志编号' },
  { field: 'operName', label: '操作人' },
  { field: 'operType', label: '操作类型', render: value => <a-tag color={operTypeColorMap[value as string] || 'default'}>{value}</a-tag> },
  { field: 'title', label: '操作模块' },
  { field: 'method', label: '请求方法', render: value => <span class="block truncate max-w-[300px]" title={value as string}>{value || '-'}</span> },
  { field: 'requestMethod', label: '请求方式', render: (value) => {
    const m: Record<string, string> = { GET: 'green', POST: 'blue', PUT: 'orange', DELETE: 'red' }
    return <a-tag color={m[value as string] || 'default'}>{value}</a-tag>
  } },
  { field: 'operatorType', label: '操作类别', render: value => <span>{operatorTypeLabelMap[value as number] || '未知'}</span> },
  { field: 'operUrl', label: '请求URL', render: value => <span class="block truncate max-w-[300px]" title={value as string}>{value || '-'}</span> },
  { field: 'operIp', label: '主机地址' },
  { field: 'operLocation', label: '操作地点' },
  { field: 'operParam', label: '请求参数', render: value => <a-typography-paragraph copyable={{ text: value as string }} ellipsis={{ rows: 2, expandable: true, symbol: '展开' }} style={{ margin: 0, maxWidth: 400 }} code>{(value as string) || '-'}</a-typography-paragraph> },
  { field: 'jsonResult', label: '返回结果', render: value => value ? <a-typography-paragraph copyable={{ text: value as string }} ellipsis={{ rows: 2, expandable: true, symbol: '展开' }} style={{ margin: 0, maxWidth: 400 }} code>{value as string}</a-typography-paragraph> : <span class="text-gray-400">-</span> },
  { field: 'status', label: '操作状态', render: value => <a-tag color={statusColorMap[value as number] || 'default'}>{statusLabelMap[value as number] || '未知'}</a-tag> },
  { field: 'errorMsg', label: '错误消息', render: value => (value as string) ? <a-typography-paragraph type="danger" ellipsis={{ rows: 2, expandable: true, symbol: '展开' }} style={{ margin: 0, maxWidth: 400 }}>{value as string}</a-typography-paragraph> : <span class="text-gray-400">-</span> },
  { field: 'operTime', label: '操作时间' },
  { field: 'costTime', label: '消耗时间', render: (value) => {
    const ms = value as number
    const color = ms > 1000 ? 'red' : ms > 500 ? 'orange' : 'green'
    return <a-tag color={color}>{ms} ms</a-tag>
  } },
]

// 操作日志 API
async function mockApi(params: Record<string, any>) {
  const res = await getOperLogList(params)
  const data = res?.data ?? res
  return { items: data?.list || [], total: data?.total || 0 }
}

// 登录日志 Mock API
async function mockLoginApi(params: Record<string, any>) {
  const { getLoginLogList } = await import('@/api/system')
  const res = await getLoginLogList(params)
  const data = res?.data ?? res
  return { items: data?.list || [], total: data?.total || 0 }
}

function handleView(record: OperLogRecord) {
  viewingRecord.value = record
  drawerMethods.openDrawer()
}

async function handleDelete(record: OperLogRecord) {
  try {
    await deleteOperLog(record.id)
    message.success(`已删除日志 #${record.id}`)
    tableMethods.value?.reload()
  } catch {
    message.error('删除失败')
  }
}

async function handleBatchDelete() {
  const selectedRows = (tableMethods.value?.getSelectRows?.() || []) as OperLogRecord[]
  if (selectedRows.length === 0) {
    message.warning('请先选择要删除的日志')
    return
  }
  try {
    await Promise.all(selectedRows.map(row => deleteOperLog(row.id)))
    message.success(`批量删除 ${selectedRows.length} 条日志成功`)
    tableMethods.value?.reload()
  } catch {
    message.error('批量删除失败')
  }
}

function handleExport() {
  const selectedRows = (tableMethods.value?.getSelectRows?.() || []) as OperLogRecord[]
  const dataToExport = selectedRows.length > 0 ? selectedRows : (tableMethods.value?.getDataSource?.() || []) as OperLogRecord[]
  exportToExcel({
    filename: '系统日志',
    sheetName: '系统日志',
    columns: [
      { header: '日志编号', key: 'id', width: 10 },
      { header: '操作人', key: 'operName', width: 12 },
      { header: '操作类型', key: 'operType', width: 10 },
      { header: '操作模块', key: 'title', width: 14 },
      { header: '请求方式', key: 'requestMethod', width: 8 },
      { header: '请求URL', key: 'operUrl', width: 30 },
      { header: '主机地址', key: 'operIp', width: 16 },
      { header: '操作地点', key: 'operLocation', width: 18 },
      { header: '操作状态', key: 'status', width: 8 },
      { header: '消耗时间(ms)', key: 'costTime', width: 12 },
      { header: '操作时间', key: 'operTime', width: 20 },
    ],
    data: dataToExport.map(i => ({ ...i, status: i.status === 0 ? '成功' : '失败' })),
  })
}

function handleClear() {
  message.success('日志清空成功')
  tableMethods.value?.reload()
}

// 操作日志列
const columns: BasicColumn[] = [
  { title: '#', key: 'index', width: 60, align: 'center', customRender: ({ index }) => index + 1 },
  { title: '操作模块', dataIndex: 'title', key: 'title', width: 120 },
  { title: '操作类型', dataIndex: 'operType', key: 'operType', width: 90, align: 'center' },
  { title: '操作人员', dataIndex: 'operName', key: 'operName', width: 100, align: 'center' },
  { title: 'IP地址', dataIndex: 'operIp', key: 'operIp', width: 140, ellipsis: true },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center' },
  { title: '耗时(ms)', dataIndex: 'costTime', key: 'costTime', width: 90, align: 'center' },
  { title: '操作时间', dataIndex: 'operTime', key: 'operTime', width: 165 },
]

// 登录日志列
const loginColumns: BasicColumn[] = [
  { title: '#', key: 'index', width: 60, align: 'center', customRender: ({ index }) => index + 1 },
  { title: '用户名', dataIndex: 'userName', key: 'userName', width: 100 },
  { title: 'IP地址', dataIndex: 'ipaddr', key: 'ipaddr', width: 140, ellipsis: true },
  { title: '登录地点', dataIndex: 'loginLocation', key: 'loginLocation', width: 150, ellipsis: true },
  { title: '浏览器', dataIndex: 'browser', key: 'browser', width: 120, ellipsis: true },
  { title: '操作系统', dataIndex: 'os', key: 'os', width: 120, ellipsis: true },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center' },
  { title: '登录时间', dataIndex: 'loginTime', key: 'loginTime', width: 165 },
  { title: '备注', dataIndex: 'msg', key: 'msg', width: 120, ellipsis: true },
]
</script>

<template>
  <div :class="containerClassName">
    <div :class="cardClassName">
      <!-- 标签页 -->
      <div class="flex border-b border-gray-200 dark:border-gray-700 px-6 mb-4">
        <button
          v-for="tab in tabItems"
          :key="tab.key"
          :class="tabClassName(activeTab === tab.key)"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- 操作日志 -->
      <template v-if="activeTab === 0">
        <BasicTable
          :columns="columns"
          :api="mockApi"
          :immediate="true"
          :use-search-form="true"
          :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
          :action-column="{ width: 160, title: '操作', fixed: 'right' }"
          :row-selection="{ type: 'checkbox' }"
          :pagination="{ showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }"
          :scroll="{ x: 1300 }"
          @register="tableRegister"
        >
          <template #toolbar>
            <a-button @click="handleExport">
              <template #icon><Icon icon="carbon:export" /></template>
              导出
            </a-button>
            <a-button danger @click="handleBatchDelete">
              <template #icon><Icon icon="ant-design:delete-outlined" /></template>
              批量删除
            </a-button>
            <a-popconfirm title="确定要清空所有系统日志吗？此操作不可恢复！" @confirm="handleClear">
              <a-button danger>
                <template #icon><Icon icon="carbon:trash-can" /></template>
                清空
              </a-button>
            </a-popconfirm>
          </template>

          <template #cell-operType="{ record }">
            <a-tag :color="operTypeColorMap[record.operType] || 'default'">
              {{ record.operType }}
            </a-tag>
          </template>

          <template #cell-status="{ record }">
            <a-tag :color="statusColorMap[record.status] || 'default'">
              <span class="inline-flex items-center gap-1">
                <Icon :icon="record.status === 0 ? 'carbon:checkmark-outline' : 'carbon:close-outline'" />
                {{ statusLabelMap[record.status] || '未知' }}
              </span>
            </a-tag>
          </template>

          <template #cell-costTime="{ record }">
            <span
              :style="{
                color: record.costTime > 500 ? 'var(--color-warning, #d97706)' : 'inherit',
                fontWeight: record.costTime > 500 ? '500' : 'normal',
              }"
            >
              {{ record.costTime }}
            </span>
          </template>

          <template #action="{ record }">
            <div :class="actionClassName">
              <a-button type="link" :class="btnClassName" @click="() => handleView(record)">
                <template #icon><Icon icon="ant-design:eye-outlined" /></template>
                详情
              </a-button>
              <a-divider type="vertical" :class="dividerClassName" />
              <a-popconfirm :title="`确定要删除日志 #${record.id} 吗？`" @confirm="() => handleDelete(record)">
                <a-button type="link" danger :class="btnClassName">
                  <template #icon><Icon icon="ant-design:delete-outlined" /></template>
                  删除
                </a-button>
              </a-popconfirm>
            </div>
          </template>
        </BasicTable>
      </template>

      <!-- 登录日志 -->
      <template v-if="activeTab === 1">
        <BasicTable
          :columns="loginColumns"
          :api="mockLoginApi"
          :immediate="true"
          :use-search-form="true"
          :form-config="{ schemas: loginSearchFormSchemas, labelWidth: 80 }"
          :action-column="{ width: 0, title: '操作', fixed: 'right' }"
          :show-table-setting="false"
          :pagination="{ showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }"
          :scroll="{ x: 1200 }"
          @register="loginTableRegister"
        >
          <template #cell-status="{ record }">
            <a-tag :color="record.status === 0 ? 'green' : 'red'">
              {{ record.status === 0 ? '成功' : '失败' }}
            </a-tag>
          </template>
        </BasicTable>
      </template>

      <!-- 错误日志 -->
      <template v-if="activeTab === 2">
        <div class="py-20 text-center">
          <Icon
            icon="carbon:checkmark-outline"
            class="text-6xl text-gray-300 dark:text-gray-600 mb-4"
          />
          <div class="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-2">
            暂无错误日志
          </div>
          <div class="text-sm text-gray-400">
            系统运行正常，当前没有错误日志记录
          </div>
        </div>
      </template>
    </div>

    <!-- 日志详情抽屉 -->
    <BasicDrawer
      title="操作日志详情"
      :width="640"
      :show-footer="false"
      @register="drawerRegister"
    >
      <div v-if="viewingRecord" class="relative pl-6">
        <div class="absolute left-[7px] top-0 bottom-0 w-[2px] bg-gray-200 dark:bg-gray-700" />
        <div class="space-y-6">
          <div class="relative pb-6">
            <div class="absolute left-[-23px] top-[2px] w-3 h-3 rounded-full border-2 border-green-500 bg-white dark:bg-gray-900 z-[1]" />
            <div class="text-xs text-gray-400 mb-1">操作时间</div>
            <div class="text-sm">{{ viewingRecord.operTime }}</div>
          </div>
          <div class="relative pb-6">
            <div class="absolute left-[-23px] top-[2px] w-3 h-3 rounded-full border-2 border-ant-primary bg-white dark:bg-gray-900 z-[1]" />
            <div class="text-xs text-gray-400 mb-1">操作模块</div>
            <div class="text-sm">{{ viewingRecord.title }}</div>
          </div>
          <div class="relative pb-6">
            <div class="absolute left-[-23px] top-[2px] w-3 h-3 rounded-full border-2 border-ant-primary bg-white dark:bg-gray-900 z-[1]" />
            <div class="text-xs text-gray-400 mb-1">操作类型</div>
            <div class="text-sm">
              <a-tag :color="operTypeColorMap[viewingRecord.operType] || 'default'">{{ viewingRecord.operType }}</a-tag>
            </div>
          </div>
          <div class="relative pb-6">
            <div class="absolute left-[-23px] top-[2px] w-3 h-3 rounded-full border-2 border-ant-primary bg-white dark:bg-gray-900 z-[1]" />
            <div class="text-xs text-gray-400 mb-1">操作人员</div>
            <div class="text-sm"><span class="text-ant-primary font-medium">{{ viewingRecord.operName }}</span></div>
          </div>
          <div class="relative pb-6">
            <div class="absolute left-[-23px] top-[2px] w-3 h-3 rounded-full border-2 border-ant-primary bg-white dark:bg-gray-900 z-[1]" />
            <div class="text-xs text-gray-400 mb-1">请求URL</div>
            <div class="text-sm"><code class="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">{{ viewingRecord.operUrl }}</code></div>
          </div>
          <div class="relative pb-6">
            <div class="absolute left-[-23px] top-[2px] w-3 h-3 rounded-full border-2 border-ant-primary bg-white dark:bg-gray-900 z-[1]" />
            <div class="text-xs text-gray-400 mb-1">IP地址</div>
            <div class="text-sm"><code class="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">{{ viewingRecord.operIp }}</code></div>
          </div>
          <div class="relative pb-6">
            <div class="absolute left-[-23px] top-[2px] w-3 h-3 rounded-full border-2 bg-white dark:bg-gray-900 z-[1]"
              :class="viewingRecord.status === 0 ? 'border-green-500' : 'border-red-500'"
            />
            <div class="text-xs text-gray-400 mb-1">执行状态</div>
            <div class="text-sm">
              <a-tag :color="statusColorMap[viewingRecord.status] || 'default'">
                {{ statusLabelMap[viewingRecord.status] || '未知' }}
              </a-tag>
            </div>
          </div>
          <div class="relative">
            <div class="absolute left-[-23px] top-[2px] w-3 h-3 rounded-full border-2 border-ant-primary bg-white dark:bg-gray-900 z-[1]" />
            <div class="text-xs text-gray-400 mb-1">耗时</div>
            <div class="text-sm">{{ viewingRecord.costTime }}ms</div>
          </div>
        </div>
        <div
          v-if="viewingRecord.errorMsg"
          class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md border-l-[3px] border-red-500"
        >
          <div class="text-sm font-semibold text-red-500 mb-1">错误信息</div>
          <div class="text-sm text-gray-600 dark:text-gray-400">{{ viewingRecord.errorMsg }}</div>
        </div>
      </div>
    </BasicDrawer>
  </div>
</template>