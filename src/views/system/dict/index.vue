<script setup lang="ts">
import type { FormSchema } from '@/components/business/Form'
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { ref } from 'vue'
import { BasicForm, useForm } from '@/components/business/Form'
import { BasicModal, useModal } from '@/components/business/Modal'
import { BasicTable, useTable } from '@/components/business/Table'
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
const actionClassName = cn('flex', 'items-center')
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

const mockDictTypes: DictTypeRecord[] = [
  {
    id: 1,
    typeName: '用户性别',
    typeCode: 'sys_user_sex',
    status: 1,
    remark: '用户性别字典',
    items: [
      { id: 101, dictType: 'sys_user_sex', dictLabel: '男', dictValue: '0', cssClass: '', sort: 1, status: 1, remark: '' },
      { id: 102, dictType: 'sys_user_sex', dictLabel: '女', dictValue: '1', cssClass: '', sort: 2, status: 1, remark: '' },
      { id: 103, dictType: 'sys_user_sex', dictLabel: '保密', dictValue: '2', cssClass: '', sort: 3, status: 1, remark: '' },
    ],
  },
  {
    id: 2,
    typeName: '显示状态',
    typeCode: 'sys_show_status',
    status: 1,
    remark: '显示状态字典',
    items: [
      { id: 201, dictType: 'sys_show_status', dictLabel: '显示', dictValue: '0', cssClass: 'primary', sort: 1, status: 1, remark: '' },
      { id: 202, dictType: 'sys_show_status', dictLabel: '隐藏', dictValue: '1', cssClass: 'warning', sort: 2, status: 1, remark: '' },
    ],
  },
  {
    id: 3,
    typeName: '通知置顶',
    typeCode: 'biz_notice_top',
    status: 1,
    remark: '通知置顶状态',
    items: [
      { id: 301, dictType: 'biz_notice_top', dictLabel: '置顶', dictValue: '0', cssClass: '', sort: 1, status: 1, remark: '' },
      { id: 302, dictType: 'biz_notice_top', dictLabel: '热门', dictValue: '1', cssClass: '', sort: 2, status: 1, remark: '' },
      { id: 303, dictType: 'biz_notice_top', dictLabel: '普通', dictValue: '2', cssClass: '', sort: 3, status: 1, remark: '' },
    ],
  },
  {
    id: 4,
    typeName: '通知类型',
    typeCode: 'biz_notice_type',
    status: 1,
    remark: '通知类型分类',
    items: [
      { id: 401, dictType: 'biz_notice_type', dictLabel: '通告', dictValue: '1', cssClass: '', sort: 1, status: 1, remark: '' },
      { id: 402, dictType: 'biz_notice_type', dictLabel: '公告', dictValue: '2', cssClass: '', sort: 2, status: 1, remark: '' },
      { id: 403, dictType: 'biz_notice_type', dictLabel: '通知', dictValue: '3', cssClass: '', sort: 3, status: 1, remark: '' },
    ],
  },
  {
    id: 5,
    typeName: '系统状态',
    typeCode: 'sys_normal_disable',
    status: 1,
    remark: '系统正常/停用状态',
    items: [
      { id: 501, dictType: 'sys_normal_disable', dictLabel: '正常', dictValue: '1', cssClass: 'success', sort: 1, status: 1, remark: '' },
      { id: 502, dictType: 'sys_normal_disable', dictLabel: '停用', dictValue: '0', cssClass: 'danger', sort: 2, status: 1, remark: '' },
    ],
  },
  {
    id: 6,
    typeName: '文章状态',
    typeCode: 'biz_article_status',
    status: 1,
    remark: '文章发布状态',
    items: [
      { id: 601, dictType: 'biz_article_status', dictLabel: '草稿', dictValue: '0', cssClass: 'info', sort: 1, status: 1, remark: '' },
      { id: 602, dictType: 'biz_article_status', dictLabel: '发布', dictValue: '1', cssClass: 'success', sort: 2, status: 1, remark: '' },
      { id: 603, dictType: 'biz_article_status', dictLabel: '下架', dictValue: '2', cssClass: 'warning', sort: 3, status: 0, remark: '' },
    ],
  },
]

