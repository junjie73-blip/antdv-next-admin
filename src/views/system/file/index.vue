<script setup lang="tsx">
import type { FormSchema } from '@/components/business/Form'
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { deleteFile, getFileList } from '@/api/system'
import { BasicTable, useTable } from '@/components/business/Table'
import { cn } from '@/utils/cn'
import { exportToExcel } from '@/utils/excel'
import { message } from 'antdv-next'
import dayjs from 'dayjs'

defineOptions({ name: 'SystemFile' })

// ========== 类型定义（与后端 sys_file 表对齐） ==========
interface FileRecord {
  fileId: string
  tenantId?: string
  filename: string
  url: string
  size: number
  mimeType?: string
  uploader?: string
  createdAt: string
}

// ========== 样式 ==========
const containerClassName = cn('space-y-4')
const cardClassName = cn(
  'shadow-sm rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900',
)
const actionClassName = cn('flex', 'items-center', 'justify-center', 'whitespace-nowrap')
const btnClassName = cn('!px-0.5')
const dividerClassName = cn('mx-0')

// ========== MIME 类型筛选 ==========
const mimeTypeOptions = [
  { label: '全部', value: '' },
  { label: '图片', value: 'image/' },
  { label: '文档', value: 'application/pdf' },
  { label: 'Word', value: 'application/msword' },
  { label: 'Excel', value: 'application/vnd.ms-excel' },
  { label: '视频', value: 'video/' },
  { label: '音频', value: 'audio/' },
  { label: '压缩包', value: 'application/zip' },
  { label: '文本', value: 'text/' },
]

// ========== 文件大小格式化 ==========
function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1)
  return `${(bytes / k ** i).toFixed(2)} ${units[i]}`
}

// ========== 图标 & 颜色 ==========
function getFileIcon(record: FileRecord): string {
  const mime = record.mimeType || ''
  if (mime.startsWith('image/')) return 'carbon:image'
  if (mime.startsWith('video/')) return 'carbon:video'
  if (mime.startsWith('audio/')) return 'carbon:sound-wave'
  if (mime.startsWith('text/')) return 'carbon:document'
  if (mime.includes('pdf')) return 'carbon:document-pdf'
  if (mime.includes('word') || mime.includes('msword')) return 'carbon:document-word'
  if (mime.includes('excel') || mime.includes('spreadsheet')) return 'carbon:document-excel'
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar'))
    return 'carbon:document-archive'
  return 'carbon:document'
}

function getFileColor(record: FileRecord): string {
  const mime = record.mimeType || ''
  if (mime.startsWith('image/')) return '#1677ff'
  if (mime.startsWith('video/')) return '#eb2f96'
  if (mime.startsWith('audio/')) return '#722ed1'
  if (mime.includes('pdf')) return '#f5222d'
  if (mime.includes('word') || mime.includes('msword')) return '#1890ff'
  if (mime.includes('excel') || mime.includes('spreadsheet')) return '#52c41a'
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar')) return '#8c8c8c'
  return '#8c8c8c'
}

// ========== 搜索表单 ==========
const searchFormSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '文件名',
    component: 'Input',
    colProps: { span: 6 },
    componentProps: {
      placeholder: '搜索文件名...',
      allowClear: true,
    },
  },
  {
    field: 'mimeType',
    label: '文件类型',
    component: 'Select',
    colProps: { span: 6 },
    componentProps: {
      options: mimeTypeOptions,
      placeholder: '选择类型',
      allowClear: true,
    },
  },
]

// ========== 表格实例 ==========
const [tableRegister, tableMethods] = useTable()

// ========== 数据加载 ==========
async function mockApi(params: Record<string, any>) {
  // 只传接口支持的字段
  const query = {
    pageNum: params.pageNum,
    pageSize: params.pageSize,
    keyword: params.keyword,
    mimeType: params.mimeType,
  }
  const res = await getFileList(query)
  const data = res?.data ?? res
  const list = (data?.list || []).map((item: any) => ({
    fileId: item.fileId,
    tenantId: item.tenantId,
    filename: item.filename,
    url: item.url,
    size: item.size,
    mimeType: item.mimeType,
    uploader: item.uploader,
    createdAt: item.createdAt ? dayjs(item.createdAt).format('YYYY-MM-DD HH:mm:ss') : '',
  }))
  return { items: list, total: data?.total || 0 }
}

