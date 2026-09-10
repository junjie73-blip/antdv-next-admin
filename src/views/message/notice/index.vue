<script setup lang="ts">
import type { FormSchema } from '@/components/business/Form'
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
import {
  getNoticeList,
  deleteNotice,
  saveNotice,
  sendNotice,
  getUserOptions,
  updateNotice,
  getUserAllOptions,
  getNoticeDetail, // 假设已有该接口，用于选择接收人
} from '@/api/system'
import { BasicForm, useForm } from '@/components/business/Form'
import { BasicModal, useModal } from '@/components/business/Modal'
import { BasicTable, useTable } from '@/components/business/Table'
import { cn } from '@/utils/cn'
import { useCRUD } from '@/composables/useCRUD'
import { message } from 'antdv-next'

defineOptions({ name: 'SystemNotice' })

interface NoticeRecord {
  noticeId: string
  title: string
  content: string
  noticeType: number // 1-通知 2-公告 3-提醒
  status: string // '0'-草稿 '1'-发布
  publishTime?: string
  createdAt: string
  targetUserIds?: string[]
}

// ========== 样式 ==========
const containerClassName = cn('space-y-4')
const cardClassName = cn(
  'shadow-sm rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900',
)

// ========== 映射 ==========
const typeMap: Record<number, { label: string; color: string }> = {
  1: { label: '通知', color: 'blue' },
  2: { label: '公告', color: 'green' },
  3: { label: '提醒', color: 'orange' },
}
const statusMap: Record<string, { label: string; color: string }> = {
  '0': { label: '草稿', color: 'gray' },
  '1': { label: '已发布', color: 'green' },
}

// ========== 搜索表单 ==========
const searchFormSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '标题',
    component: 'Input',
    componentProps: { placeholder: '搜索标题关键字', allowClear: true },
    colProps: { span: 6 },
  },
  {
    field: 'noticeType',
    label: '类型',
    component: 'Select',
    componentProps: {
      placeholder: '全部类型',
      allowClear: true,
      options: [
        { label: '通知', value: 1 },
        { label: '公告', value: 2 },
        { label: '提醒', value: 3 },
      ],
    },
    colProps: { span: 6 },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    componentProps: {
      placeholder: '全部状态',
      allowClear: true,
      options: [
        { label: '草稿', value: '0' },
        { label: '已发布', value: '1' },
      ],
    },
    colProps: { span: 6 },
  },
]

// ========== 弹窗表单 ==========
const userOptions = ref<{ label: string; value: string }[]>([])

const noticeFormSchemas = computed<FormSchema[]>(() => [
  {
    field: 'title',
    label: '通知标题',
    component: 'Input',
    required: true,
    colProps: {
      span: 24,
    },
    componentProps: { placeholder: '请输入标题' },
  },
  {
    field: 'noticeType',
    label: '通知类型',
    component: 'Select',
    defaultValue: 1,
    componentProps: {
      options: [
        { label: '通知', value: 1 },
        { label: '公告', value: 2 },
        { label: '提醒', value: 3 },
      ],
    },
  },
  {
    field: 'status',
    label: '发布状态',
    component: 'RadioGroup',
    defaultValue: '0',
    componentProps: () => ({
      optionType: 'button',
      buttonStyle: 'solid',
      options: [
        { label: '草稿', value: '0' },
        { label: '发布', value: '1' },
      ],
    }),
  },
  {
    field: 'publishTime',
    label: '发布时间',
    component: 'DatePicker',
    colProps: { span: 24 },
    componentProps: {
      showTime: true,
      placeholder: '不填则立即发布或保持草稿',
      style: { width: '100%' },
    },
  },
  {
    field: 'targetUserIds',
    label: '接收人',
    component: 'Select',
    colProps: { span: 24 },
    componentProps: {
      mode: 'multiple',
      placeholder: '选择接收用户（不选则发送给所有人）',
      options: userOptions.value,
    },
  },
  {
    field: 'content',
    label: '内容',
    component: 'InputTextArea',
    required: true,
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入通知内容', rows: 5 },
  },
])

// ========== 注册 ==========
const [tableRegister, tableMethods] = useTable()
const [modalRegister, modalMethods] = useModal()
const [formRegister, formMethods] = useForm()

// ========== 加载用户选项 ==========
async function loadUserOptions() {
  try {
    const res = await getUserAllOptions()
    const data = Array.isArray(res) ? res : (res?.data ?? res ?? [])
    userOptions.value = data
  } catch (e) {
    console.error(e)
  }
}

