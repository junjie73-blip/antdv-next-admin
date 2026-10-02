<template>
  <a-drawer
    v-model:open="open"
    :title="`角色绑定 · ${groupName || ''}`"
    :width="560"
    :destroy-on-close="true"
    @after-open-change="onOpenChange"
  >
    <template #extra>
      <a-button type="primary" :loading="saving" @click="handleSave"> 保存 </a-button>
    </template>

    <a-spin :spinning="loading">
      <a-alert type="info" show-icon message="组内成员将自动获得所选角色的权限" class="mb-3" />

      <div v-if="roles.length === 0" class="py-12">
        <a-empty description="暂无可绑定的角色" />
      </div>

      <a-checkbox-group v-else v-model:value="selectedRoleIds" class="w-full">
        <div class="space-y-1">
          <div
            v-for="r in roles"
            :key="r.roleId"
            class="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2.5 hover:bg-gray-50"
          >
            <a-checkbox :value="r.roleId" />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="font-medium text-gray-800">{{ r.roleName }}</span>
                <a-tag>{{ r.roleCode }}</a-tag>
              </div>
            </div>
          </div>
        </div>
      </a-checkbox-group>
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
import { message } from 'antdv-next'
import { ref } from 'vue'

import { getUserRoleOptions } from '~/api/role'

import { assignGroupRoles, getUserGroupDetail, type GroupRole } from '../api'

defineOptions({ name: 'UserGroupRoleDrawer' })

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  groupId: string | null
  groupName: string
}>()

const emit = defineEmits<{ success: [] }>()

const loading = ref(false)
const saving = ref(false)
const roles = ref<GroupRole[]>([])
const selectedRoleIds = ref<string[]>([])

async function loadRoles() {
  loading.value = true
  try {
    const [allRes, detailRes]: any[] = await Promise.all([
      getUserRoleOptions(),
      props.groupId ? getUserGroupDetail(props.groupId) : Promise.resolve(null),
    ])
    const list = allRes?.data ?? allRes ?? []
    roles.value = list.map((r: any) => ({
      roleId: r.value ?? r.roleId,
      roleCode: r.code ?? r.roleCode,
      roleName: r.label ?? r.roleName,
    }))

    const detail = detailRes?.data ?? detailRes
    selectedRoleIds.value = (detail?.roles ?? []).map((r: any) => r.roleId)
  } finally {
    loading.value = false
  }
}

function onOpenChange(v: boolean) {
  if (!v) return
  selectedRoleIds.value = []
  void loadRoles()
}

async function handleSave() {
  if (!props.groupId) return
  saving.value = true
  try {
    await assignGroupRoles(props.groupId, selectedRoleIds.value)
    message.success('保存成功')
    open.value = false
    emit('success')
  } finally {
    saving.value = false
  }
}
</script>
