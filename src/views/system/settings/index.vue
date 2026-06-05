<script setup lang="tsx">
import type { DescriptionItem } from '@/components/business/Description'
import type { FormSchema } from '@/components/business/Form'
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { computed, ref } from 'vue'
import { addSetting, deleteSetting, getSettingsList, updateSetting } from '@/api/system'
import { Description as DetailDescription } from '@/components/business/Description'
import { BasicDrawer, useDrawer } from '@/components/business/Drawer'
import { BasicForm, useForm } from '@/components/business/Form'
import { BasicModal, useModal } from '@/components/business/Modal'
import { BasicTable, useTable } from '@/components/business/Table'
import { useDictStore } from '@/stores'
import { cn } from '@/utils/cn'
import { DictType } from '@/enums/dict'

defineOptions({ name: 'SystemSettings' })

interface SystemConfig {
  id: number
  key: string
  name: string
  value: string
  type: 'text' | 'number' | 'boolean' | 'json'
  group: string
  description: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

const dictStore = useDictStore()

const statusOptions = computed(() => dictStore.getOptions(DictType.NORMAL_DISABLE))

const containerClassName = cn('space-y-4')
const cardClassName = cn('shadow-sm')
const valueCellClassName = cn('truncate', 'block', 'max-w-[180px]')
const actionClassName = cn('flex', 'items-center', 'justify-center')
const btnClassName = cn('!px-0.5')
const dividerClassName = cn('mx-0')

const groupColorMap: Record<string, string> = {
  通用设置: 'blue',
  功能开关: 'green',
  安全设置: 'red',
  上传设置: 'cyan',
  通知设置: 'orange',
  缓存设置: 'purple',
  主题设置: 'magenta',
}

const groupIconMap: Record<string, string> = {
  通用设置: 'ant-design:setting-outlined',
  功能开关: 'ant-design:switcher-outlined',
  安全设置: 'ant-design:safety-outlined',
  上传设置: 'ant-design:cloud-upload-outlined',
  通知设置: 'ant-design:bell-outlined',
  缓存设置: 'ant-design:database-outlined',
  主题设置: 'ant-design:bg-colors-outlined',
}

const typeColorMap: Record<string, string> = {
  text: 'blue',
  number: 'green',
  boolean: 'orange',
  json: 'purple',
}

const typeLabelMap: Record<string, string> = {
  text: '文本',
  number: '数字',
  boolean: '布尔值',
  json: 'JSON',
}

const detailSchemas: DescriptionItem[] = [
  {
    field: 'key',
    label: '配置键',
    render: (value: string) => <a-tag color="blue">{value}</a-tag>,
  },
  { field: 'name', label: '配置名称' },
  { field: 'value', label: '配置值' },
  {
    field: 'type',
    label: '配置类型',
    render: (_: string, record: any) => <a-tag color={typeColorMap[record.type] || 'default'}>{typeLabelMap[record.type] || record.type}</a-tag>,
  },
  {
    field: 'group',
    label: '所属分组',
    render: (_: string, record: any) => <a-tag color={groupColorMap[record.group] || 'default'}>{record.group}</a-tag>,
  },
  { field: 'description', label: '描述信息' },
  {
    field: 'enabled',
    label: '启用状态',
    render: (_: any, record: any) => <a-tag color={record.enabled ? 'green' : 'red'}>{record.enabled ? '已启用' : '已禁用'}</a-tag>,
  },
  { field: 'createdAt', label: '创建时间' },
  { field: 'updatedAt', label: '更新时间' },
]

const isEditing = ref(false)
const currentRecord = ref<SystemConfig | null>(null)
const viewingRecord = ref<SystemConfig | null>(null)

const [modalRegister, modalMethods] = useModal()
const [drawerRegister, drawerMethods] = useDrawer()
const [tableRegister, tableMethods] = useTable()
const [formRegister, formMethods] = useForm()

const searchFormSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    colProps: { span: 6 },
    componentProps: {
      placeholder: '搜索配置键/名称/分组...',
      allowClear: true,
    },
  },
  {
    field: 'type',
    label: '配置类型',
    component: 'Select',
    colProps: { span: 6 },
    componentProps: {
      placeholder: '选择类型',
      allowClear: true,
      options: [
        { label: '文本', value: 'text' },
        { label: '数字', value: 'number' },
        { label: '布尔值', value: 'boolean' },
        { label: 'JSON', value: 'json' },
      ],
    },
  },
  {
    field: 'enabled',
    label: '状态',
    component: 'Select',
    colProps: { span: 6 },
    componentProps: () => ({
      placeholder: '选择状态',
      allowClear: true,
      options: statusOptions.value,
    }),
  },
]