// ========== useCRUD ==========
const { isEditing, handleAdd, handleEdit, handleDelete, handleSave } = useCRUD<NoticeRecord>({
  containerType: 'modal',
  modalMethods,
  formMethods,
  tableMethods,
  idKey: 'noticeId',
  confirmDelete: true,
  onFetchDetail: async (id) => {
    return await getNoticeDetail(id)
  },
  getEmptyValues: () => ({
    title: '',
    noticeType: 1,
    status: '0',
    publishTime: null,
    targetUserIds: [],
    content: '',
  }),
  getFormValues: (record) => ({
    title: record.title,
    noticeType: record.noticeType,
    status: record.status,
    publishTime: record.publishTime ? dayjs(record.publishTime) : null,
    targetUserIds: record.targetUserIds || [],
    content: record.content,
  }),
  onCreate: async (values) => {
    const payload = {
      ...values,
      publishTime: values.publishTime
        ? dayjs(values.publishTime).format('YYYY-MM-DD HH:mm:ss')
        : null,
    }
    await saveNotice(payload)
  },
  onUpdate: async (id, values) => {
    await updateNotice(id, values) // 注意后端接口为 POST /notice/{id}
  },
  onDelete: async (record) => {
    await deleteNotice(record.noticeId)
  },
  messages: {
    createSuccess: '通知创建成功',
    updateSuccess: '通知更新成功',
    deleteSuccess: '通知删除成功',
    deleteConfirm: '确定要删除该通知吗？',
  },
})

// 手动发送
async function handleSend(record: NoticeRecord) {
  try {
    await sendNotice(record.noticeId)
    message.success(`已发送通知「${record.title}」`)
    tableMethods.value?.reload()
  } catch (e: any) {
    message.error(e?.message || '发送失败')
  }
}

// ========== 列定义 ==========
const columns: BasicColumn[] = [
  {
    title: '#',
    key: 'index',
    dataIndex: 'noticeId',
    width: 60,
    align: 'center',
    customRender: ({ index }) => index + 1,
  },
  { title: '标题', dataIndex: 'title', key: 'title', width: 240, ellipsis: true },
  {
    title: '类型',
    dataIndex: 'noticeType',
    key: 'noticeType',
    width: 80,
    align: 'center',
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 90,
    align: 'center',
  },
  {
    title: '发布时间',
    dataIndex: 'publishTime',
    key: 'publishTime',
    width: 180,
    customRender: ({ record }: any) =>
      record.publishTime ? dayjs(record.publishTime).format('YYYY-MM-DD HH:mm') : '未设置',
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 180,
    customRender: ({ record }: any) => dayjs(record.createdAt).format('YYYY-MM-DD HH:mm'),
  },
]

// 初始化时加载用户选项
loadUserOptions()
</script>

<template>
  <div :class="containerClassName">
    <a-card :class="cardClassName" :bordered="false">
      <div class="p-4">
        <BasicTable
          :columns="columns"
          :api="getNoticeList"
          :immediate="true"
          :use-search-form="true"
          :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
          :action-column="{ width: 220, title: '操作', fixed: 'right' }"
          :pagination="{ showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }"
          :row-key="(record) => record.noticeId"
          @register="tableRegister"
        >
          <template #toolbar>
            <a-button type="primary" @click="handleAdd()">
              <template #icon><Icon icon="ant-design:plus-outlined" /></template>
              新增通知
            </a-button>
          </template>

          <template #cell-noticeType="{ record }">
            <a-tag :color="typeMap[record.noticeType]?.color || 'default'">
              {{ typeMap[record.noticeType]?.label || '未知' }}
            </a-tag>
          </template>

          <template #cell-status="{ record }">
            <a-tag :color="statusMap[record.status]?.color || 'default'">
              {{ statusMap[record.status]?.label || record.status }}
            </a-tag>
          </template>

          <template #action="{ record }">
            <div class="flex items-center justify-center gap-1">
              <a-button type="link" class="!px-0.5" @click="handleEdit(record)">编辑</a-button>
              <a-divider type="vertical" class="mx-0" />
              <a-button
                :disabled="record.status === '1'"
                type="link"
                class="!px-0.5"
                @click="handleSend(record)"
              >
                发送
              </a-button>
              <a-divider type="vertical" class="mx-0" />
              <a-popconfirm
                :title="`确定删除通知「${record.title}」吗？`"
                @confirm="handleDelete(record)"
              >
                <a-button type="link" danger class="!px-0.5">删除</a-button>
              </a-popconfirm>
            </div>
          </template>
        </BasicTable>
      </div>
    </a-card>

    <BasicModal
      :title="isEditing ? '编辑通知' : '新增通知'"
      :width="640"
      @register="modalRegister"
      @ok="handleSave"
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
