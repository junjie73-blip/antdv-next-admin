<script setup lang="ts">
import type { LayoutMode } from '../composables/useLayout'

import type { ComponentSize, NotificationPosition, ThemeStyle, TransitionEffect } from '@/settings'
import { Icon } from '@iconify/vue'
import { Divider, Input, InputNumber, Segmented, Select, Switch } from 'antdv-next'
import { computed } from 'vue'
import { useThemeTransition } from '@/composables/web/useThemeTransition'
import { THEME_PRESETS } from '@/settings/theme'
import { useAppStore } from '@/stores/modules/app'
import { cn } from '@/utils/cn'
import { LAYOUT_OPTIONS, LayoutIcon } from './LayoutIcon'

defineOptions({
  name: 'SettingDrawer',
})

const visible = defineModel<boolean>('visible', { default: false })

const appStore = useAppStore()
const { toggleThemeWithAnimation } = useThemeTransition()

const drawerClassName = cn('w-[300px]')

const themeOptions = [
  { value: 'light', label: '亮色' },
  { value: 'dark', label: '暗色' },
]

const sizeOptions: { value: ComponentSize, label: string }[] = [
  { value: 'small', label: '小' },
  { value: 'middle', label: '中' },
  { value: 'large', label: '大' },
]

const transitionOptions: { value: TransitionEffect, label: string }[] = [
  { value: 'fade', label: '淡入淡出' },
  { value: 'slide', label: '滑动' },
  { value: 'slide-right', label: '右滑' },
  { value: 'slide-left', label: '左滑' },
  { value: 'slide-up', label: '上滑' },
  { value: 'slide-down', label: '下滑' },
  { value: 'zoom', label: '缩放' },
  { value: 'fade-slide', label: '淡入滑动' },
  { value: 'scale', label: '缩放淡入' },
  { value: 'flip', label: '翻转' },
]

const notificationPositionOptions: { value: NotificationPosition, label: string }[] = [
  { value: 'topLeft', label: '左上' },
  { value: 'topRight', label: '右上' },
  { value: 'bottomLeft', label: '左下' },
  { value: 'bottomRight', label: '右下' },
]

const allowedStyles = ['default', 'compact', 'illustration', 'bootstrap', 'skeuomorphism', 'glass', 'geek'] as ThemeStyle[]

const themeStyles = computed(() =>
  Object.values(THEME_PRESETS).filter(style => allowedStyles.includes(style.name as ThemeStyle)),
)

const primaryColors = [
  { color: '#1677ff', name: '极光蓝' },
  { color: '#1890ff', name: '天际蓝' },
  { color: '#52c41a', name: '翡翠绿' },
  { color: '#faad14', name: '日落橙' },
  { color: '#f5222d', name: '烈焰红' },
  { color: '#722ed1', name: '梦幻紫' },
  { color: '#13c2c2', name: '薄荷青' },
  { color: '#eb2f96', name: '樱花粉' },
]

const settingItemClassName = cn(
  'flex items-center justify-between',
  'py-2',
)

function handleThemeChange(value: string | number, event?: MouseEvent) {
  if (value !== appStore.themeMode) {
    toggleThemeWithAnimation(event)
  }
}

function handleLayoutChange(value: string | number) {
  appStore.updateSetting({ layout: value as LayoutMode })
}

function handleSizeChange(value: string | number) {
  appStore.updateSetting({ componentSize: value as ComponentSize })
}

function handleThemeStyleChange(value: string) {
  appStore.updateSetting({ themeStyle: value as ThemeStyle })
}

function handlePrimaryColorChange(color: string) {
  appStore.updateSetting({ primaryColor: color })
}

function handleTransitionChange(value: TransitionEffect) {
  appStore.updateSetting({ transitionEffect: value })
}

function handleNotificationPositionChange(value: NotificationPosition) {
  appStore.updateSetting({ notificationPosition: value })
}

function handleBorderRadiusChange(value: number | null) {
  if (value !== null) {
    appStore.updateSetting({ borderRadius: value })
  }
}

function handleSidebarWidthChange(value: number | null) {
  if (value !== null) {
    appStore.updateSetting({ sidebarWidth: value })
  }
}

function handleReset() {
  appStore.resetSetting()
}

function getPrimaryColor(style: { token?: Record<string, unknown> }): string {
  const color = style.token?.colorPrimary
  return typeof color === 'string' ? color : '#1677ff'
}
</script>

