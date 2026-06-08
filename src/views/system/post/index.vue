<script setup lang="ts">
import type { FormSchema } from '@/components/business/Form'
import type { BasicColumn } from '@/components/business/Table'
import { faker } from '@faker-js/faker/locale/zh_CN'
import { Icon } from '@iconify/vue'

import { computed, ref, useTemplateRef } from 'vue'
import {
  addPost,
  deletePost,
  getPostList,
  updatePost,
} from '@/api/system'
import { BasicDrawer, useDrawer } from '@/components/business/Drawer'
import { BasicForm, useForm } from '@/components/business/Form'
import { BasicModal, useModal } from '@/components/business/Modal'
import { BasicTable, useTable } from '@/components/business/Table'
import { DictType } from '@/enums/dict'
import { useDictStore } from '@/stores'
import { cn } from '@/utils/cn'

defineOptions({ name: 'SystemPost' })

interface PostRecord {
  id: number
  name: string
  code: string
  deptId: number
  deptName: string
  sortOrder: number
  status: 0 | 1
  remark: string
  createdAt: string
  userCount: number
  userIds: number[]
}

interface UserRecord {
  id: number
  username: string
  nickname: string
  avatar?: string
  deptName: string
}

// ========== 样式类名 ==========
const containerClassName = cn('space-y-4')
const cardClassName = cn('shadow-sm')
const tagClassName = cn('inline-flex items-center gap-1')
const actionClassName = cn('flex', 'items-center', 'justify-center', 'whitespace-nowrap')
const btnClassName = cn('!px-0.5')
const dividerClassName = cn('mx-0')

// ========== 状态映射 ==========
const dictStore = useDictStore()

const statusOptions = computed(() => dictStore.getOptions(DictType.NORMAL_DISABLE))

const statusColorMap: Record<number, string> = {
  1: 'green',
  0: 'red',
}
const statusLabelMap: Record<number, string> = {
  1: '正常',
  0: '停用',
}

// 部门树结构（用于表单筛选）
interface DeptTreeNode {
  id: number
  name: string
  children?: DeptTreeNode[]
}

const deptTreeData: DeptTreeNode[] = [
  {
    id: 1,
    name: '总公司',
    children: [
      { id: 2, name: '技术部' },
      { id: 3, name: '产品部' },
      { id: 4, name: '市场部' },
      { id: 5, name: '运营部' },
      { id: 6, name: '财务部' },
      { id: 7, name: '人事部' },
      { id: 8, name: '行政部' },
    ],
  },
]

// 用户池 — 用于分配用户功能
faker.seed(2024)
const userPool = ref<UserRecord[]>([])

// 初始化用户池
for (let i = 1; i <= 30; i++) {
  userPool.value.push({
    id: i,
    username: `user_${String(i).padStart(3, '0')}`,
    nickname: faker.person.fullName(),
    avatar: undefined,
    deptName: ['技术部', '产品部', '市场部', '运营部'][faker.number.int({ min: 0, max: 3 })] || '未分配',
  })
}

// ========== 状态管理 ==========
const isEditing = ref(false)
const currentRecord = ref<PostRecord | null>(null)
const assignPostRecord = ref<PostRecord | null>(null)
const assignSearchKeyword = ref('')
const selectedAssignUserIds = ref<number[]>([])

const tableRef = useTemplateRef<InstanceType<typeof BasicTable>>('tableRef')
const [drawerRegister, drawerMethods] = useDrawer()
const [assignModalRegister, assignModalMethods] = useModal()
const [tableRegister, tableMethods] = useTable()
const [formRegister, formMethods] = useForm()

