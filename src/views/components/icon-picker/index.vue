<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { ref } from 'vue'
import { IconPicker } from '@/components/common/Icon'
import { cn } from '@/utils/cn'

const containerClassName = cn('space-y-6')
const twinContainerClassName = cn('grid grid-cols-2 gap-4')
const infoBoxClassName = cn(
  'flex items-center gap-2 mt-4 p-3 rounded-lg',
  'bg-blue-50 dark:bg-blue-900/20',
  'border border-blue-200 dark:border-blue-800',
)
const infoIconClassName = cn('text-blue-500 text-lg flex-shrink-0')
const infoTextClassName = cn('text-sm text-blue-700 dark:text-blue-300 font-mono')

const selectedIcon = ref('')
const defaultIcon = ref('carbon:star-filled')
const disabledValue = ref('carbon:lock-locked')

const leftIcon = ref('')
const rightIcon = ref('')

function handleBasicChange(value: string) {
  message.success(`已选择图标：${value || '(已清除)'}`)
}

function handleLeftChange(value: string) {
  message.info(`左侧图标变更为：${value || '(已清除)'}`)
}

function handleRightChange(value: string) {
  message.info(`右侧图标变更为：${value || '(已清除)'}`)
}
</script>

<template>
  <div :class="containerClassName">
    <a-card
      title="基础用法"
      variant="borderless"
    >
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        点击输入框打开图标选择器，搜索或浏览图标集合后点击选择。
      </p>
      <div class="max-w-md">
        <IconPicker
          v-model="selectedIcon"
          placeholder="点击选择图标"
          @change="handleBasicChange"
        />
        <div :class="infoBoxClassName">
          <Icon
            icon="carbon:information"
            :class="infoIconClassName"
          />
          <span :class="infoTextClassName">
            已选：{{ selectedIcon || '(无)' }}
          </span>
        </div>
      </div>
    </a-card>

    <a-card
      title="默认值"
      variant="borderless"
    >
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        通过 <code>v-model</code> 提供初始图标值。本例中预设了
        <code>carbon:star-filled</code> 图标。
      </p>
      <div class="max-w-md">
        <IconPicker
          v-model="defaultIcon"
          placeholder="已有默认图标"
        />
        <div :class="infoBoxClassName">
          <Icon
            icon="carbon:information"
            :class="infoIconClassName"
          />
          <span :class="infoTextClassName">
            默认值：{{ defaultIcon }}
          </span>
        </div>
      </div>
    </a-card>

    <a-card
      title="禁用状态（只读）"
      variant="borderless"
    >
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        设置 <code>:disabled=&quot;true&quot;</code> 可禁止用户交互。
      </p>
      <div class="max-w-md">
        <IconPicker
          v-model="disabledValue"
          disabled
          placeholder="此选择器已被禁用"
        />
      </div>
    </a-card>

    <a-card
      title="多实例"
      variant="borderless"
    >
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        多个独立的图标选择器并排显示，各自维护独立的状态。
      </p>
      <div :class="twinContainerClassName">
        <div>
          <label class="block text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">
            左侧选择器
          </label>
          <IconPicker
            v-model="leftIcon"
            placeholder="请选择左侧图标"
            @change="handleLeftChange"
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">
            右侧选择器
          </label>
          <IconPicker
            v-model="rightIcon"
            placeholder="请选择右侧图标"
            @change="handleRightChange"
          />
        </div>
      </div>
    </a-card>

    <a-card
      title="变更事件"
      variant="borderless"
    >
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        每次图标选择变更时触发 <code>@change</code> 事件（包括清空操作），通过消息提示展示选中值。
      </p>
      <div class="max-w-md">
        <IconPicker
          v-model="selectedIcon"
          placeholder="选择图标查看提示效果"
          @change="handleBasicChange"
        />
      </div>
    </a-card>
  </div>
</template>
