<script setup lang="ts">
import type { FormSchema } from '~/components/business/Form'
import type { BasicColumn } from '~/components/business/Table'

import { computed, onMounted, ref, useTemplateRef } from 'vue'

import { cn } from '@antdv/shared/cn'
import { Icon } from '@iconify/vue'
import { addDept, deleteDept, getDeptTree, updateDept } from '~/api/system'
import { BasicForm, useForm } from '~/components/business/Form'
import { BasicModal, useModal } from '~/components/business/Modal'
import { BasicTable, useTable } from '~/components/business/Table'
import { DictType } from '~/enums/dict'
import { useDictStore } from '~/stores'

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
const rightPanelClassName = cn('min-w-0 flex-1')
const cardClassName = cn('shadow-sm')
const treeCardClassName = cn('h-full shadow-sm')
const headerClassName = cn('mb-4 flex items-center justify-between')
const statClassName = cn('text-sm text-gray-500')
const statNumClassName = cn('text-lg font-bold text-blue-600')
const statusTagClassName = cn('inline-flex items-center gap-1')
const actionClassName = cn('flex', 'items-center', 'justify-center')
const btnClassName = cn('px-0.5!')
const dividerClassName = cn('mx-0')

// ========== 状态映射 ==========
const dictStore = useDictStore()

const statusOptions = computed(() =>
  dictStore.getOptions(DictType.NORMAL_DISABLE),
)

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
/**
 * 共享的加载 promise —— 表格的 `immediate` 首屏取数**早于**这里 fetch 完成，
 * 直接读 `allData` 拿到的是空数组，表现是"页面打开就空表，点一下左侧树才有数据"
 * （巡检时 /system/dept 正是这个现象）。
 * 所以取数侧一律先 `await ensureDeptTree()`，把"谁先到"这件事收敛成"都等同一次请求"。
 */
let deptTreeLoading: Promise<void> | null = null

function ensureDeptTree(): Promise<void> {
  deptTreeLoading ??= initDeptTree().then((ok) => {
    // 失败不留缓存的 promise：下次进来还能重试，否则整页永远读的是空数据
    if (!ok) deptTreeLoading = null
  })
  return deptTreeLoading
}

/**
 * 增删改之后强制重取：共享 promise 已经 fulfilled，再 `ensure` 只会拿到旧数据。
 * 先清缓存再走 `ensureDeptTree`，让"重取"和"首屏取"是同一条代码路径。
 */
function reloadDeptTree(): Promise<void> {
  deptTreeLoading = null
  return ensureDeptTree()
}

async function initDeptTree(): Promise<boolean> {
  try {
    const res = await getDeptTree()
    /**
     * `api/request.get` 只解掉外层响应壳，交回来的是 `{ code, data, message }`
     * 这个 envelope；mock 也出现过直接给数组本体的写法，所以两种都兼容
     * （和用户管理/角色管理那几页 `res?.data ?? res` 是同一套约定）。
     * 少这一步就是把 `{code:200,...}` 当数组去 `.map`，页面静默空树。
     */
    const raw = res?.data ?? res
    const list = Array.isArray(raw) ? (raw as DeptRecord[]) : []
    allData.value = list
    deptTreeData.value = list.map(convertToTreeNode)
    /**
     * 展开 keys 要在**数据到手之后**重新赋值，不能只靠 `ref([1])` 的初值。
     *
     * `expanded-keys` 是受控属性，而 antd Tree 只在"这个 prop 换了引用"时才把它
     * 写进内部展开态：装配时数据还是空数组，初值 `[1]` 落在一棵空树上，
     * 之后数据来了 prop 引用没变 → 根节点永远折着，整棵树只剩「总公司」一行。
     * 这里赋一个新数组（而不是原地 push），既触发同步，也让首屏就把根节点的
     * 子部门露出来 —— 右侧表格展示的正是"选中部门的直接子部门"，树折着等于
     * 把表格的数据来源藏起来了。
     */
    treeExpandedKeys.value = list.map((dept) => dept.id)
    return true
  } catch (error) {
    console.error('获取部门树失败', error)
    return false
  }
}

onMounted(() => {
  ensureDeptTree()
})

// 扁平化部门列表
function flattenDepts(nodes: DeptRecord[]): DeptRecord[] {
  const result: DeptRecord[] = []
  function walk(items: DeptRecord[]) {
    for (const item of items) {
      result.push(item)
      if (item.children && item.children.length > 0) walk(item.children)
    }
  }
  walk(nodes)
  return result
}

const flatAllDepts = computed(() => flattenDepts(allData.value))

