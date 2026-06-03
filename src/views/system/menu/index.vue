<script setup lang="ts">
import type { MenuConfig } from '#/menu'
import type { FormSchema } from '@/components/business/Form'
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { ref } from 'vue'
import { BasicDrawer, useDrawer } from '@/components/business/Drawer'
import { BasicForm, useForm } from '@/components/business/Form'
import { BasicTable, useTable } from '@/components/business/Table'
import IconPicker from '@/components/common/Icon/IconPicker.vue'
import { frontendMenus } from '@/router/menus'
import { cn } from '@/utils/cn'

defineOptions({ name: 'SystemMenu' })

interface MenuRecord {
  id: number
  menuName: string
  icon: string
  orderNum: number
  perms: string
  path: string
  component: string
  menuType: 'M' | 'C' | 'F'
  parentId: number | null
  status: number
  children?: MenuRecord[]
  createdAt: string
}

const containerClassName = cn('space-y-4')
const cardClassName = cn('shadow-sm')
const tagClassName = cn('inline-flex items-center gap-1')
const actionClassName = cn('flex', 'items-center')
const btnClassName = cn('!px-0.5')
const dividerClassName = cn('mx-0')

const menuTypeColorMap: Record<string, string> = {
  M: 'blue',
  C: 'green',
  F: 'orange',
}

const menuTypeLabelMap: Record<string, string> = {
  M: '目录',
  C: '菜单',
  F: '按钮',
}

const statusColorMap: Record<number, string> = {
  1: 'green',
  0: 'red',
}

const statusLabelMap: Record<number, string> = {
  1: '正常',
  0: '停用',
}

function convertFrontendMenusToRecords(menus: MenuConfig[], parentId: number | null, startId: number): { records: MenuRecord[], nextId: number } {
  const result: MenuRecord[] = []
  let currentId = startId
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

  for (const menu of menus) {
    const record: MenuRecord = {
      id: currentId++,
      menuName: menu.title,
      icon: menu.icon || '',
      orderNum: 0,
      perms: '',
      path: menu.path,
      component: menu.component || '',
      menuType: menu.children?.length ? 'M' : 'C',
      parentId,
      status: 1,
      createdAt: now,
    }
    result.push(record)

    if (menu.children && menu.children.length > 0) {
      const { records: childRecords, nextId } = convertFrontendMenusToRecords(menu.children, record.id, currentId)
      result.push(...childRecords)
      currentId = nextId
    }
  }

  return { records: result, nextId: currentId }
}

function flattenMenuTree(tree: MenuRecord[]): MenuRecord[] {
  const result: MenuRecord[] = []
  function walk(nodes: MenuRecord[]) {
    for (const node of nodes) {
      result.push(node)
      if (node.children && node.children.length > 0) {
        walk(node.children)
      }
    }
  }
  walk(tree)
  return result
}

const { records: initialRecords } = convertFrontendMenusToRecords(frontendMenus, null, 1)
const allData = ref<MenuRecord[]>(rebuildTree(initialRecords))

function rebuildTree(flat: MenuRecord[]): MenuRecord[] {
  const map = new Map<number, MenuRecord>()
  const roots: MenuRecord[] = []

  for (const item of flat) {
    map.set(item.id, { ...item, children: [] })
  }

  for (const item of flat) {
    const node = map.get(item.id)!
    if (item.parentId === null) {
      roots.push(node)
    }
    else {
      const parent = map.get(item.parentId)
      if (parent) {
        parent.children = parent.children || []
        parent.children.push(node)
      }
    }
  }

  return roots
}

const isEditing = ref(false)
const currentRecord = ref<MenuRecord | null>(null)

const [drawerRegister, drawerMethods] = useDrawer()
const [tableRegister, tableMethods] = useTable()
const [formRegister, formMethods] = useForm()

function getParentTreeOptions(): any[] {
  const flat = flattenMenuTree(allData.value)
  const filtered = flat.filter(i => i.menuType === 'M' || i.menuType === 'C')

  const map = new Map<number, any>()
  for (const item of filtered) {
    map.set(item.id, {
      label: item.menuName,
      value: item.id,
    })
  }

  const roots: any[] = []
  for (const item of filtered) {
    const node = map.get(item.id)!
    if (item.parentId === null) {
      roots.push(node)
    }
    else {
      const parent = map.get(item.parentId)
      if (parent) {
        parent.children = parent.children || []
        parent.children.push(node)
      }
    }
  }

  return roots
}

const searchFormSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    componentProps: {
      placeholder: '搜索菜单名称/权限标识...',
      allowClear: true,
    },
    colProps: { span: 8 },
  },
  {
    field: 'menuType',
    label: '菜单类型',
    component: 'Select',
    componentProps: {
      placeholder: '选择类型',
      allowClear: true,
      options: [
        { label: '目录', value: 'M' },
        { label: '菜单', value: 'C' },
        { label: '按钮', value: 'F' },
      ],
    },
    colProps: { span: 8 },
  },
]

