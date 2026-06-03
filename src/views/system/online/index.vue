<script setup lang="tsx">
import type { DescriptionItem } from '@/components/business/Description'
import type { FormSchema } from '@/components/business/Form'
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { onMounted, onUnmounted, ref } from 'vue'
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
const actionClassName = cn('flex', 'items-center')
const btnClassName = cn('!px-0.5')
const dividerClassName = cn('mx-0')

// 模拟在线用户数据
function generateOnlineUsers(): OnlineUserRecord[] {
  const now = dayjs()
  return [
    {
      tokenId: 'tok-admin-001',
      sessionId: 'sess-admin-001',
      username: 'admin',
      nickname: '超级管理员',
      ip: '192.168.1.100',
      location: '北京市朝阳区',
      browser: 'Chrome 125.0',
      os: 'Windows 11',
      loginTime: now.subtract(30, 'minute').format('YYYY-MM-DD HH:mm:ss'),
      status: 0,
    },
    {
      tokenId: 'tok-zhangsan-002',
      sessionId: 'sess-zhangsan-002',
      username: 'zhangsan',
      nickname: '张三',
      ip: '192.168.1.101',
      location: '上海市浦东新区',
      browser: 'Firefox 126.0',
      os: 'Windows 10',
      loginTime: now.subtract(15, 'minute').format('YYYY-MM-DD HH:mm:ss'),
      status: 0,
    },
    {
      tokenId: 'tok-lisi-003',
      sessionId: 'sess-lisi-003',
      username: 'lisi',
      nickname: '李四',
      ip: '192.168.1.102',
      location: '广州市天河区',
      browser: 'Safari 17.4',
      os: 'macOS Sonoma',
      loginTime: now.subtract(8, 'minute').format('YYYY-MM-DD HH:mm:ss'),
      status: 0,
    },
    {
      tokenId: 'tok-wangwu-004',
      sessionId: 'sess-wangwu-004',
      username: 'wangwu',
      nickname: '王五',
      ip: '10.0.0.55',
      location: '内网地址',
      browser: 'Edge 124.0',
      os: 'Windows 11',
      loginTime: now.subtract(45, 'minute').format('YYYY-MM-DD HH:mm:ss'),
      status: 0,
    },
    {
      tokenId: 'tok-zhaoliu-005',
      sessionId: 'sess-zhaoliu-005',
      username: 'zhaoliu',
      nickname: '赵六',
      ip: '172.16.0.88',
      location: '内网地址',
      browser: 'Chrome 125.0',
      os: 'Ubuntu 22.04',
      loginTime: now.subtract(2, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      status: 0,
    },
    {
      tokenId: 'tok-sunqi-006',
      sessionId: 'sess-sunqi-006',
      username: 'sunqi',
      nickname: '孙七',
      ip: '192.168.1.105',
      location: '成都市武侯区',
      browser: 'Chrome Mobile 125.0',
      os: 'iOS 17.5',
      loginTime: now.subtract(5, 'minute').format('YYYY-MM-DD HH:mm:ss'),
      status: 0,
    },
    {
      tokenId: 'tok-zhouba-007',
      sessionId: 'sess-zhouba-007',
      username: 'zhouba',
      nickname: '周八',
      ip: '192.168.1.106',
      location: '武汉市洪山区',
      browser: 'WeChat MiniProgram',
      os: 'Android 14',
      loginTime: now.subtract(12, 'minute').format('YYYY-MM-DD HH:mm:ss'),
      status: 0,
    },
    {
      tokenId: 'tok-wujiu-008',
      sessionId: 'sess-wujiu-008',
      username: 'wujiu',
      nickname: '吴九',
      ip: '192.168.1.107',
      location: '南京市鼓楼区',
      browser: 'Postman Runtime',
      os: 'macOS Ventura',
      loginTime: now.subtract(1, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      status: 0,
    },
  ]
}

const allData = ref<OnlineUserRecord[]>(generateOnlineUsers())
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
    colProps: { span: 8 },
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
  const { keyword, status, page = 1, pageSize = 10 } = params
  let filtered = [...allData.value]

  if (keyword) {
    const kw = String(keyword).toLowerCase()
    filtered = filtered.filter(i =>
      i.username.toLowerCase().includes(kw)
      || i.nickname.toLowerCase().includes(kw)
      || i.ip.includes(kw),
    )
  }

  if (status !== undefined && status !== null && status !== '') {
    filtered = filtered.filter(i => i.status === Number(status))
  }

  // 按登录时间倒序
  filtered.sort((a, b) => dayjs(b.loginTime).valueOf() - dayjs(a.loginTime).valueOf())

  const total = filtered.length
  const startIdx = (Number(page) - 1) * Number(pageSize)
  const items = filtered.slice(startIdx, startIdx + Number(pageSize))

  return { items, total }
}

function handleView(record: OnlineUserRecord | any) {
  viewingRecord.value = record as OnlineUserRecord
  drawerMethods.openDrawer()
}

function handleForceLogout(record: OnlineUserRecord | any) {
  const rec = record as OnlineUserRecord
  // 不能踢出自己
  if (rec.username === 'admin') {
    message.warning('不能强制退出当前登录用户')
    return
  }

  const idx = allData.value.findIndex(i => i.tokenId === rec.tokenId)
  if (idx > -1) {
    allData.value.splice(idx, 1)
    message.success(`已强制退出用户「${rec.nickname}」`)
    tableMethods.value?.reload()
  }
}

function handleBatchForceLogout() {
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

  const kickIds = new Set(canKick.map(r => r.tokenId))
  const kickedNames = canKick.map(r => r.nickname)
  allData.value = allData.value.filter(i => !kickIds.has(i.tokenId))
  message.success(`已强制退出 ${kickedNames.length} 个会话：${kickedNames.join('、')}`)
  tableMethods.value?.reload()
}

function handleExport() {
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
    data: allData.value.map(i => ({ ...i, status: i.status === 0 ? '在线' : '离线' })),
  })
}

