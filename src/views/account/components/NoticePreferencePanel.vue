<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { computed, onMounted, ref } from 'vue'

import { getMyNoticePreferences, resetMyNoticePreferences, setMyNoticePreferences } from '~/api'

defineOptions({ name: 'NoticePreferencePanel' })

/* ============================================================
 * 渠道 / 事件定义
 * ============================================================ */
const CHANNELS = [
  { key: 'in_app', label: '站内信', icon: 'carbon:notification' },
  { key: 'email', label: '邮件', icon: 'carbon:email' },
  { key: 'sms', label: '短信', icon: 'carbon:mobile' },
] as const

const EVENTS = [
  { key: 'notice', label: '通知' },
  { key: 'announcement', label: '公告' },
  { key: 'workflow', label: '工作流' },
  { key: 'todo', label: '待办' },
  { key: 'system', label: '系统消息' },
] as const

type ChannelKey = (typeof CHANNELS)[number]['key']
type EventKey = (typeof EVENTS)[number]['key']

/* ============================================================
 * 状态
 * ============================================================ */
const loading = ref(false)
const saving = ref(false)

/** prefs[channel][event] = 0 | 1 */
const prefs = ref<Record<string, Record<string, number>>>({})

/** 快速计算某渠道是否"全部开启" */
const channelAllOn = computed(() => {
  const r: Record<string, boolean> = {}
  for (const c of CHANNELS) {
    r[c.key] = EVENTS.every((e) => prefs.value[c.key]?.[e.key] === 1)
  }
  return r
})

/* ============================================================
 * 加载
 * ============================================================ */
async function load() {
  loading.value = true
  try {
    const res: any = await getMyNoticePreferences()
    const data = res?.data ?? res ?? {}
    // data 结构：{ email: { notice: 1, workflow: 1, "*": 0 }, ... }
    prefs.value = normalize(data)
  } catch (e: any) {
    message.error(e?.message || '加载通知偏好失败')
    prefs.value = normalize({})
  } finally {
    loading.value = false
  }
}

/** 保证所有 channel/event 组合都有值，缺失时默认开启 in_app，其他按后端默认 */
function normalize(data: Record<string, Record<string, number>>) {
  const out: Record<string, Record<string, number>> = {}
  for (const c of CHANNELS) {
    out[c.key] = {}
    for (const e of EVENTS) {
      const v = data[c.key]?.[e.key]
      if (typeof v === 'number') {
        out[c.key][e.key] = v
      } else {
        // 后端默认：in_app 全开；其他按事件类型
        out[c.key][e.key] = c.key === 'in_app' ? 1 : 0
      }
    }
  }
  return out
}

/* ============================================================
 * 开关
 * ============================================================ */
function toggleOne(channel: string, eventKey: string, value: boolean) {
  prefs.value[channel][eventKey] = value ? 1 : 0
}

function toggleChannelAll(channel: string, value: boolean) {
  for (const e of EVENTS) {
    prefs.value[channel][e.key] = value ? 1 : 0
  }
}

/* ============================================================
 * 保存（自动 diff + 批量提交）
 * ============================================================ */
async function save() {
  saving.value = true
  try {
    const items: Array<{ channel: string; eventType: string; enabled: number }> = []
    for (const c of CHANNELS) {
      for (const e of EVENTS) {
        items.push({
          channel: c.key,
          eventType: e.key,
          enabled: prefs.value[c.key][e.key],
        })
      }
    }
    await setMyNoticePreferences({ items })
    message.success('通知偏好已保存')
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

/* ============================================================
 * 重置
 * ============================================================ */
async function reset() {
  saving.value = true
  try {
    await resetMyNoticePreferences({})
    message.success('已恢复默认')
    await load()
  } catch (e: any) {
    message.error(e?.message || '重置失败')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="mb-3 flex items-center justify-between">
      <div class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
        <Icon icon="carbon:notification" class="text-gray-500" />
        <span>通知接收偏好</span>
      </div>
      <div class="flex items-center gap-2">
        <a-button size="small" :loading="saving" @click="reset">恢复默认</a-button>
        <a-button type="primary" size="small" :loading="saving" @click="save">保存</a-button>
      </div>
    </div>

    <div
      class="mb-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300"
    >
      <Icon icon="carbon:information" class="mr-1 inline" />
      关闭某渠道后，该类型消息将不再通过此渠道推送；站内信关闭后系统消息可能无法触达，请谨慎设置。
    </div>

    <a-spin :spinning="loading">
      <div class="overflow-hidden rounded-lg border border-gray-100 dark:border-gray-800">
        <!-- 表头 -->
        <div
          class="grid grid-cols-[1fr_repeat(3,100px)] border-b border-gray-100 bg-gray-50/60 px-4 py-2.5 text-xs font-medium text-gray-500 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400"
        >
          <div>事件类型</div>
          <div v-for="c in CHANNELS" :key="c.key" class="flex items-center justify-center gap-1">
            <Icon :icon="c.icon" />
            <span>{{ c.label }}</span>
          </div>
        </div>

        <!-- 全选行 -->
        <div
          class="grid grid-cols-[1fr_repeat(3,100px)] items-center border-b border-gray-100 px-4 py-2.5 dark:border-gray-800"
        >
          <div class="text-xs font-medium text-gray-500">全部开启</div>
          <div v-for="c in CHANNELS" :key="c.key" class="flex justify-center">
            <a-switch
              size="small"
              :checked="channelAllOn[c.key]"
              @change="(v: boolean) => toggleChannelAll(c.key, v)"
            />
          </div>
        </div>

        <!-- 各事件 -->
        <div
          v-for="(e, idx) in EVENTS"
          :key="e.key"
          class="grid grid-cols-[1fr_repeat(3,100px)] items-center px-4 py-3 transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-800/20"
          :class="idx < EVENTS.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''"
        >
          <div class="text-sm text-gray-700 dark:text-gray-300">{{ e.label }}</div>
          <div v-for="c in CHANNELS" :key="c.key" class="flex justify-center">
            <a-switch
              size="small"
              :checked="prefs[c.key]?.[e.key] === 1"
              @change="(v: boolean) => toggleOne(c.key, e.key, v)"
            />
          </div>
        </div>
      </div>
    </a-spin>
  </div>
</template>
