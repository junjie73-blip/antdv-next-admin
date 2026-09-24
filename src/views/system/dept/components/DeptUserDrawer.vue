<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { ref, watch } from 'vue'

import { getDeptUsers, getUserAllOptions, updateDeptUsers } from '~/api'

import type { DeptRecord } from '../types'

defineOptions({ name: 'DeptUserDrawer' })

const props = defineProps<{
  open: boolean
  dept: DeptRecord | null
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  saved: []
}>()

const loading = ref(false)
const saving = ref(false)
const selectedUserIds = ref<string[]>([])
const userOptions = ref<{ label: string; value: string }[]>([])

async function load() {
  if (!props.dept) return
  loading.value = true
  try {
    const [users, all] = await Promise.all([getDeptUsers(props.dept.deptId), getUserAllOptions()])
    const allList = (all as { data?: unknown[] })?.data ?? all ?? []
    userOptions.value = (allList as any[]).map((u) => ({
      label: u.username || u.label,
      value: u.userId || u.value,
    }))
    selectedUserIds.value = (users as any[]).map((u) => u.userId ?? u)
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!props.dept) return
  saving.value = true
  try {
    await updateDeptUsers(props.dept.deptId, selectedUserIds.value)
    message.success('已保存')
    emit('saved')
    emit('update:open', false)
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function close() {
  emit('update:open', false)
}

watch(
  () => props.open,
  (v) => {
    if (v) void load()
  },
)
</script>

<template>
  <a-drawer
    :open="open"
    :title="`分配用户 - ${dept?.deptName || ''}`"
    :width="520"
    :footer="null"
    placement="right"
    :destroy-on-close="true"
    @close="close"
  >
    <div class="flex h-full flex-col gap-4">
      <!-- 信息提示 -->
      <div
        class="rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-600 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-400"
      >
        <div class="flex items-start gap-2">
          <Icon icon="carbon:information" class="mt-0.5 shrink-0 text-sm" />
          <div>
            <div class="font-medium">批量分配用户到该部门</div>
            <div class="mt-0.5 opacity-80">已选 {{ selectedUserIds.length }} / {{ userOptions.length }} 人</div>
          </div>
        </div>
      </div>

      <!-- 选择器 -->
      <div class="min-h-0 flex-1">
        <a-spin :spinning="loading">
          <a-select
            v-model:value="selectedUserIds"
            mode="multiple"
            placeholder="搜索并选择用户"
            :options="userOptions"
            :max-tag-count="10"
            show-search
            allow-clear
            :filter-option="(input: string, opt: any) => String(opt.label).toLowerCase().includes(input.toLowerCase())"
            class="w-full"
          />
        </a-spin>
      </div>

      <!-- 底部操作 -->
      <div class="flex shrink-0 justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
        <a-button @click="close">取消</a-button>
        <a-button type="primary" :loading="saving" @click="save"> 保存 </a-button>
      </div>
    </div>
  </a-drawer>
</template>
