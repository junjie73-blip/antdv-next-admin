<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message, Modal } from 'antdv-next'
import { computed, onMounted, ref } from 'vue'

import { getMyAbnormalLogins, type AbnormalLoginItem } from '~/api'
import dayjs from '~/utils/dayjs'

defineOptions({ name: 'AbnormalLoginPanel' })

/* ============================================================
 * 状态
 * ============================================================ */
const loading = ref(false)
const list = ref<AbnormalLoginItem[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(5)

const TYPE_LABEL: Record<string, string> = {
  new_ip: '新 IP 登录',
  new_device: '新设备登录',
  impossible_travel: '异地异常',
  unusual_time: '异常时段',
}

const TYPE_COLOR: Record<string, string> = {
  new_ip: 'blue',
  new_device: 'orange',
  impossible_travel: 'red',
  unusual_time: 'purple',
}

async function load() {
  loading.value = true
  try {
    const res: any = await getMyAbnormalLogins({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
    })
    const data = res?.data ?? res ?? {}
    list.value = data.list ?? []
    total.value = data.total ?? 0
  } catch (e: any) {
    message.error(e?.message || '加载异常登录记录失败')
  } finally {
    loading.value = false
  }
}

function handlePageChange(page: number, size: number) {
  pageNum.value = page
  pageSize.value = size
  void load()
}

const isEmpty = computed(() => !loading.value && list.value.length === 0)

onMounted(load)
</script>

<template>
  <div>
    <div class="mb-3 flex items-center justify-between">
      <div class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
        <Icon icon="carbon:warning-alt" class="text-amber-500" />
        <span>异常登录检测</span>
        <a-tag v-if="total > 0" color="amber" class="!m-0">{{ total }} 条记录</a-tag>
      </div>
      <a-button size="small" :loading="loading" @click="load">
        <template #icon><Icon icon="carbon:renew" /></template>
        刷新
      </a-button>
    </div>

    <a-spin :spinning="loading">
      <div
        v-if="isEmpty"
        class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-200 py-8 text-gray-400 dark:border-gray-800"
      >
        <Icon icon="carbon:shield-check" class="text-3xl text-emerald-400" />
        <span class="text-xs">未检测到异常登录，账号安全</span>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="item in list"
          :key="item.logId"
          class="rounded-lg border border-amber-200/60 bg-amber-50/30 p-4 dark:border-amber-900/40 dark:bg-amber-950/10"
        >
          <div class="flex items-start gap-3">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
            >
              <Icon icon="carbon:warning-alt" class="text-lg" />
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <a-tag :color="TYPE_COLOR[item.abnormalType ?? ''] ?? 'default'" class="!m-0">
                  {{ TYPE_LABEL[item.abnormalType ?? ''] ?? item.abnormalType ?? '异常' }}
                </a-tag>
              </div>

              <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <span class="inline-flex items-center gap-1">
                  <Icon icon="carbon:location" />
                  {{ [item.country, item.province, item.city].filter(Boolean).join(' ') || '未知位置' }}
                </span>
                <span class="inline-flex items-center gap-1">
                  <Icon icon="carbon:network-4" />
                  {{ item.ipAddress }}
                </span>
                <span class="inline-flex items-center gap-1">
                  <Icon icon="carbon:time" />
                  {{ dayjs(item.createdAt).format('YYYY-MM-DD HH:mm:ss') }}
                </span>
              </div>

              <div v-if="item.abnormalReason" class="mt-1 text-xs text-gray-400">
                {{ item.abnormalReason }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="!isEmpty && total > pageSize"
        class="mt-4 flex justify-end border-t border-gray-100 pt-3 dark:border-gray-800"
      >
        <a-pagination
          v-model:current="pageNum"
          v-model:page-size="pageSize"
          :total="total"
          :show-size-changer="false"
          :show-total="(t: number) => `共 ${t} 条`"
          size="small"
          @change="handlePageChange"
        />
      </div>
    </a-spin>

    <!-- 提示：如发现非本人操作 -->
    <div
      v-if="!isEmpty"
      class="mt-3 rounded-lg border border-rose-200/60 bg-rose-50/40 p-3 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300"
    >
      <Icon icon="carbon:information" class="mr-1 inline" />
      如发现非本人操作，请立即
      <span class="font-medium">修改密码</span>
      并检查
      <span class="font-medium">在线设备</span>
      ，必要时联系管理员。
    </div>
  </div>
</template>
