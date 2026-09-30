<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message, Modal } from 'antdv-next'
import { computed, onMounted, ref } from 'vue'

import { getMyTenants, switchTenant, type AccessibleTenant } from '~/api/auth'
import { useUserStore } from '~/stores/modules/user'

defineOptions({ name: 'TenantSwitchPanel' })

/* ============================================================
 * 状态
 * ============================================================ */
const userStore = useUserStore()
const tenants = ref<AccessibleTenant[]>([])
const loading = ref(false)
const switchingId = ref<string | null>(null)

const currentTenantId = computed(() => userStore.userInfo?.tenantId)

/* ============================================================
 * 加载租户列表
 * ============================================================ */
async function loadTenants() {
  loading.value = true
  try {
    const res: any = await getMyTenants()
    const list = Array.isArray(res) ? res : (res?.data ?? [])
    tenants.value = list.filter(
      (t: any): t is AccessibleTenant => t && typeof t.tenantId === 'string' && typeof t.tenantName === 'string',
    )
  } catch (e: any) {
    message.error(e?.message || '加载租户列表失败')
    tenants.value = []
  } finally {
    loading.value = false
  }
}

/* ============================================================
 * 切换租户
 * ============================================================ */
function handleSwitch(tenant: AccessibleTenant) {
  if (tenant.tenantId === currentTenantId.value) return
  if (switchingId.value) {
    message.warning('正在切换中，请稍候')
    return
  }

  Modal.confirm({
    title: '切换租户',
    content: `确定切换到「${tenant.tenantName}」吗？切换后需重新登录。`,
    okText: '确认切换',
    cancelText: '取消',
    async onOk() {
      switchingId.value = tenant.tenantId
      try {
        const res: any = await switchTenant(tenant.tenantId)
        const data = res?.data ?? res

        if (data?.accessToken) {
          // 后端返回新 token，直接切换
          userStore.setToken(data.accessToken, data.refreshToken || '')
          message.success('已切换，正在重新加载...')
          setTimeout(() => window.location.reload(), 300)
        } else {
          // 后端未返回 token，要求重新登录
          message.success('切换成功，请重新登录')
          await userStore.logout?.()
        }
      } catch (e: any) {
        message.error(e?.message || '切换失败')
      } finally {
        switchingId.value = null
      }
    },
  })
}

/* ============================================================
 * 生命周期
 * ============================================================ */
onMounted(loadTenants)

defineExpose({ refresh: loadTenants })
</script>

<template>
  <div>
    <div class="mb-3 flex items-center justify-between">
      <div class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
        <Icon icon="carbon:enterprise" class="text-gray-500" />
        <span>可访问的租户</span>
        <a-tag v-if="tenants.length" color="blue" class="!m-0">{{ tenants.length }}</a-tag>
      </div>
      <a-button size="small" :loading="loading" @click="loadTenants">
        <template #icon><Icon icon="carbon:renew" /></template>
        刷新
      </a-button>
    </div>

    <a-spin :spinning="loading">
      <div v-if="tenants.length > 0" class="space-y-2">
        <div
          v-for="tenant in tenants"
          :key="tenant.tenantId"
          class="flex items-center justify-between rounded-lg border p-4 transition-colors"
          :class="
            tenant.tenantId === currentTenantId
              ? 'border-blue-300 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-900/10'
              : 'border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700'
          "
        >
          <div class="flex min-w-0 items-center gap-3">
            <div
              class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
              :class="
                tenant.tenantId === currentTenantId
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
              "
            >
              <Icon icon="carbon:building" class="text-lg" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="truncate font-medium text-gray-800 dark:text-gray-100">
                  {{ tenant.tenantName }}
                </span>
                <a-tag v-if="tenant.tenantId === currentTenantId" color="blue" class="!m-0"> 当前 </a-tag>
              </div>
              <div class="mt-0.5 truncate text-xs text-gray-400">
                {{ tenant.tenantCode }}
              </div>
            </div>
          </div>

          <a-button
            v-if="tenant.tenantId !== currentTenantId"
            type="primary"
            ghost
            size="small"
            :loading="switchingId === tenant.tenantId"
            :disabled="!!switchingId && switchingId !== tenant.tenantId"
            @click="handleSwitch(tenant)"
          >
            切换
          </a-button>
          <span v-else class="flex-shrink-0 text-xs text-gray-400">使用中</span>
        </div>
      </div>
      <a-empty v-else-if="!loading" description="暂无可访问的租户" />
    </a-spin>
  </div>
</template>
