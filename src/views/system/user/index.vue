<script setup lang="ts">
import type { FormSchema } from '@/components/business/Form'
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { ref } from 'vue'
import * as XLSX from 'xlsx'
import { BasicForm, useForm } from '@/components/business/Form'
import { BasicModal, useModal } from '@/components/business/Modal'
import { BasicTable, useTable } from '@/components/business/Table'
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
const actionClassName = cn('flex', 'items-center')
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

const mockDeptTree: DeptNode[] = [
  {
    id: 1,
    name: '总公司',
    children: [
      { id: 2, name: '技术部' },
      { id: 3, name: '产品部' },
      { id: 4, name: '市场部' },
      { id: 5, name: '运营部' },
    ],
  },
]

const allDeptNodes: { id: number, name: string }[] = [
  { id: 1, name: '总公司' },
  { id: 2, name: '技术部' },
  { id: 3, name: '产品部' },
  { id: 4, name: '市场部' },
  { id: 5, name: '运营部' },
]

const roleOptions = [
  { label: '超级管理员', value: 1 },
  { label: '管理员', value: 2 },
  { label: '普通用户', value: 3 },
  { label: '运维人员', value: 4 },
]

const mockData: UserRecord[] = [
  { id: 1, username: 'admin', nickname: '超级管理员', email: 'admin@example.com', phone: '13800000001', deptName: '总公司', deptId: 1, status: 1, role: '超级管理员', roleId: 1, remark: '系统内置管理员', createdAt: '2024-01-01 10:00:00' },
  { id: 2, username: 'zhangsan', nickname: '张三', email: 'zhangsan@example.com', phone: '13800000002', deptName: '技术部', deptId: 2, status: 1, role: '管理员', roleId: 2, remark: '', createdAt: '2024-01-15 10:00:00' },
  { id: 3, username: 'lisi', nickname: '李四', email: 'lisi@example.com', phone: '13800000003', deptName: '技术部', deptId: 2, status: 1, role: '普通用户', roleId: 3, remark: '', createdAt: '2024-02-01 10:00:00' },
  { id: 4, username: 'wangwu', nickname: '王五', email: 'wangwu@example.com', phone: '13800000004', deptName: '技术部', deptId: 2, status: 1, role: '普通用户', roleId: 3, remark: '', createdAt: '2024-02-10 10:00:00' },
  { id: 5, username: 'zhaoliu', nickname: '赵六', email: 'zhaoliu@example.com', phone: '13800000005', deptName: '技术部', deptId: 2, status: 0, role: '普通用户', roleId: 3, remark: '已离职', createdAt: '2024-03-01 10:00:00' },
  { id: 6, username: 'sunqi', nickname: '孙七', email: 'sunqi@example.com', phone: '13800000006', deptName: '产品部', deptId: 3, status: 1, role: '管理员', roleId: 2, remark: '', createdAt: '2024-03-15 10:00:00' },
  { id: 7, username: 'zhouba', nickname: '周八', email: 'zhouba@example.com', phone: '13800000007', deptName: '产品部', deptId: 3, status: 1, role: '普通用户', roleId: 3, remark: '', createdAt: '2024-04-01 10:00:00' },
  { id: 8, username: 'wujiu', nickname: '吴九', email: 'wujiu@example.com', phone: '13800000008', deptName: '产品部', deptId: 3, status: 1, role: '普通用户', roleId: 3, remark: '', createdAt: '2024-04-10 10:00:00' },
  { id: 9, username: 'zhengshi', nickname: '郑十', email: 'zhengshi@example.com', phone: '13800000009', deptName: '市场部', deptId: 4, status: 1, role: '管理员', roleId: 2, remark: '', createdAt: '2024-05-01 10:00:00' },
  { id: 10, username: 'chenyi', nickname: '陈一', email: 'chenyi@example.com', phone: '13800000010', deptName: '市场部', deptId: 4, status: 1, role: '普通用户', roleId: 3, remark: '', createdAt: '2024-05-15 10:00:00' },
  { id: 11, username: 'liuer', nickname: '刘二', email: 'liuer@example.com', phone: '13800000011', deptName: '市场部', deptId: 4, status: 0, role: '普通用户', roleId: 3, remark: '', createdAt: '2024-06-01 10:00:00' },
  { id: 12, username: 'huangsan', nickname: '黄三', email: 'huangsan@example.com', phone: '13800000012', deptName: '运营部', deptId: 5, status: 1, role: '管理员', roleId: 2, remark: '', createdAt: '2024-06-10 10:00:00' },
  { id: 13, username: 'linxi', nickname: '林四', email: 'linxi@example.com', phone: '13800000013', deptName: '运营部', deptId: 5, status: 1, role: '普通用户', roleId: 3, remark: '', createdAt: '2024-07-01 10:00:00' },
  { id: 14, username: 'hexu', nickname: '何五', email: 'hexu@example.com', phone: '13800000014', deptName: '运营部', deptId: 5, status: 1, role: '普通用户', roleId: 3, remark: '', createdAt: '2024-07-15 10:00:00' },
  { id: 15, username: 'caoqi', nickname: '曹七', email: 'caoqi@example.com', phone: '13800000015', deptName: '技术部', deptId: 2, status: 1, role: '运维人员', roleId: 4, remark: '', createdAt: '2024-08-01 10:00:00' },
  { id: 16, username: 'luoba', nickname: '罗八', email: 'luoba@example.com', phone: '13800000016', deptName: '技术部', deptId: 2, status: 1, role: '普通用户', roleId: 3, remark: '', createdAt: '2024-08-10 10:00:00' },
  { id: 17, username: 'liangjiu', nickname: '梁九', email: 'liangjiu@example.com', phone: '13800000017', deptName: '产品部', deptId: 3, status: 0, role: '普通用户', roleId: 3, remark: '已禁用', createdAt: '2024-09-01 10:00:00' },
  { id: 18, username: 'songshi', nickname: '宋十', email: 'songshi@example.com', phone: '13800000018', deptName: '市场部', deptId: 4, status: 1, role: '运维人员', roleId: 4, remark: '', createdAt: '2024-09-15 10:00:00' },
]