const modalFormSchemas: FormSchema[] = [
  {
    field: 'key',
    label: '配置键',
    colProps: { span: 12 },
    component: 'Input',
    required: true,
    componentProps: { placeholder: '例如：site.name' },
  },
  {
    field: 'name',
    label: '配置名称',
    colProps: { span: 12 },
    component: 'Input',
    required: true,
    componentProps: { placeholder: '例如：站点名称' },
  },
  {
    field: 'type',
    label: '配置类型',
    component: 'Select',
    colProps: { span: 12 },
    componentProps: {
      options: [
        { label: '文本', value: 'text' },
        { label: '数字', value: 'number' },
        { label: '布尔值', value: 'boolean' },
        { label: 'JSON', value: 'json' },
      ],
    },
  },
  {
    field: 'group',
    label: '所属分组',
    component: 'Select',
    colProps: { span: 12 },
    componentProps: {
      options: Object.keys(groupColorMap).map(g => ({ label: g, value: g })),
    },
  },
  {
    field: 'value',
    label: '配置值',
    component: 'Input',
    componentProps: { placeholder: '请输入配置值' },
    colProps: { span: 24 },
  },
  {
    field: 'sortOrder',
    label: '排序号',
    component: 'InputNumber',
    colProps: { span: 12 },
    defaultValue: 0,
    componentProps: { min: 0, placeholder: '数字越小越靠前', style: { width: '100%' } },
  },
  {
    field: 'enabled',
    label: '启用状态',
    component: 'RadioGroup',
    defaultValue: '0',
    colProps: { span: 12 },
    componentProps: () => ({
      optionType: 'button',
      buttonStyle: 'solid',
      options: statusOptions.value,
    }),
  },
  {
    field: 'description',
    label: '描述信息',
    component: 'InputTextArea',
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入配置描述...', rows: 3 },
  },
]

async function mockApi(params: Record<string, any>) {
  const res = await getSettingsList(params)
  const data = res?.data ?? res
  return { items: data?.list || [], total: data?.total || 0 }
}

function handleAdd() {
  isEditing.value = false
  currentRecord.value = null
  formMethods.setFieldsValue({
    key: '',
    name: '',
    value: '',
    type: 'text',
    group: '通用设置',
    description: '',
    sortOrder: 0,
    enabled: true,
  })
  formMethods.clearValidate()
  modalMethods.openModal()
}

function handleEdit(record: SystemConfig) {
  isEditing.value = true
  currentRecord.value = record
  formMethods.setFieldsValue({
    key: record.key,
    name: record.name,
    value: record.value,
    type: record.type,
    group: record.group,
    description: record.description,
    sortOrder: (record as any).sortOrder ?? 0,
    enabled: record.enabled,
  })
  formMethods.clearValidate()
  modalMethods.openModal()
}

function handleView(record: SystemConfig) {
  viewingRecord.value = record
  drawerMethods.openDrawer()
}

async function handleDelete(record: SystemConfig) {
  try {
    await deleteSetting(record.id)
    message.success(`已删除配置：${record.name}`)
    tableMethods.value?.reload()
  }
  catch {
    message.error('删除失败')
  }
}