// 获取选中部门的直接子部门（保持树形结构）
function getChildrenOnly(deptId: number): DeptRecord[] {
  const target = flatAllDepts.value.find((d) => d.id === deptId)
  if (!target || !target.children || target.children.length === 0) return []
  return target.children
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
      // 这版 antdv-next 用语义化 `styles.popup.root`，`dropdownStyle` 已废弃（控制台会警告）
      styles: { popup: { root: { maxHeight: '400px', overflow: 'auto' } } },
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
    componentProps: {
      min: 0,
      placeholder: '数字越小越靠前',
      style: { width: '100%' },
    },
  },
  {
    field: 'status',
    label: '状态',
    component: 'RadioGroup',
    defaultValue: 0,
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
  // 先等树到位再取数：首屏 `immediate` 比 onMounted 的 fetch 更早，不等就是空表
  await ensureDeptTree()
  const { keyword } = params
  // 获取选中部门的直接子部门（保持树形结构）
  const target = flatAllDepts.value.find((d) => d.id === selectedDeptId.value)
  let items = target?.children || []

  if (keyword) {
    const kw = String(keyword).toLowerCase()
    // 过滤时需要递归搜索子树
    function filterTree(nodes: DeptRecord[]): DeptRecord[] {
      return nodes.reduce((acc, node) => {
        if (node.name.toLowerCase().includes(kw)) {
          acc.push(node)
        } else if (node.children?.length) {
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
/**
 * `a-tree` 的 `@select` 回调签名由 antd 定义（`selectedKeys: Key[]`、
 * `info.node: EventDataNode<DataNode>`），这里只关心被点的那条部门 id。
 * `node` 收成宽类型而不是自造 `{ id: number }`：后者会让模板上的事件绑定
 * 因为"实参类型对不上形参"而过不了 type-check。
 */
function handleDeptSelect(
  _selectedKeys: (number | string)[],
  info: { node: Record<string, any> },
) {
  selectedDeptId.value = Number(info.node.id)
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
    status: 0,
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
    status: 0,
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
    // 刷新树形数据：走 reloadDeptTree，左侧树和表格读的是同一份 allData
    await reloadDeptTree()
    tableMethods.value?.reload()
  } catch (error: any) {
    message.error(error?.message || '删除失败')
  }
}

function handleToggleExpand() {
  isAllExpanded.value = !isAllExpanded.value
  if (isAllExpanded.value) {
    const allIds = flatAllDepts.value.map((d) => d.id)
    treeExpandedKeys.value = allIds
  } else {
    treeExpandedKeys.value = [allData.value[0]?.id ?? 1]
  }
}

async function handleSave() {
  const values = await formMethods.validate()
  if (!values) return

  if (!values.name || !values.code) {
    message.warning('请填写部门名称和编码')
    return
  }

  try {
    if (isEditing.value && currentRecord.value) {
      await updateDept(currentRecord.value.id, values)
      message.success(`已更新部门：${values.name}`)
    } else {
      await addDept(values)
      message.success(`已新增部门：${values.name}`)
    }

    // 刷新树形数据：必须走 reload，`ensureDeptTree` 拿到的是已缓存的旧 promise
    await reloadDeptTree()

    modalMethods.closeModal()
    tableMethods.value?.reload()
  } catch (error: any) {
    message.error(error?.message || '保存失败')
  }
}

// ========== 表格列配置 ==========
const columns: BasicColumn[] = [
  {
    title: '#',
    key: 'index',
    width: 60,
    align: 'center',
    customRender: ({ index }) => index + 1,
  },
  { title: '部门名称', dataIndex: 'name', key: 'name', width: 160 },
  {
    title: '部门编码',
    dataIndex: 'code',
    key: 'code',
    width: 140,
    align: 'center',
  },
  {
    title: '负责人',
    dataIndex: 'leader',
    key: 'leader',
    width: 120,
    align: 'center',
  },
  {
    title: '联系电话',
    dataIndex: 'phone',
    key: 'phone',
    width: 140,
    align: 'center',
  },
  {
    title: '排序号',
    dataIndex: 'sortOrder',
    key: 'sortOrder',
    width: 80,
    align: 'center',
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 80,
    align: 'center',
  },
  {
    title: '人数',
    dataIndex: 'userCount',
    key: 'userCount',
    width: 70,
    align: 'center',
  },
  { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 170,
    align: 'center',
  },
]
</script>

<template>
  <div :class="containerClassName">
    <!-- 左侧部门树 -->
    <div :class="leftPanelClassName">
      <a-card :class="treeCardClassName" title="部门架构" size="small">
        <template #extra>
          <a-button
            type="link"
            size="small"
            :class="btnClassName"
            @click="handleToggleExpand"
          >
            <template #icon>
              <Icon
                :icon="
                  isAllExpanded ? 'carbon:collapse-all' : 'carbon:expand-all'
                "
              />
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
          @update:expanded-keys="
            (keys) => {
              treeExpandedKeys = keys.map(Number)
            }
          "
        />
      </a-card>
    </div>

    <!-- 右侧内容区 -->
    <div :class="rightPanelClassName">
      <a-card title="部门列表" :class="cardClassName">
        <!-- 统计信息 -->
        <div :class="headerClassName">
          <div :class="statClassName">
            当前选中：
            <span class="font-medium text-gray-700 dark:text-gray-300">{{
              flatAllDepts.find((d) => d.id === selectedDeptId)?.name
            }}</span>
            <span class="mx-2">|</span>
            直接子部门：<span :class="statNumClassName">{{
              currentStat.deptCount
            }}</span>
            个
            <span class="mx-2">|</span>
            总人数：<span :class="statNumClassName">{{
              currentStat.totalUsers
            }}</span>
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
            <a-button type="primary" @click="handleAdd">
              <template #icon>
                <Icon icon="ant-design:plus-outlined" />
              </template>
              新增部门
            </a-button>
          </template>

          <template #cell-status="{ record }">
            <a-tag :color="statusColorMap[record.status] || 'default'">
              <span :class="statusTagClassName">
                <Icon
                  :icon="
                    record.status === 1
                      ? 'carbon:checkmark-outline'
                      : 'carbon:close-outline'
                  "
                />
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
                @click="() => handleAddChild(record as DeptRecord)"
              >
                <template #icon>
                  <Icon icon="ant-design:plus-circle-outlined" />
                </template>
                新增
              </a-button>
              <a-button
                type="link"
                :class="btnClassName"
                @click="() => handleEdit(record as DeptRecord)"
              >
                <template #icon>
                  <Icon icon="ant-design:edit-outlined" />
                </template>
                编辑
              </a-button>
              <a-divider type="vertical" :class="dividerClassName" />
              <a-popconfirm
                :title="`确定要删除部门「${record.name}」吗？子部门也将一并删除。`"
                @confirm="() => handleDelete(record as DeptRecord)"
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
