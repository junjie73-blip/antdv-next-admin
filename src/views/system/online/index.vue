<script setup lang="tsx">
import type { DescriptionItem } from '@/components/business/Description'
import type { FormSchema } from '@/components/business/Form'
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { onMounted, onUnmounted, ref } from 'vue'
import { forceLogout, getOnlineUserList } from '@/api/system'
import { Description as DetailDescription } from '@/components/business/Description'
import { BasicDrawer, useDrawer } from '@/components/business/Drawer'
import { BasicTable, useTable } from '@/components/business/Table'
import { cn } from '@/utils/cn'
import { exportToExcel } from '@/utils/excel'
import { usePrint } from '@/utils/print'

defineOptions({ name: 'SystemOnline' })

dayjs.extend(relativeTime)

interface OnlineUserRecord {
  tokenId: string
  sessionId: string
  username: string
  nickname: string
  ip: string
  location: string
  browser: string
  os: string
  loginTime: string
  status: number
}

const containerClassName = cn('space-y-4')
const cardClassName = cn('shadow-sm')
const tagClassName = cn('inline-flex items-center gap-1')
const actionClassName = cn('flex', 'items-center', 'justify-center')
const btnClassName = cn('!px-0.5')
const dividerClassName = cn('mx-0')

const viewingRecord = ref<OnlineUserRecord | null>(null)
const onlineCount = ref(0)

let refreshTimer: ReturnType<typeof setInterval> | null = null

const [drawerRegister, drawerMethods] = useDrawer()
const [tableRegister, tableMethods] = useTable()

const searchFormSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    componentProps: {
      placeholder: '搜索用户名/昵称/IP地址...',
      allowClear: true,
    },
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
        { label: '在线', value: 0 },
        { label: '已离线', value: 1 },
      ],
    },
    colProps: { span: 6 },
  },
]

const detailSchemas: DescriptionItem[] = [
  { field: 'tokenId', label: '会话标识' },
  { field: 'sessionId', label: 'Session ID' },
  { field: 'username', label: '用户名' },
  { field: 'nickname', label: '昵称' },
  { field: 'ip', label: 'IP 地址' },
  { field: 'location', label: '登录地点' },
  { field: 'browser', label: '浏览器' },
  { field: 'os', label: '操作系统' },
  {
    field: 'loginTime',
    label: '登录时间',
    render: value => (
      <span>
        {value as string}
        {' '}
        (
        {dayjs(value as string).fromNow(true)}
        前)
      </span>
    ),
  },
  {
    field: 'status',
    label: '在线状态',
    render: value => (
      <a-tag color={(value as number) === 0 ? 'green' : 'default'}>
        {(value as number) === 0 ? '在线' : '离线'}
      </a-tag>
    ),
  },
]

async function mockApi(params: Record<string, any>) {
  const res = await getOnlineUserList(params)
  const data = res?.data ?? res
  const items = data?.list || []
  onlineCount.value = data?.total || items.length
  return { items, total: data?.total || 0 }
}

function handleView(record: OnlineUserRecord | any) {
  viewingRecord.value = record as OnlineUserRecord
  drawerMethods.openDrawer()
}

async function handleForceLogout(record: OnlineUserRecord | any) {
  const rec = record as OnlineUserRecord
  // 不能踢出自己
  if (rec.username === 'admin') {
    message.warning('不能强制退出当前登录用户')
    return
  }

  try {
    await forceLogout(rec.tokenId)
    message.success(`已强制退出用户「${rec.nickname}」`)
    tableMethods.value?.reload()
  }
  catch {
    message.error('强制退出失败')
  }
}

async function handleBatchForceLogout() {
  const selectedRows = (tableMethods.value?.getSelectRows?.() || []) as OnlineUserRecord[]
  if (selectedRows.length === 0) {
    message.warning('请先选择要强退的用户')
    return
  }

  // 过滤掉 admin 用户
  const canKick = selectedRows.filter(r => r.username !== 'admin')
  if (canKick.length === 0) {
    message.warning('选中的用户包含当前登录用户，无法全部强退')
    return
  }

  try {
    await Promise.all(canKick.map(r => forceLogout(r.tokenId)))
    const kickedNames = canKick.map(r => r.nickname)
    message.success(`已强制退出 ${kickedNames.length} 个会话：${kickedNames.join('、')}`)
    tableMethods.value?.reload()
  }
  catch {
    message.error('批量强制退出失败')
  }
}

