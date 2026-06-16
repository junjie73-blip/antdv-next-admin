<script setup lang="ts">
import type { BasicColumn, TableSetting } from '../types'
import { Button, Checkbox, Popover, Tooltip } from 'antdv-next'
import { cloneDeep } from 'es-toolkit'
import { computed, ref, watch } from 'vue'
import { IconifyIcon as Icon } from '@/components/common/Icon'
import { cn } from '@/utils/cn'

const props = defineProps<{
  setting?: TableSetting
  columns?: BasicColumn[]
  cacheColumns?: BasicColumn[]
}>()

const emit = defineEmits<{
  (e: 'redo'): void
  (e: 'update:columns', columns: BasicColumn[]): void
  (e: 'reset'): void
}>()

// 全屏状态
const isFullscreen = ref(false)

// 列设置弹窗可见性
const settingVisible = ref(false)

// 本地列数据
const localColumns = ref<BasicColumn[]>([])

/**
 * 监听列数据变化
 */
watch(
  () => props.columns,
  (newColumns) => {
    if (newColumns) {
      localColumns.value = cloneDeep(newColumns)
    }
  },
  { immediate: true, deep: true },
)

/**
 * 刷新表格
 */
function handleRedo() {
  emit('redo')
}

/**
 * 切换全屏
 */
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
    isFullscreen.value = true
  }
  else {
    document.exitFullscreen()
    isFullscreen.value = false
  }
}

/**
 * 获取设置配置
 */
const getSetting = computed(() => {
  return {
    redo: true,
    setting: true,
    fullScreen: true,
    ...props.setting,
  }
})

/**
 * 获取可配置的列（排除选择列、序号列、操作列）
 */
const configurableColumns = computed(() => {
  return localColumns.value.filter((col) => {
    const key = col.key || col.dataIndex
    return key !== 'ant-table-selection-column' && key !== 'index' && key !== 'action'
  })
})

/**
 * 检查列是否显示
 */
function isColumnVisible(col: BasicColumn): boolean {
  return col.ifShow !== false
}

/**
 * 切换列显示状态
 */
function toggleColumnVisible(col: BasicColumn, checked: boolean) {
  const index = localColumns.value.findIndex(
    c => c.key === col.key || c.dataIndex === col.dataIndex,
  )
  if (index > -1) {
    localColumns.value[index] = { ...localColumns.value[index], ifShow: checked }
    emit('update:columns', cloneDeep(localColumns.value))
  }
}

/**
 * 重置列设置
 */
function handleReset() {
  emit('reset')
}

/**
 * 全选/取消全选
 */
function handleSelectAll(checked: boolean) {
  localColumns.value = localColumns.value.map((col) => {
    const key = col.key || col.dataIndex
    if (key !== 'ant-table-selection-column' && key !== 'index' && key !== 'action') {
      return { ...col, ifShow: checked }
    }
    return col
  })
  emit('update:columns', cloneDeep(localColumns.value))
}

/**
 * 是否全部选中
 */
const isAllSelected = computed(() => {
  return configurableColumns.value.every(col => isColumnVisible(col))
})

/**
 * 是否部分选中
 */
const isIndeterminate = computed(() => {
  const visibleCount = configurableColumns.value.filter(col => isColumnVisible(col)).length
  return visibleCount > 0 && visibleCount < configurableColumns.value.length
})
</script>

<template>
  <div :class="cn('flex items-center gap-1')">
    <!-- 刷新 -->
    <Tooltip
      v-if="getSetting.redo"
      title="刷新"
    >
      <Button
        type="text"
        @click="handleRedo"
      >
        <template #icon>
          <Icon icon="ant-design:redo-outlined" />
        </template>
      </Button>
    </Tooltip>

    <!-- 列设置 -->
    <Popover
      v-if="getSetting.setting"
      v-model:open="settingVisible"
      trigger="click"
      placement="bottomRight"
      :overlay-class-name="cn('table-column-setting')"
    >
      <template #content>
        <div :class="cn('w-56')">
          <!-- 标题 -->
          <div :class="cn('flex items-center justify-between mb-3')">
            <span :class="cn('font-medium')">列设置</span>
            <Button
              type="link"
              @click="handleReset"
            >
              重置
            </Button>
          </div>

          <!-- 全选 -->
          <div :class="cn('mb-2 pb-2 border-b border-gray-100')">
            <Checkbox
              :checked="isAllSelected"
              :indeterminate="isIndeterminate"
              @change="(e) => handleSelectAll(e.target.checked)"
            >
              全选
            </Checkbox>
          </div>

          <!-- 列列表 -->
          <PerfectScrollbar :class="cn('max-h-64')">
            <div :class="cn('space-y-1')">
              <div
                v-for="(col, idx) in configurableColumns"
                :key="String(col.key || col.dataIndex || idx)"
                :class="cn('flex items-center justify-between py-1')"
              >
                <Checkbox
                  :checked="isColumnVisible(col)"
                  @change="(e) => toggleColumnVisible(col, e.target.checked)"
                >
                  <span :class="cn('text-sm')">{{ col.title }}</span>
                </Checkbox>
              </div>
            </div>
          </PerfectScrollbar>

          <!-- 空状态 -->
          <div
            v-if="configurableColumns.length === 0"
            :class="cn('text-center text-gray-400 py-4')"
          >
            暂无可用列
          </div>
        </div>
      </template>
      <Tooltip title="列设置">
        <Button type="text">
          <template #icon>
            <Icon icon="ant-design:setting-outlined" />
          </template>
        </Button>
      </Tooltip>
    </Popover>

    <!-- 全屏 -->
    <Tooltip
      v-if="getSetting.fullScreen"
      :title="isFullscreen ? '退出全屏' : '全屏'"
    >
      <Button
        type="text"
        @click="toggleFullscreen"
      >
        <template #icon>
          <Icon :icon="isFullscreen ? 'ant-design:fullscreen-exit-outlined' : 'ant-design:fullscreen-outlined'" />
        </template>
      </Button>
    </Tooltip>
  </div>
</template>
