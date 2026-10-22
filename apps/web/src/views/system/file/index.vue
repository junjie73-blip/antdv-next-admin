<script setup lang="tsx">
import type {
  NormalTreeNode,
  UploadChangeParam,
  UploadFile,
} from '@antdv/common-ui';
import type { FormSchema } from '@antdv/form-ui';
import type { BasicColumn, Recordable } from '@antdv/table-ui';

import { computed, ref, useTemplateRef } from 'vue';

import {
  Alert,
  Card,
  Divider,
  PageHeader,
  Popconfirm,
  Tree,
  UploadDragger,
} from '@antdv/common-ui';
import { BasicForm, useForm } from '@antdv/form-ui';
import { BasicModal, confirm, message, useModal } from '@antdv/popup-ui';
import { Button } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { BasicTable, useTable } from '@antdv/table-ui';
import { Icon } from '@iconify/vue';
import {
  createFolder,
  deleteFile,
  getFileList,
  getFileTree,
  renameFile,
  uploadFile,
} from '~/api/system';

defineOptions({ name: 'SystemFile' });

interface FileRecord {
  id: number;
  name: string;
  type: string;
  extension: string;
  size: number;
  sizeDisplay: string;
  mimeType: string;
  path: string;
  parentId: null | number;
  uploader: string;
  uploaderId: number;
  createdAt: string;
  updatedAt: string;
  isFolder: boolean;
}

// ========== 样式类名 ==========
/* 页头独占一行，下面左树右表（同用户管理：grid + minmax(0,1fr) 才不会被宽表格撑破） */
const containerClassName = cn('grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]');
const headerRowClassName = cn('lg:col-span-2');
const leftPanelClassName = cn('min-w-0');
const rightPanelClassName = cn('min-w-0');
const cardClassName = cn('shadow-sm');
const treeCardClassName = cn('h-full shadow-sm');
const breadcrumbClassName = cn(
  'text-muted-foreground mb-4 flex items-center gap-2 text-sm',
);
const actionClassName = cn(
  'flex',
  'items-center',
  'justify-center',
  'whitespace-nowrap',
);
const btnClassName = cn('h-auto', 'px-0.5!');
const dividerClassName = cn('mx-0');

// ========== 文件类型图标映射 ==========
function getFileIcon(record: Recordable): string {
  if (record.isFolder) return 'carbon:folder';

  const iconMap: Record<string, string> = {
    image: 'carbon:image',
    document: 'carbon:document',
    video: 'carbon:video',
    audio: 'carbon:waveform',
    archive: 'carbon:archive',
  };
  return iconMap[record.type] || 'carbon:document';
}

function getFileColor(record: Recordable): string {
  if (record.isFolder) return '#faad14';

  const colorMap: Record<string, string> = {
    image: '#1677ff',
    document: '#52c41a',
    video: '#eb2f96',
    audio: '#722ed1',
    archive: '#8c8c8c',
  };
  return colorMap[record.type] || '#8c8c8c';
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
];

// ========== 状态管理 ==========
const currentParentId = ref<null | number>(null);
/** 面包屑节点：只用到 common-ui 树节点的 `key`/`title` 两个字段 */
type PathNode = Pick<NormalTreeNode, 'key' | 'title'>;
const currentPath = ref<PathNode[]>([{ title: '根目录', key: '__root__' }]);
const isEditing = ref(false);
const currentRecord = ref<FileRecord | null>(null);
const selectedRowKeys = ref<(number | string)[]>([]);
const selectedRows = ref<FileRecord[]>([]);
const fileTreeData = ref<any[]>([]);

const tableRef = useTemplateRef<InstanceType<typeof BasicTable>>('tableRef');
const [modalRegister, modalMethods] = useModal();
const [uploadModalRegister, uploadModalMethods] = useModal();
const [tableRegister, tableMethods] = useTable();
const [formRegister, formMethods] = useForm();

