<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { ref } from 'vue'

import {
  deleteNotice,
  getNoticeDetail,
  getNoticeList,
  getTemplateOptions,
  getUserAllOptions,
  revokeNotice,
  saveNotice,
  sendNotice,
  updateNotice,
} from '~/api'
import { useDrawer } from '~/components'
import BasicDrawer from '~/components/business/Drawer/BasicDrawer.vue'
import { BasicForm, useForm } from '~/components/business/Form'
import { BasicTable, useTable } from '~/components/business/Table'
import { useCRUD } from '~/composables/useCRUD'
import { MESSAGE_PERMS } from '~/enums/permissions'

import type { NoticeRecord, UserOption } from './types'

import { CHANNEL_MAP } from '../template/constants'
import { getNoticeActions } from './actions'
import { noticeActionColumn, noticeColumns, noticePagination, noticeRowKey } from './columns'
import ChannelConfig from './components/ChannelConfig.vue'
import {
  NOTICE_IS_TOP_MAP,
  NOTICE_PRIORITY_MAP,
  NOTICE_SEND_STATUS_MAP, // ⭐ 新增
  NOTICE_STATUS_MAP,
  NOTICE_TYPE_MAP,
} from './constants'
import { noticeSearchSchemas, useNoticeFormSchemas } from './schemas'
import { cardClassName, containerClassName } from './style'

defineOptions({ name: 'SystemNotice' })

// ========== 用户选项 ==========
const userOptions = ref<UserOption[]>([])
const channelConfigOpen = ref(false)
const templateOptions = ref<{ label: string; value: string }[]>([])

async function loadUserOptions() {
  try {
    const res = await getUserAllOptions()
    const data = Array.isArray(res) ? res : ((res as any)?.data ?? res ?? [])
    userOptions.value = data
  } catch (e) {
    console.error(e)
  }
}

async function loadTemplateOptions() {
  try {
    const res: any = await getTemplateOptions()
    const list = res?.data ?? []
    templateOptions.value = list
      .filter((t: any) => t.status === '1')
      .map((t: any) => ({
        label: `${t.templateName} (${CHANNEL_MAP[t.channelType]?.label ?? t.channelType})`,
        value: t.templateId,
      }))
  } catch (e) {
    console.error('加载模板失败', e)
  }
}

// ========== 弹窗表单 schema（依赖 userOptions / templateOptions）==========
// ⭐ 不再 ref(userOptions) 双重包装
const noticeFormSchemas = useNoticeFormSchemas(userOptions, templateOptions)

// ========== 注册实例 ==========
const [tableRegister, tableMethods] = useTable()
const [drawerRegister, drawerMethods] = useDrawer()
const [formRegister, formMethods] = useForm()

// ========== useCRUD ==========
const { isEditing, handleAdd, handleEdit, handleDelete, handleSave } = useCRUD<NoticeRecord>({
  containerType: 'drawer',
  drawerMethods,
  formMethods,
  tableMethods,
  idKey: 'noticeId',
  onFetchDetail: async (id) => await getNoticeDetail(id),
  getEmptyValues: () => ({
    title: '',
    noticeType: 1,
    priority: 0,
    isTop: 0,
    status: '0',
    publishTime: null,
    templateId: null,
    targetUserIds: [],
    content: '',
  }),
  getFormValues: (record) => ({
    title: record.title,
    noticeType: record.noticeType,
    priority: record.priority ?? 0,
    isTop: record.isTop ?? 0,
    status: record.status,
    // ⭐ 后端返回的 publishTime 是字符串，DatePicker 支持直接赋值
    publishTime: record.publishTime || null,
    templateId: record.templateId ?? null,
    targetUserIds: record.targetUserIds || [],
    content: record.content,
  }),
  onCreate: async (values: any) => {
    // ⭐ valueFormat 已统一为 'YYYY-MM-DD HH:mm:ss'，无需手动 dayjs 转换
    await saveNotice(values)
  },
  onUpdate: async (id, values) => {
    // ⭐ 同步格式化逻辑
    await updateNotice(id, values)
  },
  onDelete: async (record) => {
    await deleteNotice(record.noticeId)
  },
  messages: {
    createSuccess: '通知创建成功',
    updateSuccess: '通知更新成功',
    deleteSuccess: '通知删除成功',
  },
})