const drawerFormSchemas: FormSchema[] = [
  {
    field: 'menuType',
    label: '菜单类型',
    component: 'RadioGroup',
    colProps: { span: 24 },
    componentProps: {
      optionType: 'button',
      buttonStyle: 'solid',
      options: [
        { label: '目录', value: 'M' },
        { label: '菜单', value: 'C' },
        { label: '按钮', value: 'F' },
      ],
    },
  },
  {
    field: 'parentId',
    label: '上级菜单',
    component: 'TreeSelect',
    colProps: { span: 24 },
    componentProps: {
      treeData: getParentTreeOptions(),
      placeholder: '请选择上级菜单（留空为顶级）',
      allowClear: true,
      treeDefaultExpandAll: true,
    },
  },
  {
    field: 'menuName',
    label: '菜单名称',
    component: 'Input',
    required: true,
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入菜单名称' },
  },
  {
    field: 'icon',
    label: '图标',
    component: 'Input',
    colProps: { span: 24 },
    slot: 'iconPicker',
    componentProps: { placeholder: '点击选择图标', readonly: true },
  },
  {
    field: 'path',
    label: '路由地址',
    component: 'Input',
    colProps: { span: 24 },
    componentProps: { placeholder: '例如：/system/user' },
    dynamicDisabled: ({ model }) => {
      const mt = (model as any).menuType || 'M'
      return mt === 'F'
    },
  },
  {
    field: 'component',
    label: '组件路径',
    component: 'Input',
    colProps: { span: 24 },
    componentProps: { placeholder: '例如：system/user/index' },
    dynamicDisabled: ({ model }) => {
      const mt = (model as any).menuType || 'M'
      return mt !== 'C'
    },
  },
  {
    field: 'perms',
    label: '权限标识',
    component: 'Input',
    colProps: { span: 24 },
    componentProps: { placeholder: '例如：system:user:list' },
    dynamicDisabled: ({ model }) => {
      const mt = (model as any).menuType || 'M'
      return mt === 'M'
    },
  },
  {
    field: 'orderNum',
    label: '排序',
    component: 'InputNumber',
    colProps: { span: 24 },
    componentProps: {
      min: 0,
      placeholder: '请输入排序号',
      style: { width: '100%' },
    },
  },
  {
    field: 'status',
    label: '状态',
    component: 'RadioGroup',
    colProps: { span: 24 },
    defaultValue: 1,
    componentProps: {
      optionType: 'button',
      buttonStyle: 'solid',
      options: [
        { label: '正常', value: 1 },
        { label: '停用', value: 0 },
      ],
    },
  },
]

async function mockApi(params: Record<string, any>) {
  const { keyword, menuType } = params
  const flat = flattenMenuTree(allData.value)
  let filtered = [...flat]

  if (keyword) {
    const kw = String(keyword).toLowerCase()
    filtered = filtered.filter(
      i => i.menuName.toLowerCase().includes(kw)
        || i.perms.toLowerCase().includes(kw),
    )
  }

  if (menuType) {
    filtered = filtered.filter(i => i.menuType === menuType)
  }

  const tree = rebuildTree(filtered)
  return { items: tree, total: tree.length }
}

function handleAdd() {
  isEditing.value = false
  currentRecord.value = null
  formMethods.setFieldsValue({
    parentId: undefined,
    menuType: 'M',
    menuName: '',
    icon: '',
    path: '',
    component: '',
    perms: '',
    orderNum: 0,
    status: 1,
  })
  formMethods.clearValidate()
  drawerMethods.openDrawer()
}

function handleAddChild(record: MenuRecord) {
  isEditing.value = false
  currentRecord.value = null
  const childType = record.menuType === 'M' ? 'C' : 'F'
  formMethods.setFieldsValue({
    parentId: record.id,
    menuType: childType,
    menuName: '',
    icon: '',
    path: childType === 'F' ? '' : '',
    component: childType === 'C' ? '' : '',
    perms: '',
    orderNum: 0,
    status: 1,
  })
  formMethods.clearValidate()
  drawerMethods.openDrawer()
}

function handleEdit(record: MenuRecord) {
  isEditing.value = true
  currentRecord.value = record
  formMethods.setFieldsValue({
    parentId: record.parentId ?? undefined,
    menuType: record.menuType,
    menuName: record.menuName,
    icon: record.icon,
    path: record.path,
    component: record.component,
    perms: record.perms,
    orderNum: record.orderNum,
    status: record.status,
  })
  formMethods.clearValidate()
  drawerMethods.openDrawer()
}

