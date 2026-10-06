<script setup lang="ts">
import {
  CloseCircleOutlined,
  CloseOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@antdv-next/icons'
import { Icon } from '@iconify/vue'
import { Dropdown } from 'antdv-next'
import { computed, h, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { MenuConfig } from '@antdv-admin/types'

import { useAppStore } from '~/stores/modules/app'
import { useRouteStore } from '~/stores/modules/route'
import { cn } from '~/utils/cn'

const props = defineProps<{
  hasChildren?: boolean
  showIcon?: boolean
}>()

defineOptions({
  name: 'LayoutTabs',
})

interface TabItem {
  /** ★ 用路由 name 作为 tab 唯一 key */
  key: string
  /** 显示标题 */
  title: string
  icon?: string
  closable: boolean
}

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const routeStore = useRouteStore()

/** 从菜单树里按 name 递归查找节点 */
function findMenuByName(
  list: MenuConfig[],
  name: string,
): MenuConfig | undefined {
  for (const m of list) {
    if (m.name === name) return m
    if (m.children?.length) {
      const found = findMenuByName(m.children, name)
      if (found) return found
    }
  }
  return undefined
}

/** 获取路由图标：优先 meta，再回退菜单 */
function getRouteIcon(name: string): string | undefined {
  try {
    const r = router.resolve({ name })
    if (r?.meta?.icon) return r.meta.icon as string
  } catch {
    // 无对应路由，忽略
  }
  return findMenuByName(routeStore.menus, name)?.icon
}

/** 获取路由标题：优先 meta，再回退菜单 */
function getRouteTitle(name: string, fallback = ''): string {
  try {
    const r = router.resolve({ name })
    if (r?.meta?.title) return r.meta.title as string
  } catch {
    // 忽略
  }
  return findMenuByName(routeStore.menus, name)?.title ?? fallback
}

/** 递归找菜单树第一个叶子节点（用于首页 tab） */
function findFirstLeafMenu(list: MenuConfig[]): MenuConfig | null {
  if (!list?.length) return null
  const first = list[0]
  if (!first) return null
  if (!first.children?.length) return first
  return findFirstLeafMenu(first.children)
}

/** 首页 tab（不可关闭） */
const homeTab = computed<TabItem>(() => {
  const leaf = findFirstLeafMenu(routeStore.menus)
  if (leaf?.name) {
    return {
      key: leaf.name,
      title: leaf.title || getRouteTitle(leaf.name),
      icon: leaf.icon ?? getRouteIcon(leaf.name),
      closable: false,
    }
  }
  // 兜底：写死默认首页
  return {
    key: 'Analysis',
    title: '分析面板',
    icon: 'carbon:data-vis-4',
    closable: false,
  }
})

/** 首页 tab key，用于判断 tab 是否可关闭 */
const homeTabKey = computed(() => homeTab.value.key)

const tabs = ref<TabItem[]>([homeTab.value])
const activeKey = ref<string>('')

/** 菜单变化时，更新首页 tab */
watch(
  () => homeTab.value,
  (newHome) => {
    if (tabs.value[0]) {
      tabs.value[0] = newHome
    } else {
      tabs.value.unshift(newHome)
    }
  },
)

/** 滚动容器引用 */
const scrollContainerRef = useTemplateRef('scrollContainerRef')

/** 路由变化 → 同步 tabs */
watch(
  () => route.name,
  (name) => {
    if (!name) return
    const key = name as string
    activeKey.value = key

    const exists = tabs.value.some((t) => t.key === key)
    if (!exists) {
      tabs.value.push({
        key,
        title: getRouteTitle(key, (route.meta?.title as string) || key),
        icon: getRouteIcon(key),
        closable: key !== homeTabKey.value,
      })
      nextTick(() => scrollToLastTab())
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
      const lastTab = ps.element.querySelector(
        '[class*="shrink-0"]:last-child',
      ) as HTMLElement
      if (lastTab) {
        ps.element.scrollLeft =
          lastTab.offsetLeft + lastTab.offsetWidth - ps.element.clientWidth + 16
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
      ? 'bg-ant-primary text-white'
      : isGeekStyle.value
        ? 'bg-[#1a1a1a] text-gray-400 hover:bg-[#222] hover:text-gray-300'
        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600',
  )
}

/** ★ 点击 tab：用 name 跳转 */
function handleTabClick(key: string) {
  if (key === route.name) return
  if (!router.hasRoute(key)) {
    console.warn('[tabs] 无对应路由 name:', key)
    return
  }
  router.push({ name: key })
}

function removeTab(targetKey: string) {
  const index = tabs.value.findIndex((tab) => tab.key === targetKey)
  if (index === -1) return

  tabs.value.splice(index, 1)

  if (activeKey.value === targetKey) {
    const newTab = tabs.value[index] || tabs.value[index - 1]
    if (newTab) {
      activeKey.value = newTab.key
      if (router.hasRoute(newTab.key)) {
        router.push({ name: newTab.key })
      }
    }
  }
}

function refreshCurrent() {
  // 用 name 走 /redirect
  if (route.name) {
    router.replace({ path: `/redirect${route.path}` })
  }
}

function closeAll() {
  tabs.value = tabs.value.filter((tab) => !tab.closable)
  const home = tabs.value[0]
  if (home) {
    activeKey.value = home.key
    if (router.hasRoute(home.key)) {
      router.push({ name: home.key })
    }
  }
}

function closeOther() {
  tabs.value = tabs.value.filter(
    (tab) => tab.key === activeKey.value || !tab.closable,
  )
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
  <div v-if="appStore.showTabs" :class="tabsClassName">
    <PerfectScrollbar
      ref="scrollContainerRef"
      class="min-w-0 flex-1 cursor-grab select-none"
      :options="{
        suppressScrollX: false,
        suppressScrollY: true,
        wheelPropagation: false,
      }"
      :class="{ grabbing: isDragging }"
      @mousedown.prevent="onMouseDown"
    >
      <div class="inline-flex h-full items-center gap-1">
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
            class="ml-0.5 text-xs hover:text-red-500"
            @click.stop="removeTab(tab.key)"
          />
        </div>
      </div>
    </PerfectScrollbar>

    <Dropdown :menu="{ items: dropdownItems, onClick: handleDropdownClick }">
      <a-button type="text" size="small" class="ml-2 shrink-0">
        <template #icon>
          <SettingOutlined />
        </template>
      </a-button>
    </Dropdown>
  </div>
</template>