function handleExport() {
  const tableData = (tableMethods.value?.getDataSource?.() || []) as OnlineUserRecord[]
  exportToExcel({
    filename: '在线用户',
    sheetName: '在线用户',
    columns: [
      { header: '会话标识', key: 'tokenId', width: 22 },
      { header: '用户名', key: 'username', width: 14 },
      { header: '昵称', key: 'nickname', width: 12 },
      { header: 'IP地址', key: 'ip', width: 16 },
      { header: '登录地点', key: 'location', width: 16 },
      { header: '浏览器', key: 'browser', width: 18 },
      { header: '操作系统', key: 'os', width: 16 },
      { header: '登录时间', key: 'loginTime', width: 20 },
      { header: '状态', key: 'status', width: 8 },
    ],
    data: tableData.map(i => ({ ...i, status: i.status === 0 ? '在线' : '离线' })),
  })
}

function handlePrint() {
  usePrint({
    title: '在线用户',
    target: '.ant-card-body',
  })
}

function updateOnlineCount() {
  // 在线数量已在 mockApi 中从 API 响应更新
}

// 模拟实时刷新在线列表
function startAutoRefresh() {
  stopAutoRefresh()
  refreshTimer = setInterval(() => {
    tableMethods.value?.reload()
  }, 30000) // 每30秒刷新一次
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

onMounted(() => {
  updateOnlineCount()
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})

const columns: BasicColumn[] = [
  { title: '#', key: 'index', width: 60, align: 'center', customRender: ({ index }) => index + 1 },
  { title: '会话标识', dataIndex: 'tokenId', key: 'tokenId', width: 180, ellipsis: true },
  { title: '用户名', dataIndex: 'username', key: 'username', width: 110, align: 'center' },
  { title: '昵称', dataIndex: 'nickname', key: 'nickname', width: 110, align: 'center' },
  { title: 'IP 地址', dataIndex: 'ip', key: 'ip', width: 140, align: 'center' },
  { title: '登录地点', dataIndex: 'location', key: 'location', width: 130, ellipsis: true },
  { title: '浏览器', dataIndex: 'browser', key: 'browser', width: 160, ellipsis: true },
  { title: '操作系统', dataIndex: 'os', key: 'os', width: 130, ellipsis: true },
  { title: '登录时间', dataIndex: 'loginTime', key: 'loginTime', width: 170, align: 'center' },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 80,
    align: 'center',
  },
]
</script>

<template>
  <div :class="containerClassName">
    <!-- 在线统计卡片 -->
    <div class="grid grid-cols-4 gap-4">
      <a-card
        :class="cardClassName"
        size="small"
      >
        <a-statistic
          title="当前在线"
          :value="onlineCount"
          suffix="人"
        >
          <template #prefix>
            <Icon
              icon="carbon:user-online"
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
          title="今日登录"
          :value="28"
          suffix="人次"
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
          title="峰值在线"
          :value="15"
          suffix="人"
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
        :class="cardClassName"
        size="small"
      >
        <a-statistic
          title="平均在线时长"
          value="2.5"
          suffix="小时"
        >
          <template #prefix>
            <Icon
              icon="carbon:time"
              class="text-purple-500 text-lg mr-1"
            />
          </template>
        </a-statistic>
      </a-card>
    </div>

    <a-card
      title="在线用户"
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
        :scroll="{ x: 1500 }"
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
            @click="handleBatchForceLogout"
          >
            <template #icon>
              <Icon icon="carbon:logout" />
            </template>
            批量强退
          </a-button>
        </template>

        <template #cell-status="{ record }">
          <a-tag :color="record.status === 0 ? 'green' : 'default'">
            <span :class="tagClassName">
              <Icon :icon="record.status === 0 ? 'carbon:dot-mark' : 'carbon:close-outline'" />
              {{ record.status === 0 ? '在线' : '离线' }}
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
              :title="`确定要强制退出用户「${record.nickname}」吗？`"
              @confirm="() => handleForceLogout(record)"
            >
              <a-button
                v-if="record.username !== 'admin'"
                type="link"
                danger
                :class="btnClassName"
              >
                <template #icon>
                  <Icon icon="carbon:logout" />
                </template>
                强退
              </a-button>
              <span
                v-else
                class="text-gray-400 text-xs"
              >
                当前用户
              </span>
            </a-popconfirm>
          </div>
        </template>
      </BasicTable>
    </a-card>

    <!-- 用户详情抽屉 -->
    <BasicDrawer
      title="在线用户详情"
      :width="520"
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
          message="提示：该用户的会话信息将在下次请求时失效"
          type="info"
          show-icon
        />
      </div>
    </BasicDrawer>
  </div>
</template>
