<script setup lang="ts">
import type { BackendMenu, MenuConfig, MicroAppConfig } from '@antdv/types'
import type { FormSchema } from '~/components/business/Form'
import type { BasicColumn } from '~/components/business/Table'

import { computed, ref, watch } from 'vue'

import { cn } from '@antdv/shared/cn'
import { IconPicker } from '@antdv/ui/icon';
import { Icon } from '@iconify/vue'
import { BasicDrawer, useDrawer } from '~/components/business/Drawer'
import { BasicForm, useForm } from '~/components/business/Form'
import { BasicTable, useTable } from '~/components/business/Table'
import { DictType } from '~/enums/dict'
import { useDictStore, useRouteStore } from '~/stores'

defineOptions({ name: 'SystemMenu' })

interface MenuRecord {
  id: number
  /** 回到源数据的锚点：菜单是"权限来源"，本页的改动要能写回这一棵树 */
  sourceName?: string
  menuName: string
  icon: string
  orderNum: number
  perms: string
  path: string
  component: string
  menuType: 'C' | 'F' | 'L' | 'M' | 'MICRO'
  parentId: null | number
  status: number
  /** 是否出现在导航里。`hidden` 只影响导航，不影响访问权限（菜单即权限）。 */
  hidden?: boolean
  linkUrl?: string
  microAppConfig?: MicroAppConfig
  children?: MenuRecord[]
  createdAt: string
}

const containerClassName = cn('space-y-4')
const cardClassName = cn('shadow-sm')
const tagClassName = cn('inline-flex items-center gap-1')
const actionClassName = cn('flex', 'items-center', 'justify-center')
const btnClassName = cn('px-0.5!')
const dividerClassName = cn('mx-0')

const menuTypeColorMap: Record<string, string> = {
  M: 'blue',
  C: 'green',
  F: 'orange',
  L: 'purple',
}

const menuTypeLabelMap: Record<string, string> = {
  M: '目录',
  C: '菜单',
  F: '按钮',
  L: '链接',
}

const statusColorMap: Record<number, string> = {
  1: 'green',
  0: 'red',
}

const statusLabelMap: Record<number, string> = {
  1: '正常',
  0: '停用',
}

const dictStore = useDictStore()

const statusOptions = computed(() =>
  dictStore.getOptions(DictType.NORMAL_DISABLE),
)

/**
 * 后端菜单树 → 表格记录。
 *
 * 数据源换掉了：这里以前读 `~/router/menus` 的 `frontendMenus`，
 * 那是"前端静态菜单"时代的产物，混合布局 + 菜单即权限改造后它恒为空数组，
 * 于是菜单管理页整张表永远是空的 —— 巡检时看起来像"页面坏了"。
 *
 * 现在按两张树分工：**字段取源树**（`store.backendMenus`，后端下发的原始契约，
 * menuType/sortOrder/status/component/perms 这些后台元数据只在这里有），
 * **路由地址取派生树**（`store.menus`，`attachMenuPaths` 按路由表补全后的结果）。
 * 目录节点在后端常写成空 path，只有派生树里才有真实前缀 ——
 * 表格若直接显示源树的空串，复制出去的链接就是死的。
 */
function convertBackendMenus(
  list: BackendMenu[],
  resolvedPaths: Map<string, string>,
  parentId: null | number,
  startId: number,
): { records: MenuRecord[]; nextId: number } {
  const result: MenuRecord[] = []
  let currentId = startId
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  for (const [index, menu] of list.entries()) {
    const children = menu.children?.filter(Boolean) ?? []
    // 后端只给 name 时（或目录写成空串）用派生树补出来的完整 path
    const path = menu.path || (menu.name ? resolvedPaths.get(menu.name) : '') || ''
    const record: MenuRecord = {
      id: currentId++,
      sourceName: menu.name,
      menuName: menu.menuName ?? menu.name ?? '',
      icon: menu.icon || '',
      orderNum: menu.sortOrder ?? index + 1,
      perms: menu.permission ?? '',
      path,
      component: menu.component ?? '',
      // 后端没标 menuType 时按结构判定：外链单独成类，有孩子的是目录，叶子是页面菜单
      menuType: menu.isExternal
        ? 'L'
        : (MENU_TYPE_BY_CODE[menu.menuType ?? 0] ??
          (children.length ? 'M' : 'C')),
      parentId,
      // 「状态」是菜单本身的启停（'0' 停用）；导航显隐是另一回事，看 hidden
      status: menu.status === '0' ? 0 : 1,
      hidden: menu.hidden === true,
      linkUrl: menu.isExternal ? path : '',
      createdAt: now,
    }
    result.push(record)

    if (children.length > 0) {
      const { records: childRecords, nextId } = convertBackendMenus(
        children,
        resolvedPaths,
        record.id,
        currentId,
      )
      result.push(...childRecords)
      currentId = nextId
    }
  }

  return { records: result, nextId: currentId }
}

