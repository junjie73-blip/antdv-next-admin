<script setup lang="tsx">
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { computed, onMounted, ref } from 'vue'
import { BasicTable, useTable } from '@/components/business/Table'
import { cn } from '@/utils/cn'

defineOptions({ name: 'SystemNotice' })

dayjs.extend(relativeTime)

interface NoticeRecord {
  id: number
  title: string
  content: string
  type: number // 1-系统公告 2-通知消息 3-待办提醒
  status: number // 0-未读 1-已读
  priority: number // 0-普通 1-重要 2-紧急
  sender: string
  sendTime: string
  readTime?: string
}

const containerClassName = cn('space-y-4')
const cardClassName = cn('shadow-sm')
const tagClassName = cn('inline-flex items-center gap-1')

// Mock 数据 — 消息通知
const mockNotices: NoticeRecord[] = [
  {
    id: 1,
    title: '系统升级维护通知',
    content: '尊敬的用户，系统将于2024年6月5日 00:00 - 06:00 进行版本升级维护，届时系统将暂停服务，请提前做好相关安排。本次升级将带来以下新特性：\n1. 全新的UI界面设计\n2. 性能优化，响应速度提升50%\n3. 新增数据导出功能\n4. 安全漏洞修复',
    type: 1,
    status: 0,
    priority: 2,
    sender: '系统管理员',
    sendTime: '2024-06-03 08:00:00',
  },
  {
    id: 2,
    title: '关于加强账号安全的通知',
    content: '为保障您的账号安全，请定期修改登录密码，并开启两步验证功能。建议密码长度不少于8位，包含大小写字母、数字和特殊字符。',
    type: 1,
    status: 0,
    priority: 1,
    sender: '安全中心',
    sendTime: '2024-06-02 14:30:00',
  },
  {
    id: 3,
    title: '您有新的审批任务待处理',
    content: '张三提交的「系统权限申请」等待您审批，请在24小时内完成处理。',
    type: 3,
    status: 0,
    priority: 1,
    sender: '工作流系统',
    sendTime: '2024-06-03 09:15:22',
  },
  {
    id: 4,
    title: '欢迎使用新版后台管理系统',
    content: '感谢您使用我们的产品！新版本带来了全新的用户体验和更强大的功能。如有任何问题，请联系技术支持团队。',
    type: 2,
    status: 0,
    priority: 0,
    sender: '产品团队',
    sendTime: '2024-06-01 10:00:00',
  },
  {
    id: 5,
    title: '服务器资源使用率预警',
    content: '检测到生产环境服务器CPU使用率已达到85%，内存使用率达到78%，建议及时扩容或优化应用性能。',
    type: 2,
    status: 0,
    priority: 2,
    sender: '监控系统',
    sendTime: '2024-06-03 11:45:10',
  },
  {
    id: 6,
    title: '数据库备份完成通知',
    content: '今日凌晨自动备份任务已完成，备份数据大小约2.3GB，备份文件已保存至异地灾备中心。',
    type: 2,
    status: 1,
    priority: 0,
    sender: '运维平台',
    sendTime: '2024-06-03 06:00:05',
    readTime: '2024-06-03 08:30:12',
  },
  {
    id: 7,
    title: '月度报表已生成',
    content: '2024年5月份运营数据报表已自动生成，包含用户增长、活跃度、转化率等核心指标分析，请查阅。',
    type: 3,
    status: 1,
    priority: 0,
    sender: '数据分析平台',
    sendTime: '2024-06-03 07:00:00',
    readTime: '2024-06-03 09:00:33',
  },
  {
    id: 8,
    title: 'API 接口调用频率限制调整',
    content: '自即日起，部分高频 API 接口的调用频率限制将从 1000次/分钟 调整至 500次/分钟，请各业务方提前评估影响范围。',
    type: 1,
    status: 1,
    priority: 1,
    sender: '技术架构组',
    sendTime: '2024-05-31 16:20:00',
    readTime: '2024-06-01 09:15:44',
  },
  {
    id: 9,
    title: '新员工入职培训安排',
    content: '本周五（6月7日）下午14:00将在A栋3楼会议室举行新员工入职培训，请相关部门提前准备培训材料。',
    type: 2,
    status: 1,
    priority: 0,
    sender: '人力资源部',
    sendTime: '2024-05-30 11:00:00',
    readTime: '2024-05-30 15:45:21',
  },
  {
    id: 10,
    title: '合同到期提醒',
    content: '您负责的「XX项目技术服务合同」将于2024年7月15日到期，请提前启动续签流程。',
    type: 3,
    status: 1,
    priority: 1,
    sender: '合同管理系统',
    sendTime: '2024-05-29 09:00:00',
    readTime: '2024-05-29 14:20:18',
  },
]

