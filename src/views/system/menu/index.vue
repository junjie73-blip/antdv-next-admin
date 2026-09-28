<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { computed, ref } from 'vue'

import { changeMenuStatus } from '~/api'
import { BasicDrawer, useDrawer } from '~/components/business/Drawer'
import { BasicForm, useForm } from '~/components/business/Form'
import { type ActionItem, BasicTable, TableAction, useTable } from '~/components/business/Table'
import IconPicker from '~/components/common/Icon/IconPicker.vue'
import { useCRUD } from '~/composables/useCRUD'
import { DictType } from '~/enums/dict'
import { SYSTEM_PERMS } from '~/enums/permissions'
import { useDictStore } from '~/stores'
import { http } from '~/utils'

import type { MenuRecord, MicroAppConfig } from './types'

import { getMenuActions } from './actions'
import { menuActionColumn, menuColumns, menuRowKey, menuScroll } from './columns'
import PermissionDrawer from './components/PermissionDrawer.vue'
import {
  cardClassName,
  containerClassName,
  MENU_EMPTY_VALUES,
  MENU_TYPE_COLOR_MAP,
  MENU_TYPE_ICON_MAP,
  MENU_TYPE_LABEL_MAP,
  tagClassName,
} from './constants'
import { useMenuFormSchemas } from './schemas'
// 抽离的模块

defineOptions({ name: 'SystemMenu' })

// ========== 字典 ==========
const dictStore = useDictStore()
const statusOptions = computed(() => dictStore.getOptions(DictType.NORMAL_DISABLE))

// ========== 注册实例 ==========
const [drawerRegister, drawerMethods] = useDrawer()
const [tableRegister, tableMethods] = useTable()
const [formRegister, formMethods] = useForm()

// ========== 表单 schema ==========
const drawerFormSchemas = useMenuFormSchemas(statusOptions)

// ========== 表格 API ==========
async function fetchMenuTree() {
  return await http
    .Get('/menu/tree', {
      cacheFor: null,
    })
    .send(true)
}
function flatToMicroApp(values: Record<string, any>): MicroAppConfig | null {
  const { microAppName, microAppUrl, microAppBaseroute, microAppKeepAlive } = values
  // 三个必填都为空则视为"无微应用配置"
  if (!microAppName && !microAppUrl && !microAppBaseroute) return null
  if (!microAppName || !microAppUrl || !microAppBaseroute) return null
  return {
    name: microAppName,
    url: microAppUrl,
    baseroute: microAppBaseroute,
    keepAlive: !!microAppKeepAlive,
  }
}

/** 后端 → 表单：把 microApp 对象拆解为 4 个扁平字段 */
function microAppToFlat(microApp?: MicroAppConfig | null) {
  return {
    microAppName: microApp?.name ?? '',
    microAppUrl: microApp?.url ?? '',
    microAppBaseroute: microApp?.baseroute ?? '',
    microAppKeepAlive: microApp?.keepAlive ?? false,
  }
}

/** 清掉扁平字段，得到真正提交给后端的数据 */
function stripFlatMicroAppFields(values: Record<string, any>) {
  const { microAppName: _n, microAppUrl: _u, microAppBaseroute: _b, microAppKeepAlive: _k, ...rest } = values
  return rest
}
// ========== useCRUD ==========
// 说明：删除确认由操作项 popConfirm 负责，关闭 useCRUD 内置 Modal.confirm。
const { isEditing, handleAdd, handleEdit, handleDelete, handleSave } = useCRUD<MenuRecord>({
  containerType: 'drawer',
  drawerMethods,
  formMethods,
  tableMethods,
  idKey: 'menuId',
  getEmptyValues: () => ({ ...MENU_EMPTY_VALUES }),
  getFormValues: (record) => ({
    parentId: record.parentId,
    menuType: record.menuType,
    menuName: record.menuName,
    icon: record.icon,
    path: record.path,
    component: record.component,
    permission: record.permission,
    sortOrder: record.sortOrder,
    status: record.status,
    isExternal: !!record.isExternal,
    layout: (record.layout as any) ?? null,
    hidden: !!record.hidden,
    keepAlive: !!record.keepAlive,
    ...microAppToFlat(record.microApp),
  }),
  onCreate: async (values) => {
    const microApp = flatToMicroApp(values)
    const payload = {
      ...stripFlatMicroAppFields(values),
      microApp,
    }
    await http.Post('/menu', payload)
  },
  onUpdate: async (id, values) => {
    const microApp = flatToMicroApp(values)
    const payload = {
      ...stripFlatMicroAppFields(values),
      microApp,
    }
    await http.Put(`/menu/${id}`, payload)
  },
  onDelete: async (record) => {
    await http.Delete(`/menu/${record.menuId}`)
  },
  messages: {
    createSuccess: '菜单创建成功',
    updateSuccess: '菜单更新成功',
    deleteSuccess: '菜单删除成功',
  },
})

// ========== 新增子菜单 ==========
async function handleAddChild(record: MenuRecord) {
  await handleAdd({ parentId: record.menuId })
}