/** `BackendMenu.menuType` 是数字编码（1-目录 2-菜单 3-按钮） */
const MENU_TYPE_BY_CODE: Record<number, MenuRecord['menuType']> = {
  1: 'M',
  2: 'C',
  3: 'F',
}

/** 派生树摊平成 `{ name: 完整 path }`，供源树补写路由地址 */
function collectResolvedPaths(
  list: MenuConfig[],
  out = new Map<string, string>(),
): Map<string, string> {
  for (const menu of list) {
    if (menu.name && menu.path) out.set(menu.name, menu.path)
    if (menu.children?.length) collectResolvedPaths(menu.children, out)
  }
  return out
}

const routeStore = useRouteStore()

/**
 * 菜单是异步拉的（守卫里 `initRoutes` 才把树落到 store），本页又可能被
 * keep-alive 缓存，所以首屏建一次 + 到位后再铺一次。
 * 只建一次的话，从别的页切回来时数据已经在了但表格还拿着上一次的空快照，
 * 表现就是"首屏空表，点一下树节点才有数据"。
 */
function buildRecords(): MenuRecord[] {
  return rebuildTree(
    convertBackendMenus(
      routeStore.backendMenus,
      collectResolvedPaths(routeStore.menus),
      null,
      1,
    ).records,
  )
}

const allData = ref<MenuRecord[]>(buildRecords())

/**
 * `recompute()` 每次都会重新赋值 `menus`（新数组身份），源树 `backendMenus`
 * 则是就地改 `hidden` —— 所以监听派生树即可覆盖"首次加载"和"开关拨动"两种变化。
 */
watch(
  () => routeStore.menus,
  () => {
    allData.value = buildRecords()
    tableMethods.value?.reload()
  },
)

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
    } else {
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
  const filtered = flat.filter((i) => i.menuType === 'M' || i.menuType === 'C')

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
    } else {
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
        { label: '链接', value: 'L' },
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
    defaultValue: 'C',
    componentProps: {
      optionType: 'button',
      buttonStyle: 'solid',
      options: [
        { label: '目录', value: 'M' },
        { label: '菜单', value: 'C' },
        { label: '按钮', value: 'F' },
        { label: '链接', value: 'L' },
      ],
    },
  },
  {
    field: 'parentId',
    label: '上级菜单',
    component: 'TreeSelect',
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
    componentProps: { placeholder: '请输入菜单名称' },
  },
  {
    field: 'icon',
    label: '图标',
    component: 'Input',
    slot: 'iconPicker',
    componentProps: { placeholder: '点击选择图标', readonly: true },
    dynamicDisabled: ({ model }) => {
      const mt = (model as any).menuType || 'M'
      return mt === 'F'
    },
  },
  {
    field: 'path',
    label: '路由地址',
    component: 'Input',
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
    componentProps: { placeholder: '例如：system/user/index' },
    dynamicDisabled: ({ model }) => {
      const mt = (model as any).menuType || 'M'
      return mt !== 'C'
    },
  },
  {
    field: 'linkUrl',
    label: '链接地址',
    component: 'Input',
    componentProps: {
      placeholder: '外部或微前端链接地址，如 https://crm.example.com',
    },
    ifShow: ({ model }) => {
      return (model as any).menuType === 'L'
    },
  },
  {
    field: 'perms',
    label: '权限标识',
    component: 'Input',
    componentProps: { placeholder: '例如：system:user:list' },
    dynamicDisabled: ({ model }) => {
      const mt = (model as any).menuType || 'M'
      return mt === 'M' || mt === 'L'
    },
  },
  {
    field: 'orderNum',
    label: '排序',
    component: 'InputNumber',
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
    defaultValue: 0,
    componentProps: () => ({
      optionType: 'button',
      buttonStyle: 'solid',
      options: statusOptions.value,
    }),
  },
]

/**
 * 命中项的祖先链一并留下。
 *
 * `rebuildTree` 只认"父亲也在这批数据里"的节点：父亲不在就把孩子当孤儿丢掉。
 * 于是按关键词搜「用户管理」会得到一张**空表**——命中的是子菜单，
 * 它的父级「系统管理」被关键词过滤掉了，整条链自己把自己筛没了。
 * 表格是层级视图而不是平铺列表，搜索必须把祖先补回来才看得见结果。
 */
