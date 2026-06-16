<script setup lang="ts">
import type { SecurityEvent, SecurityEventLevel, SecurityEventType } from '@/api/security'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import { computed, onMounted, ref } from 'vue'
import { getSecurityEvents } from '@/api/security'
import { cn } from '@/utils/cn'

defineOptions({ name: 'SecurityTimeline' })

// 样式类名
const containerClassName = cn('rounded-xl p-5')
const filterBarClassName = cn('flex items-center gap-2 flex-wrap mb-4')
const tagClassName = cn('cursor-pointer transition-all duration-200 text-xs px-2.5 py-1 rounded-full border')

const events = ref<SecurityEvent[]>([])
const loading = ref(false)

// 筛选状态
const activeType = ref<string>('all')
const activeLevel = ref<string>('all')
const activeStatus = ref<string>('all')

/** 事件类型选项 */
const typeOptions = [
  { value: 'all', label: '全部类型' },
  { value: 'login_anomaly', label: '登录异常' },
  { value: 'permission_change', label: '权限变更' },
  { value: 'sensitive_operation', label: '敏感操作' },
  { value: 'attack_attempt', label: '攻击尝试' },
]

/** 级别选项 */
const levelOptions = [
  { value: 'all', label: '全部级别' },
  { value: 'critical', label: '严重' },
  { value: 'high', label: '高危' },
  { value: 'medium', label: '中危' },
  { value: 'low', label: '低危' },
]

/** 状态选项 */
const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待处理' },
  { value: 'handled', label: '已处理' },
]

/** 过滤后的事件列表 */
const filteredEvents = computed(() => {
  return events.value.filter((e) => {
    if (activeType.value !== 'all' && e.type !== activeType.value)
      return false
    if (activeLevel.value !== 'all' && e.level !== activeLevel.value)
      return false
    if (activeStatus.value !== 'all' && e.status !== activeStatus.value)
      return false
    return true
  })
})

/** 时间线颜色 */
function getTimelineColor(level: SecurityEventLevel): string {
  const map: Record<SecurityEventLevel, string> = {
    critical: '#ff4d4f',
    high: '#fa8c16',
    medium: '#1677ff',
    low: '#d9d9d9',
  }
  return map[level] || map.low
}

/** 级别标签颜色 */
function getLevelTagColor(level: SecurityEventLevel): string {
  const map: Record<SecurityEventLevel, string> = {
    critical: 'error',
    high: 'warning',
    medium: 'processing',
    low: 'default',
  }
  return map[level] || map.low
}

/** 级别文字 */
function getLevelLabel(level: SecurityEventLevel): string {
  const map: Record<SecurityEventLevel, string> = {
    critical: '严重',
    high: '高危',
    medium: '中危',
    low: '低危',
  }
  return map[level] || level
}

/** 类型图标 */
function getTypeIcon(type: SecurityEventType): string {
  const map: Record<SecurityEventType, string> = {
    login_anomaly: 'carbon:user-identification',
    permission_change: 'carbon:locked',
    sensitive_operation: 'carbon:document-security',
    attack_attempt: 'carbon:shield-check',
  }
  return map[type] || 'carbon:warning-alt'
}

/** 类型标签颜色 */
function getTypeTagColor(type: SecurityEventType): string {
  const map: Record<SecurityEventType, string> = {
    login_anomaly: 'red',
    permission_change: 'orange',
    sensitive_operation: 'blue',
    attack_attempt: 'magenta',
  }
  return map[type] || 'default'
}