// ========== 图标选择 ==========
function handleIconSelect(icon: string) {
  formMethods.setFieldsValue({ icon })
}

// ========== 权限抽屉 ==========
const currentPermissionRecord = ref<MenuRecord>()
const [permissionDrawerRegister, permissionDrawerMethods] = useDrawer()

async function handleAddPermission(record: MenuRecord) {
  currentPermissionRecord.value = record
  await permissionDrawerMethods.openDrawer()
}

async function handlePermissionOk() {
  permissionDrawerMethods.closeDrawer()
  tableMethods.value?.reload()
}
async function handleToggleStatus(record: MenuRecord) {
  try {
    const newStatus = record.status === '1' ? '0' : '1'
    await changeMenuStatus(record.menuId, newStatus)
    message.success(`已${newStatus === '0' ? '停用' : '启用'}：${record.menuName}`)
    tableMethods.value?.reload()
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}
// ========== 操作项 ==========
function getActions(record: MenuRecord): ActionItem[] {
  return getMenuActions(record, {
    onAddChild: handleAddChild,
    onAddPermission: handleAddPermission,
    onEdit: handleEdit,
    onDelete: handleDelete,
  })
}
function getAttributeTags(record: MenuRecord): Array<{ label: string; color: string }> {
  const tags: Array<{ label: string; color: string }> = []
  if (record.microApp) tags.push({ label: `微应用:${record.microApp.name}`, color: 'purple' })
  if (record.isExternal) tags.push({ label: '外链', color: 'cyan' })
  if (record.layout === 'blank') tags.push({ label: '无布局', color: 'gold' })
  if (record.hidden) tags.push({ label: '隐藏', color: 'default' })
  if (record.keepAlive) tags.push({ label: '缓存', color: 'blue' })
  return tags
}
</script>

<template>
  <div :class="containerClassName">
    <a-card :class="cardClassName">
      <BasicTable
        :show-index-column="false"
        :columns="menuColumns"
        :api="fetchMenuTree"
        :immediate="true"
        :use-search-form="false"
        :is-tree="true"
        children-column-name="children"
        :pagination="false"
        :action-column="menuActionColumn"
        :row-key="menuRowKey"
        virtual
        :scroll="menuScroll"
        default-expand-all-rows
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button type="primary" @click="handleAdd()" v-permission="SYSTEM_PERMS.menu.create">
            <template #icon><Icon icon="ant-design:plus-outlined" /></template>
            新增菜单
          </a-button>
        </template>

        <template #cell-icon="{ record }">
          <div class="flex items-center justify-center">
            <Icon v-if="record.icon" :icon="record.icon" class="text-lg" />
            <span v-else>-</span>
          </div>
        </template>
        <template #attributes="{ record }">
          <div class="flex flex-wrap gap-1">
            <Tag v-for="tag in getAttributeTags(record as MenuRecord)" :key="tag.label" :color="tag.color">
              {{ tag.label }}
            </Tag>
            <span v-if="getAttributeTags(record as MenuRecord).length === 0" class="text-gray-400"> - </span>
          </div>
        </template>
        <template #cell-menuType="{ record }">
          <a-tag :color="MENU_TYPE_COLOR_MAP[record.menuType as 1 | 2 | 3] || 'default'">
            <span :class="tagClassName">
              <Icon :icon="MENU_TYPE_ICON_MAP[record.menuType as 1 | 2 | 3] || 'carbon:link'" />
              {{ MENU_TYPE_LABEL_MAP[record.menuType as 1 | 2 | 3] || record.menuType }}
            </span>
          </a-tag>
        </template>

        <template #cell-status="{ record }">
          <a-switch
            :checked="record.status"
            checked-value="1"
            un-checked-value="0"
            @change="handleToggleStatus(record as MenuRecord)"
          ></a-switch>
        </template>

        <template #action="{ record }">
          <TableAction :actions="getActions(record as MenuRecord)" />
        </template>
      </BasicTable>
    </a-card>

    <!-- 菜单编辑抽屉 -->
    <BasicDrawer :title="isEditing ? '编辑菜单' : '新增菜单'" :width="640" @register="drawerRegister" @ok="handleSave">
      <BasicForm
        :schemas="drawerFormSchemas"
        :show-action-button-group="false"
        :grid="{ cols: 1, gutter: 16 }"
        @register="formRegister"
      >
        <template #iconPicker="{ model, field }">
          <IconPicker
            :model-value="model[field] || ''"
            @update:model-value="(val: string) => formMethods.setFieldsValue({ [field]: val })"
            @select="handleIconSelect"
          />
        </template>
      </BasicForm>
    </BasicDrawer>

    <!-- 权限按钮抽屉 -->
    <BasicDrawer title="权限按钮" :width="640" @register="permissionDrawerRegister" @ok="handlePermissionOk">
      <PermissionDrawer :menu="currentPermissionRecord" :visible="permissionDrawerMethods.getVisible()" />
    </BasicDrawer>
  </div>
</template>
