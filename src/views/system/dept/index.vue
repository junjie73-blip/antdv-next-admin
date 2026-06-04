<script setup lang="ts">
import type { FormSchema } from '@/components/business/Form'
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import {
  addDept,
  deleteDept,
  getDeptTree,
  updateDept,
} from '@/api/system'
import { BasicForm, useForm } from '@/components/business/Form'
import { BasicModal, useModal } from '@/components/business/Modal'
import { BasicTable, useTable } from '@/components/business/Table'
import { useDictStore } from '@/stores'
import { cn } from '@/utils/cn'

defineOptions({ name: 'SystemDept' })

interface DeptRecord {
  id: number
  parentId: number
  name: string
  code: string
  leader: string
  phone: string
  sortOrder: number
  status: 0 | 1
  remark: string
  createdAt: string
  children?: DeptRecord[]
  userCount: number
}

interface DeptTreeNode {
  id: number
  name: string
  children?: DeptTreeNode[]
}

// ========== 样式类名 ==========
const containerClassName = cn('flex gap-4')
const leftPanelClassName = cn('w-[280px] shrink-0')
const rightPanelClassName = cn('flex-1 min-w-0')
const cardClassName = cn('shadow-sm')
const treeCardClassName = cn('shadow-sm h-full')
const headerClassName = cn('flex items-center justify-between mb-4')
const statClassName = cn('text-sm text-gray-500')
const statNumClassName = cn('text-lg font-bold text-blue-600')
const statusTagClassName = cn('inline-flex items-center gap-1')
const actionClassName = cn('flex', 'items-center', 'justify-center')
const btnClassName = cn('!px-0.5')
const dividerClassName = cn('mx-0')

// ========== 状态映射 ==========
const dictStore = useDictStore()

const statusOptions = computed(() => dictStore.getOptions('sys_normal_disable'))

const statusColorMap: Record<number, string> = {
  1: 'green',
  0: 'red',
}
const statusLabelMap: Record<number, string> = {
  1: '正常',
  0: '停用',
}

// 从 API 获取部门树数据
const allData = ref<DeptRecord[]>([])
const deptTreeData = ref<DeptTreeNode[]>([])

// 将 DeptRecord 转换为 TreeSelect 需要的格式
function convertToTreeNode(dept: DeptRecord): DeptTreeNode {
  const node: DeptTreeNode = { id: dept.id, name: dept.name }
  if (dept.children && dept.children.length > 0) {
    node.children = dept.children.map(convertToTreeNode)
  }
  return node
}

// 初始化部门树数据
async function initDeptTree() {
  try {
    const res = await getDeptTree()
    // 兼容 mock 返回完整响应或已解包的数据
    const data = Array.isArray(res) ? res : (res?.data ?? res ?? [])
    allData.value = data
    deptTreeData.value = data.map(convertToTreeNode)
  }
  catch (e) {
    console.error('获取部门树失败', e)
  }
}

onMounted(() => {
  initDeptTree()
})

// 扁平化部门列表
function flattenDepts(nodes: DeptRecord[]): DeptRecord[] {
  const result: DeptRecord[] = []
  function walk(items: DeptRecord[]) {
    for (const item of items) {
      result.push(item)
      if (item.children && item.children.length > 0)
        walk(item.children)
    }
  }
  walk(nodes)
  return result
}

const flatAllDepts = computed(() => flattenDepts(allData.value))

// 获取选中部门的直接子部门（保持树形结构）
function getChildrenOnly(deptId: number): DeptRecord[] {
  const target = flatAllDepts.value.find(d => d.id === deptId)
  if (!target || !target.children || target.children.length === 0)
    return []
  return target.children
}

function _getTotalUserCount(deptId: number): number {
  return getDeptAndChildren(deptId).reduce((sum, d) => sum + d.userCount, 0)
}

// ========== 状态管理 ==========
const selectedDeptId = ref<number>(1)
const treeExpandedKeys = ref<number[]>([1])
const isEditing = ref(false)
const currentRecord = ref<DeptRecord | null>(null)
const isAllExpanded = ref(false)

const tableRef = useTemplateRef<InstanceType<typeof BasicTable>>('tableRef')

const [modalRegister, modalMethods] = useModal()
const [tableRegister, tableMethods] = useTable()
const [formRegister, formMethods] = useForm()