function withAncestors(flat: MenuRecord[], matched: MenuRecord[]): MenuRecord[] {
  if (matched.length === 0 || matched.length === flat.length) return matched

  const byId = new Map(flat.map((item) => [item.id, item]))
  const keep = new Set(matched.map((item) => item.id))

  for (const item of matched) {
    let parent = item.parentId == null ? undefined : byId.get(item.parentId)
    // 向上补链；遇到已经在集合里的祖先就停，天然防环
    while (parent && !keep.has(parent.id)) {
      keep.add(parent.id)
      parent = parent.parentId == null ? undefined : byId.get(parent.parentId)
    }
  }

  // 按原表顺序输出，保证层级重建后的父子次序与折叠态稳定
  return flat.filter((item) => keep.has(item.id))
}

async function mockApi(params: Record<string, any>) {
  const { keyword, menuType } = params
  const flat = flattenMenuTree(allData.value)
  let filtered = [...flat]

  if (keyword) {
    const kw = String(keyword).toLowerCase()
    filtered = filtered.filter(
      (i) =>
        i.menuName.toLowerCase().includes(kw) ||
        i.perms.toLowerCase().includes(kw),
    )
  }

  if (menuType) {
    filtered = filtered.filter((i) => i.menuType === menuType)
  }

  const tree = rebuildTree(withAncestors(flat, filtered))
  return { items: tree, total: tree.length }
}

function handleAdd() {
  isEditing.value = false
  currentRecord.value = null
  formMethods.setFieldsValue({
    parentId: undefined,
    menuType: 'C',
    menuName: '',
    icon: '',
    path: '',
    component: '',
    perms: '',
    orderNum: 0,
    status: 0,
    linkUrl: '',
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
    status: 0,
    linkUrl: '',
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
    linkUrl: (record as any).linkUrl || '',
  })
  formMethods.clearValidate()
  drawerMethods.openDrawer()
}

/** 一个菜单节点底下挂了多少子孙（目录 → 菜单 → 按钮是三层） */
function countDescendants(node: MenuRecord): number {
  if (!node.children?.length) return 0
  return node.children.reduce(
    (sum, child) => sum + 1 + countDescendants(child),
    0,
  )
}

/**
 * 删除确认文案。
 *
 * 删目录会连带整棵子树一起没，只报一个名字太轻描淡写 ——
 * 用户以为删掉的是手上这一行，实际少了十几项。把数量摊开说清楚。
 */
