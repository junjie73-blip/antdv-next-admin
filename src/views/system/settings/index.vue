<script setup lang="ts">
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { reactive, ref } from 'vue'
import { BasicDrawer, useDrawer } from '@/components/business/Drawer'
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
const toolbarClassName = cn('mb-4', 'flex', 'justify-between', 'items-center')
const detailSectionClassName = cn('mb-4')

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

const mockData: SystemConfig[] = [
  { id: 1, key: 'site.name', name: '站点名称', value: 'Antdv Next Admin', type: 'text', group: '通用', description: '系统站点显示名称', enabled: true, createdAt: '2024-01-15 10:00:00', updatedAt: '2024-05-20 14:30:00' },
  { id: 2, key: 'site.logo', name: '站点Logo', value: '/logo.png', type: 'text', group: '通用', description: '站点Logo图片路径', enabled: true, createdAt: '2024-01-15 10:00:00', updatedAt: '2024-05-18 09:00:00' },
  { id: 3, key: 'upload.maxSize', name: '最大上传大小', value: '10', type: 'number', group: '上传', description: '单文件最大上传大小（MB）', enabled: true, createdAt: '2024-02-01 08:00:00', updatedAt: '2024-05-15 11:00:00' },
  { id: 4, key: 'upload.allowedTypes', name: '允许的文件类型', value: '["jpg","png","pdf","docx"]', type: 'json', group: '上传', description: '允许上传的文件类型列表', enabled: true, createdAt: '2024-02-01 08:00:00', updatedAt: '2024-05-12 16:00:00' },
  { id: 5, key: 'security.loginRetry', name: '登录重试次数', value: '5', type: 'number', group: '安全', description: '最大登录重试次数', enabled: true, createdAt: '2024-03-10 09:00:00', updatedAt: '2024-05-10 10:00:00' },
  { id: 6, key: 'security.captchaEnabled', name: '验证码开关', value: 'true', type: 'boolean', group: '安全', description: '是否启用登录验证码', enabled: true, createdAt: '2024-03-10 09:00:00', updatedAt: '2024-05-08 13:00:00' },
  { id: 7, key: 'notification.emailAlert', name: '邮件告警', value: 'false', type: 'boolean', group: '通知', description: '系统错误时发送邮件告警', enabled: false, createdAt: '2024-04-01 10:00:00', updatedAt: '2024-04-20 15:00:00' },
  { id: 8, key: 'notification.webhook', name: 'Webhook地址', value: 'https://hooks.example.com/alert', type: 'text', group: '通知', description: '系统告警Webhook地址', enabled: true, createdAt: '2024-04-01 10:00:00', updatedAt: '2024-05-01 09:00:00' },
  { id: 9, key: 'cache.ttl', name: '缓存过期时间', value: '3600', type: 'number', group: '缓存', description: '默认缓存TTL（秒）', enabled: true, createdAt: '2024-04-15 08:00:00', updatedAt: '2024-05-19 12:00:00' },
  { id: 10, key: 'cache.prefix', name: '缓存键前缀', value: 'admin:', type: 'text', group: '缓存', description: '缓存键前缀', enabled: true, createdAt: '2024-04-15 08:00:00', updatedAt: '2024-04-16 10:00:00' },
  { id: 11, key: 'feature.darkMode', name: '暗黑模式', value: 'true', type: 'boolean', group: '功能', description: '启用暗黑模式切换', enabled: true, createdAt: '2024-05-01 09:00:00', updatedAt: '2024-05-20 08:00:00' },
  { id: 12, key: 'feature.watermark', name: '水印功能', value: 'true', type: 'boolean', group: '功能', description: '启用页面水印', enabled: false, createdAt: '2024-05-01 09:00:00', updatedAt: '2024-05-02 14:00:00' },
]

let nextId = 13

const searchText = ref('')
const dataSource = ref<SystemConfig[]>([...mockData])

const columns: BasicColumn[] = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80, align: 'center' },
  { title: '配置键', dataIndex: 'key', key: 'key', ellipsis: true },
  { title: '配置名', dataIndex: 'name', key: 'name' },
  { title: '配置值', dataIndex: 'value', key: 'value', ellipsis: true },
  { title: '类型', dataIndex: 'type', key: 'type', width: 100, align: 'center' },
  { title: '分组', dataIndex: 'group', key: 'group', width: 120 },
  { title: '状态', dataIndex: 'enabled', key: 'enabled', width: 100, align: 'center' },
  { title: '操作', key: 'operations', width: 280, align: 'center' as const },
]