const allDictTypes = ref<DictTypeRecord[]>([...mockDictTypes])

const isEditing = ref(false)
const isEditingItem = ref(false)
const currentRecord = ref<DictTypeRecord | null>(null)
const currentItemRecord = ref<DictItemRecord | null>(null)
const selectedTypeId = ref<number | null>(null)

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
        { label: '正常', value: 1 },
        { label: '停用', value: 0 },
      ],
    },
    colProps: { span: 8 },
  },
]

const modalFormSchemas: FormSchema[] = [
  {
    field: 'typeName',
    label: '字典名称',
    component: 'Input',
    required: true,
    colProps: { span: 12 },
    componentProps: { placeholder: '例如：用户性别' },
  },
  {
    field: 'typeCode',
    label: '字典编码',
    component: 'Input',
    required: true,
    colProps: { span: 12 },
    componentProps: { placeholder: '例如：sys_user_sex' },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    colProps: { span: 12 },
    componentProps: {
      options: [
        { label: '正常', value: 1 },
        { label: '停用', value: 0 },
      ],
    },
  },
  {
    field: 'remark',
    label: '备注',
    component: 'InputTextArea',
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入备注信息...', rows: 2 },
  },
]

const itemFormSchemas: FormSchema[] = [
  {
    field: 'dictLabel',
    label: '字典标签',
    component: 'Input',
    required: true,
    colProps: { span: 12 },
    componentProps: { placeholder: '例如：男' },
  },
  {
    field: 'dictValue',
    label: '字典键值',
    component: 'Input',
    required: true,
    colProps: { span: 12 },
    componentProps: { placeholder: '例如：0' },
  },
  {
    field: 'cssClass',
    label: '样式类名',
    component: 'Input',
    colProps: { span: 12 },
    componentProps: { placeholder: '例如：success' },
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
    component: 'Select',
    colProps: { span: 12 },
    componentProps: {
      options: [
        { label: '正常', value: 1 },
        { label: '停用', value: 0 },
      ],
    },
  },
  {
    field: 'remark',
    label: '备注',
    component: 'InputTextArea',
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入备注...', rows: 2 },
  },
]

async function mockApi(params: Record<string, any>) {
  const { keyword, status, page = 1, pageSize = 10 } = params
  let filtered = [...allDictTypes.value]

  if (keyword) {
    const kw = String(keyword).toLowerCase()
    filtered = filtered.filter(
      i => i.typeName.toLowerCase().includes(kw)
        || i.typeCode.toLowerCase().includes(kw),
    )
  }

  if (status !== undefined && status !== null && status !== '') {
    filtered = filtered.filter(i => i.status === Number(status))
  }

  const total = filtered.length
  const start = (Number(page) - 1) * Number(pageSize)
  const items = filtered.slice(start, start + Number(pageSize))

  return { items, total }
}

async function mockItemApi(params: Record<string, any>) {
  const { keyword, status } = params || {}
  if (selectedTypeId.value === null)
    return { items: [], total: 0 }

  const dictType = allDictTypes.value.find(t => t.id === selectedTypeId.value)
  if (!dictType)
    return { items: [], total: 0 }

  let filtered = [...dictType.items]

  if (keyword) {
    const kw = String(keyword).toLowerCase()
    filtered = filtered.filter(
      i => i.dictLabel.toLowerCase().includes(kw)
        || i.dictValue.toLowerCase().includes(kw),
    )
  }

  if (status !== undefined && status !== null && status !== '') {
    filtered = filtered.filter(i => i.status === Number(status))
  }

  return { items: filtered, total: filtered.length }
}

function handleAdd() {
  isEditing.value = false
  currentRecord.value = null
  formMethods.setFieldsValue({
    typeName: '',
    typeCode: '',
    status: 1,
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
    status: record.status,
    remark: record.remark,
  })
  formMethods.clearValidate()
  modalMethods.openModal()
}

function handleDelete(record: DictTypeRecord) {
  const idx = allDictTypes.value.findIndex(i => i.id === record.id)
  if (idx > -1) {
    allDictTypes.value.splice(idx, 1)
    message.success(`已删除字典：${record.typeName}`)
    tableMethods.value?.reload()
  }
}