const allData = ref<UserRecord[]>([...mockData])

const isEditing = ref(false)
const currentRecord = ref<UserRecord | null>(null)
const selectedDeptId = ref<number | null>(null)
const treeExpandedKeys = ref<number[]>([1])

const [modalRegister, modalMethods] = useModal()
const [tableRegister, tableMethods] = useTable()
const [formRegister, formMethods] = useForm()

const searchFormSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    componentProps: {
      placeholder: '搜索用户名/昵称/邮箱/手机号...',
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
        { label: '禁用', value: 0 },
      ],
    },
    colProps: { span: 8 },
  },
]

const modalFormSchemas: FormSchema[] = [
  {
    field: 'username',
    label: '用户名',
    component: 'Input',
    required: true,
    colProps: { span: 12 },
    componentProps: { placeholder: '请输入用户名' },
  },
  {
    field: 'nickname',
    label: '昵称',
    component: 'Input',
    required: true,
    colProps: { span: 12 },
    componentProps: { placeholder: '请输入昵称' },
  },
  {
    field: 'password',
    label: '密码',
    component: 'InputPassword',
    colProps: { span: 12 },
    componentProps: { placeholder: '留空则不修改密码' },
  },
  {
    field: 'phone',
    label: '手机号',
    component: 'Input',
    colProps: { span: 12 },
    componentProps: { placeholder: '请输入手机号' },
  },
  {
    field: 'email',
    label: '邮箱',
    component: 'Input',
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入邮箱地址' },
  },
  {
    field: 'deptId',
    label: '部门',
    component: 'TreeSelect',
    colProps: { span: 12 },
    componentProps: {
      treeData: mockDeptTree,
      fieldNames: { children: 'children', title: 'name', key: 'id', value: 'id' },
      placeholder: '请选择部门',
      treeDefaultExpandAll: true,
    },
  },
  {
    field: 'roleId',
    label: '角色',
    component: 'Select',
    colProps: { span: 12 },
    componentProps: {
      options: roleOptions,
      placeholder: '请选择角色',
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
        { label: '禁用', value: 0 },
      ],
    },
  },
  {
    field: 'remark',
    label: '备注',
    component: 'Input',
    colProps: { span: 12 },
    componentProps: { placeholder: '请输入备注' },
  },
]

