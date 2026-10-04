<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message, Select } from 'antdv-next'
import { ref, watch } from 'vue'

import { request } from '~/composables'

interface Props {
  roleId?: string
  roleName?: string
}

const props = defineProps<Props>()

const loading = ref(false)
const sampleUserId = ref('')
const preview = ref<{
  ctx: any
  sampleUsers: Array<{ user_id: string; username: string; real_name: string | null }>
  total: number
} | null>(null)

const userOptions = ref<Array<{ label: string; value: string }>>([])

async function loadUsers() {
  try {
    const res: any = await request.get('/user/all/options')
    const list = Array.isArray(res) ? res : (res?.data ?? [])
    userOptions.value = list.map((u: any) => ({
      label: u.realName || u.username,
      value: u.userId,
    }))
  } catch {
    userOptions.value = []
  }
}

async function loadPreview() {
  if (!props.roleId || !sampleUserId.value) return
  loading.value = true
  try {
    const res: any = await request.post(`/role/${props.roleId}/data-scope-preview`, {
      sampleUserId: sampleUserId.value,
    })
    preview.value = res?.data ?? res
  } catch (e: any) {
    message.error(e?.message || '预览失败')
    preview.value = null
  } finally {
    loading.value = false
  }
}

watch(
  () => props.roleId,
  () => {
    if (props.roleId && userOptions.value.length === 0) loadUsers()
  },
  { immediate: true },
)

watch(sampleUserId, loadPreview)

function describeScope(ctx: any): string {
  if (!ctx) return ''
  if (ctx.deptIds === '*') return '全部数据'
  if (ctx.selfOnly) return '仅本人数据'
  if (Array.isArray(ctx.deptIds)) {
    return `本部门及以下（${ctx.deptIds.length} 个部门）`
  }
  return '未知'
}
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-lg border border-blue-100 bg-blue-50/40 p-4 dark:border-blue-900 dark:bg-blue-900/10">
      <div class="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
        <Icon icon="carbon:view" class="text-ant-primary" />
        <span>数据权限预览</span>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400">选择一个样本用户，查看该用户当前的数据可见范围。</p>
    </div>

    <div>
      <label class="mb-1 block text-sm text-gray-600 dark:text-gray-300">样本用户</label>
      <Select
        v-model:value="sampleUserId"
        :options="userOptions"
        placeholder="请选择样本用户"
        show-search
        :filter-option="(input: string, option: any) => option.label.toLowerCase().includes(input.toLowerCase())"
        style="width: 100%"
        allow-clear
      />
    </div>

    <a-spin :spinning="loading">
      <div v-if="preview" class="space-y-3">
        <div class="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <div class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            可见范围：{{ describeScope(preview.ctx) }}
          </div>
          <div class="text-xs text-gray-500">
            共 <span class="font-semibold text-blue-600">{{ preview.total }}</span> 名用户可见
          </div>
        </div>

        <div class="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <div class="mb-2 text-xs font-medium text-gray-500">样本数据（前 20 条）</div>
          <div class="space-y-1">
            <div
              v-for="u in preview.sampleUsers"
              :key="u.user_id"
              class="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <span class="text-gray-700 dark:text-gray-200">{{ u.real_name || u.username }}</span>
              <span class="text-gray-400">@{{ u.username }}</span>
            </div>
          </div>
          <a-empty v-if="preview.sampleUsers.length === 0" description="无可见用户" :image="undefined" />
        </div>
      </div>
      <a-empty v-else-if="sampleUserId && !loading" description="请选择用户查看预览" />
    </a-spin>
  </div>
</template>