<template>
  <a-drawer
    v-model:open="visible"
    title="主题设置"
    placement="right"
    :class="drawerClassName"
    size="300px"
  >
    <PerfectScrollbar class="h-full">
      <div class="space-y-4 pr-2">
        <div>
          <div class="mb-2 text-sm font-medium">
            主题模式
          </div>
          <Segmented
            :options="themeOptions"
            :value="appStore.themeMode"
            block
            @change="(value: string) => {
              if (value !== appStore.themeMode) {
                appStore.updateSetting({ theme: value as 'light' | 'dark' })
              }
            }"
          />
        </div>

        <Divider />

        <div>
          <div class="mb-2 text-sm font-medium">
            布局方式
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div
              v-for="item in LAYOUT_OPTIONS"
              :key="item.value"
              :class="cn(
                'flex flex-col items-center gap-1 p-2 rounded cursor-pointer',
                'border-2 transition-all duration-200',
                'hover:border-gray-400',
                appStore.layout === item.value
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200',
              )"
              @click="handleLayoutChange(item.value)"
            >
              <LayoutIcon
                :type="item.value"
                :active="appStore.layout === item.value"
              />
              <span class="text-xs">{{ item.label }}</span>
            </div>
          </div>
        </div>

        <Divider />

        <div>
          <div class="mb-2 text-sm font-medium">
            组件大小
          </div>
          <Segmented
            :options="sizeOptions"
            :value="appStore.componentSize"
            block
            @change="handleSizeChange"
          />
        </div>

        <Divider />

        <div>
          <div class="mb-2 text-sm font-medium">
            主题色
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div
              v-for="item in primaryColors"
              :key="item.color"
              :class="cn(
                'flex items-center gap-2 p-2 rounded cursor-pointer',
                'border-2 transition-all duration-200',
                'hover:border-gray-400',
                appStore.primaryColor === item.color
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200',
              )"
              @click="handlePrimaryColorChange(item.color)"
            >
              <div
                class="w-6 h-6 rounded-full flex-shrink-0"
                :style="{ backgroundColor: item.color }"
              />
              <span class="text-xs">{{ item.name }}</span>
            </div>
          </div>
        </div>

        <Divider />

        <div>
          <div class="mb-2 text-sm font-medium">
            主题风格
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div
              v-for="style in themeStyles"
              :key="style.name"
              :class="cn(
                'flex items-center gap-2 p-2 rounded cursor-pointer',
                'border-2 transition-all duration-200',
                'hover:border-gray-400',
                appStore.themeStyle === style.name
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200',
              )"
              @click="handleThemeStyleChange(style.name)"
            >
              <div
                class="w-8 h-8 rounded-full flex-shrink-0"
                :style="{ backgroundColor: getPrimaryColor(style) }"
              />
              <span class="text-xs">{{ style.label }}</span>
            </div>
          </div>
        </div>

        <Divider />

        <div>
          <div class="mb-2 text-sm font-medium">
            界面设置
          </div>
          <div class="space-y-1">
            <div :class="settingItemClassName">
              <span class="text-sm">暗色侧边栏</span>
              <Switch
                :checked="appStore.darkSidebar"
                @change="appStore.toggleDarkSidebar"
              />
            </div>
            <div :class="settingItemClassName">
              <span class="text-sm">显示面包屑</span>
              <Switch
                :checked="appStore.showBreadcrumb"
                @change="appStore.toggleBreadcrumb"
              />
            </div>
            <div :class="settingItemClassName">
              <span class="text-sm">显示标签页</span>
              <Switch
                :checked="appStore.showTabs"
                @change="appStore.toggleTabs"
              />
            </div>
            <div
              v-if="appStore.showTabs"
              :class="settingItemClassName"
            >
              <span class="text-sm">标签页显示图标</span>
              <Switch
                :checked="appStore.tabShowIcon"
                @change="appStore.toggleTabShowIcon"
              />
            </div>
            <div :class="settingItemClassName">
              <span class="text-sm">显示页脚</span>
              <Switch
                :checked="appStore.showFooter"
                @change="appStore.toggleFooter"
              />
            </div>
            <div :class="settingItemClassName">
              <span class="text-sm">水波纹效果</span>
              <Switch
                :checked="appStore.enableWaterRipple"
                @change="appStore.toggleWaterRipple"
              />
            </div>
            <div :class="settingItemClassName">
              <span class="text-sm">色弱模式</span>
              <Switch
                :checked="appStore.colorWeak"
                @change="appStore.toggleColorWeak"
              />
            </div>
            <div :class="settingItemClassName">
              <span class="text-sm">灰色模式</span>
              <Switch
                :checked="appStore.grayMode"
                @change="appStore.toggleGrayMode"
              />
            </div>
            <div :class="settingItemClassName">
              <span class="text-sm">水印</span>
              <Switch
                :checked="appStore.enableWatermark"
                @change="appStore.toggleWatermark"
              />
            </div>
            <div
              v-if="appStore.enableWatermark"
              :class="settingItemClassName"
            >
              <span class="text-sm">水印内容</span>
              <Input
                :value="appStore.watermarkContent"
                placeholder="请输入水印内容"
                class="w-32"
                @update:value="(val: string) => appStore.updateSetting({ watermarkContent: val })"
              />
            </div>
          </div>
        </div>

        <Divider />

        <div :class="settingItemClassName">
          <span class="text-sm">侧边栏宽度</span>
          <InputNumber
            :value="appStore.sidebarWidth"
            :min="180"
            :max="280"
            :step="10"
            class="w-24"
            @change="handleSidebarWidthChange"
          />
        </div>

        <div :class="settingItemClassName">
          <span class="text-sm">圆角大小</span>
          <InputNumber
            :value="appStore.borderRadius"
            :min="0"
            :max="16"
            :step="1"
            class="w-24"
            @change="handleBorderRadiusChange"
          />
        </div>

        <Divider />

        <div :class="settingItemClassName">
          <span class="text-sm">页面切换动画</span>
          <Select
            :value="appStore.transitionEffect"
            :options="transitionOptions"
            class="w-32"
            @change="handleTransitionChange"
          />
        </div>

        <div :class="settingItemClassName">
          <span class="text-sm">通知位置</span>
          <Select
            :value="appStore.notificationPosition"
            :options="notificationPositionOptions"
            class="w-32"
            @change="handleNotificationPositionChange"
          />
        </div>

        <Divider />

        <div>
          <a-button
            block
            @click="handleReset"
          >
            <template #icon>
              <Icon icon="carbon:reset" />
            </template>
            重置设置
          </a-button>
        </div>
      </div>
    </PerfectScrollbar>
  </a-drawer>
</template>