function handlePrint() {
  usePrint({
    title: '在线用户',
    target: '.ant-card-body',
  })
}

function updateOnlineCount() {
  onlineCount.value = allData.value.length
}

// 模拟实时刷新在线列表
function startAutoRefresh() {
  stopAutoRefresh()
  refreshTimer = setInterval(() => {
    // 随机模拟有新用户上线或下线（小概率事件）
    if (Math.random() > 0.9) {
      // 模拟新用户上线
      const newId = Date.now()
      const names = ['chenyi', 'liuer', 'huangsan', 'linxi', 'hexu']
      const locations = ['西安市雁塔区', '郑州市金水区', '长沙市岳麓区', '沈阳市和平区', '济南市历下区']
      const browsers = ['Chrome 125.0', 'Firefox 126.0', 'Edge 124.0', 'Safari 17.4']
      const oss = ['Windows 11', 'Windows 10', 'macOS Sonoma', 'Ubuntu 22.04']

      allData.value.push({
        tokenId: `tok-auto-${newId}`,
        sessionId: `sess-auto-${newId}`,
        username: names[Math.floor(Math.random() * names.length)]!,
        nickname: `自动用户${Math.floor(Math.random() * 100)}`,
        ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
        location: locations[Math.floor(Math.random() * locations.length)]!,
        browser: browsers[Math.floor(Math.random() * browsers.length)]!,
        os: oss[Math.floor(Math.random() * oss.length)]!,
        loginTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        status: 0,
      })
      tableMethods.value?.reload()
    }
    else if (Math.random() > 0.95 && allData.value.length > 1) {
      // 模拟用户下线（非 admin）
      const nonAdminUsers = allData.value.filter(u => u.username !== 'admin')
      if (nonAdminUsers.length > 0) {
        const randomIdx = Math.floor(Math.random() * nonAdminUsers.length)
        const userToLeave = nonAdminUsers[randomIdx]
        if (userToLeave) {
          const globalIdx = allData.value.findIndex(u => u.tokenId === userToLeave.tokenId)
          if (globalIdx > -1) {
            allData.value.splice(globalIdx, 1)
            tableMethods.value?.reload()
          }
        }
      }
    }
    updateOnlineCount()
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
  { title: '会话标识', dataIndex: 'tokenId', key: 'tokenId', width: 180, ellipsis: true },
  { title: '用户名', dataIndex: 'username', key: 'username', width: 110, align: 'center' },
  { title: '昵称', dataIndex: 'nickname', key: 'nickname', width: 110 },
  { title: 'IP 地址', dataIndex: 'ip', key: 'ip', width: 140, align: 'center' },
  { title: '登录地点', dataIndex: 'location', key: 'location', width: 130, ellipsis: true },
  { title: '浏览器', dataIndex: 'browser', key: 'browser', width: 160, ellipsis: true },
  { title: '操作系统', dataIndex: 'os', key: 'os', width: 130, ellipsis: true },
  { title: '登录时间', dataIndex: 'loginTime', key: 'loginTime', width: 170 },
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
        :action-column="{ width: 150, title: '操作', fixed: 'right' }"
        :row-selection="{ type: 'checkbox' }"
        :pagination="{ showSizeChanger: true,
                       pageSizeOptions: ['10',
                                         '20',
                                         '50'] }"
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