// 加载文件树
async function loadFileTree() {
  try {
    // 信封/裸数组两种返回都要兼容，http 的泛型声明只给了数组壳
    const res: any = await getFileTree();
    fileTreeData.value = res.data || [];
  } catch (error) {
    console.error('获取文件树失败', error);
  }
}

loadFileTree();

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
];

// ========== 弹窗表单配置 ==========
const folderFormSchemas: FormSchema[] = [
  {
    field: 'name',
    label: '名称',
    component: 'Input',
    required: true,
    componentProps: { placeholder: '请输入文件夹名称' },
  },
];

const renameFormSchemas: FormSchema[] = [
  {
    field: 'name',
    label: '新名称',
    component: 'Input',
    required: true,
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入新的文件/文件夹名称' },
  },
];

// ========== API 适配层 ==========
async function mockApi(params: Record<string, any>) {
  // 兼容 mock 直接返回完整响应或已解包的数据，声明层给不出这两种形状
  const res: any = await getFileList({
    ...params,
    parentId: currentParentId.value,
  });
  const data = res?.data ?? res;
  return { items: data?.list || [], total: data?.total || 0 };
}

// ========== 导航方法 ==========
function handleNavigateToFolder(node: any) {
  currentParentId.value = node.key === '__root__' ? null : node.key;

  // 更新面包屑路径
  if (node.key === '__root__') {
    currentPath.value = [{ title: '根目录', key: '__root__' }];
  } else {
    const pathIndex = currentPath.value.findIndex((p) => p.key === node.key);
    if (pathIndex === -1) {
      currentPath.value.push(node);
    } else {
      currentPath.value = currentPath.value.slice(0, pathIndex + 1);
    }
  }

  tableMethods.value?.reload();
}

/** Tree 的 `@select`：keys 为空表示点掉取消选中，行为与迁移前一致（只跟随选中项导航） */
function handleTreeSelect(keys: (number | string)[]) {
  const node = keys[0];
  if (node !== undefined && node !== null) {
    handleNavigateToFolder({
      key: node,
      title: String(node),
    });
  }
}

// ========== CRUD 操作 ==========
function handleCreateFolder() {
  isEditing.value = false;
  currentRecord.value = null;
  formMethods.setFieldsValue({ name: '' });
  formMethods.clearValidate();
  modalMethods.openModal();
}

function handleRename(record: Recordable) {
  isEditing.value = true;
  currentRecord.value = record as FileRecord;
  formMethods.setFieldsValue({ name: record.name });
  formMethods.clearValidate();
  modalMethods.openModal();
}

async function handleSaveFolderOrRename() {
  const values = await formMethods.validate();
  if (!values) return;

  if (!values.name) {
    message.warning('请填写名称');
    return;
  }

  try {
    if (isEditing.value && currentRecord.value) {
      // 重命名操作
      await renameFile(currentRecord.value.id, values);
      message.success(`已重命名为：${values.name}`);
    } else {
      // 新建文件夹
      await createFolder(values, currentParentId.value ?? undefined);
      message.success(`已创建文件夹：${values.name}`);
    }

    modalMethods.closeModal();
    tableMethods.value?.reload();
    loadFileTree();
  } catch (error: any) {
    message.error(error?.message || '操作失败');
  }
}

function handleUpload() {
  uploadModalMethods.openModal();
}

async function handleSimulateUpload(fileList?: any[]) {
  const filesToUpload = fileList || [];
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
      });
      message.success('文件上传成功（模拟）');
      uploadModalMethods.closeModal();
      tableMethods.value?.reload();
      loadFileTree();
    } catch (error: any) {
      message.error(error?.message || '上传失败');
    }
    return;
  }

  let successCount = 0;
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
      });
      successCount++;
    } catch {
      // 继续处理其他文件
    }
  }

  message.success(`成功上传 ${successCount}/${filesToUpload.length} 个文件`);
  uploadModalMethods.closeModal();
  tableMethods.value?.reload();
  loadFileTree();
}