const allData = ref<NoticeRecord[]>([...mockNotices])
const activeTabKey = ref<string>('all')
const viewingNotice = ref<NoticeRecord | null>(null)
const showDetailDrawer = ref(false)

// 统计数据
const unreadCount = computed(() => allData.value.filter(n => n.status === 0).length)
const systemCount = computed(() => allData.value.filter(n => n.type === 1).length)
const noticeCount = computed(() => allData.value.filter(n => n.type === 2).length)
const todoCount = computed(() => allData.value.filter(n => n.type === 3).length)

// 类型映射
const typeMap: Record<number, { label: string, color: string }> = {
  1: { label: '公告', color: 'blue' },
  2: { label: '通知', color: 'green' },
  3: { label: '待办', color: 'orange' },
}
const priorityMap: Record<number, { label: string, color: string }> = {
  0: { label: '普通', color: 'default' },
  1: { label: '重要', color: 'orange' },
  2: { label: '紧急', color: 'red' },
}

// Tab 切换过滤
const filteredData = computed(() => {
  if (activeTabKey.value === 'all')
    return allData.value
  if (activeTabKey.value === 'unread')
    return allData.value.filter(n => n.status === 0)
  const typeNum = Number(activeTabKey.value)
  return allData.value.filter(n => n.type === typeNum)
})

const [tableRegister, tableMethods] = useTable()

async function mockApi(params: Record<string, any>) {
  const { page = 1, pageSize = 10 } = params
  const data = [...filteredData.value]
  data.sort((a, b) => dayjs(b.sendTime).valueOf() - dayjs(a.sendTime).valueOf())
  const total = data.length
  const startIdx = (Number(page) - 1) * Number(pageSize)
  return { items: data.slice(startIdx, startIdx + Number(pageSize)), total }
}

function handleTabChange(key: string) {
  activeTabKey.value = key
  tableMethods.value?.reload()
}

function handleView(record: NoticeRecord | any) {
  viewingNotice.value = record as NoticeRecord
  showDetailDrawer.value = true

  // 自动标记已读
  if ((record as NoticeRecord).status === 0) {
    ;(record as NoticeRecord).status = 1
    ;(record as NoticeRecord).readTime = dayjs().format('YYYY-MM-DD HH:mm:ss')
  }
}

function handleMarkRead(record: NoticeRecord | any) {
  const rec = record as NoticeRecord
  rec.status = 1
  rec.readTime = dayjs().format('YYYY-MM-DD HH:mm:ss')
  message.success(`「${rec.title}」已标记为已读`)
  tableMethods.value?.reload()
}

function handleMarkAllRead() {
  const unreadItems = allData.value.filter(n => n.status === 0)
  if (unreadItems.length === 0) {
    message.info('没有未读消息')
    return
  }
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
  unreadItems.forEach((item) => {
    item.status = 1
    item.readTime = now
  })
  message.success(`已将 ${unreadItems.length} 条消息标记为已读`)
  tableMethods.value?.reload()
}

function handleDelete(record: NoticeRecord | any) {
  const rec = record as NoticeRecord
  const idx = allData.value.findIndex(i => i.id === rec.id)
  if (idx > -1) {
    allData.value.splice(idx, 1)
    message.success(`已删除消息「${rec.title}」`)
    tableMethods.value?.reload()
  }
}