async function mockApi(params: Record<string, any>) {
  const { keyword, status, page = 1, pageSize = 10 } = params
  let filtered = [...allData.value]

  if (selectedDeptId.value !== null) {
    filtered = filtered.filter(i => i.deptId === selectedDeptId.value)
  }

  if (keyword) {
    const kw = String(keyword).toLowerCase()
    filtered = filtered.filter(
      i => i.username.toLowerCase().includes(kw)
        || i.nickname.toLowerCase().includes(kw)
        || i.email.toLowerCase().includes(kw)
        || i.phone.includes(kw),
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
    status: 1,
    remark: '',
  })
  formMethods.clearValidate()
  modalMethods.openModal()
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
    remark: record.remark,
  })
  formMethods.clearValidate()
  modalMethods.openModal()
}

function handleDelete(record: UserRecord) {
  const idx = allData.value.findIndex(i => i.id === record.id)
  if (idx > -1) {
    allData.value.splice(idx, 1)
    message.success(`已删除用户：${record.nickname}`)
    tableMethods.value?.reload()
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

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

  if (isEditing.value && currentRecord.value) {
    const idx = allData.value.findIndex(i => i.id === currentRecord.value!.id)
    if (idx > -1) {
      const dept = allDeptNodes.find(d => d.id === values.deptId)
      const role = roleOptions.find(r => r.value === values.roleId)
      allData.value[idx] = {
        ...allData.value[idx]!,
        username: values.username,
        nickname: values.nickname,
        email: values.email,
        phone: values.phone,
        deptId: values.deptId!,
        deptName: dept?.name || '',
        roleId: values.roleId!,
        role: role?.label || '',
        status: values.status,
        remark: values.remark,
      }
    }
    message.success(`已更新用户：${values.nickname}`)
  }
  else {
    const newId = Math.max(...allData.value.map(i => i.id), 0) + 1
    const dept = allDeptNodes.find(d => d.id === values.deptId)
    const role = roleOptions.find(r => r.value === values.roleId)
    allData.value.push({
      id: newId,
      username: values.username,
      nickname: values.nickname,
      email: values.email,
      phone: values.phone,
      deptId: values.deptId!,
      deptName: dept?.name || '',
      roleId: values.roleId!,
      role: role?.label || '',
      status: values.status,
      remark: values.remark,
      createdAt: now,
    })
    message.success(`已新增用户：${values.nickname}`)
  }

  modalMethods.closeModal()
  tableMethods.value?.reload()
}

const columns: BasicColumn[] = [
  { title: '用户名', dataIndex: 'username', key: 'username', width: 120 },
  { title: '昵称', dataIndex: 'nickname', key: 'nickname', width: 120 },
  { title: '邮箱', dataIndex: 'email', key: 'email', width: 200, ellipsis: true },
  { title: '手机号', dataIndex: 'phone', key: 'phone', width: 140 },
  { title: '部门', dataIndex: 'deptName', key: 'deptName', width: 100, align: 'center' },
  { title: '角色', dataIndex: 'role', key: 'role', width: 120, align: 'center' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 170 },
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
          :action-column="{ width: 180, title: '操作', fixed: 'right' }"
          :row-selection="{ type: 'checkbox' }"
          :pagination="{ showSizeChanger: true,
                         pageSizeOptions: ['10',
                                           '20',
                                           '50'] }"
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
        @register="formRegister"
      />
    </BasicModal>
  </div>
</template>