async function handleSave() {
  const values = await formMethods.validate()
  if (!values) {
    return
  }

  try {
    if (isEditing.value && currentRecord.value) {
      await updateSetting(currentRecord.value.id, values)
      message.success(`已更新配置：${values.name}`)
    }
    else {
      await addSetting(values)
      message.success(`已新增配置：${values.name}`)
    }

    modalMethods.closeModal()
    tableMethods.value?.reload()
  }
  catch {
    message.error('保存失败')
  }
}

async function handleToggleEnabled(record: SystemConfig, enabled: boolean) {
  try {
    await updateSetting(record.id, { enabled })
    message.success(`${enabled ? '已启用' : '已禁用'}：${record.name}`)
    tableMethods.value?.reload()
  }
  catch {
    message.error('操作失败')
  }
}

function handleApply(record: SystemConfig) {
  message.success(`已将「${record.name}」应用到系统`)
}

const columns: BasicColumn[] = [
  { title: '#', key: 'index', width: 60, align: 'center', customRender: ({ index }) => index + 1 },
  { title: '配置键', dataIndex: 'key', key: 'key', width: 180, ellipsis: true },
  { title: '名称', dataIndex: 'name', key: 'name', width: 160 },
  { title: '配置值', dataIndex: 'value', key: 'value', width: 200, ellipsis: true },
  { title: '类型', dataIndex: 'type', key: 'type', width: 80, align: 'center' },
  { title: '分组', dataIndex: 'group', key: 'group', width: 110, align: 'center' },
  { title: '状态', dataIndex: 'enabled', key: 'enabled', width: 70, align: 'center' },
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 170 },
]
</script>

<template>
  <div :class="containerClassName">
    <a-card
      title="系统设置"
      :class="cardClassName"
    >
      <BasicTable
        :columns="columns"
        :api="mockApi"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
        :scroll="{ x: 1400 }"
        :action-column="{ width: 280, title: '操作', fixed: 'right' }"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button
            type="primary"
            @click="handleAdd"
          >
            <template #icon>
              <Icon icon="ant-design:plus-outlined" />
            </template>
            新增设置
          </a-button>
        </template>
        <template #cell-type="{ record }">
          <a-tag :color="typeColorMap[record.type] || 'default'">
            {{ typeLabelMap[record.type] || record.type }}
          </a-tag>
        </template>
        <template #cell-group="{ record }">
          <a-tag
            :color="groupColorMap[record.group] || 'default'"
            class="whitespace-nowrap flex! items-center w-full justify-between"
          >
            <template #icon>
              <Icon
                v-if="groupIconMap[record.group]"
                :icon="groupIconMap[record.group]!"
              />
            </template>
            {{ record.group }}
          </a-tag>
        </template>
        <template #cell-enabled="{ record }">
          <a-switch
            :checked="record.enabled"
            size="small"
            @change="(checked: boolean) => handleToggleEnabled(record as SystemConfig, checked)"
          />
        </template>
        <template #cell-value="{ text }">
          <a-tooltip :title="text">
            <span :class="valueCellClassName">{{ text }}</span>
          </a-tooltip>
        </template>

        <template #action="{ record }">
          <div :class="actionClassName">
            <a-button
              type="link"
              :class="btnClassName"
              @click="() => handleApply(record)"
            >
              <template #icon>
                <Icon icon="carbon:restart" />
              </template>
              应用
            </a-button>
            <a-divider
              type="vertical"
              :class="dividerClassName"
            />
            <a-button
              type="link"
              :class="btnClassName"
              @click="() => handleView(record)"
            >
              <template #icon>
                <Icon icon="ant-design:eye-outlined" />
              </template>
              查看
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
      :title="isEditing ? '编辑设置' : '新增设置'"
      :width="640"
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

    <BasicDrawer
      :title="`详情设置 - ${viewingRecord?.name || ''}`"
      :size="520"
      @register="drawerRegister"
    >
      <DetailDescription
        v-if="viewingRecord"
        :data="viewingRecord"
        :schema="detailSchemas"
        :column="1"
        bordered
      />
    </BasicDrawer>
  </div>
</template>
