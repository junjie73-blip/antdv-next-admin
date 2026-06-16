<script setup lang="ts">
import type { FormSchema } from '@/components/business/Form'
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'

import { computed, ref } from 'vue'
import {
  addRole,
  deleteRole,
  getRoleList,
  updateRole,
} from '@/api/system'
import { BasicDrawer, useDrawer } from '@/components/business/Drawer'
import { BasicForm, useForm } from '@/components/business/Form'
import { BasicTable, useTable } from '@/components/business/Table'
import { DictType } from '@/enums/dict'
import { useDictStore } from '@/stores'
import { cn } from '@/utils/cn'
import { exportToExcel } from '@/utils/excel'

defineOptions({ name: 'SystemRole' })

interface RoleRecord {
  id: number
  name: string
  code: string
  description: string
  sort: number
  status: number
  menuIds: number[]
  createdAt: string
}

const containerClassName = cn('space-y-4')
const cardClassName = cn('shadow-sm')
const tagClassName = cn('inline-flex items-center gap-1')
const actionClassName = cn('flex', 'items-center', 'justify-center', 'whitespace-nowrap')
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

// 动态菜单权限树 — 从菜单配置生成
interface MenuTreeNode {
  title: string
  key: string
  children?: MenuTreeNode[]
}

const menuSourceData = [
  {
    id: 1,
    title: '数据看板',
    path: '/dashboard',
    children: [
      { id: 101, title: '实时监控大屏', path: 'monitor' },
      { id: 102, title: '分析面板', path: 'analysis' },
    ],
  },
  {
    id: 3,
    title: '系统设置',
    path: '/system',
    children: [
      { id: 301, title: '配置管理', path: 'config' },
      { id: 302, title: '用户管理', path: 'user' },
      { id: 303, title: '角色管理', path: 'role' },
      { id: 304, title: '字典管理', path: 'dict' },
      { id: 305, title: '菜单管理', path: 'menu' },
      { id: 306, title: '操作日志', path: 'log' },
      { id: 307, title: '在线用户', path: 'online' },
      { id: 308, title: '消息通知', path: 'notice' },
    ],
  },
  {
    id: 4,
    title: '组件演示',
    path: '/components',
    children: [
      { id: 401, title: '表单组件', path: 'form' },
      { id: 402, title: '表格组件', path: 'table' },
      { id: 403, title: '描述列表', path: 'description' },
      { id: 404, title: '弹窗抽屉', path: 'modal-drawer' },
    ],
  },
]

function buildMenuTree(menus: typeof menuSourceData): MenuTreeNode[] {
  return menus.map(menu => ({
    title: menu.title,
    key: String(menu.id),
    children: menu.children?.map(child => ({
      title: child.title,
      key: String(child.id),
    })),
  }))
}

const permissionTreeData = computed(() => buildMenuTree(menuSourceData))

const isEditing = ref(false)
const currentRecord = ref<RoleRecord | null>(null)

const [drawerRegister, drawerMethods] = useDrawer()
const [permDrawerRegister, permDrawerMethods] = useDrawer()
const [tableRegister, tableMethods] = useTable()
const [formRegister, formMethods] = useForm()

const searchFormSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    colProps: { span: 6 },
    componentProps: {
      placeholder: '搜索角色名称/编码...',
      allowClear: true,
    },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    colProps: { span: 6 },
    componentProps: {
      placeholder: '选择状态',
      allowClear: true,
      options: statusOptions.value,
    },
  },
]

const drawerFormSchemas: FormSchema[] = [
  {
    field: 'name',
    label: '角色名称',
    component: 'Input',
    required: true,
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入角色名称' },
  },
  {
    field: 'code',
    label: '角色编码',
    component: 'Input',
    required: true,
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入角色编码，如 admin' },
  },
  {
    field: 'sort',
    label: '排序',
    component: 'InputNumber',
    colProps: { span: 12 },
    defaultValue: 0,
    componentProps: { min: 0, placeholder: '数字越小越靠前', style: { width: '100%' } },
  },
  {
    field: 'status',
    label: '状态',
    component: 'RadioGroup',
    colProps: { span: 12 },
    defaultValue: 0,
    componentProps: () => ({
      optionType: 'button',
      buttonStyle: 'solid',
      options: statusOptions.value,
    }),
  },
  {
    field: 'description',
    label: '描述',
    component: 'InputTextArea',
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入角色描述...', rows: 3 },
  },
]

// API 适配层
async function mockApi(params: Record<string, any>) {
  try {
    const res = await getRoleList(params)
    console.log('[Role] raw response:', res)
    // 兼容 mock 直接返回完整响应或已解包的数据
    const data = res?.data ?? res
    console.log('[Role] parsed data:', data)
    const result = { items: data?.list || [], total: data?.total || 0 }
    console.log('[Role] result:', result)
    return result
  }
  catch (e) {
    console.error('[Role] mockApi error:', e)
    return { items: [], total: 0 }
  }
}

function handleAdd() {
  isEditing.value = false
  currentRecord.value = null
  formMethods.setFieldsValue({
    name: '',
    code: '',
    description: '',
    sort: 0,
    status: 0,
  })
  formMethods.clearValidate()
  drawerMethods.openDrawer()
}