const [registerTable, tableRef] = useTable({
  columns,
  dataSource: dataSource.value,
  rowKey: 'id',
  pagination: { pageSize: 10, showSizeChanger: true, showQuickJumper: true },
})

const [registerModal, modalMethods] = useModal()
const [registerDrawer, drawerMethods] = useDrawer()

const isEdit = ref(false)
const currentRecord = ref<SystemConfig | null>(null)
const modalForm = reactive<Partial<SystemConfig>>({
  key: '',
  name: '',
  value: '',
  type: 'text',
  group: '',
  description: '',
  enabled: true,
})

function handleSearch() {
  const keyword = searchText.value.trim().toLowerCase()
  if (!keyword) {
    dataSource.value = [...mockData]
  }
  else {
    dataSource.value = mockData.filter(
      item =>
        item.key.toLowerCase().includes(keyword)
        || item.name.toLowerCase().includes(keyword)
        || item.group.toLowerCase().includes(keyword)
        || item.description.toLowerCase().includes(keyword),
    )
  }
  tableRef.value?.setProps({ dataSource: dataSource.value })
}

function handleAdd() {
  isEdit.value = false
  currentRecord.value = null
  Object.assign(modalForm, { key: '', name: '', value: '', type: 'text', group: '', description: '', enabled: true })
  modalMethods.openModal(true)
}

function handleEdit(record: SystemConfig) {
  isEdit.value = true
  currentRecord.value = { ...record }
  Object.assign(modalForm, {
    key: record.key,
    name: record.name,
    value: record.value,
    type: record.type,
    group: record.group,
    description: record.description,
    enabled: record.enabled,
  })
  modalMethods.openModal(true, record)
}

function handleView(record: SystemConfig) {
  currentRecord.value = { ...record }
  drawerMethods.openDrawer(true, record)
}

function handleDelete(record: SystemConfig) {
  const index = mockData.findIndex(item => item.id === record.id)
  if (index > -1) {
    mockData.splice(index, 1)
    dataSource.value = [...mockData]
    handleSearch()
    message.success(`已删除「${record.name}」`)
  }
}

function handleModalOk() {
  if (!modalForm.key || !modalForm.name || !modalForm.value) {
    message.warning('请填写配置键、配置名和配置值')
    return
  }

  const now = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')

  if (isEdit.value && currentRecord.value) {
    const index = mockData.findIndex(item => item.id === currentRecord.value!.id)
    if (index > -1) {
      mockData[index] = {
        ...mockData[index],
        key: modalForm.key!,
        name: modalForm.name!,
        value: modalForm.value!,
        type: modalForm.type as SystemConfig['type'],
        group: modalForm.group || '',
        description: modalForm.description || '',
        enabled: modalForm.enabled ?? true,
        updatedAt: now,
      }
      message.success(`已更新「${modalForm.name}」`)
    }
  }
  else {
    mockData.unshift({
      id: nextId++,
      key: modalForm.key!,
      name: modalForm.name!,
      value: modalForm.value!,
      type: modalForm.type as SystemConfig['type'],
      group: modalForm.group || '',
      description: modalForm.description || '',
      enabled: modalForm.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    })
    message.success(`已创建「${modalForm.name}」`)
  }

  dataSource.value = [...mockData]
  handleSearch()
  modalMethods.closeModal()
}

function handleCloseModal() {
  modalMethods.closeModal()
}

function handleCloseDrawer() {
  drawerMethods.closeDrawer()
}
</script>