function deleteConfirmTitle(record: MenuRecord): string {
  const childCount = countDescendants(record)
  return childCount > 0
    ? `确定删除菜单「${record.menuName}」及其 ${childCount} 个子项吗？删除后不可恢复。`
    : `确定删除菜单「${record.menuName}」吗？删除后不可恢复。`
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

  const target = flat.find((i) => i.id === record.id)
  if (target) {
    collectIds(target)
  }

  const remaining = flat.filter((i) => !idsToDelete.has(i.id))
  allData.value = rebuildTree(remaining)
  // 说清楚到底删了多少：只报一个菜单名，用户会以为刚才那一行就是全部
  const deleted = Math.max(idsToDelete.size - 1, 0)
  message.success(
    deleted > 0
      ? `已删除菜单「${record.menuName}」及 ${deleted} 个子项`
      : `已删除菜单「${record.menuName}」`,
  )
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
    values.linkUrl = ''
  } else if (values.menuType === 'F') {
    values.path = ''
    values.component = ''
    values.linkUrl = ''
  } else if (values.menuType === 'L') {
    values.component = ''
    values.perms = ''
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

  if (values.menuType === 'L' && !values.linkUrl) {
    message.warning('链接类型必须填写链接地址')
    return
  }

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const flat = flattenMenuTree(allData.value)

  if (isEditing.value && currentRecord.value) {
    const idx = flat.findIndex((i) => i.id === currentRecord.value!.id)
    if (idx !== -1) {
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
        linkUrl: values.linkUrl || '',
      }
    }
    allData.value = rebuildTree(flat)
    message.success(`已更新菜单：${values.menuName}`)
  } else {
    const newId = Math.max(...flat.map((i) => i.id), 0) + 1
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
      linkUrl: values.linkUrl || '',
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

/**
 * 「导航」列的开关：直接改权限树上的 `hidden`。
 *
 * 这一列和「状态」不是一回事，别混：状态是菜单本身的启停（业务字段），
 * 导航是"要不要在侧栏/顶栏占一格"。而且拨下去只是**不显示**，
 * 页面本身仍可直达 —— 这是"菜单即权限"里 hidden 的语义
 * （`stores/modules/route.ts` 的授权集合从完整树摊出来，裁剪只动注册表）。
 *
 * 表格不用手动重铺：`setMenuHidden` 会重算派生树，`watch(() => routeStore.menus)`
 * 跟着把新 hidden 铺回行里；这里只负责把结论说给用户听。
 */
function handleToggleNav(record: MenuRecord, checked: boolean) {
  const name = record.sourceName
  if (!name) {
    message.warning('该菜单缺少 name，无法定位源数据')
    return
  }
  if (!routeStore.setMenuHidden(name, !checked)) {
    message.error('菜单数据已变化，请刷新后重试')
    return
  }
  message.success(
    checked
      ? `已把「${record.menuName}」加入导航`
      : `已从导航隐藏「${record.menuName}」（页面仍可直达）`,
  )
}

const columns: BasicColumn[] = [
  {
    title: '#',
    key: 'index',
    width: 60,
    align: 'center',
    customRender: ({ index }) => index + 1,
  },
  { title: '菜单名称', dataIndex: 'menuName', key: 'menuName', width: 200 },
  { title: '图标', dataIndex: 'icon', key: 'icon', width: 70, align: 'center' },
  {
    title: '排序',
    dataIndex: 'orderNum',
    key: 'orderNum',
    width: 70,
    align: 'center',
  },
  {
    title: '权限标识',
    dataIndex: 'perms',
    key: 'perms',
    width: 180,
    ellipsis: true,
  },
  {
    title: '路由地址',
    dataIndex: 'path',
    key: 'path',
    width: 160,
    ellipsis: true,
  },
  {
    title: '组件路径',
    dataIndex: 'component',
    key: 'component',
    width: 180,
    ellipsis: true,
  },
  {
    title: '类型',
    dataIndex: 'menuType',
    key: 'menuType',
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
    title: '导航',
    dataIndex: 'hidden',
    key: 'hidden',
    width: 90,
    align: 'center',
  },
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
    <a-card title="菜单管理" :class="cardClassName">
      <BasicTable
        :columns="columns"
        :api="mockApi"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
        :is-tree="true"
        children-column-name="children"
        :pagination="false"
        :action-column="{ width: 280, title: '操作', fixed: 'right' }"
        :scroll="{ x: 1500 }"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button type="primary" @click="handleAdd">
            <template #icon>
              <Icon icon="ant-design:plus-outlined" />
            </template>
            新增菜单
          </a-button>
        </template>
        <template #cell-icon="{ record }">
          <div class="flex items-center justify-center">
            <Icon v-if="record.icon" :icon="record.icon" class="text-lg" />
            <span v-else>-</span>
          </div>
        </template>

        <template #cell-menuType="{ record }">
          <a-tag :color="menuTypeColorMap[record.menuType] || 'default'">
            <span :class="tagClassName">
              <Icon
                :icon="
                  record.menuType === 'M'
                    ? 'carbon:folder'
                    : record.menuType === 'C'
                      ? 'carbon:document'
                      : record.menuType === 'F'
                        ? 'carbon:cu3'
                        : 'carbon:link'
                "
              />
              {{ menuTypeLabelMap[record.menuType] || record.menuType }}
            </span>
          </a-tag>
        </template>

        <template #cell-status="{ record }">
          <a-tag :color="statusColorMap[record.status] || 'default'">
            <span :class="tagClassName">
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

        <!--
          「导航」列用开关而不是标签：这一列的语义就是"能不能在这里改它"。
          `checked` 取反（hidden → 关），关掉的行不会从侧栏/顶栏消失，
          页面本身仍可直达，所以提示里写清楚，别让人以为是把页面下了线。
        -->
        <template #cell-hidden="{ record }">
          <a-switch
            :checked="!record.hidden"
            size="small"
            @change="
              (checked: boolean) =>
                handleToggleNav(record as MenuRecord, checked)
            "
          />
        </template>

        <template #action="{ record }">
          <div :class="actionClassName">
            <a-button
              type="link"
              :class="btnClassName"
              @click="() => handleAddChild(record as MenuRecord)"
            >
              <template #icon>
                <Icon icon="ant-design:plus-circle-outlined" />
              </template>
              新增
            </a-button>
            <a-button
              type="link"
              :class="btnClassName"
              @click="() => handleEdit(record as MenuRecord)"
            >
              <template #icon>
                <Icon icon="ant-design:edit-outlined" />
              </template>
              编辑
            </a-button>
            <a-divider type="vertical" :class="dividerClassName" />
            <!--
              删除是连带子树的，且没有回收站 —— 一刀下去可能十几项没了。
              这种操作不能点到就生效，必须有一次把影响面说清楚的确认。
            -->
            <a-popconfirm
              :title="deleteConfirmTitle(record as MenuRecord)"
              ok-text="删除"
              ok-type="danger"
              cancel-text="取消"
              @confirm="() => handleDelete(record as MenuRecord)"
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
        :grid="{ cols: 1, gutter: 16 }"
        @register="formRegister"
      >
        <template #iconPicker="{ model, field }">
          <IconPicker
            :model-value="model[field] || ''"
            @update:model-value="
              (val: string) => {
                formMethods.setFieldsValue({ [field]: val })
              }
            "
            @select="handleIconSelect"
          />
        </template>
      </BasicForm>
    </BasicDrawer>
  </div>
</template>