function handleEdit(record: RoleRecord) {
  isEditing.value = true
  currentRecord.value = record
  formMethods.setFieldsValue({
    name: record.name,
    code: record.code,
    description: record.description,
    sort: record.sort,
    status: record.status,
  })
  formMethods.clearValidate()
  drawerMethods.openDrawer()
}

function handlePermission(record: RoleRecord) {
  currentRecord.value = record
  permDrawerMethods.openDrawer()
}

async function handleDelete(record: RoleRecord) {
  if (record.code === 'super_admin') {
    message.warning('超级管理员角色不允许删除')
    return
  }
  try {
    await deleteRole(record.id)
    message.success(`已删除角色：${record.name}`)
    tableMethods.value?.reload()
  }
  catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

async function handleToggleStatus(record: RoleRecord) {
  try {
    await updateRole(record.id, { status: record.status === 1 ? 0 : 1 })
    message.success(`已${record.status === 1 ? '停用' : '启用'}：${record.name}`)
    tableMethods.value?.reload()
  }
  catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

function handleExport() {
  const selectedRows = (tableMethods.value?.getSelectRows?.() || []) as any[]
  const dataToExport = selectedRows.length > 0 ? selectedRows : []
  exportToExcel({
    filename: '角色列表',
    sheetName: '角色管理',
    columns: [
      { header: 'ID', key: 'id', width: 8 },
      { header: '角色名称', key: 'name', width: 15 },
      { header: '角色编码', key: 'code', width: 18 },
      { header: '描述', key: 'description', width: 30 },
      { header: '排序', key: 'sort', width: 8 },
      { header: '状态', key: 'status', width: 8 },
      { header: '创建时间', key: 'createdAt', width: 20 },
    ],
    data: dataToExport.map(i => ({ ...i, status: i.status === 1 ? '正常' : '停用' })),
  })
}

async function handleSave() {
  const values = await formMethods.validate()
  if (!values)
    return

  if (!values.name || !values.code) {
    message.warning('请填写角色名称和编码')
    return
  }

  try {
    if (isEditing.value && currentRecord.value) {
      await updateRole(currentRecord.value.id, values)
      message.success(`已更新角色：${values.name}`)
    }
    else {
      await addRole(values)
      message.success(`已新增角色：${values.name}`)
    }

    drawerMethods.closeDrawer()
    tableMethods.value?.reload()
  }
  catch (e: any) {
    message.error(e?.message || '保存失败')
  }
}

const columns: BasicColumn[] = [
  { title: '#', key: 'index', width: 60, align: 'center', customRender: ({ index }) => index + 1 },
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70, align: 'center' },
  { title: '角色名称', dataIndex: 'name', key: 'name', width: 140 },
  { title: '角色编码', dataIndex: 'code', key: 'code', width: 150 },
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '排序', dataIndex: 'sort', key: 'sort', width: 70, align: 'center' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 170 },
]
</script>

<template>
  <div :class="containerClassName">
    <a-card
      title="角色管理"
      :class="cardClassName"
    >
      <BasicTable
        :columns="columns"
        :api="mockApi"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
        :pagination="{ showSizeChanger: true,
                       pageSizeOptions: ['10',
                                         '20',
                                         '50'] }"
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
            新增角色
          </a-button>
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
              @click="() => handlePermission(record)"
            >
              <template #icon>
                <Icon icon="ant-design:safety-certificate-outlined" />
              </template>
              权限
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
            <a-popconfirm
              :title="`确定要「${record.status === 1 ? '停用' : '启用'}」角色「${record.name}」吗？`"
              @confirm="() => handleToggleStatus(record)"
            >
              <a-button
                v-if="record.status === 1"
                type="link"
                :class="btnClassName"
              >
                停用
              </a-button>
              <a-button
                v-else
                type="link"
                :class="btnClassName"
              >
                启用
              </a-button>
            </a-popconfirm>
            <a-divider
              type="vertical"
              :class="dividerClassName"
            />
            <a-popconfirm
              :title="`确定要删除角色「${record.name}」吗？`"
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

    <!-- 新增/编辑抽屉 -->
    <BasicDrawer
      :title="isEditing ? '编辑角色' : '新增角色'"
      :width="520"
      @register="drawerRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="drawerFormSchemas"
        :label-width="80"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="formRegister"
      />
    </BasicDrawer>

    <!-- 权限分配抽屉 -->
    <BasicDrawer
      :title="`权限分配 - ${currentRecord?.name || ''}`"
      :width="480"
      @register="permDrawerRegister"
    >
      <div class="space-y-4">
        <a-alert
          message="选择该角色可以访问的菜单和按钮权限"
          type="info"
          show-icon
        />
        <div class="text-sm text-gray-500 dark:text-gray-400">
          角色编码：<a-tag color="blue">
            {{ currentRecord?.code }}
          </a-tag>
        </div>
        <div class="text-sm text-gray-500 dark:text-gray-400">
          角色描述：<span class="text-gray-700 dark:text-gray-300">{{ currentRecord?.description }}</span>
        </div>

        <a-tree
          checkable
          default-expand-all
          :tree-data="permissionTreeData"
          :checked-keys="currentRecord?.menuIds || []"
          @check="(checkedKeys: any) => {
            if (currentRecord) {
              currentRecord.menuIds = checkedKeys
            }
          }"
        />
      </div>
    </BasicDrawer>
  </div>
</template>