onMounted(() => {
  // 初始化时模拟未读数量
  console.log(`当前未读消息数: ${unreadCount.value}`)
})

const columns: BasicColumn[] = [
  {
    title: '标题',
    dataIndex: 'title',
    key: 'title',
    width: 220,
    ellipsis: true,
    customRender: ({ record }: any) => (
      <div class="flex items-center gap-2">
        {record.status === 0 && <span class="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
        <span class={record.priority === 2 ? 'font-medium text-red-600 dark:text-red-400' : ''}>
          {record.title}
        </span>
      </div>
    ),
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: 80,
    align: 'center',
    customRender: ({ record }: any) => (
      <a-tag color={typeMap[record.type]?.color || 'default'}>
        {typeMap[record.type]?.label || '未知'}
      </a-tag>
    ),
  },
  {
    title: '优先级',
    dataIndex: 'priority',
    key: 'priority',
    width: 80,
    align: 'center',
    customRender: ({ record }: any) => (
      <a-tag color={priorityMap[record.priority]?.color || 'default'}>
        {priorityMap[record.priority]?.label || '普通'}
      </a-tag>
    ),
  },
  { title: '发送人', dataIndex: 'sender', key: 'sender', width: 120, ellipsis: true },
  {
    title: '发送时间',
    dataIndex: 'sendTime',
    key: 'sendTime',
    width: 170,
    customRender: ({ record }: any) => (
      <span>
        {record.sendTime}
        {' '}
        (
        {dayjs(record.sendTime).fromNow(true)}
        前)
      </span>
    ),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 80,
    align: 'center',
    customRender: ({ record }: any) => (
      <a-tag color={record.status === 0 ? 'blue' : 'default'}>
        <span class="inline-flex items-center gap-1">
          <Icon icon={record.status === 0 ? 'carbon:new-filled' : 'carbon:checkmark'} />
          {record.status === 0 ? '未读' : '已读'}
        </span>
      </a-tag>
    ),
  },
]
</script>

<template>
  <div :class="containerClassName">
    <!-- 统计卡片 -->
    <div class="grid grid-cols-4 gap-4">
      <a-card
        :class="cardClassName"
        size="small"
        hoverable
        @click="handleTabChange('unread')"
      >
        <a-statistic
          title="未读消息"
          :value="unreadCount"
          suffix="条"
        >
          <template #prefix>
            <Icon
              icon="carbon:notification-new"
              class="text-blue-500 text-lg mr-1"
            />
          </template>
        </a-statistic>
      </a-card>
      <a-card
        :class="cardClassName"
        size="small"
        hoverable
        @click="handleTabChange('1')"
      >
        <a-statistic
          title="系统公告"
          :value="systemCount"
          suffix="条"
        >
          <template #prefix>
            <Icon
              icon="carbon:megaphone"
              class="text-green-500 text-lg mr-1"
            />
          </template>
        </a-statistic>
      </a-card>
      <a-card
        :class="cardClassName"
        size="small"
        hoverable
        @click="handleTabChange('2')"
      >
        <a-statistic
          title="通知消息"
          :value="noticeCount"
          suffix="条"
        >
          <template #prefix>
            <Icon
              icon="carbon:email"
              class="text-orange-500 text-lg mr-1"
            />
          </template>
        </a-statistic>
      </a-card>
      <a-card
        :class="cardClassName"
        size="small"
        hoverable
        @click="handleTabChange('3')"
      >
        <a-statistic
          title="待办提醒"
          :value="todoCount"
          suffix="条"
        >
          <template #prefix>
            <Icon
              icon="carbon:task"
              class="text-purple-500 text-lg mr-1"
            />
          </template>
        </a-statistic>
      </a-card>
    </div>

    <!-- Tab 切换 + 工具栏 -->
    <a-card :class="cardClassName">
      <div class="flex justify-between items-center mb-4">
        <a-tabs
          v-model:active-key="activeTabKey"
          @change="handleTabChange"
        >
          <a-tab-pane
            key="all"
            tab="全部消息"
          />
          <a-tab-pane
            key="unread"
            tab="未读消息"
          />
          <a-tab-pane
            key="1"
            tab="系统公告"
          />
          <a-tab-pane
            key="2"
            tab="通知消息"
          />
          <a-tab-pane
            key="3"
            tab="待办提醒"
          />
        </a-tabs>
        <div class="flex gap-2">
          <a-button @click="handleMarkAllRead">
            <template #icon>
              <Icon icon="carbon:checkmark-outline" />
            </template>
            全部已读
          </a-button>
        </div>
      </div>

      <BasicTable
        :columns="columns"
        :api="mockApi"
        :immediate="true"
        :use-search-form="false"
        :action-column="{ width: 180, title: '操作', fixed: 'right' }"
        :pagination="{ showSizeChanger: true,
                       pageSizeOptions: ['10',
                                         '20',
                                         '50'] }"
        @register="tableRegister"
      >
        <template #action="{ record }">
          <div class="flex items-center gap-1">
            <a-button
              type="link"
              class="!px-0.5"
              @click="() => handleView(record)"
            >
              <template #icon>
                <Icon icon="ant-design:eye-outlined" />
              </template>
              查看
            </a-button>
            <a-divider
              type="vertical"
              class="mx-0"
            />
            <a-button
              v-if="record.status === 0"
              type="link"
              class="!px-0.5"
              @click="() => handleMarkRead(record)"
            >
              <template #icon>
                <Icon icon="carbon:checkmark-outline" />
              </template>
              已读
            </a-button>
            <a-popconfirm
              :title="`确定要删除消息「${record.title}」吗？`"
              @confirm="() => handleDelete(record)"
            >
              <a-button
                type="link"
                danger
                class="!px-0.5"
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

    <!-- 消息详情抽屉 -->
    <a-drawer
      v-model:open="showDetailDrawer"
      :width="560"
      :title="viewingNotice?.title || '消息详情'"
      placement="right"
      :closable="true"
    >
      <template v-if="viewingNotice">
        <div class="space-y-4">
          <!-- 头部信息 -->
          <div class="flex flex-wrap gap-2">
            <a-tag :color="typeMap[viewingNotice.type]?.color || 'default'">
              {{ typeMap[viewingNotice.type]?.label }}
            </a-tag>
            <a-tag :color="priorityMap[viewingNotice.priority]?.color || 'default'">
              {{ priorityMap[viewingNotice.priority]?.label }}
            </a-tag>
            <a-tag :color="viewingNotice.status === 0 ? 'blue' : 'default'">
              {{ viewingNotice.status === 0 ? '未读' : '已读' }}
            </a-tag>
          </div>

          <!-- 元信息 -->
          <a-descriptions
            :column="1"
            bordered
            size="small"
          >
            <a-descriptions-item label="发送人">
              {{ viewingNotice.sender }}
            </a-descriptions-item>
            <a-descriptions-item label="发送时间">
              {{ viewingNotice.sendTime }}
            </a-descriptions-item>
            <a-descriptions-item
              v-if="viewingNotice.readTime"
              label="阅读时间"
            >
              {{ viewingNotice.readTime }}
            </a-descriptions-item>
          </a-descriptions>

          <!-- 内容区域 -->
          <div class="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h4 class="font-medium mb-2">
              消息内容
            </h4>
            <div class="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed">
              {{ viewingNotice.content }}
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <a-button @click="showDetailDrawer = false">
            关闭
          </a-button>
          <a-button
            v-if="viewingNotice?.status === 0"
            type="primary"
            @click="handleMarkRead(viewingNotice); showDetailDrawer = false"
          >
            标记已读并关闭
          </a-button>
        </div>
      </template>
    </a-drawer>
  </div>
</template>