onMounted(async () => {
  loading.value = true
  try {
    const res = await getSecurityEvents({ page: 1, pageSize: 15 })
    // 兼容直接返回 { list } 或包装为 { data: { list } }
    const data = (res && 'list' in res) ? res : (res?.data ?? res)
    events.value = data?.list || []
  }
  catch {
    events.value = []
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div :class="cn(containerClassName, 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800')">
    <!-- 标题 -->
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-base font-semibold text-gray-800 dark:text-white">
          安全事件时间线
        </h3>
        <p class="text-xs text-gray-400 mt-0.5">
          近期安全事件追踪
        </p>
      </div>
      <a-badge
        :count="filteredEvents.filter(e => e.status === 'pending').length"
        :offset="[2,
                  0]"
      >
        <span class="text-xs text-gray-400">待处理</span>
      </a-badge>
    </div>

    <!-- 筛选栏 -->
    <div :class="filterBarClassName">
      <!-- 类型筛选 -->
      <div class="flex items-center gap-1">
        <a-tag
          v-for="opt in typeOptions"
          :key="opt.value"
          :class="tagClassName"
          :color="activeType === opt.value ? 'blue' : undefined"
          @click="activeType = opt.value"
        >
          {{ opt.label }}
        </a-tag>
      </div>
      <!-- 级别筛选 -->
      <div class="flex items-center gap-1">
        <a-tag
          v-for="opt in levelOptions"
          :key="opt.value"
          :class="tagClassName"
          :color="activeLevel === opt.value && opt.value !== 'all'
            ? (opt.value === 'critical' ? 'red' : opt.value === 'high' ? 'orange' : opt.value === 'medium' ? 'blue' : undefined)
            : undefined"
          @click="activeLevel = opt.value"
        >
          {{ opt.label }}
        </a-tag>
      </div>
      <!-- 状态筛选 -->
      <div class="flex items-center gap-1">
        <a-tag
          v-for="opt in statusOptions"
          :key="opt.value"
          :class="tagClassName"
          :color="activeStatus === opt.value ? (opt.value === 'pending' ? 'red' : 'green') : undefined"
          @click="activeStatus = opt.value"
        >
          {{ opt.label }}
        </a-tag>
      </div>
    </div>

    <!-- 时间线 -->
    <PerfectScrollbar class="max-h-[420px] pr-1">
      <a-spin :spinning="loading">
        <a-timeline
          v-if="filteredEvents.length > 0"
          mode="left"
          class="mt-2"
        >
          <a-timeline-item
            v-for="event in filteredEvents"
            :key="event.id"
            :color="getTimelineColor(event.level)"
          >
            <div class="group flex items-start gap-3 py-2 px-2 -ml-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <!-- 图标 -->
              <div
                class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                :class="cn(
                  event.level === 'critical' ? 'bg-red-50 dark:bg-red-950/30 text-red-500'
                  : event.level === 'high' ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-500'
                    : event.level === 'medium' ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-500'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-400',
                )"
              >
                <Icon
                  :icon="getTypeIcon(event.type)"
                  :width="16"
                  :height="16"
                />
              </div>

              <!-- 内容 -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap mb-1">
                  <span class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ event.title }}</span>
                  <a-tag
                    :color="getLevelTagColor(event.level)"
                    size="small"
                    class="text-[10px]"
                  >
                    {{ getLevelLabel(event.level) }}
                  </a-tag>
                  <a-tag
                    :color="getTypeTagColor(event.type)"
                    size="small"
                    class="text-[10px]"
                  >
                    {{ typeOptions.find(t => t.value === event.type)?.label }}
                  </a-tag>
                  <a-tag
                    v-if="event.status === 'pending'"
                    color="error"
                    size="small"
                    class="text-[10px]"
                  >
                    待处理
                  </a-tag>
                  <a-tag
                    v-else-if="event.status === 'handled'"
                    color="success"
                    size="small"
                    class="text-[10px]"
                  >
                    已处理
                  </a-tag>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                  {{ event.description }}
                </p>
                <div class="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                  <span class="flex items-center gap-1">
                    <Icon
                      icon="carbon:location"
                      :width="12"
                      :height="12"
                    />
                    {{ event.sourceIp }} · {{ event.location }}
                  </span>
                  <span>{{ dayjs(event.createdAt).format('MM-DD HH:mm:ss') }}</span>
                </div>
              </div>
            </div>
          </a-timeline-item>
        </a-timeline>

        <a-empty
          v-else
          description="暂无匹配的安全事件"
          class="py-8"
        />
      </a-spin>
    </PerfectScrollbar>
  </div>
</template>
