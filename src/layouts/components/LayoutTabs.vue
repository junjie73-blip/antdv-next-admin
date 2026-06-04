<script setup lang="ts">
import { CloseCircleOutlined, CloseOutlined, ReloadOutlined, SettingOutlined } from '@antdv-next/icons'
import { Icon } from '@iconify/vue'
import { Dropdown } from 'antdv-next'
import { computed, h, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/modules/app'
import { useRouteStore } from '@/stores/modules/route'
import { cn } from '@/utils/cn'

const props = defineProps<{
  hasChildren?: boolean
  showIcon?: boolean
}>()

defineOptions({
  name: 'LayoutTabs',
})

interface TabItem {
  key: string
  title: string
  icon?: string
  closable: boolean
}

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const routeStore = useRouteStore()

/** 从路由或菜单中获取图标 */
function getRouteIcon(path: string): string | undefined {
  // 优先从当前路由 meta 取
  const currentRoute = router.resolve(path)
  if (currentRoute?.meta?.icon)
    return currentRoute.meta.icon as string
  // 回退到菜单配置中查找（匹配路径前缀）
  for (const menu of routeStore.menus) {
    if (path.startsWith(menu.path) && menu.icon)
      return menu.icon
    if (menu.children) {
      for (const child of menu.children) {
        if (path === `${menu.path}/${child.path}` && child.icon)
          return child.icon
        // 子菜单没 icon 时继承父级
        if (path === `${menu.path}/${child.path}` && menu.icon)
          return menu.icon
      }
    }
  }
  return undefined
}

/** 递归查找第一个菜单的最内层叶子节点 */
function findFirstLeafMenu(menus: any[], parentPath = ''): { path: string, title: string, icon?: string } | null {
  if (!menus.length)
    return null
  const first = menus[0]
  // 拼接完整路径（子级 path 可能是相对路径如 'echarts'）
  const fullPath = first.path.startsWith('/')
    ? first.path
    : `${parentPath}/${first.path}`.replace(/\/+/g, '/')
  // 没有子级 → 自身就是叶子节点
  if (!first.children?.length) {
    return { path: fullPath, title: first.title || first.name, icon: first.icon }
  }
  // 有子级 → 继续往下递归，传递当前路径作为父级
  return findFirstLeafMenu(first.children, fullPath)
}

const leafMenu = findFirstLeafMenu(routeStore.menus)
const tabs = ref<TabItem[]>([
  leafMenu
    ? { key: leafMenu.path, title: leafMenu.title, icon: leafMenu.icon, closable: false }
    : { key: '/dashboard', title: '仪表盘', closable: false },
])

/** 首页标签 key（用于判断不可关闭） */
const homeTabKey = computed(() => tabs.value[0]?.key ?? '/dashboard')

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
        icon: getRouteIcon(path),
        closable: path !== homeTabKey.value,
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
    if (!scrollContainerRef.value)
      return
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

function tabItemClassName(key: string) {
  return cn(
    'px-3 py-1.5 text-sm rounded cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap',
    'transition-colors duration-200',
    activeKey.value === key
      ? 'bg-primary text-white'
      : isGeekStyle.value
        ? 'bg-[#1a1a1a] text-gray-400 hover:bg-[#222] hover:text-gray-300'
        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600',
  )
}

function handleTabClick(key: string) {
  router.push(key)
}

function _handleTabEdit(targetKey: any, action: 'add' | 'remove') {
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
  if (!isDragging || !scrollContainerRef.value)
    return
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
      :class="{ grabbing: isDragging }"
      @mousedown.prevent="onMouseDown"
    >
      <div class="inline-flex items-center gap-1 h-full">
        <div
          v-for="tab in tabs"
          :key="tab.key"
          :class="tabItemClassName(tab.key)"
          @click="handleTabClick(tab.key)"
        >
          <Icon
            v-if="props.showIcon && tab.icon"
            :icon="tab.icon"
            :width="14"
            :height="14"
          />
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
