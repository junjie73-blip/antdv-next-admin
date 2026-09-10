<script setup lang="tsx">
import type { DescriptionItem } from '@/components/business/Description'
import type { FormSchema } from '@/components/business/Form'
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import {
  addSetting,
  deleteSetting,
  updateSetting,
  batchDeleteSetting,
  getSettingsList,
} from '@/api/system'
import { Description as DetailDescription } from '@/components/business/Description'
import { BasicDrawer, useDrawer } from '@/components/business/Drawer'
import { BasicForm, useForm } from '@/components/business/Form'
import { BasicModal, useModal } from '@/components/business/Modal'
import { BasicTable, useTable } from '@/components/business/Table'
import { cn } from '@/utils/cn'
import { useCRUD } from '@/composables/useCRUD'
import { message } from 'antdv-next'
import dayjs from 'dayjs'

defineOptions({ name: 'SystemSettings' })

// ========== 类型定义（与后端 sys_config 表对齐） ==========
interface ConfigRecord {
  configId: string
  configKey: string
  configValue?: string | null
  description?: string | null
  createdAt: string
  updatedAt: string
}

// ========== 样式 ==========
const containerClassName = cn('space-y-4')
const cardClassName = cn('shadow-sm')
const valueCellClassName = cn('truncate', 'block', 'max-w-[260px]')
const actionClassName = cn('flex', 'items-center', 'justify-center')
const btnClassName = cn('!px-0.5')
const dividerClassName = cn('mx-0')

// ========== 详情 ==========
const viewingRecord = ref<ConfigRecord | null>(null)
const [drawerRegister, drawerMethods] = useDrawer()

const detailSchemas: DescriptionItem[] = [
  {
    field: 'configKey',
    label: '配置键',
    render: (value: string) => <a-tag color="blue">{value}</a-tag>,
  },
  {
    field: 'configValue',
    label: '配置值',
    span: 2,
    render: (value: string) => (
      <pre class="whitespace-pre-wrap text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded">
        {value || '-'}
      </pre>
    ),
  },
  { field: 'description', label: '描述', span: 2 },
  {
    field: 'createdAt',
    label: '创建时间',
    render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
  },
  {
    field: 'updatedAt',
    label: '更新时间',
    render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
  },
]

function handleView(record: ConfigRecord) {
  viewingRecord.value = null
  setTimeout(() => {
    viewingRecord.value = record
    drawerMethods.openDrawer()
  })
}

// ========== 表格实例 ==========
const [tableRegister, tableMethods] = useTable()
const [modalRegister, modalMethods] = useModal()
const [formRegister, formMethods] = useForm()

// ========== 搜索表单 ==========
const searchFormSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    colProps: { span: 8 },
    componentProps: {
      placeholder: '搜索配置键或描述...',
      allowClear: true,
    },
  },
]

// ========== 编辑表单（只保留后端支持的字段） ==========
const modalFormSchemas: FormSchema[] = [
  {
    field: 'configKey',
    label: '配置键',
    component: 'Input',
    required: true,
    colProps: { span: 24 },
    componentProps: { placeholder: '例如：site.name' },
  },
  {
    field: 'configValue',
    label: '配置值',
    component: 'InputTextArea',
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入配置值', rows: 3 },
  },
  {
    field: 'description',
    label: '描述',
    component: 'InputTextArea',
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入描述信息...', rows: 2 },
  },
]

// ========== useCRUD ==========
const { isEditing, handleAdd, handleEdit, handleDelete, handleSave, handleBatchDelete } =
  useCRUD<ConfigRecord>({
    containerType: 'modal',
    modalMethods,
    formMethods,
    tableMethods,
    idKey: 'configId',
    confirmDelete: true,
    getEmptyValues: () => ({
      configKey: '',
      configValue: '',
      description: '',
    }),
    getFormValues: (record) => ({
      configKey: record.configKey,
      configValue: record.configValue || '',
      description: record.description || '',
    }),
    onCreate: async (values) => {
      await addSetting(values)
    },
    onUpdate: async (id, values) => {
      await updateSetting(id, values)
    },
    onDelete: async (record) => {
      await deleteSetting(record.configId)
    },
    onBatchDelete: async (records) => {
      await batchDeleteSetting(records.map((r) => r.configId))
    },
    messages: {
      createSuccess: '配置创建成功',
      updateSuccess: '配置更新成功',
      deleteSuccess: '配置删除成功',
      batchDeleteSuccess: '批量删除成功',
      deleteConfirm: '确定要删除该配置吗？',
      batchDeleteConfirm: '确定要删除选中的配置吗？',
    },
  })

// ========== 列定义 ==========
const columns: BasicColumn[] = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    align: 'center',
    customRender: ({ index }) => index + 1,
  },
  { title: '配置键', dataIndex: 'configKey', key: 'configKey', width: 220, ellipsis: true },
  { title: '配置值', dataIndex: 'configValue', key: 'configValue', width: 280, ellipsis: true },
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 170, align: 'center' },
]
</script>

<template>
  <div :class="containerClassName">
    <a-card title="系统设置" :class="cardClassName">
      <BasicTable
        :columns="columns"
        :api="getSettingsList"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
        :scroll="{ x: 1100 }"
        :row-selection="{ type: 'checkbox' }"
        :action-column="{ width: 220, title: '操作', fixed: 'right' }"
        :pagination="{ showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }"
        :row-key="(record) => record.configId"
        table-layout="fixed"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button type="primary" @click="() => handleAdd()">
            <template #icon>
              <Icon icon="ant-design:plus-outlined" />
            </template>
            新增设置
          </a-button>
          <a-button danger @click="() => handleBatchDelete()">
            <template #icon>
              <Icon icon="ant-design:delete-outlined" />
            </template>
            批量删除
          </a-button>
        </template>

        <template #cell-configValue="{ text }">
          <a-tooltip :title="text">
            <span :class="valueCellClassName">{{ text || '-' }}</span>
          </a-tooltip>
        </template>

        <template #action="{ record }">
          <div :class="actionClassName">
            <a-button type="link" :class="btnClassName" @click="() => handleView(record)">
              <template #icon>
                <Icon icon="ant-design:eye-outlined" />
              </template>
              查看
            </a-button>
            <a-divider type="vertical" :class="dividerClassName" />
            <a-button type="link" :class="btnClassName" @click="() => handleEdit(record)">
              <template #icon>
                <Icon icon="ant-design:edit-outlined" />
              </template>
              编辑
            </a-button>
            <a-divider type="vertical" :class="dividerClassName" />
            <a-popconfirm
              :title="`确定要删除配置「${record.configKey}」吗？`"
              @confirm="() => handleDelete(record)"
            >
              <a-button type="link" danger :class="btnClassName">
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

    <!-- 新增/编辑弹窗 -->
    <BasicModal
      :title="isEditing ? '编辑设置' : '新增设置'"
      :width="560"
      @register="modalRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="modalFormSchemas"
        :label-width="80"
        :show-action-button-group="false"
        :grid="{ cols: 1, gutter: 16 }"
        @register="formRegister"
      />
    </BasicModal>

    <!-- 详情抽屉 -->
    <BasicDrawer
      :title="`配置详情 - ${viewingRecord?.configKey || ''}`"
      :width="560"
      :show-footer="false"
      @register="drawerRegister"
      @close="viewingRecord = null"
    >
      <DetailDescription
        v-if="viewingRecord"
        :key="viewingRecord.configId"
        :data="viewingRecord"
        :schema="detailSchemas"
        :column="2"
        bordered
        size="middle"
      />
    </BasicDrawer>
  </div>
</template>