// ========== 手动发送 ==========
async function handleSend(record: NoticeRecord) {
  if (record.sendStatus === '1') {
    message.warning('该通知已发送')
    return
  }
  try {
    await sendNotice(record.noticeId)
    message.success(`已发送通知「${record.title}」`)
    tableMethods.value?.reload()
  } catch (e: any) {
    message.error(e?.message || '发送失败')
  }
}

// ========== 撤回 ==========
async function handleRevoke(record: NoticeRecord) {
  if (record.sendStatus !== '1') {
    message.warning('只能撤回已发送的通知')
    return
  }
  try {
    await revokeNotice(record.noticeId)
    message.success('已撤回')
    tableMethods.value?.reload()
  } catch (e: any) {
    message.error(e?.message || '撤回失败')
  }
}

// ========== 操作项 ==========
function getActions(record: NoticeRecord) {
  return getNoticeActions(record, {
    onEdit: handleEdit,
    onSend: handleSend,
    onDelete: handleDelete,
    onRevoke: handleRevoke,
  })
}

// ========== 初始化 ==========
loadUserOptions()
loadTemplateOptions()
</script>

<template>
  <div :class="containerClassName">
    <a-card :class="cardClassName" :bordered="false">
      <div class="p-4">
        <BasicTable
          :columns="noticeColumns"
          :api="getNoticeList"
          :immediate="true"
          :use-search-form="true"
          :form-config="{ schemas: noticeSearchSchemas, labelWidth: 80 }"
          :action-column="noticeActionColumn"
          :pagination="noticePagination"
          :row-key="noticeRowKey"
          @register="tableRegister"
        >
          <template #toolbar>
            <a-button type="primary" @click="handleAdd()" v-permission="MESSAGE_PERMS.notice.create">
              <template #icon><Icon icon="ant-design:plus-outlined" /></template>
              新增通知
            </a-button>
            <a-button @click="channelConfigOpen = true" v-permission="MESSAGE_PERMS.notice.channel">
              <template #icon><Icon icon="carbon:notification" /></template>
              渠道设置
            </a-button>
          </template>

          <template #cell-noticeType="{ record }">
            <a-tag :color="NOTICE_TYPE_MAP[record.noticeType]?.color || 'default'">
              {{ NOTICE_TYPE_MAP[record.noticeType]?.label || '未知' }}
            </a-tag>
          </template>

          <template #cell-status="{ record }">
            <a-tag :color="NOTICE_STATUS_MAP[record.status]?.color || 'default'">
              {{ NOTICE_STATUS_MAP[record.status]?.label || record.status }}
            </a-tag>
          </template>

          <template #cell-priority="{ record }">
            <a-tag :color="NOTICE_PRIORITY_MAP[record.priority]?.color || 'default'">
              {{ NOTICE_PRIORITY_MAP[record.priority]?.label || record.priority }}
            </a-tag>
          </template>

          <template #cell-isTop="{ record }">
            <a-tag :color="NOTICE_IS_TOP_MAP[record.isTop]?.color || 'default'">
              {{ NOTICE_IS_TOP_MAP[record.isTop]?.label || record.isTop }}
            </a-tag>
          </template>

          <!-- ⭐ 新增：发送状态 -->
          <template #cell-sendStatus="{ record }">
            <a-tag :color="NOTICE_SEND_STATUS_MAP[record.sendStatus]?.color || 'default'">
              {{ NOTICE_SEND_STATUS_MAP[record.sendStatus]?.label || record.sendStatus }}
            </a-tag>
          </template>

          <template #action="{ record }">
            <table-action :actions="getActions(record as NoticeRecord)" />
          </template>
        </BasicTable>
      </div>
    </a-card>

    <BasicDrawer :title="isEditing ? '编辑通知' : '新增通知'" :width="720" @register="drawerRegister" @ok="handleSave">
      <BasicForm
        :schemas="noticeFormSchemas"
        :label-width="90"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="formRegister"
      />
    </BasicDrawer>

    <ChannelConfig v-model:open="channelConfigOpen" />
  </div>
</template>
