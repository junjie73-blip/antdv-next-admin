<script setup lang="ts">
import type { FormSchema } from '@/components/business/Form'
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'

import { computed, ref } from 'vue'
import {
  addDict,
  addDictItem,
  deleteDict,
  deleteDictItem,
  getDictItems,
  getDictList,
  updateDict,
  updateDictItem,
} from '@/api/system'
import { BasicForm, useForm } from '@/components/business/Form'
import { BasicModal, useModal } from '@/components/business/Modal'
import { BasicTable, useTable } from '@/components/business/Table'
import { DictType } from '@/enums/dict'
import { useDictStore } from '@/stores'
import { cn } from '@/utils/cn'
import { exportToExcel } from '@/utils/excel'

defineOptions({ name: 'SystemDict' })

interface DictItemRecord {
  id: number
  dictType: string
  dictLabel: string
  dictValue: string
  cssClass: string
  sort: number
  status: number
  remark: string
}

interface DictTypeRecord {
  id: number
  typeName: string
  typeCode: string
  status: number
  remark: string
  items: DictItemRecord[]
}

const containerClassName = cn('space-y-4')
const cardClassName = cn('shadow-sm')
const tagClassName = cn('inline-flex items-center gap-1')
const actionClassName = cn('flex', 'items-center', 'justify-center')
const btnClassName = cn('!px-0.5')
const dividerClassName = cn('mx-0')

const statusColorMap: Record<number, string> = {
  1: 'green',
  0: 'red',
}

const statusLabelMap: Record<number, string> = {
  1: '正常',
  0: '停用',
}

const dictStore = useDictStore()

const statusOptions = computed(() => dictStore.getOptions(DictType.NORMAL_DISABLE))

const isEditing = ref(false)
const isEditingItem = ref(false)
const currentRecord = ref<DictTypeRecord | null>(null)
const currentItemRecord = ref<DictItemRecord | null>(null)
const selectedTypeId = ref<number | null>(null)
const selectedTypeName = ref<string>('')

const [modalRegister, modalMethods] = useModal()
const [itemModalRegister, itemModalMethods] = useModal()
const [itemEditModalRegister, itemEditModalMethods] = useModal()
const [tableRegister, tableMethods] = useTable()
const [itemTableRegister, itemTableMethods] = useTable()
const [formRegister, formMethods] = useForm()
const [itemFormRegister, itemFormMethods] = useForm()

const searchFormSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    componentProps: {
      placeholder: '搜索字典名称/编码...',
      allowClear: true,
    },
    colProps: { span: 6 },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    componentProps: () => ({
      placeholder: '选择状态',
      allowClear: true,
      options: statusOptions.value,
    }),
    colProps: { span: 6 },
  },
]

const modalFormSchemas: FormSchema[] = [
  {
    field: 'typeName',
    label: '字典名称',
    component: 'Input',
    required: true,
    componentProps: { placeholder: '例如：用户性别' },
  },
  {
    field: 'typeCode',
    label: '字典编码',
    component: 'Input',
    required: true,
    componentProps: { placeholder: '例如：sys_user_sex' },
  },
  {
    field: 'sort',
    label: '排序',
    component: 'InputNumber',
    colProps: { span: 12 },
    defaultValue: 0,
    componentProps: {
      min: 0,
      placeholder: '请输入排序号',
      style: { width: '100%' },
    },
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
      options: statusOptions.value,
    }),
  },
  {
    field: 'remark',
    label: '备注',
    component: 'InputTextArea',
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入备注信息...', rows: 3 },
  },
]

const itemFormSchemas: FormSchema[] = [
  {
    field: 'dictLabel',
    label: '字典标签',
    component: 'Input',
    required: true,
    componentProps: { placeholder: '例如：男' },
  },
  {
    field: 'dictValue',
    label: '字典键值',
    component: 'Input',
    required: true,
    componentProps: { placeholder: '例如：0' },
  },
  {
    field: 'sort',
    label: '排序',
    component: 'InputNumber',
    colProps: { span: 12 },
    componentProps: {
      min: 0,
      placeholder: '请输入排序号',
      style: { width: '100%' },
    },
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
      options: statusOptions.value,
    }),
  },
  {
    field: 'remark',
    label: '备注',
    component: 'InputTextArea',
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入备注...', rows: 3 },
  },
]

async function mockApi(params: Record<string, any>) {
  const res = await getDictList(params)
  const data = res?.data ?? res
  return { items: data?.list || [], total: data?.total || 0 }
}

async function mockItemApi(_params: Record<string, any>) {
  if (selectedTypeId.value === null)
    return { items: [], total: 0 }

  const res = await getDictItems(selectedTypeId.value)
  const items = Array.isArray(res) ? res : (res?.data ?? res ?? [])
  return { items, total: items.length }
}