// ========== 搜索表单配置 ==========
const searchFormSchemas: FormSchema[] = [
  {
    field: 'name',
    label: '岗位名称',
    component: 'Input',
    colProps: { span: 6 },
    componentProps: {
      placeholder: '搜索岗位名称...',
      allowClear: true,
    },
  },
  {
    field: 'deptId',
    label: '所属部门',
    component: 'TreeSelect',
    colProps: { span: 6 },
    componentProps: {
      treeData: deptTreeData,
      fieldNames: { children: 'children', label: 'name', value: 'id' },
      placeholder: '选择部门',
      allowClear: true,
      treeDefaultExpandAll: true,
    },
  },
  {
    field: 'status',
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

// ========== 弹窗表单配置 ==========
const modalFormSchemas: FormSchema[] = [
  {
    field: 'name',
    label: '岗位名称',
    component: 'Input',
    required: true,
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入岗位名称' },
  },
  {
    field: 'code',
    label: '岗位编码',
    component: 'Input',
    required: true,
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入岗位编码（唯一），如 POST_FE_001' },
  },
  {
    field: 'deptId',
    label: '所属部门',
    component: 'TreeSelect',
    required: true,
    colProps: { span: 24 },
    componentProps: {
      treeData: deptTreeData,
      fieldNames: { children: 'children', label: 'name', value: 'id' },
      placeholder: '请选择所属部门',
      treeDefaultExpandAll: true,
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
    colProps: { span: 12 },
    defaultValue: 0,
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
    componentProps: { placeholder: '请输入备注信息...', rows: 3 },
  },
]

// ========== API 适配层 ==========
async function mockApi(params: Record<string, any>) {
  const res = await getPostList(params)
  // 兼容 mock 直接返回完整响应或已解包的数据
  const data = res?.data ?? res
  return { items: data?.list || [], total: data?.total || 0 }
}

// ========== 分配用户相关计算属性与方法 ==========
const availableUsers = computed(() => {
  let list = [...userPool.value]
  if (assignSearchKeyword.value) {
    const kw = assignSearchKeyword.value.toLowerCase()
    list = list.filter(
      u => u.nickname.toLowerCase().includes(kw) || u.username.toLowerCase().includes(kw),
    )
  }
  return list
})

const _assignedUsers = computed(() => {
  if (!assignPostRecord.value)
    return []
  return userPool.value.filter(u => assignPostRecord.value!.userIds.includes(u.id))
})

const _unassignedUsers = computed(() => {
  const assignedIds = new Set(selectedAssignUserIds.value)
  return availableUsers.value.filter(u => !assignedIds.has(u.id))
})

const transferDataSource = computed(() =>
  userPool.value.map(u => ({
    key: u.id,
    title: `${u.nickname} (${u.username})`,
  })),
)

function handleOpenAssign(record: PostRecord) {
  assignPostRecord.value = record
  selectedAssignUserIds.value = [...record.userIds]
  assignSearchKeyword.value = ''
  assignModalMethods.openModal()
}

function _handleToggleAssignUser(user: UserRecord) {
  const idx = selectedAssignUserIds.value.indexOf(user.id)
  if (idx > -1) {
    selectedAssignUserIds.value.splice(idx, 1)
  }
  else {
    selectedAssignUserIds.value.push(user.id)
  }
}

async function handleSaveAssign() {
  if (!assignPostRecord.value)
    return
  try {
    await updatePost(assignPostRecord.value.id, { userIds: selectedAssignUserIds.value })
    message.success(`已为「${assignPostRecord.value.name}」分配 ${selectedAssignUserIds.value.length} 名用户`)
    assignModalMethods.closeModal()
    tableMethods.value?.reload()
  }
  catch (e: any) {
    message.error(e?.message || '保存失败')
  }
}

// ========== CRUD 操作 ==========
function handleAdd() {
  isEditing.value = false
  currentRecord.value = null
  formMethods.setFieldsValue({
    name: '',
    code: '',
    deptId: undefined,
    sortOrder: 0,
    status: 0,
    remark: '',
  })
  formMethods.clearValidate()
  drawerMethods.openDrawer()
}

function handleEdit(record: PostRecord) {
  isEditing.value = true
  currentRecord.value = record
  formMethods.setFieldsValue({
    name: record.name,
    code: record.code,
    deptId: record.deptId,
    sortOrder: record.sortOrder,
    status: record.status,
    remark: record.remark,
  })
  formMethods.clearValidate()
  drawerMethods.openDrawer()
}

async function handleDelete(record: PostRecord) {
  try {
    await deletePost(record.id)
    message.success(`已删除岗位：${record.name}`)
    tableMethods.value?.reload()
  }
  catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

async function handleToggleStatus(record: PostRecord) {
  try {
    await updatePost(record.id, { status: record.status === 1 ? 0 : 1 })
    message.success(`已${record.status === 1 ? '停用' : '启用'}：${record.name}`)
    tableMethods.value?.reload()
  }
  catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

async function handleSave() {
  const values = await formMethods.validate()
  if (!values)
    return

  if (!values.name || !values.code) {
    message.warning('请填写岗位名称和编码')
    return
  }

  try {
    if (isEditing.value && currentRecord.value) {
      await updatePost(currentRecord.value.id, values)
      message.success(`已更新岗位：${values.name}`)
    }
    else {
      await addPost(values)
      message.success(`已新增岗位：${values.name}`)
    }

    drawerMethods.closeDrawer()
    tableMethods.value?.reload()
  }
  catch (e: any) {
    message.error(e?.message || '保存失败')
  }
}

// ========== 表格列配置 ==========
const columns: BasicColumn[] = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70, align: 'center' },
  { title: '岗位名称', dataIndex: 'name', key: 'name', width: 160 },
  { title: '岗位编码', dataIndex: 'code', key: 'code', width: 180, align: 'center' },
  { title: '所属部门', dataIndex: 'deptName', key: 'deptName', width: 120, align: 'center' },
  { title: '排序号', dataIndex: 'sortOrder', key: 'sortOrder', width: 80, align: 'center' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center' },
  { title: '关联用户数', dataIndex: 'userCount', key: 'userCount', width: 100, align: 'center' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 170, align: 'center' },
  { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true },
]
</script>

<template>
  <div :class="containerClassName">
    <a-card
      title="岗位管理"
      :class="cardClassName"
    >
      <BasicTable
        ref="tableRef"
        :columns="columns"
        :api="mockApi"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
        :pagination="{ showSizeChanger: true,
                       pageSizeOptions: ['10',
                                         '20',
                                         '50'] }"
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
            新增岗位
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

        <template #cell-userCount="{ record }">
          <a-badge
            :count="record.userCount"
            :number-style="{ backgroundColor: '#1677ff' }"
          />
        </template>

        <template #action="{ record }">
          <div :class="actionClassName">
            <a-button
              type="link"
              :class="btnClassName"
              @click="() => handleOpenAssign(record)"
            >
              <template #icon>
                <Icon icon="ant-design:user-switch-outlined" />
              </template>
              分配用户
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
              :title="`确定要「${record.status === 1 ? '停用' : '启用'}」岗位「${record.name}」吗？`"
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
              :title="`确定要删除岗位「${record.name}」吗？`"
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
      :title="isEditing ? '编辑岗位' : '新增岗位'"
      :width="560"
      @register="drawerRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="modalFormSchemas"
        :label-width="90"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="formRegister"
      />
    </BasicDrawer>

    <!-- 分配用户弹窗 -->
    <BasicModal
      :title="`分配用户 - ${assignPostRecord?.name || ''}`"
      :width="720"
      @register="assignModalRegister"
      @ok="handleSaveAssign"
    >
      <div class="space-y-4">
        <!-- 岗位信息提示 -->
        <a-alert
          message="选择要分配到该岗位的用户，支持多选"
          type="info"
          show-icon
        />

        <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span>岗位编码：<a-tag color="blue">{{ assignPostRecord?.code }}</a-tag></span>
          <span>所属部门：<a-tag color="cyan">{{ assignPostRecord?.deptName }}</a-tag></span>
          <span>已选：<a-tag color="orange">{{ selectedAssignUserIds.length }} 人</a-tag></span>
        </div>

        <!-- 搜索框 -->
        <a-input
          v-model:value="assignSearchKeyword"
          placeholder="搜索用户名/昵称..."
          allow-clear
        >
          <template #prefix>
            <Icon
              icon="ant-design:search-outlined"
              class="text-gray-400"
            />
          </template>
        </a-input>

        <!-- Transfer 穿梭框 -->
        <a-transfer
          v-model:target-keys="selectedAssignUserIds"
          :data-source="transferDataSource"
          :titles="['待选用户',
                    '已选用户']"
          :render="(item: any) => item.title"
          show-search
        />
      </div>
    </BasicModal>
  </div>
</template>