// ========== 删除 ==========
async function handleDelete(record: FileRecord) {
  try {
    await deleteFile(record.fileId)
    message.success(`已删除：${record.filename}`)
    tableMethods.value?.reload()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

// ========== 下载/预览 ==========
function handleDownload(record: FileRecord) {
  if (!record.url) {
    message.warning('文件地址不存在')
    return
  }
  window.open(record.url, '_blank')
}

function handlePreview(record: FileRecord) {
  if (!record.url) {
    message.warning('文件地址不存在')
    return
  }
  window.open(record.url, '_blank')
}

// ========== 导出 ==========
function handleExport() {
  const rows = (tableMethods.value?.getDataSource?.() || []) as FileRecord[]
  if (rows.length === 0) {
    message.warning('暂无数据可导出')
    return
  }
  exportToExcel({
    filename: '文件列表',
    sheetName: '文件列表',
    columns: [
      { header: '文件ID', key: 'fileId', width: 36 },
      { header: '文件名', key: 'filename', width: 30 },
      { header: '大小', key: 'size', width: 12 },
      { header: 'MIME 类型', key: 'mimeType', width: 24 },
      { header: '上传者', key: 'uploader', width: 36 },
      { header: '文件地址', key: 'url', width: 50 },
      { header: '上传时间', key: 'createdAt', width: 20 },
    ],
    data: rows.map((r) => ({ ...r, size: formatSize(r.size) })),
  })
  message.success('导出成功')
}

// ========== 列定义 ==========
const columns: BasicColumn[] = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    align: 'center',
    customRender: ({ index }) => index + 1,
  },
  { title: '文件名', dataIndex: 'filename', key: 'filename', width: 260, ellipsis: true },
  {
    title: '大小',
    dataIndex: 'size',
    key: 'size',
    width: 110,
    align: 'center',
    customRender: ({ record }: any) => formatSize(record.size),
  },
  { title: 'MIME 类型', dataIndex: 'mimeType', key: 'mimeType', width: 180, ellipsis: true },
  { title: '上传者', dataIndex: 'uploader', key: 'uploader', width: 120, align: 'center' },
  { title: '上传时间', dataIndex: 'createdAt', key: 'createdAt', width: 170, align: 'center' },
]
</script>

<template>
  <div :class="containerClassName">
    <a-card :class="cardClassName" :bordered="false">
      <div class="p-4">
        <BasicTable
          :columns="columns"
          :api="mockApi"
          :immediate="true"
          :use-search-form="true"
          :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
          :action-column="{ width: 180, title: '操作', fixed: 'right' }"
          :pagination="{ showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }"
          :scroll="{ x: 1000 }"
          :row-key="(record) => record.fileId"
          table-layout="fixed"
          @register="tableRegister"
        >
          <template #toolbar>
            <a-button @click="handleExport">
              <template #icon>
                <Icon icon="carbon:export" />
              </template>
              导出
            </a-button>
          </template>

          <!-- 文件名列：图标 + 名称 -->
          <template #cell-filename="{ record }">
            <div class="flex items-center gap-2 min-w-0">
              <Icon
                :icon="getFileIcon(record)"
                :style="{ color: getFileColor(record), fontSize: '16px' }"
                class="shrink-0"
              />
              <span class="truncate" :title="record.filename">{{ record.filename }}</span>
            </div>
          </template>

          <!-- 操作列 -->
          <template #action="{ record }">
            <div :class="actionClassName">
              <a-button type="link" :class="btnClassName" @click="() => handlePreview(record)">
                <template #icon>
                  <Icon icon="ant-design:eye-outlined" />
                </template>
                预览
              </a-button>
              <a-divider type="vertical" :class="dividerClassName" />
              <a-button type="link" :class="btnClassName" @click="() => handleDownload(record)">
                <template #icon>
                  <Icon icon="ant-design:download-outlined" />
                </template>
                下载
              </a-button>
              <a-divider type="vertical" :class="dividerClassName" />
              <a-popconfirm
                :title="`确定要删除「${record.filename}」吗？`"
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
      </div>
    </a-card>
  </div>
</template>
