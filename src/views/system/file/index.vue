<script setup lang="tsx">
import type { TreeData } from 'antdv-next/es/tree'
import type { FormSchema } from '@/components/business/Form'
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'
import { Modal as AntModal } from 'antdv-next'
import { computed, ref, useTemplateRef } from 'vue'
import {
  createFolder,
  deleteFile,
  getFileList,
  getFileTree,
  renameFile,
  uploadFile,
} from '@/api/system'
import { BasicForm, useForm } from '@/components/business/Form'
import { BasicModal, useModal } from '@/components/business/Modal'
import { BasicTable, useTable } from '@/components/business/Table'
import { cn } from '@/utils/cn'

defineOptions({ name: 'SystemFile' })

interface FileRecord {
  id: number
  name: string
  type: string
  extension: string
  size: number
  sizeDisplay: string
  mimeType: string
  path: string
  parentId: number | null
  uploader: string
  uploaderId: number
  createdAt: string
  updatedAt: string
  isFolder: boolean
}

// ========== 样式类名 ==========
const containerClassName = cn('flex gap-4')
const leftPanelClassName = cn('w-[240px] shrink-0')
const rightPanelClassName = cn('flex-1 min-w-0')
const cardClassName = cn('shadow-sm')
const treeCardClassName = cn('shadow-sm h-full')
const breadcrumbClassName = cn('flex items-center gap-2 text-sm mb-4 text-gray-500 dark:text-gray-400')
const actionClassName = cn('flex', 'items-center', 'justify-center', 'whitespace-nowrap')
const btnClassName = cn('!px-0.5')
const dividerClassName = cn('mx-0')

// ========== 文件类型图标映射 ==========
function getFileIcon(record: FileRecord): string {
  if (record.isFolder)
    return 'carbon:folder'

  const iconMap: Record<string, string> = {
    image: 'carbon:image',
    document: 'carbon:document',
    video: 'carbon:video',
    audio: 'carbon:sound-wave',
    archive: 'carbon:document-archive',
  }
  return iconMap[record.type] || 'carbon:document'
}

function getFileColor(record: FileRecord): string {
  if (record.isFolder)
    return '#faad14'

  const colorMap: Record<string, string> = {
    image: '#1677ff',
    document: '#52c41a',
    video: '#eb2f96',
    audio: '#722ed1',
    archive: '#8c8c8c',
  }
  return colorMap[record.type] || '#8c8c8c'
}

// ========== 文件类型筛选选项 ==========
const fileTypeOptions = [
  { label: '全部文件', value: '' },
  { label: '文件夹', value: 'folder' },
  { label: '图片', value: 'image' },
  { label: '文档', value: 'document' },
  { label: '视频', value: 'video' },
  { label: '音频', value: 'audio' },
  { label: '压缩包', value: 'archive' },
]

// ========== 状态管理 ==========
const currentParentId = ref<number | null>(null)
const currentPath = ref<TreeData[]>([{ title: '根目录', key: '__root__' }])
const isEditing = ref(false)
const currentRecord = ref<FileRecord | null>(null)
const selectedRowKeys = ref<(string | number)[]>([])
const selectedRows = ref<FileRecord[]>([])
const fileTreeData = ref<any[]>([])

const tableRef = useTemplateRef<InstanceType<typeof BasicTable>>('tableRef')
const [modalRegister, modalMethods] = useModal()
const [uploadModalRegister, uploadModalMethods] = useModal()
const [tableRegister, tableMethods] = useTable()
const [formRegister, formMethods] = useForm()

// 加载文件树
async function loadFileTree() {
  try {
    const res = await getFileTree()
    fileTreeData.value = res.data || []
  }
  catch (e) {
    console.error('获取文件树失败', e)
  }
}

loadFileTree()

// ========== 搜索表单配置 ==========
const searchFormSchemas: FormSchema[] = [
  {
    field: 'name',
    label: '文件名',
    component: 'Input',
    colProps: { span: 6 },
    componentProps: {
      placeholder: '搜索文件名...',
      allowClear: true,
    },
  },
  {
    field: 'type',
    label: '文件类型',
    component: 'Select',
    colProps: { span: 6 },
    componentProps: {
      options: fileTypeOptions,
      placeholder: '选择类型',
      allowClear: true,
    },
  },
]