/** 拖拽区没有真实通道（customRequest 为空实现），选中文件即视为"已上传"走模拟登记 */
function handleUploadChange(info: UploadChangeParam) {
  const list = info.fileList || [];
  if (
    info.file.status === 'done' ||
    list.some((f: UploadFile) => f.originFileObj)
  ) {
    handleSimulateUpload(
      list.map((f: UploadFile) => ({
        name: f.name,
        size: f.size || 0,
        type: f.type || '',
      })),
    );
  }
}

async function handleDelete(record: any | FileRecord) {
  try {
    await deleteFile(record.id);
    message.success(`已删除：${record.name}`);
    tableMethods.value?.reload();
    loadFileTree();
  } catch (error: any) {
    message.error(error?.message || '删除失败');
  }
}

function handleBatchDelete() {
  if (selectedRows.value.length === 0) {
    message.warning('请先选择要删除的文件');
    return;
  }

  confirm({
    title: `确定要删除选中的 ${selectedRows.value.length} 个项目吗？`,
    content: '删除后不可恢复，请谨慎操作。',
    okText: '确认删除',
    cancelText: '取消',
    danger: true,
    async onOk() {
      let successCount = 0;
      for (const row of selectedRows.value) {
        try {
          await deleteFile(row.id);
          successCount++;
        } catch {
          // 继续处理其他文件
        }
      }
      message.success(
        `成功删除 ${successCount}/${selectedRows.value.length} 个项目`,
      );
      tableMethods.value?.reload();
      loadFileTree();
    },
  });
}

function handleDownload(record: Recordable) {
  // Mock 环境下模拟下载
  message.info(`开始下载：${record.name}`);
}

// ========== 表格事件回调 ==========
function handleSelectionChange(keys: (number | string)[], rows: Recordable[]) {
  selectedRowKeys.value = keys;
  selectedRows.value = rows as unknown as FileRecord[];
}

