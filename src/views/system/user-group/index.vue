<template>
  <div :class="containerClassName">
    <a-card :class="cardClassName" :bordered="false">
      <BasicTable
        :columns="userGroupColumns"
        :api="getUserGroupList"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchSchemas, labelWidth: 80 }"
        :action-column="actionColumn"
        :pagination="pagination"
        :row-key="rowKey"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button type="primary" v-permission="SYSTEM_PERMS.userGroup.create" @click="handleAdd">
            <template #icon><Icon icon="lucide:plus" class="h-4 w-4" /></template>
            新增用户组
          </a-button>
        </template>

        <template #cell-groupType="{ record }">
          <a-tag :color="GROUP_TYPE_MAP[record.groupType]?.color">
            {{ GROUP_TYPE_MAP[record.groupType]?.label ?? record.groupType }}
          </a-tag>
        </template>

        <template #cell-status="{ record }">
          <a-tag :color="STATUS_MAP[record.status]?.color">
            {{ STATUS_MAP[record.status]?.label ?? record.status }}
          </a-tag>
        </template>

        <template #cell-createdAt="{ record }">
          <span class="text-gray-600">
            {{ dayjs(record.createdAt).format('YYYY-MM-DD HH:mm') }}
          </span>
        </template>

        <template #action="{ record }">
          <TableAction :actions="getUserGroupActions(record, actionCtx)" />
        </template>
      </BasicTable>
    </a-card>

    <!-- 创建/编辑抽屉 -->
    <BasicDrawer
      :title="isEditing ? '编辑用户组' : '新增用户组'"
      :width="540"
      @register="drawerRegister"
      @ok="handleSave"
    >
      <BasicForm :schemas="formSchemas" :label-width="90" :show-action-button-group="false" @register="formRegister" />
    </BasicDrawer>

    <!-- 成员管理 -->
    <MemberDrawer
      v-model:open="memberOpen"
      :group-id="currentGroupId"
      :group-name="currentGroupName"
      @success="onMemberSuccess"
    />

    <!-- 角色管理 -->
    <RoleDrawer
      v-model:open="roleOpen"
      :group-id="currentGroupId"
      :group-name="currentGroupName"
      @success="onRoleSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { ref } from 'vue'

import { useDrawer } from '~/components'
import BasicDrawer from '~/components/business/Drawer/BasicDrawer.vue'
import { BasicForm, useForm } from '~/components/business/Form'
import { BasicTable, TableAction, useTable } from '~/components/business/Table'
import { useCRUD } from '~/composables/useCRUD'
import { SYSTEM_PERMS } from '~/enums/permissions'
import dayjs from '~/utils/dayjs'

import type { UserGroupActionContext, UserGroupRecord } from './types'

import { getUserGroupActions } from './actions'
import { createUserGroup, deleteUserGroup, getUserGroupDetail, getUserGroupList, updateUserGroup } from './api'
import { actionColumn, pagination, rowKey, userGroupColumns } from './columns'
import MemberDrawer from './components/MemberDrawer.vue'
import RoleDrawer from './components/RoleDrawer.vue'
import { GROUP_TYPE_MAP, STATUS_MAP, cardClassName, containerClassName } from './constants'
import { formSchemas, searchSchemas } from './schemas'

defineOptions({ name: 'SystemUserGroup' })

/* ============================================================
 * 表格 + 抽屉 + 表单
 * ============================================================ */
const [tableRegister, tableMethods] = useTable()
const [drawerRegister, drawerMethods] = useDrawer()
const [formRegister, formMethods] = useForm()

const memberOpen = ref(false)
const roleOpen = ref(false)
const currentGroupId = ref<string | null>(null)
const currentGroupName = ref<string>('')

/* ============================================================
 * useCRUD
 * ============================================================ */
const { isEditing, handleAdd, handleEdit, handleDelete, handleSave } = useCRUD<UserGroupRecord>({
  containerType: 'drawer',
  drawerMethods,
  formMethods,
  tableMethods,
  idKey: 'groupId',
  onFetchDetail: async (id) => await getUserGroupDetail(id),
  getEmptyValues: () => ({
    groupCode: '',
    groupName: '',
    description: '',
    groupType: 'custom',
    sortOrder: 0,
    status: '1',
  }),
  getFormValues: (r) => ({
    groupCode: r.groupCode,
    groupName: r.groupName,
    description: r.description ?? '',
    groupType: r.groupType,
    sortOrder: r.sortOrder,
    status: r.status,
  }),
  onCreate: async (v) => {
    await createUserGroup(v)
  },
  onUpdate: async (id, v) => {
    // ⚠️ 编辑时不要提交 groupCode（后端 Schema 不接受）
    const { groupCode: _ignore, ...rest } = v
    await updateUserGroup(id, rest)
  },
  onDelete: async (r) => {
    await deleteUserGroup(r.groupId)
  },
  messages: {
    createSuccess: '用户组创建成功',
    updateSuccess: '用户组更新成功',
    deleteSuccess: '用户组删除成功',
  },
})

/* ============================================================
 * 行操作
 * ============================================================ */
const actionCtx: UserGroupActionContext = {
  onEdit: handleEdit,
  onDelete: handleDelete,
  onMembers(record) {
    currentGroupId.value = record.groupId
    currentGroupName.value = record.groupName
    memberOpen.value = true
  },
  onRoles(record) {
    currentGroupId.value = record.groupId
    currentGroupName.value = record.groupName
    roleOpen.value = true
  },
}

async function onMemberSuccess() {
  await tableMethods.value?.reload?.()
}

async function onRoleSuccess() {
  await tableMethods.value?.reload?.()
  message.success('角色绑定已更新，成员权限将在下次请求生效')
}
</script>
