<script setup lang="tsx">
import type { DescriptionItem } from '@/components/business/Description'
import type { FormSchema } from '@/components/business/Form'
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { ref } from 'vue'
import { Description as DetailDescription } from '@/components/business/Description'
import { BasicDrawer, useDrawer } from '@/components/business/Drawer'
import { BasicForm, useForm } from '@/components/business/Form'
import { BasicModal, useModal } from '@/components/business/Modal'
import { BasicTable, useTable } from '@/components/business/Table'
import { cn } from '@/utils/cn'

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

const containerClassName = cn('space-y-4')
const cardClassName = cn('shadow-sm')
const valueCellClassName = cn('truncate', 'block', 'max-w-[180px]')
const actionClassName = cn('flex', 'items-center')
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

const mockData: SystemConfig[] = [
  { id: 1, key: 'site.name', name: '站点名称', value: 'Antdv Next Admin', type: 'text', group: '通用设置', description: '系统站点显示名称', enabled: true, createdAt: '2024-01-15 10:00:00', updatedAt: '2024-05-20 14:30:00' },
  { id: 2, key: 'site.logo', name: '站点Logo', value: '/logo.png', type: 'text', group: '通用设置', description: '站点Logo图片路径', enabled: true, createdAt: '2024-01-15 10:00:00', updatedAt: '2024-05-18 09:00:00' },
  { id: 3, key: 'site.subtitle', name: '副标题', value: '企业级后台管理系统', type: 'text', group: '通用设置', description: '站点副标题，显示在Logo下方', enabled: true, createdAt: '2024-01-16 08:00:00', updatedAt: '2024-05-22 10:00:00' },
  { id: 4, key: 'site.icp', name: 'ICP备案号', value: '京ICP备2024000001号', type: 'text', group: '通用设置', description: '网站ICP备案号', enabled: true, createdAt: '2024-01-16 08:00:00', updatedAt: '2024-05-22 10:00:00' },
  { id: 5, key: 'site.copyright', name: '版权信息', value: '© 2024 Antdv Next Admin', type: 'text', group: '通用设置', description: '网站底部版权信息', enabled: true, createdAt: '2024-01-16 08:30:00', updatedAt: '2024-05-22 10:15:00' },
  { id: 6, key: 'site.language', name: '默认语言', value: 'zh-CN', type: 'text', group: '通用设置', description: '系统默认显示语言', enabled: true, createdAt: '2024-01-16 08:30:00', updatedAt: '2024-05-22 10:15:00' },
  { id: 8, key: 'feature.darkMode', name: '暗黑模式', value: 'true', type: 'boolean', group: '功能开关', description: '启用暗黑模式切换', enabled: true, createdAt: '2024-05-01 09:00:00', updatedAt: '2024-05-20 08:00:00' },
  { id: 9, key: 'feature.watermark', name: '水印功能', value: 'true', type: 'boolean', group: '功能开关', description: '启用页面水印', enabled: false, createdAt: '2024-05-01 09:00:00', updatedAt: '2024-05-02 14:00:00' },
  { id: 16, key: 'security.loginRetry', name: '登录重试次数', value: '5', type: 'number', group: '安全设置', description: '最大登录失败重试次数', enabled: true, createdAt: '2024-03-10 09:00:00', updatedAt: '2024-05-10 10:00:00' },
  { id: 22, key: 'upload.maxSize', name: '最大上传大小', value: '10', type: 'number', group: '上传设置', description: '单文件最大上传大小（MB）', enabled: true, createdAt: '2024-02-01 08:00:00', updatedAt: '2024-05-15 11:00:00' },
  { id: 26, key: 'notification.emailAlert', name: '邮件告警', value: 'false', type: 'boolean', group: '通知设置', description: '系统错误时发送邮件告警', enabled: false, createdAt: '2024-04-01 10:00:00', updatedAt: '2024-04-20 15:00:00' },
  { id: 30, key: 'cache.ttl', name: '缓存过期时间', value: '3600', type: 'number', group: '缓存设置', description: '默认缓存TTL（秒）', enabled: true, createdAt: '2024-04-15 08:00:00', updatedAt: '2024-05-19 12:00:00' },
  { id: 34, key: 'theme.primaryColor', name: '主题色', value: '#1677ff', type: 'text', group: '主题设置', description: '系统主题色', enabled: true, createdAt: '2024-06-01 09:00:00', updatedAt: '2024-06-10 14:00:00' },
]