// ========== 计算属性 ==========
const currentStats = computed(() => {
  const rows = (tableMethods.value?.getDataSource?.() || []) as FileRecord[];
  const folders = rows.filter((r) => r.isFolder).length;
  const files = rows.length - folders;
  const totalSize = rows
    .filter((r) => !r.isFolder)
    .reduce((sum, r) => sum + r.size, 0);

  function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / k ** i).toFixed(1)} ${units[i]}`;
  }

  return {
    folders,
    files,
    totalSize: formatSize(totalSize),
    totalCount: rows.length,
  };
});

// ========== 表格列配置 ==========
const columns: BasicColumn[] = [
  {
    title: '#',
    key: 'index',
    width: 60,
    align: 'center',
    customRender: ({ index }) => index + 1,
  },
  { title: '名称', dataIndex: 'name', key: 'name', width: 260 },
  {
    title: '大小',
    dataIndex: 'sizeDisplay',
    key: 'sizeDisplay',
    width: 90,
    align: 'center',
  },
  { title: '类型', dataIndex: 'type', key: 'type', width: 80, align: 'center' },
  { title: '修改时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 170 },
  {
    title: '上传者',
    dataIndex: 'uploader',
    key: 'uploader',
    width: 100,
    align: 'center',
  },
];
</script>

<template>
  <div data-page-view :class="containerClassName">
    <PageHeader
      :class="headerRowClassName"
      title="文件管理"
      description="管理上传的文件与目录，支持分片上传与在线预览"
      icon="carbon:folder"
    >
      <template #extra>
        <Button variant="outline" @click="handleCreateFolder">
          <Icon icon="ant-design:folder-add-outlined" />
          新建文件夹
        </Button>
        <Button @click="handleUpload">
          <Icon icon="ant-design:cloud-upload-outlined" />
          上传文件
        </Button>
      </template>
    </PageHeader>

    <!-- 左侧文件树 -->
    <div :class="leftPanelClassName">
      <Card :class="treeCardClassName" title="文件结构">
        <Tree
          :tree-data="fileTreeData"
          default-expand-all
          block-node
          @select="handleTreeSelect"
        />
      </Card>
    </div>

    <!-- 右侧内容区 -->
    <div :class="rightPanelClassName">
      <Card title="文件列表" :class="cardClassName">
        <!-- 批量删除作用于列表勾选，留在这一栏而不是页头 -->
        <template #extra>
          <Button variant="destructive" @click="handleBatchDelete">
            <Icon icon="ant-design:delete-outlined" />
            批量删除 (
            {{ selectedRowKeys.length }}
            )
          </Button>
        </template>
        <!-- 面包屑导航 -->
        <div :class="breadcrumbClassName">
          <span>当前位置：</span>
          <template v-for="(item, index) in currentPath" :key="item.key">
            <a
              class="cursor-pointer transition-colors hover:text-primary"
              @click="handleNavigateToFolder(item)"
              >{{ item.title }}</a>
            <span v-if="index < currentPath.length - 1" class="mx-1">/</span>
          </template>
        </div>

        <!-- 统计信息 -->
        <div
          class="mb-4 flex items-center gap-4 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground"
        >
          <span>
            共
            {{ currentStats.totalCount }}
            项
          </span>
          <span>|</span>
          <span>
            文件夹：
            <span class="font-medium text-warning">{{
              currentStats.folders
            }}</span>
          </span>
          <span>|</span>
          <span>
            文件：
            <span class="font-medium text-primary">{{
              currentStats.files
            }}</span>
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
          :pagination="{
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100'],
          }"
          :action-column="{ width: 280, title: '操作', fixed: 'right' }"
          @register="tableRegister"
        >
          <template #cell-name="{ record }">
            <div class="flex min-w-0 items-center gap-2">
              <Icon
                :icon="getFileIcon(record)"
                :style="{
                  color: getFileColor(record),
                  fontSize: record.isFolder ? '18px' : '16px',
                }"
                class="shrink-0"
              />
              <span
                class="cursor-pointer truncate transition-colors hover:text-primary"
                :title="record.name"
                >{{ record.name }}</span>
            </div>
          </template>

          <template #action="{ record }">
            <div :class="actionClassName">
              <Button
                v-if="!record.isFolder"
                variant="link"
                :class="btnClassName"
                @click="() => handleDownload(record)"
              >
                <Icon icon="ant-design:download-outlined" />
                下载
              </Button>
              <Button
                variant="link"
                :class="btnClassName"
                @click="() => handleRename(record)"
              >
                <Icon icon="ant-design:edit-outlined" />
                重命名
              </Button>
              <Divider type="vertical" :class="dividerClassName" />
              <Popconfirm
                :title="`确定要删除「${record.name}」吗？${record.isFolder ? '文件夹内的所有内容也将被删除。' : ''}`"
                @confirm="() => handleDelete(record)"
              >
                <Button
                  variant="link"
                  class="text-destructive hover:text-destructive"
                  :class="btnClassName"
                >
                  <Icon icon="ant-design:delete-outlined" />
                  删除
                </Button>
              </Popconfirm>
            </div>
          </template>
        </BasicTable>
      </Card>
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
        <Alert
          message="选择要上传的文件，支持多文件同时上传"
          type="info"
          show-icon
        />

        <UploadDragger
          multiple
          accept="*/*"
          :max-count="10"
          :show-upload-list="true"
          :custom-request="() => {}"
          @change="handleUploadChange"
        >
          <p class="mb-2 text-2xl">
            <Icon
              icon="carbon:cloud-upload"
              style="font-size: 48px; color: #1677ff"
            />
          </p>
          <p class="text-sm">点击或拖拽文件到此区域上传</p>
          <p class="text-muted-foreground mt-1 text-xs">
            支持单个或批量上传，最大支持 10 个文件，单个文件不超过 100MB
          </p>
        </UploadDragger>

        <div class="border-border border-t pt-3">
          <Button class="w-full" @click="handleSimulateUpload()">
            模拟上传（测试用）
          </Button>
        </div>
      </div>
    </BasicModal>
  </div>
</template>