function handleDelete(record: MenuRecord) {
  const flat = flattenMenuTree(allData.value)
  const idsToDelete = new Set<number>()

  function collectIds(node: MenuRecord) {
    idsToDelete.add(node.id)
    if (node.children) {
      for (const child of node.children) {
        collectIds(child)
      }
    }
  }

  const target = flat.find(i => i.id === record.id)
  if (target) {
    collectIds(target)
  }

  const remaining = flat.filter(i => !idsToDelete.has(i.id))
  allData.value = rebuildTree(remaining)
  message.success(`已删除菜单：${record.menuName}`)
  tableMethods.value?.reload()
}

async function handleSave() {
  const values = await formMethods.validate()
  if (!values) {
    return
  }

  if (values.menuType === 'M') {
    values.component = ''
    values.perms = ''
  }
  else if (values.menuType === 'F') {
    values.path = ''
    values.component = ''
  }

  if (!values.menuName) {
    message.warning('请填写菜单名称')
    return
  }

  if (values.menuType === 'M' && !values.path) {
    message.warning('目录类型必须填写路由地址')
    return
  }

  if (values.menuType === 'C' && (!values.path || !values.component)) {
    message.warning('菜单类型必须填写路由地址和组件路径')
    return
  }

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
  const flat = flattenMenuTree(allData.value)

  if (isEditing.value && currentRecord.value) {
    const idx = flat.findIndex(i => i.id === currentRecord.value!.id)
    if (idx > -1) {
      flat[idx] = {
        ...flat[idx]!,
        parentId: values.parentId ?? null,
        menuType: values.menuType,
        menuName: values.menuName,
        icon: values.icon,
        path: values.path,
        component: values.component,
        perms: values.perms,
        orderNum: values.orderNum,
        status: values.status,
      }
    }
    allData.value = rebuildTree(flat)
    message.success(`已更新菜单：${values.menuName}`)
  }
  else {
    const newId = Math.max(...flat.map(i => i.id), 0) + 1
    flat.push({
      id: newId,
      parentId: values.parentId ?? null,
      menuType: values.menuType,
      menuName: values.menuName,
      icon: values.icon,
      path: values.path,
      component: values.component,
      perms: values.perms,
      orderNum: values.orderNum,
      status: values.status,
      createdAt: now,
    })
    allData.value = rebuildTree(flat)
    message.success(`已新增菜单：${values.menuName}`)
  }

  drawerMethods.closeDrawer()
  tableMethods.value?.reload()
}

function handleIconSelect(icon: string) {
  formMethods.setFieldsValue({ icon })
}

const columns: BasicColumn[] = [
  { title: '菜单名称', dataIndex: 'menuName', key: 'menuName', width: 200 },
  { title: '图标', dataIndex: 'icon', key: 'icon', width: 70, align: 'center' },
  { title: '排序', dataIndex: 'orderNum', key: 'orderNum', width: 70, align: 'center' },
  { title: '权限标识', dataIndex: 'perms', key: 'perms', width: 180, ellipsis: true },
  { title: '路由地址', dataIndex: 'path', key: 'path', width: 160, ellipsis: true },
  { title: '组件路径', dataIndex: 'component', key: 'component', width: 180, ellipsis: true },
  { title: '类型', dataIndex: 'menuType', key: 'menuType', width: 80, align: 'center' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 170 },
]
</script>

<template>
  <div :class="containerClassName">
    <a-card
      title="菜单管理"
      :class="cardClassName"
    >
      <BasicTable
        :columns="columns"
        :api="mockApi"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
        :is-tree="true"
        children-column-name="children"
        :pagination="false"
        :action-column="{ width: 180, title: '操作', fixed: 'right' }"
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
            新增菜单
          </a-button>
        </template>
        <template #cell-icon="{ record }">
          <Icon
            v-if="record.icon"
            :icon="record.icon"
            class="text-lg"
          />
          <span v-else>-</span>
        </template>

        <template #cell-menuType="{ record }">
          <a-tag :color="menuTypeColorMap[record.menuType] || 'default'">
            <span :class="tagClassName">
              <Icon
                :icon="record.menuType === 'M' ? 'carbon:folder' : record.menuType === 'C' ? 'carbon:document' : 'carbon:cu3'"
              />
              {{ menuTypeLabelMap[record.menuType] || record.menuType }}
            </span>
          </a-tag>
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

    <BasicDrawer
      :title="isEditing ? '编辑菜单' : '新增菜单'"
      :width="640"
      @register="drawerRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="drawerFormSchemas"
        :label-width="80"
        :show-action-button-group="false"
        @register="formRegister"
      >
        <template #iconPicker="{ model, field }">
          <IconPicker
            :model-value="model[field] || ''"
            @update:modelValue="(val: string) => { formMethods.setFieldsValue({ [field]: val }) }"
            @select="handleIconSelect"
          />
        </template>
      </BasicForm>
    </BasicDrawer>
  </div>
</template>