const allData = ref<SystemConfig[]>([...mockData])

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
    componentProps: {
      placeholder: '选择状态',
      allowClear: true,
      options: [
        { label: '启用', value: true },
        { label: '禁用', value: false },
      ],
    },
  },
]

const modalFormSchemas: FormSchema[] = [
  {
    field: 'key',
    label: '配置键',
    component: 'Input',
    required: true,
    colProps: { span: 12 },
    componentProps: { placeholder: '例如：site.name' },
  },
  {
    field: 'name',
    label: '配置名称',
    component: 'Input',
    required: true,
    colProps: { span: 12 },
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
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入配置值' },
  },
  {
    field: 'description',
    label: '描述信息',
    component: 'InputTextArea',
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入配置描述...', rows: 2 },
  },
  {
    field: 'enabled',
    label: '启用状态',
    component: 'Switch',
    colProps: { span: 24 },
  },
]

async function mockApi(params: Record<string, any>) {
  const { keyword, type, enabled, page = 1, pageSize = 10 } = params
  let filtered = [...allData.value]

  if (keyword) {
    const kw = String(keyword).toLowerCase()
    filtered = filtered.filter(
      i => i.name.toLowerCase().includes(kw)
        || i.key.toLowerCase().includes(kw)
        || i.group.includes(kw),
    )
  }

  if (type) {
    filtered = filtered.filter(i => i.type === type)
  }

  if (enabled !== undefined && enabled !== null && enabled !== '') {
    filtered = filtered.filter(i => i.enabled === (enabled === 'true' || enabled === true))
  }

  const total = filtered.length
  const start = (Number(page) - 1) * Number(pageSize)
  const items = filtered.slice(start, start + Number(pageSize))

  return { items, total }
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
    enabled: record.enabled,
  })
  formMethods.clearValidate()
  modalMethods.openModal()
}

function handleView(record: SystemConfig) {
  viewingRecord.value = record
  drawerMethods.openDrawer()
}

function handleDelete(record: SystemConfig) {
  const idx = allData.value.findIndex(i => i.id === record.id)
  if (idx > -1) {
    allData.value.splice(idx, 1)
    message.success(`已删除配置：${record.name}`)
    tableMethods.value?.reload()
  }
}

async function handleSave() {
  const values = await formMethods.validate()
  if (!values) {
    return
  }

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

  if (isEditing.value && currentRecord.value) {
    const idx = allData.value.findIndex(i => i.id === currentRecord.value!.id)
    if (idx > -1) {
      allData.value[idx] = { ...allData.value[idx]!, ...values, id: currentRecord.value.id, updatedAt: now }
    }
    message.success(`已更新配置：${values.name}`)
  }
  else {
    const newId = Math.max(...allData.value.map(i => i.id), 0) + 1
    allData.value.push({
      id: newId,
      ...values,
      createdAt: now,
      updatedAt: now,
    })
    message.success(`已新增配置：${values.name}`)
  }

  modalMethods.closeModal()
  tableMethods.value?.reload()
}

function handleToggleEnabled(record: SystemConfig, enabled: boolean) {
  const item = allData.value.find(i => i.id === record.id)
  if (item) {
    item.enabled = enabled
    message.success(`${enabled ? '已启用' : '已禁用'}：${item.name}`)
    tableMethods.value?.reload()
  }
}

const columns: BasicColumn[] = [
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
        :action-column="{ width: 220, title: '操作', fixed: 'right' }"
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
        :show-action-button-group="true"
        @register="formRegister"
      />
    </BasicModal>

    <BasicDrawer
      :title="`查看设置 - ${viewingRecord?.name || ''}`"
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