const currentStat = computed(() => {
  const depts = getChildrenOnly(selectedDeptId.value)
  return {
    deptCount: depts.length,
    totalUsers: depts.reduce((sum, d) => sum + d.userCount, 0),
  }
})

// ========== 搜索表单配置 ==========
const searchFormSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '部门名称',
    component: 'Input',
    componentProps: {
      placeholder: '搜索部门名称...',
      allowClear: true,
    },
    colProps: { span: 6 },
  },
]

// ========== 弹窗表单配置 ==========
const modalFormSchemas: FormSchema[] = [
  {
    field: 'parentId',
    label: '上级部门',
    component: 'TreeSelect',
    componentProps: {
      treeData: deptTreeData,
      fieldNames: { children: 'children', label: 'name', value: 'id' },
      placeholder: '选择上级部门（留空则为顶级部门）',
      allowClear: true,
      treeDefaultExpandAll: true,
      showSearch: true,
      treeNodeFilterProp: 'name',
      dropdownStyle: { maxHeight: '400px', overflow: 'auto' },
    },
  },
  {
    field: 'name',
    label: '部门名称',
    component: 'Input',
    required: true,
    componentProps: { placeholder: '请输入部门名称' },
  },
  {
    field: 'code',
    label: '部门编码',
    component: 'Input',
    required: true,
    componentProps: { placeholder: '请输入部门编码（唯一）' },
  },
  {
    field: 'leader',
    label: '负责人',
    component: 'Input',
    componentProps: { placeholder: '请输入负责人姓名' },
  },
  {
    field: 'phone',
    label: '联系电话',
    component: 'Input',
    componentProps: { placeholder: '请输入联系电话' },
  },
  {
    field: 'sortOrder',
    label: '排序号',
    component: 'InputNumber',
    defaultValue: 0,
    colProps: { span: 12 },
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
    componentProps: { placeholder: '请输入备注信息...', rows: 3 },
  },
]

// ========== API 适配层 — 树形表格不分页 ==========
async function mockApi(params: Record<string, any>) {
  const { keyword } = params
  // 获取选中部门的直接子部门（保持树形结构）
  const target = flatAllDepts.value.find(d => d.id === selectedDeptId.value)
  let items = target?.children || []

  if (keyword) {
    const kw = String(keyword).toLowerCase()
    // 过滤时需要递归搜索子树
    function filterTree(nodes: DeptRecord[]): DeptRecord[] {
      return nodes.reduce((acc, node) => {
        if (node.name.toLowerCase().includes(kw)) {
          acc.push(node)
        }
        else if (node.children?.length) {
          const filtered = filterTree(node.children)
          if (filtered.length > 0) {
            acc.push({ ...node, children: filtered })
          }
        }
        return acc
      }, [] as DeptRecord[])
    }
    items = filterTree(items)
  }

  return { items, total: items.length }
}

// ========== 事件处理 ==========
function handleDeptSelect(_selectedKeys: (string | number)[], info: { node: { id: number } }) {
  selectedDeptId.value = info.node.id
  tableMethods.value?.reload()
}

function handleAdd() {
  isEditing.value = false
  currentRecord.value = null
  formMethods.setFieldsValue({
    parentId: selectedDeptId.value,
    name: '',
    code: '',
    leader: '',
    phone: '',
    sortOrder: 0,
    status: 1,
    remark: '',
  })
  formMethods.clearValidate()
  modalMethods.openModal()
}

function handleAddChild(record: DeptRecord) {
  isEditing.value = false
  currentRecord.value = null
  formMethods.setFieldsValue({
    parentId: record.id,
    name: '',
    code: '',
    leader: '',
    phone: '',
    sortOrder: 0,
    status: 1,
    remark: '',
  })
  formMethods.clearValidate()
  modalMethods.openModal()
}

function handleEdit(record: DeptRecord) {
  isEditing.value = true
  currentRecord.value = record
  formMethods.setFieldsValue({
    parentId: record.parentId === 0 ? undefined : record.parentId,
    name: record.name,
    code: record.code,
    leader: record.leader,
    phone: record.phone,
    sortOrder: record.sortOrder,
    status: record.status,
    remark: record.remark,
  })
  formMethods.clearValidate()
  modalMethods.openModal()
}