// ========== 弹窗表单配置 ==========
const folderFormSchemas: FormSchema[] = [
  {
    field: 'name',
    label: '名称',
    component: 'Input',
    required: true,
    componentProps: { placeholder: '请输入文件夹名称' },
  },
]

const renameFormSchemas: FormSchema[] = [
  {
    field: 'name',
    label: '新名称',
    component: 'Input',
    required: true,
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入新的文件/文件夹名称' },
  },
]

// ========== API 适配层 ==========
async function mockApi(params: Record<string, any>) {
  const res = await getFileList({ ...params, parentId: currentParentId.value })
  // 兼容 mock 直接返回完整响应或已解包的数据
  const data = res?.data ?? res
  return { items: data?.list || [], total: data?.total || 0 }
}

// ========== 导航方法 ==========
function handleNavigateToFolder(node: any) {
  currentParentId.value = node.key === '__root__' ? null : node.key

  // 更新面包屑路径
  if (node.key === '__root__') {
    currentPath.value = [{ title: '根目录', key: '__root__' }]
  }
  else {
    const pathIndex = currentPath.value.findIndex(p => p.key === node.key)
    if (pathIndex > -1) {
      currentPath.value = currentPath.value.slice(0, pathIndex + 1)
    }
    else {
      currentPath.value.push(node)
    }
  }

  tableMethods.value?.reload()
}

// ========== CRUD 操作 ==========
function handleCreateFolder() {
  isEditing.value = false
  currentRecord.value = null
  formMethods.setFieldsValue({ name: '' })
  formMethods.clearValidate()
  modalMethods.openModal()
}

function handleRename(record: FileRecord) {
  isEditing.value = true
  currentRecord.value = record
  formMethods.setFieldsValue({ name: record.name })
  formMethods.clearValidate()
  modalMethods.openModal()
}

