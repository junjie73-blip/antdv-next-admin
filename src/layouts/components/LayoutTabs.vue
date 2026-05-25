<script setup lang="ts">
import { CloseCircleOutlined, CloseOutlined, ReloadOutlined, SettingOutlined } from '@antdv-next/icons'
import { Dropdown } from 'antdv-next'
import { computed, h, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/modules/app'
import { cn } from '@/utils/cn'

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
      nextTick(() => {
        scrollToLastTab()
      })
    }
  },
  { immediate: true },
)

function scrollToLastTab() {
  nextTick(() => {
    if (!scrollContainerRef.value) return
    const el = scrollContainerRef.value as any
    const ps = el.$ps
    if (ps?.element) {
      const lastTab = ps.element.querySelector('[class*="shrink-0"]:last-child') as HTMLElement
      if (lastTab) {
        ps.element.scrollLeft = lastTab.offsetLeft + lastTab.offsetWidth - ps.element.clientWidth + 16
        ps.update()
      }
    }
  })
}


const isGeekStyle = computed(() => appStore.themeStyle === 'geek')

const tabsClassName = computed(() =>
  cn(
    'h-10 px-2 flex items-center flex-shrink-0',
    isGeekStyle.value
      ? 'bg-[#0a0a0a] border-[#1a1a1a]'
      : 'bg-white dark:bg-gray-800',
    isGeekStyle.value
      ? 'border-b border-[#1a1a1a]'
      : 'border-b border-gray-200 dark:border-gray-700',
  ),
)

const tabItemClassName = (key: string) => cn(
  'px-3 py-1.5 text-sm rounded cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap',
  'transition-colors duration-200',
  activeKey.value === key
    ? 'bg-primary text-white'
    : isGeekStyle.value
      ? 'bg-[#1a1a1a] text-gray-400 hover:bg-[#222] hover:text-gray-300'
      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600',
)

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

const scrollContainerRef = ref<any>(null)

let isDragging = false
let startX = 0
let startScrollLeft = 0

function onMouseDown(e: MouseEvent) {
  isDragging = true
  startX = e.pageX
  const el = scrollContainerRef.value as any
  const ps = el?.$ps || el
  startScrollLeft = ps?.element?.scrollLeft || 0
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  e.preventDefault()
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging || !scrollContainerRef.value) return
  const x = e.pageX
  const walk = (x - startX) * 1.5
  const ps = (scrollContainerRef.value as any).$ps || scrollContainerRef.value
  if (ps && ps.element) {
    ps.element.scrollLeft = Math.max(0, startScrollLeft - walk)
  }
}

function onMouseUp() {
  isDragging = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}
</script>

<template>
  <div
    v-if="appStore.showTabs"
    :class="tabsClassName"
  >
    <PerfectScrollbar
      ref="scrollContainerRef"
      class="min-w-0 flex-1 cursor-grab select-none"
      :options="{ suppressScrollX: false, suppressScrollY: true, wheelPropagation: false }"
      :class="{ 'grabbing': isDragging }"
      @mousedown.prevent="onMouseDown"
    >
      <div class="inline-flex items-center gap-1 h-full">
        <div
          v-for="tab in tabs"
          :key="tab.key"
          :class="tabItemClassName(tab.key)"
          @click="handleTabClick(tab.key)"
        >
          <span>{{ tab.title }}</span>
          <CloseOutlined
            v-if="tab.closable"
            class="text-xs hover:text-red-500 ml-0.5"
            @click.stop="removeTab(tab.key)"
          />
        </div>
      </div>
    </PerfectScrollbar>

    <Dropdown :menu="{ items: dropdownItems, onClick: handleDropdownClick }">
      <a-button
        type="text"
        size="small"
        class="shrink-0 ml-2"
      >
        <template #icon>
          <SettingOutlined />
        </template>
      </a-button>
    </Dropdown>
  </div>
</template>