function handleViewItems(record: DictTypeRecord) {
  selectedTypeId.value = record.id
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

  if (isEditing.value && currentRecord.value) {
    const idx = allDictTypes.value.findIndex(i => i.id === currentRecord.value!.id)
    if (idx > -1) {
      allDictTypes.value[idx] = {
        ...allDictTypes.value[idx]!,
        typeName: values.typeName,
        typeCode: values.typeCode,
        status: values.status,
        remark: values.remark,
      }
    }
    message.success(`已更新字典：${values.typeName}`)
  }
  else {
    const newId = Math.max(...allDictTypes.value.map(i => i.id), 0) + 1
    allDictTypes.value.push({
      id: newId,
      typeName: values.typeName,
      typeCode: values.typeCode,
      status: values.status,
      remark: values.remark,
      items: [],
    })
    message.success(`已新增字典：${values.typeName}`)
  }

  modalMethods.closeModal()
  tableMethods.value?.reload()
}

function handleAddItem() {
  isEditingItem.value = false
  currentItemRecord.value = null
  itemFormMethods.setFieldsValue({
    dictLabel: '',
    dictValue: '',
    cssClass: '',
    sort: 0,
    status: 1,
    remark: '',
  })
  itemEditModalMethods.openModal()
}

function handleEditItem(item: DictItemRecord) {
  isEditingItem.value = true
  currentItemRecord.value = item
  itemFormMethods.setFieldsValue({
    dictLabel: item.dictLabel,
    dictValue: item.dictValue,
    cssClass: item.cssClass,
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

  const dictType = allDictTypes.value.find(t => t.id === selectedTypeId.value)
  if (!dictType)
    return

  if (isEditingItem.value && currentItemRecord.value) {
    const idx = dictType.items.findIndex(i => i.id === currentItemRecord.value!.id)
    if (idx > -1) {
      dictType.items[idx] = {
        ...dictType.items[idx]!,
        dictLabel: values.dictLabel,
        dictValue: values.dictValue,
        cssClass: values.cssClass,
        sort: values.sort,
        status: values.status,
        remark: values.remark,
      }
    }
    message.success(`已更新字典项：${values.dictLabel}`)
  }
  else {
    const newId = Math.max(...dictType.items.map(i => i.id), 500) + 1
    dictType.items.push({
      id: newId,
      dictType: dictType.typeCode,
      dictLabel: values.dictLabel,
      dictValue: values.dictValue,
      cssClass: values.cssClass,
      sort: values.sort,
      status: values.status,
      remark: values.remark,
    })
    message.success(`已新增字典项：${values.dictLabel}`)
  }

  isEditingItem.value = false
  currentItemRecord.value = null
  itemFormMethods.setFieldsValue({
    dictLabel: '',
    dictValue: '',
    cssClass: '',
    sort: 0,
    status: 1,
    remark: '',
  })
  itemTableMethods.value?.reload()
  itemEditModalMethods.closeModal()
}

function handleDeleteItem(item: DictItemRecord) {
  const dictType = allDictTypes.value.find(t => t.id === selectedTypeId.value)
  if (!dictType)
    return

  const idx = dictType.items.findIndex(i => i.id === item.id)
  if (idx > -1) {
    dictType.items.splice(idx, 1)
    message.success(`已删除字典项：${item.dictLabel}`)
    itemTableMethods.value?.reload()
  }
}

function handleExport() {
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
    data: allDictTypes.value.map(i => ({
      ...i,
      itemCount: i.items.length,
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
  { title: '样式类名', dataIndex: 'cssClass', key: 'cssClass', width: 110, align: 'center' },
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
        :action-column="{ width: 250, title: '操作', fixed: 'right' }"
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
        @register="formRegister"
      />
    </BasicModal>

    <BasicModal
      :title="`字典项管理 - ${allDictTypes.find(t => t.id === selectedTypeId)?.typeName || ''}`"
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
        <template #cell-cssClass="{ record }">
          <a-tag
            v-if="record.cssClass"
            :color="record.cssClass"
          >
            {{ record.cssClass }}
          </a-tag>
          <span v-else>-</span>
        </template>

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
          @register="itemFormRegister"
        />
      </BasicModal>
    </BasicModal>
  </div>
</template>