async function handleDelete(record: DeptRecord) {
  try {
    await deleteDept(record.id)
    message.success(`已删除部门「${record.name}」及其子部门`)
    // 刷新树形数据
    const res = await getDeptTree()
    const data = Array.isArray(res) ? res : (res?.data ?? res ?? [])
    allData.value = data
    tableMethods.value?.reload()
  }
  catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

function handleToggleExpand() {
  isAllExpanded.value = !isAllExpanded.value
  if (isAllExpanded.value) {
    const allIds = flatAllDepts.value.map(d => d.id)
    treeExpandedKeys.value = allIds
  }
  else {
    treeExpandedKeys.value = [allData.value[0]?.id ?? 1]
  }
}

async function handleSave() {
  const values = await formMethods.validate()
  if (!values)
    return

  if (!values.name || !values.code) {
    message.warning('请填写部门名称和编码')
    return
  }

  try {
    if (isEditing.value && currentRecord.value) {
      await updateDept(currentRecord.value.id, values)
      message.success(`已更新部门：${values.name}`)
    }
    else {
      await addDept(values)
      message.success(`已新增部门：${values.name}`)
    }

    // 刷新树形数据
    await initDeptTree()

    modalMethods.closeModal()
    tableMethods.value?.reload()
  }
  catch (e: any) {
    message.error(e?.message || '保存失败')
  }
}

// ========== 表格列配置 ==========
const columns: BasicColumn[] = [
  { title: '#', key: 'index', width: 60, align: 'center', customRender: ({ index }) => index + 1 },
  { title: '部门名称', dataIndex: 'name', key: 'name', width: 160 },
  { title: '部门编码', dataIndex: 'code', key: 'code', width: 140, align: 'center' },
  { title: '负责人', dataIndex: 'leader', key: 'leader', width: 120, align: 'center' },
  { title: '联系电话', dataIndex: 'phone', key: 'phone', width: 140, align: 'center' },
  { title: '排序号', dataIndex: 'sortOrder', key: 'sortOrder', width: 80, align: 'center' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center' },
  { title: '人数', dataIndex: 'userCount', key: 'userCount', width: 70, align: 'center' },
  { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 170, align: 'center' },
]
</script>

<template>
  <div :class="containerClassName">
    <!-- 左侧部门树 -->
    <div :class="leftPanelClassName">
      <a-card
        :class="treeCardClassName"
        title="部门架构"
        size="small"
      >
        <template #extra>
          <a-button
            type="link"
            size="small"
            :class="btnClassName"
            @click="handleToggleExpand"
          >
            <template #icon>
              <Icon :icon="isAllExpanded ? 'carbon:collapse-all' : 'carbon:expand-all'" />
            </template>
            {{ isAllExpanded ? '折叠' : '展开' }}
          </a-button>
        </template>
        <a-tree
          :tree-data="deptTreeData"
          :field-names="{ children: 'children', title: 'name', key: 'id' }"
          :expanded-keys="treeExpandedKeys"
          :default-selected-keys="[selectedDeptId]"
          block-node
          @select="handleDeptSelect"
          @update:expandedKeys="(keys: number[]) => { treeExpandedKeys = keys }"
        />
      </a-card>
    </div>

    <!-- 右侧内容区 -->
    <div :class="rightPanelClassName">
      <a-card
        title="部门列表"
        :class="cardClassName"
      >
        <!-- 统计信息 -->
        <div :class="headerClassName">
          <div :class="statClassName">
            当前选中：
            <span class="font-medium text-gray-700 dark:text-gray-300">{{ flatAllDepts.find(d => d.id === selectedDeptId)?.name }}</span>
            <span class="mx-2">|</span>
            直接子部门：<span :class="statNumClassName">{{ currentStat.deptCount }}</span>
            个
            <span class="mx-2">|</span>
            总人数：<span :class="statNumClassName">{{ currentStat.totalUsers }}</span>
            人
          </div>
        </div>

        <BasicTable
          ref="tableRef"
          :columns="columns"
          :api="mockApi"
          :immediate="true"
          :use-search-form="true"
          :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
          :is-tree="true"
          children-column-name="children"
          :pagination="false"
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
              新增部门
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
                @click="() => handleAddChild(record)"
              >
                <template #icon>
                  <Icon icon="ant-design:plus-circle-outlined" />
                </template>
                新增
              </a-button>
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
                :title="`确定要删除部门「${record.name}」吗？子部门也将一并删除。`"
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

    <!-- 新增/编辑弹窗 -->
    <BasicModal
      :title="isEditing ? '编辑部门' : '新增部门'"
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
