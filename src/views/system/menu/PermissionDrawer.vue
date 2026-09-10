<script setup lang="ts">
import type { FormSchema } from '@/components/business/Form'
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'
import { computed, ref, unref, watch } from 'vue'
import { BasicDrawer, useDrawer } from '@/components/business/Drawer'
import { BasicForm, useForm } from '@/components/business/Form'
import { BasicTable, useTable } from '@/components/business/Table'
import { useCRUD } from '@/composables/useCRUD'
import { http } from '@/utils'
import { cn } from '@/utils/cn'
import { message, type MenuEmits } from 'antdv-next'
import { DictType } from '@/enums/dict'
import { useDictStore } from '@/stores'

defineOptions({ name: 'SystemPermissionButton' })

const props = defineProps<{
  menu: any
  /** 外层抽屉是否可见（用于刷新表格） */
  visible?: boolean
}>()

interface PermissionRecord {
  menuId: string
  menuName: string
  permission: string
  sortOrder: number
  status: string
  menuType?: string
  description?: string
}

// ========== 样式 ==========
const containerClassName = cn('space-y-4 h-full')
const tagClassName = cn('inline-flex items-center gap-1')
const actionClassName = cn('flex', 'items-center', 'justify-center')
const btnClassName = cn('!px-0.5')
const dividerClassName = cn('mx-0')

// ========== 预设常见按钮 ==========
const commonButtons = [
  {
    label: '新增',
    permName: '新增',
    permCode: 'create',
    icon: 'ant-design:plus-outlined',
    key: 'create',
  },
  {
    label: '编辑',
    permName: '编辑',
    permCode: 'update',
    icon: 'ant-design:edit-outlined',
    key: 'update',
  },
  {
    label: '详情',
    permName: '详情',
    permCode: 'detail',
    icon: 'ant-design:info-outlined',
    key: 'detail',
  },
  {
    label: '删除',
    permName: '删除',
    permCode: 'delete',
    icon: 'ant-design:delete-outlined',
    key: 'delete',
  },
  {
    label: '批量删除',
    permName: '批量删除',
    permCode: 'deleteBatch',
    icon: 'ant-design:delete-outlined',
    key: 'deleteBatch',
  },
  {
    label: '导出',
    permName: '导出',
    permCode: 'export',
    icon: 'ant-design:export-outlined',
    key: 'export',
  },
  {
    label: '导入',
    permName: '导入',
    permCode: 'import',
    icon: 'ant-design:import-outlined',
    key: 'import',
  },
]

const dictStore = useDictStore()
const statusOptions = computed(() => dictStore.getOptions(DictType.NORMAL_DISABLE))

// ========== 抽屉和表格注册 ==========
const [drawerRegister, drawerMethods] = useDrawer()
const [tableRegister, tableMethods] = useTable()
const [formRegister, formMethods] = useForm()

// ========== 表单 Schema ==========
const formSchemas: FormSchema[] = [
  {
    field: 'menuName',
    label: '按钮名称',
    component: 'Input',
    required: true,
    componentProps: { placeholder: '请输入按钮名称' },
  },
  {
    field: 'permission',
    label: '权限标识',
    component: 'Input',
    required: true,
    componentProps: { placeholder: '例如：system:user:create' },
  },
  {
    field: 'sortOrder',
    label: '排序',
    component: 'InputNumber',
    componentProps: { min: 0, placeholder: '请输入排序号', style: { width: '100%' } },
  },
  {
    field: 'status',
    label: '状态',
    component: 'RadioGroup',
    defaultValue: '1',
    componentProps: {
      optionType: 'button',
      buttonStyle: 'solid',
      options: unref(statusOptions),
    },
  },
]

// ========== 表格列配置 ==========
const columns: BasicColumn[] = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    align: 'center',
    customRender: ({ index }) => index + 1,
  },
  { title: '按钮名称', dataIndex: 'menuName', key: 'menuName', width: 200 },
  { title: '权限标识', dataIndex: 'permission', key: 'permission', width: 240, ellipsis: true },
  { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder', width: 100, align: 'center' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center' },
]

