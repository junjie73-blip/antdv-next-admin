<script setup lang="ts">
import type { FormSchema } from '@/components/business/Form'
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'

import { computed, onMounted, ref } from 'vue'
import * as XLSX from 'xlsx'
import {
  addUser,
  deleteUser,
  getDeptTree,
  getUserList,
  getUserOptions,
  updateUser,
} from '@/api/system'
import { BasicForm, useForm } from '@/components/business/Form'
import { BasicModal, useModal } from '@/components/business/Modal'
import { BasicTable, useTable } from '@/components/business/Table'
import { DictType } from '@/enums/dict'
import { useDictStore } from '@/stores'
import { cn } from '@/utils/cn'
import { usePrint } from '@/utils/print'

defineOptions({ name: 'SystemUser' })

interface UserRecord {
  id: number
  username: string
  nickname: string
  email: string
  phone: string
  deptName: string
  deptId: number
  status: number
  role: string
  roleId: number
  remark: string
  createdAt: string
}

interface DeptNode {
  id: number
  name: string
  children?: DeptNode[]
}

const containerClassName = cn('flex gap-4')
const leftPanelClassName = cn('w-[240px] shrink-0')
const rightPanelClassName = cn('flex-1 min-w-0')
const cardClassName = cn('shadow-sm')
const treeCardClassName = cn('shadow-sm h-full')
const statusTagClassName = cn('inline-flex items-center gap-1')
const actionClassName = cn('flex', 'items-center', 'justify-center')
const btnClassName = cn('!px-0.5')
const dividerClassName = cn('mx-0')

const statusColorMap: Record<number, string> = {
  1: 'green',
  0: 'red',
}

const statusLabelMap: Record<number, string> = {
  1: '正常',
  0: '禁用',
}

const dictStore = useDictStore()

const statusOptions = computed(() => dictStore.getOptions(DictType.NORMAL_DISABLE))

// 从 API 获取部门和角色选项
const mockDeptTree = ref<DeptNode[]>([])
const allDeptNodes = ref<{ id: number, name: string }[]>([])
const roleOptions = ref<{ label: string, value: number }[]>([])

onMounted(async () => {
  try {
    const [deptRes, optionRes] = await Promise.all([getDeptTree(), getUserOptions()])
    // 兼容 mock 返回完整响应或已解包的数据
    const deptData = Array.isArray(deptRes) ? deptRes : (deptRes?.data ?? deptRes ?? [])
    const optData = Array.isArray(optionRes) ? optionRes : (optionRes?.data ?? optionRes ?? [])
    mockDeptTree.value = deptData
    // 扁平化部门树用于查找名称
    function flatten(nodes: DeptNode[]): { id: number, name: string }[] {
      const result: { id: number, name: string }[] = []
      for (const node of nodes) {
        result.push({ id: node.id, name: node.name })
        if (node.children)
          result.push(...flatten(node.children))
      }
      return result
    }
    allDeptNodes.value = flatten(mockDeptTree.value)
    roleOptions.value = optData.map((item: any) => ({
      label: item.label,
      value: item.value,
    }))
  }
  catch (e) {
    console.error('获取基础数据失败', e)
  }
})

// ========== 状态管理 ==========
const selectedDeptId = ref<number | null>(null)
const isEditing = ref(false)
const currentRecord = ref<UserRecord | null>(null)
const treeExpandedKeys = ref<number[]>([1])

const [modalRegister, modalMethods] = useModal()
const [tableRegister, tableMethods] = useTable()
const [formRegister, formMethods] = useForm()

// API 适配层 — 将 API 返回的 { list, total } 转换为 BasicTable 需要的 { items, total }
async function mockApi(params: Record<string, any>) {
  // 合并选中的部门ID作为筛选条件
  const requestParams = {
    ...params,
    ...(selectedDeptId.value !== null && { deptId: selectedDeptId.value }),
  }
  const res = await getUserList(requestParams)
  // 兼容 mock 直接返回完整响应或已解包的数据
  const data = res?.data ?? res
  return { items: data?.list || [], total: data?.total || 0 }
}

const searchFormSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    componentProps: {
      placeholder: '搜索用户名/昵称/邮箱/手机号...',
      allowClear: true,
    },
    colProps: { span: 6 },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    componentProps: {
      placeholder: '选择状态',
      allowClear: true,
      options: statusOptions.value,
    },
    colProps: { span: 6 },
  },
]

const modalFormSchemas: FormSchema[] = [
  {
    field: 'username',
    label: '用户名',
    component: 'Input',
    required: true,
    componentProps: { placeholder: '请输入用户名' },
  },
  {
    field: 'nickname',
    label: '昵称',
    component: 'Input',
    required: true,
    componentProps: { placeholder: '请输入昵称' },
  },
  {
    field: 'password',
    label: '密码',
    component: 'InputPassword',
    componentProps: { placeholder: '留空则不修改密码' },
  },
  {
    field: 'phone',
    label: '手机号',
    component: 'Input',
    componentProps: { placeholder: '请输入手机号' },
  },
  {
    field: 'email',
    label: '邮箱',
    component: 'Input',
    componentProps: { placeholder: '请输入邮箱地址' },
  },
  {
    field: 'deptId',
    label: '部门',
    component: 'TreeSelect',
    componentProps: {
      treeData: mockDeptTree,
      fieldNames: { children: 'children', label: 'name', value: 'id' },
      placeholder: '请选择部门',
      treeDefaultExpandAll: true,
    },
  },
  {
    field: 'roleId',
    label: '角色',
    component: 'Select',
    componentProps: {
      options: roleOptions,
      placeholder: '请选择角色',
    },
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
    field: 'status',
    label: '状态',
    component: 'RadioGroup',
    defaultValue: 1,
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
    componentProps: { placeholder: '请输入备注', rows: 3 },
  },
]

