<script setup lang="tsx">
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { computed, onMounted, ref } from 'vue'
import { deleteNotice, getNoticeList, markAllNoticeRead, markNoticeRead, saveNotice } from '@/api/system'
import { BasicTable, useTable } from '@/components/business/Table'
import { BasicModal, useModal } from '@/components/business/Modal'
import { BasicForm, useForm } from '@/components/business/Form'
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

// Mock 数据 — 消息通知
const allData = ref<NoticeRecord[]>([])
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
const [modalRegister, modalMethods] = useModal()
const [formRegister, formMethods] = useForm()

const isEditingNotice = ref(false)
const editingNoticeId = ref<number | null>(null)

/** 新增/编辑消息表单 */
const noticeFormSchemas: FormSchema[] = [
  {
    field: 'title',
    label: '消息标题',
    component: 'Input',
    required: true,
    componentProps: { placeholder: '请输入消息标题' },
  },
  {
    field: 'type',
    label: '消息类型',
    component: 'Select',
    defaultValue: 2,
    componentProps: () => ({
      options: [
        { label: '系统公告', value: 1 },
        { label: '通知消息', value: 2 },
        { label: '待办提醒', value: 3 },
      ],
    }),
  },
  {
    field: 'priority',
    label: '优先级',
    component: 'Select',
    defaultValue: 0,
    colProps: { span: 12 },
    componentProps: () => ({
      options: [
        { label: '普通', value: 0 },
        { label: '重要', value: 1 },
        { label: '紧急', value: 2 },
      ],
    }),
  },
  {
    field: 'status',
    label: '状态',
    component: 'RadioGroup',
    defaultValue: 0,
    colProps: { span: 12 },
    componentProps: () => ({
      optionType: 'button',
      buttonStyle: 'solid',
      options: [
        { label: '未发布', value: 0 },
        { label: '已发布', value: 1 },
      ],
    }),
  },
  {
    field: 'content',
    label: '消息内容',
    component: 'InputTextArea',
    required: true,
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入消息内容...', rows: 5 },
  },
]

// 加载全部数据用于统计和 Tab 过滤
async function loadAllData() {
  try {
    const res = await getNoticeList({ pageSize: 1000 })
    const data = res?.data ?? res
    allData.value = data?.list || []
  }
  catch {
    allData.value = []
  }
}

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

async function handleMarkRead(record: NoticeRecord | any) {
  const rec = record as NoticeRecord
  try {
    await markNoticeRead(rec.id)
    rec.status = 1
    rec.readTime = dayjs().format('YYYY-MM-DD HH:mm:ss')
    message.success(`「${rec.title}」已标记为已读`)
    tableMethods.value?.reload()
    await loadAllData()
  }
  catch {
    message.error('操作失败')
  }
}

async function handleMarkAllRead() {
  const unreadItems = allData.value.filter(n => n.status === 0)
  if (unreadItems.length === 0) {
    message.info('没有未读消息')
    return
  }
  try {
    await markAllNoticeRead()
    message.success(`已将 ${unreadItems.length} 条消息标记为已读`)
    await loadAllData()
    tableMethods.value?.reload()
  }
  catch {
    message.error('操作失败')
  }
}

async function handleDelete(record: NoticeRecord | any) {
  const rec = record as NoticeRecord
  try {
    await deleteNotice(rec.id)
    message.success(`已删除消息「${rec.title}」`)
    await loadAllData()
    tableMethods.value?.reload()
  }
  catch {
    message.error('删除失败')
  }
}

onMounted(async () => {
  await loadAllData()
  tableMethods.value?.reload()
})

/** 新增消息 */
function handleAdd() {
  isEditingNotice.value = false
  editingNoticeId.value = null
  formMethods.setFieldsValue({
    title: '',
    type: 2,
    priority: 0,
    status: 0,
    content: '',
  })
  formMethods.clearValidate()
  modalMethods.openModal()
}

/** 保存消息 */
async function handleSaveNotice() {
  const values = await formMethods.validate()
  if (!values)
    return

  try {
    await saveNotice(values)
    message.success('消息保存成功')
    modalMethods.closeModal()
    await loadAllData()
    tableMethods.value?.reload()
  }
  catch (e: any) {
    message.error(e?.message || '保存失败')
  }
}

const columns: BasicColumn[] = [
  { title: '#', key: 'index', width: 60, align: 'center', customRender: ({ index }) => index + 1 },
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
          <a-button
            type="primary"
            @click="handleAdd"
          >
            <template #icon>
              <Icon icon="ant-design:plus-outlined" />
            </template>
            新增消息
          </a-button>
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
          <div class="flex items-center justify-center gap-1">
            <a-button
              type="link"
              class="!px-0.5"
              @click="() => handleView(record)"
            >
              <template #icon>
                <Icon icon="ant-design:eye-outlined" />
              </template>
              详情
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

    <!-- 新增/编辑消息弹窗 -->
    <BasicModal
      :title="isEditingNotice ? '编辑消息' : '新增消息'"
      :width="640"
      @register="modalRegister"
      @ok="handleSaveNotice"
    >
      <BasicForm
        :schemas="noticeFormSchemas"
        :label-width="90"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="formRegister"
      />
    </BasicModal>
  </div>
</template>
