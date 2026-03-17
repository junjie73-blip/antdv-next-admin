<script setup lang="ts">
import { CloseCircleOutlined, CloseOutlined, ReloadOutlined, SettingOutlined } from '@antdv-next/icons'
import { Dropdown } from 'antdv-next'
import { computed, h, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/modules/app'
import { cn } from '@/utils/cn'
import { COLLAPSED_WIDTH } from '../composables/useLayout'

const props = defineProps<{
  hasChildren?: boolean
}>()

defineOptions({
  name: 'LayoutTabs',
})

interface TabItem {
  key: string
  title: string
  closable: boolean
}

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()

const tabs = ref<TabItem[]>([
  { key: '/dashboard', title: '仪表盘', closable: false },
])

const activeKey = ref(route.path)

watch(
  () => route.path,
  (path) => {
    activeKey.value = path
    const exists = tabs.value.some(tab => tab.key === path)
    if (!exists && route.meta?.title) {
      tabs.value.push({
        key: path,
        title: route.meta.title as string,
        closable: path !== '/dashboard',
      })
    }
  },
  { immediate: true },
)

const isHorizontal = computed(() => appStore.layout === 'horizontal')
const isMixed = computed(() => appStore.layout === 'mixed')

const tabsClassName = computed(() =>
  cn(
    'fixed left-0 right-0 z-40',
    'h-10 px-2 flex items-center',
    'bg-white dark:bg-gray-800',
    'border-b border-gray-200 dark:border-gray-700',
    'transition-all duration-200',
  ),
)

const tabsStyle = computed(() => {
  if (isHorizontal.value) {
    return { top: '48px', left: 0 }
  }
  if (isMixed.value) {
    if (!props.hasChildren) {
      return { top: '48px', left: 0 }
    }
    return {
      top: '48px',
      left: `${appStore.sidebarCollapsed ? COLLAPSED_WIDTH : appStore.sidebarWidth}px`,
    }
  }
  return {
    top: '48px',
    left: `${appStore.sidebarCollapsed ? COLLAPSED_WIDTH : appStore.sidebarWidth}px`,
  }
})

function handleTabClick(key: string) {
  router.push(key)
}

function handleTabEdit(targetKey: any, action: 'add' | 'remove') {
  if (action === 'remove' && typeof targetKey === 'string') {
    removeTab(targetKey)
  }
}

function removeTab(targetKey: string) {
  const index = tabs.value.findIndex(tab => tab.key === targetKey)
  if (index === -1)
    return

  tabs.value.splice(index, 1)

  if (activeKey.value === targetKey) {
    const newTab = tabs.value[index] || tabs.value[index - 1]
    if (newTab) {
      activeKey.value = newTab.key
      router.push(newTab.key)
    }
  }
}

function refreshCurrent() {
  router.replace({ path: `/redirect${route.path}` })
}

function closeAll() {
  tabs.value = tabs.value.filter(tab => !tab.closable)
  const homeTab = tabs.value[0]
  if (homeTab) {
    activeKey.value = homeTab.key
    router.push(homeTab.key)
  }
}

function closeOther() {
  tabs.value = tabs.value.filter(tab => tab.key === activeKey.value || !tab.closable)
}

const dropdownItems = [
  { key: 'refresh', label: '刷新当前', icon: () => h(ReloadOutlined) },
  { key: 'closeOther', label: '关闭其他', icon: () => h(CloseCircleOutlined) },
  { key: 'closeAll', label: '关闭所有', icon: () => h(CloseOutlined) },
]

function handleDropdownClick({ key }: { key: string }) {
  switch (key) {
    case 'refresh':
      refreshCurrent()
      break
    case 'closeOther':
      closeOther()
      break
    case 'closeAll':
      closeAll()
      break
  }
}
</script>

<template>
  <div
    v-if="appStore.showTabs"
    :class="tabsClassName"
    :style="tabsStyle"
  >
    <div class="flex-1 overflow-hidden flex items-center gap-1">
      <div
        v-for="tab in tabs"
        :key="tab.key"
        :class="cn(
          'px-3 py-1 text-sm rounded cursor-pointer flex items-center gap-2',
          'transition-colors duration-200',
          activeKey === tab.key
            ? 'bg-primary text-white'
            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600',
        )"
        @click="handleTabClick(tab.key)"
      >
        <span>{{ tab.title }}</span>
        <CloseOutlined
          v-if="tab.closable"
          class="text-xs hover:text-red-500"
          @click.stop="removeTab(tab.key)"
        />
      </div>
    </div>

    <Dropdown :menu="{ items: dropdownItems, onClick: handleDropdownClick }">
      <a-button
        type="text"
        size="small"
      >
        <template #icon>
          <SettingOutlined />
        </template>
      </a-button>
    </Dropdown>
  </div>
</template>