<template>
  <div :class="containerClassName">
    <a-card title="系统配置" variant="borderless">
      <div :class="toolbarClassName">
        <a-input
          v-model:value="searchText"
          placeholder="搜索配置键、配置名、分组、描述..."
          allow-clear
          style="width: 360px"
          @pressEnter="handleSearch"
          @change="handleSearch"
        >
          <template #prefix>
            <Icon icon="carbon:search" />
          </template>
        </a-input>
        <a-button type="primary" @click="handleAdd">
          <template #icon>
            <Icon icon="carbon:add" />
          </template>
          新增配置
        </a-button>
      </div>

      <BasicTable @register="registerTable">
        <template #cell-type="{ record }">
          <a-tag :color="typeColorMap[record?.type] || 'default'">
            {{ typeLabelMap[record?.type] || record?.type }}
          </a-tag>
        </template>
        <template #cell-enabled="{ record }">
          <a-tag :color="record?.enabled ? 'green' : 'default'">
            {{ record?.enabled ? '启用' : '禁用' }}
          </a-tag>
        </template>
        <template #cell-operations="{ record }">
          <a-space>
            <a-button type="link" size="small" @click="handleView(record)">
              <template #icon>
                <Icon icon="carbon:view" />
              </template>
              查看
            </a-button>
            <a-button type="link" size="small" @click="handleEdit(record)">
              <template #icon>
                <Icon icon="carbon:edit" />
              </template>
              编辑
            </a-button>
            <a-popconfirm
              title="确认删除"
              ok-text="删除"
              cancel-text="取消"
              ok-type="danger"
              @confirm="handleDelete(record)"
            >
              <a-button type="link" size="small" danger>
                <template #icon>
                  <Icon icon="carbon:trash-can" />
                </template>
                删除
              </a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </BasicTable>
    </a-card>

    <BasicModal
      @register="registerModal"
      :title="isEdit ? '编辑配置' : '新增配置'"
      @ok="handleModalOk"
      @cancel="handleCloseModal"
    >
      <a-form :model="modalForm" layout="vertical">
        <a-form-item label="配置键" required>
          <a-input v-model:value="modalForm.key" placeholder="例如：site.name" />
        </a-form-item>
        <a-form-item label="配置名" required>
          <a-input v-model:value="modalForm.name" placeholder="例如：站点名称" />
        </a-form-item>
        <a-form-item label="配置值" required>
          <a-input v-model:value="modalForm.value" placeholder="例如：Antdv Next Admin" />
        </a-form-item>
        <a-form-item label="类型">
          <a-select v-model:value="modalForm.type" placeholder="请选择类型">
            <a-select-option value="text">文本</a-select-option>
            <a-select-option value="number">数字</a-select-option>
            <a-select-option value="boolean">布尔值</a-select-option>
            <a-select-option value="json">JSON</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="分组">
          <a-input v-model:value="modalForm.group" placeholder="例如：通用" />
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea v-model:value="modalForm.description" placeholder="请输入描述信息" :rows="3" />
        </a-form-item>
        <a-form-item label="状态">
          <a-switch v-model:checked="modalForm.enabled" />
          <span style="margin-left: 8px">{{ modalForm.enabled ? '启用' : '禁用' }}</span>
        </a-form-item>
      </a-form>
    </BasicModal>

    <BasicDrawer
      @register="registerDrawer"
      :title="`配置详情 - ${currentRecord?.name || ''}`"
      :show-ok-btn="false"
      :width="600"
      @cancel="handleCloseDrawer"
    >
      <template v-if="currentRecord">
        <div :class="detailSectionClassName">
          <a-tag :color="currentRecord.enabled ? 'green' : 'default'" style="margin-bottom: 16px">
            {{ currentRecord.enabled ? '启用' : '禁用' }}
          </a-tag>
        </div>

        <a-descriptions :column="1" bordered size="small">
          <a-descriptions-item label="ID">
            {{ currentRecord.id }}
          </a-descriptions-item>
          <a-descriptions-item label="配置键">
            <a-tag>{{ currentRecord.key }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="配置名">
            {{ currentRecord.name }}
          </a-descriptions-item>
          <a-descriptions-item label="配置值">
            {{ currentRecord.value }}
          </a-descriptions-item>
          <a-descriptions-item label="类型">
            <a-tag :color="typeColorMap[currentRecord.type] || 'default'">
              {{ typeLabelMap[currentRecord.type] || currentRecord.type }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="分组">
            {{ currentRecord.group }}
          </a-descriptions-item>
          <a-descriptions-item label="描述">
            {{ currentRecord.description }}
          </a-descriptions-item>
          <a-descriptions-item label="创建时间">
            {{ currentRecord.createdAt }}
          </a-descriptions-item>
          <a-descriptions-item label="更新时间">
            {{ currentRecord.updatedAt }}
          </a-descriptions-item>
        </a-descriptions>
      </template>
    </BasicDrawer>
  </div>
</template>