async function handleSaveFolderOrRename() {
  const values = await formMethods.validate()
  if (!values)
    return

  if (!values.name) {
    message.warning('请填写名称')
    return
  }

  try {
    if (isEditing.value && currentRecord.value) {
      // 重命名操作
      await renameFile(currentRecord.value.id, values)
      message.success(`已重命名为：${values.name}`)
    }
    else {
      // 新建文件夹
      await createFolder(values, currentParentId.value ?? undefined)
      message.success(`已创建文件夹：${values.name}`)
    }

    modalMethods.closeModal()
    tableMethods.value?.reload()
    loadFileTree()
  }
  catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

function handleUpload() {
  uploadModalMethods.openModal()
}

async function handleSimulateUpload(fileList?: any[]) {
  const filesToUpload = fileList || []
  if (filesToUpload.length === 0) {
    // 模拟上传一个随机文件
    try {
      await uploadFile({
        name: `uploaded_file_${Date.now()}.txt`,
        type: 'other',
        extension: 'txt',
        size: 1024,
        mimeType: 'text/plain',
        path: '/',
        parentId: currentParentId.value,
      })
      message.success('文件上传成功（模拟）')
      uploadModalMethods.closeModal()
      tableMethods.value?.reload()
      loadFileTree()
    }
    catch (e: any) {
      message.error(e?.message || '上传失败')
    }
    return
  }

  let successCount = 0
  for (const file of filesToUpload) {
    try {
      await uploadFile({
        name: file.name || 'unknown',
        type: file.type || 'other',
        extension: file.name?.split('.').pop() || '',
        size: file.size || 0,
        mimeType: file.type || 'application/octet-stream',
        path: '/',
        parentId: currentParentId.value,
      })
      successCount++
    }
    catch {
      // 继续处理其他文件
    }
  }

  message.success(`成功上传 ${successCount}/${filesToUpload.length} 个文件`)
  uploadModalMethods.closeModal()
  tableMethods.value?.reload()
  loadFileTree()
}

async function handleDelete(record: FileRecord | any) {
  try {
    await deleteFile(record.id)
    message.success(`已删除：${record.name}`)
    tableMethods.value?.reload()
    loadFileTree()
  }
  catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

function handleBatchDelete() {
  if (selectedRows.value.length === 0) {
    message.warning('请先选择要删除的文件')
    return
  }

  AntModal.confirm({
    title: `确定要删除选中的 ${selectedRows.value.length} 个项目吗？`,
    content: '删除后不可恢复，请谨慎操作。',
    okText: '确认删除',
    cancelText: '取消',
    okType: 'danger',
    async onOk() {
      let successCount = 0
      for (const row of selectedRows.value) {
        try {
          await deleteFile(row.id)
          successCount++
        }
        catch {
          // 继续处理其他文件
        }
      }
      message.success(`成功删除 ${successCount}/${selectedRows.value.length} 个项目`)
      tableMethods.value?.reload()
      loadFileTree()
    },
  })
}

function handleDownload(record: FileRecord) {
  // Mock 环境下模拟下载
  message.info(`开始下载：${record.name}`)
}

// ========== 表格事件回调 ==========
function handleSelectionChange(keys: (string | number)[], rows: FileRecord[]) {
  selectedRowKeys.value = keys
  selectedRows.value = rows
}

// ========== 计算属性 ==========
const currentStats = computed(() => {
  const rows = (tableMethods.value?.getDataSource?.() || []) as FileRecord[]
  const folders = rows.filter(r => r.isFolder).length
  const files = rows.length - folders
  const totalSize = rows.filter(r => !r.isFolder).reduce((sum, r) => sum + r.size, 0)

  function formatSize(bytes: number): string {
    if (bytes === 0)
      return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    const k = 1024
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / k ** i).toFixed(1)} ${units[i]}`
  }

  return { folders, files, totalSize: formatSize(totalSize), totalCount: rows.length }
})

// ========== 表格列配置 ==========
const columns: BasicColumn[] = [
  { title: '#', key: 'index', width: 60, align: 'center', customRender: ({ index }) => index + 1 },
  { title: '名称', dataIndex: 'name', key: 'name', width: 260 },
  { title: '大小', dataIndex: 'sizeDisplay', key: 'sizeDisplay', width: 90, align: 'center' },
  { title: '类型', dataIndex: 'type', key: 'type', width: 80, align: 'center' },
  { title: '修改时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 170 },
  { title: '上传者', dataIndex: 'uploader', key: 'uploader', width: 100, align: 'center' },
]
</script>

<template>
  <div :class="containerClassName">
    <!-- 左侧文件树 -->
    <div :class="leftPanelClassName">
      <a-card
        :class="treeCardClassName"
        title="文件结构"
        size="small"
      >
        <a-tree
          :tree-data="fileTreeData"
          default-expand-all
          block-node
          @select="(keys: (string|number)[]) => {
            const node = keys[0]
            if (node !== undefined && node !== null) {
              handleNavigateToFolder({
                key: node,
                title: String(node),
              })
            }
          }"
        />
      </a-card>
    </div>

    <!-- 右侧内容区 -->
    <div :class="rightPanelClassName">
      <a-card
        title="文件列表"
        :class="cardClassName"
      >
        <!-- 面包屑导航 -->
        <div :class="breadcrumbClassName">
          <span>当前位置：</span>
          <template
            v-for="(item, index) in currentPath"
            :key="item.key"
          >
            <a
              class="hover:text-blue-500 cursor-pointer transition-colors"
              @click="handleNavigateToFolder(item)"
            >{{ item.title }}</a>
            <span
              v-if="index < currentPath.length - 1"
              class="mx-1"
            >/</span>
          </template>
        </div>

        <!-- 统计信息 -->
        <div class="flex items-center gap-4 mb-4 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg">
          <span>
            共
            {{ currentStats.totalCount }}
            项
          </span>
          <span>|</span>
          <span>
            文件夹：
            <span class="font-medium text-orange-500">{{ currentStats.folders }}</span>
          </span>
          <span>|</span>
          <span>
            文件：
            <span class="font-medium text-blue-500">{{ currentStats.files }}</span>
          </span>
          <span>|</span>
          <span>
            总大小：
            <span class="font-medium">{{ currentStats.totalSize }}</span>
          </span>
        </div>

        <BasicTable
          ref="tableRef"
          :columns="columns"
          :api="mockApi"
          :immediate="true"
          :use-search-form="true"
          :form-config="{ schemas: searchFormSchemas, labelWidth: 70 }"
          :row-selection="{ type: 'checkbox', onChange: handleSelectionChange }"
          :pagination="{ showSizeChanger: true,
                         pageSizeOptions: ['20',
                                           '50',
                                           '100'] }"
          :action-column="{ width: 280, title: '操作', fixed: 'right' }"
          @register="tableRegister"
        >
          <template #toolbar>
            <a-button @click="handleCreateFolder">
              <template #icon>
                <Icon icon="ant-design:folder-add-outlined" />
              </template>
              新建文件夹
            </a-button>
            <a-button
              type="primary"
              @click="handleUpload"
            >
              <template #icon>
                <Icon icon="ant-design:cloud-upload-outlined" />
              </template>
              上传文件
            </a-button>
            <a-button
              danger
              @click="handleBatchDelete"
            >
              <template #icon>
                <Icon icon="ant-design:delete-outlined" />
              </template>
              批量删除 (
              {{ selectedRowKeys.length }}
              )
            </a-button>
          </template>

          <template #cell-name="{ record }">
            <div class="flex items-center gap-2 min-w-0">
              <Icon
                :icon="getFileIcon(record)"
                :style="{ color: getFileColor(record), fontSize: record.isFolder ? '18px' : '16px' }"
                class="shrink-0"
              />
              <span
                class="truncate cursor-pointer hover:text-blue-500 transition-colors"
                :title="record.name"
              >{{ record.name }}</span>
            </div>
          </template>

          <template #action="{ record }">
            <div :class="actionClassName">
              <a-button
                v-if="!record.isFolder"
                type="link"
                :class="btnClassName"
                @click="() => handleDownload(record)"
              >
                <template #icon>
                  <Icon icon="ant-design:download-outlined" />
                </template>
                下载
              </a-button>
              <a-button
                type="link"
                :class="btnClassName"
                @click="() => handleRename(record)"
              >
                <template #icon>
                  <Icon icon="ant-design:edit-outlined" />
                </template>
                重命名
              </a-button>
              <a-divider
                type="vertical"
                :class="dividerClassName"
              />
              <a-popconfirm
                :title="`确定要删除「${record.name}」吗？${record.isFolder ? '文件夹内的所有内容也将被删除。' : ''}`"
                @confirm="() => handleDelete(record)"
              >
                <a-button
                  type="link"
                  danger
                  :class="btnClassName"
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
    </div>

    <!-- 新建文件夹 / 重命名弹窗 -->
    <BasicModal
      :title="isEditing ? '重命名' : '新建文件夹'"
      :width="420"
      @register="modalRegister"
      @ok="handleSaveFolderOrRename"
    >
      <BasicForm
        :schemas="isEditing ? renameFormSchemas : folderFormSchemas"
        :label-width="60"
        :show-action-button-group="false"
        :grid="{ cols: 1, gutter: 16 }"
        @register="formRegister"
      />
    </BasicModal>

    <!-- 上传弹窗 -->
    <BasicModal
      title="上传文件"
      :width="520"
      :show-footer="false"
      @register="uploadModalRegister"
    >
      <div class="space-y-4">
        <a-alert
          message="选择要上传的文件，支持多文件同时上传"
          type="info"
          show-icon
        />

        <a-upload-dragger
          name="file"
          multiple
          accept="*/*"
          :max-count="10"
          :show-upload-list="true"
          :custom-request="() => {}"
          @change="(info: any) => {
            if (info.file.status === 'done' || info.fileList.some((f: any) => f.originFileObj)) {
              handleSimulateUpload(info.fileList.map((f: any) => ({
                name: f.name,
                size: f.size || 0,
                type: f.type || '',
              })))
            }
          }"
        >
          <p class="ant-upload-drag-icon">
            <Icon
              icon="carbon:cloud-upload"
              style="font-size: 48px; color: #1677ff"
            />
          </p>
          <p class="ant-upload-text">
            点击或拖拽文件到此区域上传
          </p>
          <p class="ant-upload-hint">
            支持单个或批量上传，最大支持 10 个文件，单个文件不超过 100MB
          </p>
        </a-upload-dragger>

        <div class="pt-3 border-t border-gray-200 dark:border-gray-700">
          <a-button
            type="primary"
            block
            @click="handleSimulateUpload()"
          >
            模拟上传（测试用）
          </a-button>
        </div>
      </div>
    </BasicModal>
  </div>
</template>