function handleAdd() {
  isEditing.value = false
  currentRecord.value = null
  formMethods.setFieldsValue({
    typeName: '',
    typeCode: '',
    sort: 0,
    status: 0,
    remark: '',
  })
  formMethods.clearValidate()
  modalMethods.openModal()
}

function handleEdit(record: DictTypeRecord) {
  isEditing.value = true
  currentRecord.value = record
  formMethods.setFieldsValue({
    typeName: record.typeName,
    typeCode: record.typeCode,
    sort: record.sort ?? 0,
    status: record.status,
    remark: record.remark,
  })
  formMethods.clearValidate()
  modalMethods.openModal()
}

async function handleDelete(record: DictTypeRecord) {
  try {
    await deleteDict(record.id)
    message.success(`已删除字典：${record.typeName}`)
    tableMethods.value?.reload()
  }
  catch {
    message.error('删除失败')
  }
}

function handleViewItems(record: DictTypeRecord) {
  selectedTypeId.value = record.id
  selectedTypeName.value = record.typeName
  currentItemRecord.value = null
  isEditingItem.value = false
  itemModalMethods.openModal()
  setTimeout(() => itemTableMethods.value?.reload(), 100)
}

async function handleSave() {
  const values = await formMethods.validate()
  if (!values)
    return

  if (!values.typeName || !values.typeCode) {
    message.warning('请填写字典名称和编码')
    return
  }

  try {
    if (isEditing.value && currentRecord.value) {
      await updateDict(currentRecord.value.id, values)
      message.success(`已更新字典：${values.typeName}`)
    }
    else {
      await addDict(values)
      message.success(`已新增字典：${values.typeName}`)
    }

    modalMethods.closeModal()
    tableMethods.value?.reload()
  }
  catch {
    message.error('保存失败')
  }
}

function handleAddItem() {
  isEditingItem.value = false
  currentItemRecord.value = null
  itemFormMethods.setFieldsValue({
    dictLabel: '',
    dictValue: '',
    sort: 0,
    status: 0,
    remark: '',
  })
  itemFormMethods.clearValidate()
  itemEditModalMethods.openModal()
}

function handleEditItem(item: DictItemRecord) {
  isEditingItem.value = true
  currentItemRecord.value = item
  itemFormMethods.setFieldsValue({
    dictLabel: item.dictLabel,
    dictValue: item.dictValue,
    sort: item.sort,
    status: item.status,
    remark: item.remark,
  })
  itemFormMethods.clearValidate()
  itemEditModalMethods.openModal()
}

async function handleSaveItem() {
  const values = await itemFormMethods.validate()
  if (!values)
    return

  if (!values.dictLabel || !values.dictValue) {
    message.warning('请填写字典标签和键值')
    return
  }

  try {
    if (isEditingItem.value && currentItemRecord.value) {
      await updateDictItem(currentItemRecord.value.id, values)
      message.success(`已更新字典项：${values.dictLabel}`)
    }
    else {
      await addDictItem({ ...values, dictTypeId: selectedTypeId.value })
      message.success(`已新增字典项：${values.dictLabel}`)
    }

    isEditingItem.value = false
    currentItemRecord.value = null
    itemFormMethods.setFieldsValue({
      dictLabel: '',
      dictValue: '',
      sort: 0,
      status: 0,
      remark: '',
    })
    itemTableMethods.value?.reload()
    itemEditModalMethods.closeModal()
  }
  catch {
    message.error('保存失败')
  }
}

async function handleDeleteItem(item: DictItemRecord) {
  try {
    await deleteDictItem(item.id)
    message.success(`已删除字典项：${item.dictLabel}`)
    itemTableMethods.value?.reload()
  }
  catch {
    message.error('删除失败')
  }
}

function handleExport() {
  const tableData = (tableMethods.value?.getDataSource?.() || []) as DictTypeRecord[]
  exportToExcel({
    filename: '字典列表',
    sheetName: '字典管理',
    columns: [
      { header: 'ID', key: 'id', width: 8 },
      { header: '字典名称', key: 'typeName', width: 16 },
      { header: '字典编码', key: 'typeCode', width: 20 },
      { header: '字典项数', key: 'itemCount', width: 10 },
      { header: '状态', key: 'status', width: 8 },
      { header: '备注', key: 'remark', width: 25 },
    ],
    data: tableData.map(i => ({
      ...i,
      itemCount: i.items?.length || 0,
      status: i.status === 1 ? '正常' : '停用',
    })),
  })
}

const columns: BasicColumn[] = [
  { title: '字典名称', dataIndex: 'typeName', key: 'typeName', width: 160 },
  { title: '字典编码', dataIndex: 'typeCode', key: 'typeCode', width: 180 },
  {
    title: '字典项数',
    dataIndex: 'items',
    key: 'itemCount',
    width: 100,
    align: 'center',
  },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center' },
  { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 170 },
]

