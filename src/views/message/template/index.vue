<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { ref } from 'vue'

import { BasicDrawer, useDrawer } from '~/components/business/Drawer'
import { BasicForm, useForm } from '~/components/business/Form'
import { type ActionItem, BasicTable, TableAction, useTable } from '~/components/business/Table'
import { useCRUD } from '~/composables/useCRUD'

import type { TemplateRecord } from './types'

import { getTemplateActions } from './actions'
import { createTemplate, deleteTemplate, getTemplateDetail, getTemplateList, updateTemplate } from './api'
import { templateActionColumn, templateColumns, templateRowKey } from './columns'
import TemplateEditor from './components/TemplateEditor.vue'
import TemplatePreviewModal from './components/TemplatePreviewModal.vue'
import TemplateTestModal from './components/TemplateTestModal.vue'
import { CHANNEL_MAP, TEMPLATE_STATUS_MAP } from './constants'
import { searchSchemas, useTemplateFormSchemas } from './schemas'

defineOptions({ name: 'MessageTemplate' })

/* ========== 实例 ========== */
const [tableRegister, tableMethods] = useTable()
const [drawerRegister, drawerMethods] = useDrawer()
const [formRegister, formMethods] = useForm()

/* ========== 表单 ========== */
const formSchemas = useTemplateFormSchemas(
  // 复用 isEditing 计算属性，从 useCRUD 拿到
  ref(false) as never,
)

/* ========== 预览 / 测试 ========== */
const previewOpen = ref(false)
const previewRecord = ref<TemplateRecord | null>(null)

const testOpen = ref(false)
const testRecord = ref<TemplateRecord | null>(null)

function handlePreview(record: TemplateRecord) {
  previewRecord.value = record
  previewOpen.value = true
}

function handleTest(record: TemplateRecord) {
  testRecord.value = record
  testOpen.value = true
}

/* ========== CRUD ========== */
const { isEditing, handleAdd, handleEdit, handleDelete, handleSave } = useCRUD<TemplateRecord>({
  containerType: 'drawer',
  drawerMethods,
  formMethods,
  tableMethods,
  idKey: 'templateId',
  onFetchDetail: async (id) => {
    const res: any = await getTemplateDetail(id)
    return res?.data ?? res
  },
  getEmptyValues: () => ({
    templateCode: '',
    templateName: '',
    channelType: 'email',
    title: '',
    content: '',
    params: [],
    remark: '',
    status: '1',
  }),
  getFormValues: (record) => ({
    templateCode: record.templateCode,
    templateName: record.templateName,
    channelType: record.channelType,
    title: record.title ?? '',
    content: record.content,
    params: (record.params ?? []) as never,
    remark: record.remark ?? '',
    status: record.status,
  }),
  onCreate: async (values) => {
    const payload = {
      ...values,
      content: values.content ?? '',
      contentFormat: values.contentFormat ?? 'markdown',
      params: values.params ?? [],
    }
    await createTemplate(payload)
  },
  onUpdate: async (id, values) => {
    const payload = {
      ...values,
      content: values.content ?? '',
      contentFormat: values.contentFormat ?? 'markdown',
      params: values.params ?? [],
    }
    await updateTemplate(id, payload)
  },
  onDelete: async (record) => {
    await deleteTemplate(record.templateId)
  },
  messages: {
    createSuccess: '模板创建成功',
    updateSuccess: '模板更新成功',
    deleteSuccess: '模板删除成功',
  },
})

/* ========== 复制 ========== */
function handleCopy(record: TemplateRecord) {
  handleAdd({
    templateCode: `${record.templateCode}_copy`,
    templateName: `${record.templateName} (副本)`,
    channelType: record.channelType,
    title: record.title ?? '',
    content: record.content,
    params: record.params ?? [],
    remark: record.remark ?? '',
    status: record.status,
  })
  message.success('已复制，请修改编码后保存')
}

/* ========== 操作项 ========== */
function getActions(record: TemplateRecord): ActionItem[] {
  return getTemplateActions(record, {
    onEdit: handleEdit,
    onPreview: handlePreview,
    onTest: handleTest,
    onDelete: handleDelete,
    onCopy: handleCopy,
  })
}
</script>

<template>
  <a-card :bordered="false" class="shadow-sm">
    <BasicTable
      :columns="templateColumns"
      :api="getTemplateList"
      :immediate="true"
      :use-search-form="true"
      :form-config="{ schemas: searchSchemas, labelWidth: 80 }"
      :action-column="templateActionColumn"
      :row-key="templateRowKey"
      @register="tableRegister"
    >
      <template #toolbar>
        <a-button type="primary" @click="handleAdd()">
          <template #icon><Icon icon="ant-design:plus-outlined" /></template>
          新增模板
        </a-button>
      </template>

      <template #cell-channelType="{ record }">
        <a-tag :color="CHANNEL_MAP[record.channelType]?.color || 'default'">
          <Icon :icon="CHANNEL_MAP[record.channelType]?.icon!" class="mr-0.5" />
          {{ CHANNEL_MAP[record.channelType]?.label || record.channelType }}
        </a-tag>
      </template>

      <template #cell-params="{ record }">
        <span class="text-xs text-slate-500"> {{ (record.params ?? []).length }} 个 </span>
      </template>

      <template #cell-status="{ record }">
        <a-tag :color="TEMPLATE_STATUS_MAP[record.status]?.color || 'default'">
          {{ TEMPLATE_STATUS_MAP[record.status]?.label || record.status }}
        </a-tag>
      </template>

      <template #action="{ record }">
        <TableAction :actions="getActions(record as TemplateRecord)" />
      </template>
    </BasicTable>

    <!-- 新增/编辑抽屉 -->
    <BasicDrawer :title="isEditing ? '编辑模板' : '新增模板'" :width="960" @register="drawerRegister" @ok="handleSave">
      <BasicForm
        :schemas="formSchemas"
        :label-width="90"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="formRegister"
      >
        <template #templateEditor="{ model }">
          <TemplateEditor
            :content="model.content"
            :content-format="model.contentFormat ?? 'markdown'"
            :params="model.params ?? []"
            @update:content="(v) => formMethods.setFieldsValue({ content: v })"
            @update:content-format="(v) => formMethods.setFieldsValue({ contentFormat: v })"
            @update:params="(v) => formMethods.setFieldsValue({ params: v })"
          />
        </template>
      </BasicForm>
    </BasicDrawer>

    <!-- 预览弹窗 -->
    <TemplatePreviewModal v-model:open="previewOpen" :template="previewRecord" />

    <!-- 测试发送弹窗 -->
    <TemplateTestModal v-model:open="testOpen" :template="testRecord" />
  </a-card>
</template>
