<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message, Modal } from 'antdv-next'
import { onMounted, ref } from 'vue'

import { getMyDevices, kickMyDevice, type DeviceItem } from '~/api'

const loading = ref(false)
const devices = ref<DeviceItem[]>([])

async function load() {
  loading.value = true
  try {
    const res: any = await getMyDevices()
    devices.value = Array.isArray(res) ? res : (res?.data ?? [])
  } catch (e: any) {
    message.error(e?.message || '加载设备失败')
    devices.value = []
  } finally {
    loading.value = false
  }
}

function handleKick(device: DeviceItem) {
  Modal.confirm({
    title: '下线设备',
    content: `确定下线该设备（${device.ip ?? device.deviceId.slice(0, 8)}）吗？`,
    okType: 'danger',
    async onOk() {
      try {
        await kickMyDevice(device.deviceId)
        message.success('该设备已下线')
        await load()
      } catch (e: any) {
        message.error(e?.message || '操作失败')
      }
    },
  })
}

function parseBrowser(ua: string | null): string {
  if (!ua) return '未知设备'
  if (/Edg\//.test(ua)) return 'Edge'
  if (/MicroMessenger/i.test(ua)) return '微信'
  if (/Chrome\//.test(ua)) return 'Chrome'
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari'
  return '其他浏览器'
}

function parseOS(ua: string | null): string {
  if (!ua) return ''
  if (/Windows NT 10/.test(ua)) return 'Windows 10+'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Mac OS X/.test(ua)) return 'macOS'
  if (/Android/.test(ua)) return 'Android'
  if (/iPhone|iPad/.test(ua)) return 'iOS'
  if (/Linux/.test(ua)) return 'Linux'
  return ''
}

function formatTime(ts: number | null): string {
  if (!ts) return '未知'
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

onMounted(load)
</script>

<template>
  <div>
    <div class="mb-3 flex items-center justify-between">
      <div class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
        <Icon icon="carbon:devices" class="text-gray-500" />
        <span>在线设备</span>
        <a-tag v-if="devices.length" color="blue" class="!m-0">{{ devices.length }}</a-tag>
      </div>
      <a-button size="small" :loading="loading" @click="load">
        <template #icon><Icon icon="carbon:renew" /></template>
        刷新
      </a-button>
    </div>

    <a-spin :spinning="loading">
      <div v-if="devices.length > 0" class="space-y-2">
        <div
          v-for="d in devices"
          :key="d.deviceId"
          class="flex items-center justify-between rounded-lg border p-4 transition-colors"
          :class="
            d.current
              ? 'border-blue-200 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-900/10'
              : 'border-gray-100 hover:border-gray-200 dark:border-gray-800'
          "
        >
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-lg"
              :class="
                d.current
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
              "
            >
              <Icon :icon="d.current ? 'carbon:laptop' : 'carbon:device-desktop'" class="text-lg" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium text-gray-800 dark:text-gray-100">
                  {{ parseBrowser(d.userAgent) }}
                  <span v-if="parseOS(d.userAgent)" class="text-gray-400"> · {{ parseOS(d.userAgent) }} </span>
                </span>
                <a-tag v-if="d.current" color="blue" class="!m-0">当前设备</a-tag>
              </div>
              <div class="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-gray-400">
                <span v-if="d.ip" class="inline-flex items-center gap-1">
                  <Icon icon="carbon:location" /> {{ d.ip }}
                </span>
                <span class="inline-flex items-center gap-1">
                  <Icon icon="carbon:time" /> {{ formatTime(d.lastActiveAt) }}
                </span>
                <span class="inline-flex items-center gap-1">
                  <Icon icon="carbon:timer" /> 剩余 {{ Math.max(0, Math.round(d.ttl / 60)) }} 分钟
                </span>
              </div>
            </div>
          </div>

          <a-button v-if="!d.current" danger size="small" @click="handleKick(d)"> 下线 </a-button>
          <span v-else class="text-xs text-gray-400">使用中</span>
        </div>
      </div>
      <a-empty v-else-if="!loading" description="暂无其他在线设备" />
    </a-spin>
  </div>
</template>