const itemColumns: BasicColumn[] = [
  { title: '字典标签', dataIndex: 'dictLabel', key: 'dictLabel', width: 130 },
  { title: '字典键值', dataIndex: 'dictValue', key: 'dictValue', width: 100, align: 'center' },
  { title: '排序', dataIndex: 'sort', key: 'sort', width: 80, align: 'center' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center' },
  { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true },
]
</script>

<template>
  <div :class="containerClassName">
    <a-card
      title="字典管理"
      :class="cardClassName"
    >
      <BasicTable
        :columns="columns"
        :api="mockApi"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
        :scroll="{ x: 1100 }"
        :action-column="{ width: 280, title: '操作', fixed: 'right' }"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button @click="handleExport">
            <template #icon>
              <Icon icon="carbon:export" />
            </template>
            导出
          </a-button>
          <a-button
            type="primary"
            @click="handleAdd"
          >
            <template #icon>
              <Icon icon="ant-design:plus-outlined" />
            </template>
            新增字典
          </a-button>
        </template>

        <template #cell-itemCount="{ record }">
          <span class="text-[#1677ff] font-medium">
            {{ record.items.length }} 项
          </span>
        </template>

        <template #cell-status="{ record }">
          <a-tag :color="statusColorMap[record.status] || 'default'">
            <span :class="tagClassName">
              <Icon :icon="record.status === 1 ? 'carbon:checkmark-outline' : 'carbon:close-outline'" />
              {{ statusLabelMap[record.status] || '未知' }}
            </span>
          </a-tag>
        </template>

        <template #cell-createdAt>
          {{ new Date().toISOString().replace('T', ' ').substring(0, 19) }}
        </template>

        <template #action="{ record }">
          <div :class="actionClassName">
            <a-button
              type="link"
              :class="btnClassName"
              @click="() => handleViewItems(record)"
            >
              <template #icon>
                <Icon icon="carbon:catalog" />
              </template>
              字典项
            </a-button>
            <a-divider
              type="vertical"
              :class="dividerClassName"
            />
            <a-button
              type="link"
              :class="btnClassName"
              @click="() => handleEdit(record)"
            >
              <template #icon>
                <Icon icon="ant-design:edit-outlined" />
              </template>
              编辑
            </a-button>
            <a-divider
              type="vertical"
              :class="dividerClassName"
            />
            <a-button
              type="link"
              danger
              :class="btnClassName"
              @click="() => handleDelete(record)"
            >
              <template #icon>
                <Icon icon="ant-design:delete-outlined" />
              </template>
              删除
            </a-button>
          </div>
        </template>
      </BasicTable>
    </a-card>

    <BasicModal
      :title="isEditing ? '编辑字典' : '新增字典'"
      :width="560"
      @register="modalRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="modalFormSchemas"
        :label-width="80"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="formRegister"
      />
    </BasicModal>

    <BasicModal
      :title="`字典项管理 - ${selectedTypeName}`"
      :width="900"
      :show-footer="false"
      @register="itemModalRegister"
    >
      <div class="mb-4 flex justify-end gap-2">
        <a-button
          type="primary"
          size="small"
          @click="handleAddItem"
        >
          <template #icon>
            <Icon icon="ant-design:plus-outlined" />
          </template>
          新增字典项
        </a-button>
      </div>

      <BasicTable
        :columns="itemColumns"
        :api="mockItemApi"
        :immediate="true"
        :use-search-form="false"
        :show-table-setting="false"
        :pagination="false"
        :action-column="{ width: 180, title: '操作', fixed: 'right' }"
        size="small"
        @register="itemTableRegister"
      >
        <template #cell-status="{ record }">
          <a-tag :color="statusColorMap[record.status] || 'default'">
            <span :class="tagClassName">
              <Icon :icon="record.status === 1 ? 'carbon:checkmark-outline' : 'carbon:close-outline'" />
              {{ statusLabelMap[record.status] || '未知' }}
            </span>
          </a-tag>
        </template>

        <template #action="{ record }">
          <div :class="actionClassName">
            <a-button
              type="link"
              :class="btnClassName"
              size="small"
              @click="() => handleEditItem(record)"
            >
              编辑
            </a-button>
            <a-divider
              type="vertical"
              :class="dividerClassName"
            />
            <a-button
              type="link"
              danger
              :class="btnClassName"
              size="small"
              @click="() => handleDeleteItem(record)"
            >
              删除
            </a-button>
          </div>
        </template>
      </BasicTable>

      <BasicModal
        :title="isEditingItem ? '编辑字典项' : '新增字典项'"
        :width="600"
        @register="itemEditModalRegister"
        @ok="handleSaveItem"
      >
        <BasicForm
          :schemas="itemFormSchemas"
          :label-width="80"
          :show-action-button-group="false"
          :grid="{ cols: 2, gutter: 16 }"
          @register="itemFormRegister"
        />
      </BasicModal>
    </BasicModal>
  </div>
</template>
