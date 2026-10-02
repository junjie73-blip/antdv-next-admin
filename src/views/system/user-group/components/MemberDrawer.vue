<template>
  <a-drawer
    v-model:open="open"
    :title="`成员管理 · ${groupName || ''}`"
    :width="720"
    :destroy-on-close="true"
    @after-open-change="onOpenChange"
  >
    <template #extra>
      <a-button type="primary" :disabled="selectedToAdd.length === 0" @click="handleAddMembers">
        添加选中 ({{ selectedToAdd.length }})
      </a-button>
    </template>

    <a-spin :spinning="loading">
      <a-row :gutter="16">
        <!-- 左：当前成员 -->
        <a-col :span="12">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-sm font-medium text-gray-700"> 当前成员（{{ members.length }}） </span>
            <a-button v-if="selectedMembers.length > 0" type="link" danger size="small" @click="handleRemoveMembers">
              移除选中 ({{ selectedMembers.length }})
            </a-button>
          </div>

          <div class="max-h-[520px] min-h-[200px] overflow-y-auto rounded-lg border border-gray-200 p-2">
            <a-empty v-if="members.length === 0" description="暂无成员" class="py-8" />
            <a-checkbox-group v-else v-model:value="selectedMembers" class="w-full">
              <div
                v-for="m in members"
                :key="m.userId"
                class="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50"
              >
                <a-checkbox :value="m.userId" />
                <a-avatar :size="24">
                  {{ (m.realName || m.username || '?').charAt(0) }}
                </a-avatar>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm">{{ m.realName || m.username }}</div>
                  <div class="truncate text-xs text-gray-400">@{{ m.username }}</div>
                </div>
              </div>
            </a-checkbox-group>
          </div>
        </a-col>

        <!-- 右：候选项 -->
        <a-col :span="12">
          <div class="mb-2">
            <a-input-search v-model:value="keyword" placeholder="搜索用户" allow-clear @search="onSearch" />
          </div>

          <div class="max-h-[520px] min-h-[200px] overflow-y-auto rounded-lg border border-gray-200 p-2">
            <a-empty v-if="candidateUsers.length === 0" description="无匹配用户" class="py-8" />
            <a-checkbox-group v-else v-model:value="selectedToAdd" class="w-full">
              <div
                v-for="u in candidateUsers"
                :key="u.value"
                class="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50"
              >
                <a-checkbox :value="u.value" />
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm">{{ u.label }}</div>
                  <div class="truncate text-xs text-gray-400">@{{ u.username }}</div>
                </div>
              </div>
            </a-checkbox-group>
          </div>
        </a-col>
      </a-row>
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
import { message } from 'antdv-next'
import { computed, ref, watch } from 'vue'

import { getUserAllOptions } from '~/api'

import { addGroupMembers, getUserGroupDetail, removeGroupMembers, type GroupMember } from '../api'

defineOptions({ name: 'UserGroupMemberDrawer' })

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  groupId: string | null
  groupName: string
}>()

const emit = defineEmits<{ success: [] }>()

const loading = ref(false)
const members = ref<GroupMember[]>([])
const allUsers = ref<Array<{ label: string; value: string; username: string }>>([])
const keyword = ref('')

const selectedMembers = ref<string[]>([])
const selectedToAdd = ref<string[]>([])

/** 排除已在组的用户 */
const candidateUsers = computed(() => {
  const memberIds = new Set(members.value.map((m) => m.userId))
  const kw = keyword.value.trim().toLowerCase()
  return allUsers.value.filter((u) => {
    if (memberIds.has(u.value)) return false
    if (!kw) return true
    return u.label.toLowerCase().includes(kw) || u.username.toLowerCase().includes(kw)
  })
})

async function loadMembers() {
  if (!props.groupId) return
  loading.value = true
  try {
    const res: any = await getUserGroupDetail(props.groupId)
    const detail = res?.data ?? res
    members.value = detail?.members ?? []
  } finally {
    loading.value = false
  }
}

async function loadUsers() {
  try {
    const res: any = await getUserAllOptions()
    const list = res?.data ?? res ?? []
    allUsers.value = list.map((u: any) => ({
      label: u.realName || u.username,
      value: u.userId,
      username: u.username,
    }))
  } catch {
    /* ignore */
  }
}

function onOpenChange(v: boolean) {
  if (!v) return
  selectedMembers.value = []
  selectedToAdd.value = []
  keyword.value = ''
  void Promise.all([loadMembers(), loadUsers()])
}

function onSearch() {
  /* computed 自动响应 */
}

async function handleAddMembers() {
  if (!props.groupId || selectedToAdd.value.length === 0) return
  await addGroupMembers(props.groupId, selectedToAdd.value)
  message.success(`已添加 ${selectedToAdd.value.length} 名成员`)
  selectedToAdd.value = []
  await loadMembers()
  emit('success')
}

async function handleRemoveMembers() {
  if (!props.groupId || selectedMembers.value.length === 0) return
  await removeGroupMembers(props.groupId, selectedMembers.value)
  message.success(`已移除 ${selectedMembers.value.length} 名成员`)
  selectedMembers.value = []
  await loadMembers()
  emit('success')
}
</script>