function handleDeptSelect(_selectedKeys: (string | number)[], info: { node: { id: number } }) {
  selectedDeptId.value = info.node.id
  tableMethods.value?.reload()
}

function handleAdd() {
  isEditing.value = false
  currentRecord.value = null
  formMethods.setFieldsValue({
    username: '',
    nickname: '',
    password: '',
    email: '',
    phone: '',
    deptId: undefined,
    roleId: undefined,
    status: 0,
    sortOrder: 0,
    remark: '',
  })
  formMethods.clearValidate()
  modalMethods.openModal()
}

function handleDetail(record: UserRecord) {
  message.info(`查看用户详情：${record.nickname}`)
}

function handleEdit(record: UserRecord) {
  isEditing.value = true
  currentRecord.value = record
  formMethods.setFieldsValue({
    username: record.username,
    nickname: record.nickname,
    password: '',
    email: record.email,
    phone: record.phone,
    deptId: record.deptId,
    roleId: record.roleId,
    status: record.status,
    sortOrder: (record as any).sortOrder ?? 0,
    remark: record.remark,
  })
  formMethods.clearValidate()
  modalMethods.openModal()
}

async function handleDelete(record: UserRecord) {
  try {
    await deleteUser(record.id)
    message.success(`已删除用户：${record.nickname}`)
    tableMethods.value?.reload()
  }
  catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

function handleExport() {
  const selectedRows = tableMethods.value?.getSelectRows?.() || []

  if (selectedRows.length === 0) {
    message.warning('请先选择要导出的用户')
    return
  }

  const headers = ['用户名', '昵称', '邮箱', '手机号', '部门', '角色', '状态']
  const rows = selectedRows.map((i: UserRecord) => [
    i.username,
    i.nickname,
    i.email,
    i.phone,
    i.deptName,
    i.role,
    i.status === 1 ? '正常' : '禁用',
  ])

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 24 },
    { wch: 14 },
    { wch: 10 },
    { wch: 12 },
    { wch: 8 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '用户列表')

  XLSX.writeFile(wb, `用户列表_${new Date().toISOString().slice(0, 10)}.xlsx`)
  message.success(`成功导出 ${selectedRows.length} 条数据`)
}

function handlePrint() {
  usePrint({
    title: '用户列表',
    target: '.ant-card-body',
  })
}

async function handleSave() {
  const values = await formMethods.validate()
  if (!values) {
    return
  }

  if (!values.username || !values.nickname) {
    message.warning('请填写用户名和昵称')
    return
  }

  try {
    if (isEditing.value && currentRecord.value) {
      await updateUser(currentRecord.value.id, values)
      message.success(`已更新用户：${values.nickname}`)
    }
    else {
      await addUser(values)
      message.success(`已新增用户：${values.nickname}`)
    }

    modalMethods.closeModal()
    tableMethods.value?.reload()
  }
  catch (e: any) {
    message.error(e?.message || '保存失败')
  }
}

const columns: BasicColumn[] = [
  { title: '#', key: 'index', width: 60, align: 'center', customRender: ({ index }) => index + 1 },
  { title: '用户名', dataIndex: 'username', key: 'username', width: 120, align: 'center' },
  { title: '昵称', dataIndex: 'nickname', key: 'nickname', width: 120, align: 'center' },
  { title: '邮箱', dataIndex: 'email', key: 'email', width: 200, ellipsis: true },
  { title: '手机号', dataIndex: 'phone', key: 'phone', width: 140, align: 'center' },
  { title: '部门', dataIndex: 'deptName', key: 'deptName', width: 100, align: 'center' },
  { title: '角色', dataIndex: 'role', key: 'role', width: 120, align: 'center' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 170, align: 'center' },
]
</script>

<template>
  <div :class="containerClassName">
    <div :class="leftPanelClassName">
      <a-card
        :class="treeCardClassName"
        title="部门列表"
        size="small"
      >
        <a-tree
          :tree-data="mockDeptTree"
          :field-names="{ children: 'children', title: 'name', key: 'id' }"
          :expanded-keys="treeExpandedKeys"
          :default-selected-keys="selectedDeptId !== null ? [selectedDeptId] : []"
          block-node
          @select="handleDeptSelect"
          @update:expandedKeys="(keys: number[]) => { treeExpandedKeys = keys }"
        />
      </a-card>
    </div>

    <div :class="rightPanelClassName">
      <a-card
        title="用户管理"
        :class="cardClassName"
      >
        <BasicTable
          :columns="columns"
          :api="mockApi"
          :immediate="true"
          :use-search-form="true"
          :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
          :action-column="{ width: 240, title: '操作', fixed: 'right' }"
          :row-selection="{ type: 'checkbox' }"
          :pagination="{ showSizeChanger: true,
                         pageSizeOptions: ['10',
                                           '20',
                                           '50'] }"
          :scroll="{ x: 1400 }"
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
              新增用户
            </a-button>
            <a-button @click="handleExport">
              <template #icon>
                <Icon icon="carbon:export" />
              </template>
              导出
            </a-button>
            <a-button @click="handlePrint">
              <template #icon>
                <Icon icon="carbon:printer" />
              </template>
              打印
            </a-button>
          </template>
          <template #cell-status="{ record }">
            <a-tag :color="statusColorMap[record.status] || 'default'">
              <span :class="statusTagClassName">
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
                @click="() => handleDetail(record)"
              >
                <template #icon>
                  <Icon icon="ant-design:eye-outlined" />
                </template>
                详情
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
    </div>

    <BasicModal
      :title="isEditing ? '编辑用户' : '新增用户'"
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
  </div>
</template>