// ========== 使用 useCRUD ==========
const { isEditing, handleAdd, handleEdit, handleDelete, handleSave } = useCRUD<PermissionRecord>({
  containerType: 'drawer',
  drawerMethods,
  formMethods,
  tableMethods,
  idKey: 'menuId',
  confirmDelete: true,
  getEmptyValues: () => ({
    menuName: '',
    permission: props.menu?.permission ? `${props.menu.permission}:` : '',
    sortOrder: 0,
    status: '1',
  }),
  getFormValues: (record) => ({
    menuName: record.menuName,
    permission: record.permission,
    sortOrder: record.sortOrder,
    status: record.status,
  }),
  onCreate: async (values) => {
    await http.Post('/menu', { ...values, parentId: props.menu.menuId, menuType: 3 })
  },
  onUpdate: async (id, values) => {
    await http.Put(`/menu/${id}`, { ...values, parentId: props.menu.menuId, menuType: 3 })
  },
  onDelete: async (record) => {
    await http.Delete(`/menu/${record.menuId}`)
  },
  messages: {
    createSuccess: '按钮创建成功',
    updateSuccess: '按钮更新成功',
    deleteSuccess: '按钮删除成功',
    deleteConfirm: '确定要删除该按钮权限吗？',
  },
})

// ========== 常见按钮下拉 ==========
const commonSelectValue = ref<string | undefined>(undefined)

const handleCommonSelect: MenuEmits['click'] = async ({ key }) => {
  const common = commonButtons.find((item) => item.key === key)
  if (!common) return
  await handleAdd({
    menuName: common.label,
    permission: props.menu.permission + ':' + common.permCode,
    sortOrder: 0,
    status: '1',
  })
  commonSelectValue.value = undefined
}

// ========== 表格加载 API ==========
async function loadPermissions() {
  if (!props.menu?.menuId) return { list: [], total: 0 }
  return await http
    .Get('/menu/buttons', {
      params: { parentId: props.menu.menuId },
    })
    .send(true)
}

// ========== 监听外层抽屉打开，刷新表格 ==========
watch(
  () => props.visible,
  (newVal) => {
    if (newVal === true && props.menu?.menuId) {
      // 当抽屉变为可见时，重新加载表格数据
      tableMethods.value?.reload()
    }
  },
  { immediate: true }, // 初始加载也会触发，但确保菜单已准备好
)

// 同时监听 menu 变化，刷新表格
watch(
  () => props.menu?.menuId,
  () => {
    if (props.visible === true && props.menu?.menuId) {
      tableMethods.value?.reload()
    }
  },
)
</script>

<template>
  <div :class="containerClassName">
    <!-- 顶部工具栏 -->
    <div class="flex items-center gap-4 mb-4">
      <a-button type="primary" @click="() => handleAdd()">
        <template #icon><Icon icon="ant-design:plus-outlined" /></template>
        新增按钮
      </a-button>

      <a-dropdown
        :menu="{ items: commonButtons }"
        :trigger="['click']"
        arrow
        @menuClick="handleCommonSelect"
      >
        <a @click.prevent>
          <a-button>
            常见按钮
            <DownOutlined />
          </a-button>
        </a>
      </a-dropdown>
    </div>

    <!-- 表格 -->
    <BasicTable
      :columns="columns"
      :api="loadPermissions"
      :immediate="true"
      :use-search-form="false"
      :show-table-setting="false"
      :pagination="{ pageSize: 10 }"
      :action-column="{ width: 180, title: '操作', fixed: 'right' }"
      :row-key="(record) => record.menuId"
      @register="tableRegister"
      :scroll="{ x: 400 }"
    >
      <template #cell-status="{ record }">
        <a-tag :color="record.status === '1' ? 'green' : 'red'">
          <span :class="tagClassName">
            <Icon
              :icon="record.status === '1' ? 'carbon:checkmark-outline' : 'carbon:close-outline'"
            />
            {{ record.status === '1' ? '启用' : '禁用' }}
          </span>
        </a-tag>
      </template>

      <template #action="{ record }">
        <div :class="actionClassName">
          <a-button type="link" :class="btnClassName" @click="() => handleEdit(record)">
            <template #icon><Icon icon="ant-design:edit-outlined" /></template>
            编辑
          </a-button>
          <a-divider type="vertical" :class="dividerClassName" />
          <a-button type="link" danger :class="btnClassName" @click="() => handleDelete(record)">
            <template #icon><Icon icon="ant-design:delete-outlined" /></template>
            删除
          </a-button>
        </div>
      </template>
    </BasicTable>

    <!-- 新增/编辑抽屉 -->
    <BasicDrawer
      :title="isEditing ? '编辑按钮' : '新增按钮'"
      :width="520"
      @register="drawerRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="formSchemas"
        :label-width="100"
        :show-action-button-group="false"
        :grid="{ cols: 1, gutter: 16 }"
        @register="formRegister"
      />
    </BasicDrawer>
  </div>
</template>
