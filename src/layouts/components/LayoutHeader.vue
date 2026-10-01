<script setup lang="tsx">
import type { BreadcrumbProps, MenuProps } from 'antdv-next'

import { Icon } from '@iconify/vue'
import { Dropdown, Menu, notification } from 'antdv-next'
import { computed, defineAsyncComponent, h, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { getNoticeUnreadCount } from '~/api'
import { useAppStore } from '~/stores/modules/app'
import { useRouteStore } from '~/stores/modules/route'
import { useUserStore } from '~/stores/modules/user'
import { eventBus, transformMenuConfigToItems } from '~/utils'
import { cn } from '~/utils/cn'
import { WS_EVENTS } from '~/utils/ws'

import { useBreadcrumb } from '../composables/useLayout'
import { useVisibleWidgets } from '../widgets'
import AccountDrawer from './AccountDrawer.vue'
import SettingDrawer from './SettingDrawer/index.vue'

// ============================================================
// Props / Emits
// ============================================================
const props = defineProps<{
  collapsed?: boolean
  horizontal?: boolean
  mixed?: boolean
  activeTopMenu?: string
}>()

const emit = defineEmits<{
  toggleCollapsed: []
  topMenuSelect: [key: string]
}>()

defineOptions({ name: 'LayoutHeader' })

// ============================================================
// Store / Router
// ============================================================
const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()
const routeStore = useRouteStore()
const { breadcrumbs } = useBreadcrumb()

const unreadCount = ref(0)
const showSetting = ref(false)
const showNotification = ref(false)
const accountDrawerRef = ref<InstanceType<typeof AccountDrawer> | null>(null)
const appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Next Admin'
const visibleWidgets = computed(() => useVisibleWidgets())

// ============================================================
// 样式
// ============================================================
const isGeekStyle = computed(() => appStore.themeStyle === 'geek')
const isDarkMode = computed(() => appStore.themeMode === 'dark' || isGeekStyle.value)

const headerClassName = computed(() =>
  cn(
    'h-14 px-6 flex items-center justify-between bg-white',
    'border-b shadow-sm flex-shrink-0',
    isGeekStyle.value
      ? 'bg-[#0a0a0a] border-[#1a1a1a] text-[#00ff88]'
      : isDarkMode.value
        ? 'bg-gray-800 border-gray-700 text-white'
        : 'border-gray-200 text-gray-800',
  ),
)

// ============================================================
// ⭐ 顶栏菜单项（横向 + 混合统一）
// ============================================================
const horizontalMenuItems = computed<MenuProps['items']>(() => {
  const menus = unref(routeStore.menus)
  if (!menus || menus.length === 0) return []
  const items = transformMenuConfigToItems(menus) as any[]
  const cleaned = sanitizeMenuItems(items)

  // ⭐ 混合布局：顶栏只展示一级菜单，去掉 children 下拉
  if (props.mixed) {
    return cleaned.map((item) => {
      const { children: _children, ...rest } = item
      return rest
    })
  }

  // 横向布局：保留 children，允许下拉展开二级
  return cleaned
})
/**
 * 浅层清洗（防止 antd SubMenu 内部报错）
 * - 去 null / undefined
 * - 去重复 key
 * - 空 children 转 undefined
 */
function sanitizeMenuItems(items: any[]): any[] {
  if (!Array.isArray(items)) return []

  const result: any[] = []
  const seenKeys = new Set<string>()

  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    if (!item.key || seenKeys.has(item.key)) continue
    seenKeys.add(item.key)

    const cleaned: any = { ...item }

    if (Array.isArray(item.children)) {
      const children = sanitizeMenuItems(item.children)
      if (children.length > 0) {
        cleaned.children = children
      } else {
        delete cleaned.children // ⭐ 空数组必须删掉，否则 SubMenu 报错
      }
    }

    result.push(cleaned)
  }

  return result
}

function findFirstLeafKey(items: any[], rootKey: string): string | null {
  const root = items.find((item: any) => item?.key === rootKey)
  if (!root) return null

  const walk = (node: any): string | null => {
    if (!node) return null

    // 叶子节点 → 返回自身 key
    if (!Array.isArray(node.children) || node.children.length === 0) {
      const key = String(node.key ?? '')
      // ⭐ 排除外链
      if (key.startsWith('external:')) return null
      return key
    }

    // 有 children → 递归
    for (const child of node.children) {
      if (child?.disabled || child?.hidden) continue
      const result = walk(child)
      if (result) return result
    }
    return null
  }

  return walk(root)
}
// ============================================================
// ⭐ 顶栏选中态：只放一个 key
// ============================================================
const topSelectedKeys = computed<string[]>(() => {
  const key = props.activeTopMenu
  return key ? [key] : []
})

// ============================================================
// 面包屑
// ============================================================
const breadcrumbItems = computed<BreadcrumbProps['items']>(() => {
  return breadcrumbs.value.map((item) => ({
    title: item.title,
    path: item.path,
  }))
})

// ============================================================
// 用户下拉
// ============================================================
const userDropdownItems: MenuProps['items'] = [
  {
    key: 'profile',
    label: '个人中心',
    icon: () => h(Icon, { icon: 'carbon:user-avatar' }),
  },
  {
    key: 'docs',
    label: '文档中心',
    icon: () => h(Icon, { icon: 'carbon:book' }),
  },
]

// ============================================================
// 事件处理
// ============================================================
function handleWidgetEvent(key: string) {
  if (key === 'preferences') showSetting.value = true
  if (key === 'search') showNotification.value = true
}

function handleUserMenuClick({ key }: { key: string }) {
  if (key === 'profile') {
    accountDrawerRef.value?.open('center')
  } else if (key === 'docs') {
    window.open('https://github.com/junjie73-blip/antdv-docs/', '_blank')
  }
}

function handleBreadcrumbClick(path: string) {
  router.push(path)
}

/** ⭐ 顶栏菜单点击 */
function handleHorizontalMenuSelect({ key }: { key: string }) {
  const keyStr = String(key)

  // 外链 → 新窗口
  if (keyStr.startsWith('external:')) {
    window.open(keyStr.replace('external:', ''), '_blank', 'noopener,noreferrer')
    return
  }

  // 混合布局：一级菜单
  if (props.mixed) {
    const items = transformMenuConfigToItems(unref(routeStore.menus)) as any[]
    const menu = items.find((item: any) => item?.key === keyStr)
    const hasChildren = Array.isArray(menu?.children) && menu.children.length > 0

    if (hasChildren) {
      // ① 立即切换侧边栏
      emit('topMenuSelect', keyStr)

      // ② 判断当前路由是否已在子树内
      const currentPath = router.currentRoute.value.path
      const alreadyInSubtree = currentPath === keyStr || currentPath.startsWith(keyStr + '/')

      // ③ 不在子树内 → 尝试跳到第一个叶子（先校验路由存在）
      if (!alreadyInSubtree) {
        const firstLeaf = findFirstLeafKey(items, keyStr)
        if (
          firstLeaf &&
          firstLeaf !== currentPath &&
          isRouteValid(firstLeaf) // ⭐ 关键修复
        ) {
          router.push(firstLeaf)
        } else if (firstLeaf && !isRouteValid(firstLeaf)) {
          // ⭐ 路由不存在 → 不跳转，只切侧边栏
          console.warn('[menu] firstLeaf route not found, keep current route:', firstLeaf)
        }
      }

      return
    }

    // ⭐ 一级菜单是叶子（如"微应用"没有 children）
    if (keyStr.startsWith('/') && isRouteValid(keyStr)) {
      router.push(keyStr)
    } else if (keyStr.startsWith('/')) {
      console.warn('[menu] route not found:', keyStr)
    }
    emit('topMenuSelect', keyStr)
    return
  }
}
function isRouteValid(path: string): boolean {
  if (!path || !path.startsWith('/')) return false

  try {
    const resolved = router.resolve(path)

    // 1. 没有 matched → 路由不存在
    if (!resolved.matched || resolved.matched.length === 0) {
      return false
    }

    // 2. 检查是否命中 catchAll / NotFound
    const last = resolved.matched[resolved.matched.length - 1]!
    const lastPath = last.path ?? ''
    const lastName = String(last.name ?? '')

    if (
      lastPath.includes('pathMatch') || // /:pathMatch(.*)*
      lastPath === '/:catchAll(.*)' ||
      lastName.toLowerCase().includes('notfound') ||
      lastName.toLowerCase().includes('404')
    ) {
      return false
    }

    // 3. 检查 meta 标记（有些项目用 meta.hiddenForMenu）
    if (resolved.meta?.is404) {
      return false
    }

    return true
  } catch (err) {
    console.warn('[menu] resolve route failed:', path, err)
    return false
  }
}
// ============================================================
// 未读数轮询
// ============================================================
async function loadUnread() {
  try {
    unreadCount.value = await getNoticeUnreadCount()
  } catch {
    // 静默失败
  }
}

const timer = ref<NodeJS.Timeout>()

onMounted(() => {
  timer.value = setInterval(loadUnread, 60_000)
})

eventBus.on(WS_EVENTS.FORCE_LOGOUT, () => {
  loadUnread()
})

eventBus.on(WS_EVENTS.UPLOAD_MERGE, (data: any) => {
  if (data.status === 'completed') {
    notification.success({
      title: '文件上传合并成功',
      description: `文件 ${data.fileName} 已成功上传合并`,
      placement: 'bottomRight',
    })
  } else {
    notification.error({
      title: '文件上传合并失败',
      description: `文件 ${data.filename} 已合并失败，失败原因：${data.errorMsg}`,
      placement: 'bottomRight',
    })
  }
})

onUnmounted(() => {
  clearInterval(timer.value)
  eventBus.clear()
})
</script>

<template>
  <a-layout-header :class="headerClassName">
    <div class="flex flex-1 items-center gap-4">
      <!-- 垂直布局：面包屑 -->
      <template v-if="!horizontal && !mixed">
        <a-breadcrumb v-if="appStore.showBreadcrumb" class="hidden items-center md:flex" :items="breadcrumbItems">
          <template #separator>
            <Icon icon="carbon:chevron-right" class="text-xs opacity-50" />
          </template>
          <template #titleRender="{ item, index }">
            <span class="inline-flex cursor-pointer items-center gap-1.5" @click="handleBreadcrumbClick(item.path!)">
              <Icon
                :icon="
                  index === 0
                    ? 'carbon:home'
                    : (breadcrumbs[index - 1]?.icon as string) || 'carbon:folder'
                "
                class="text-sm"
              />
              <span>{{ item.title }}</span>
            </span>
          </template>
        </a-breadcrumb>
      </template>

      <!-- 横向布局：Logo + 水平菜单 -->
      <template v-else-if="horizontal">
        <div class="flex items-center gap-2">
          <Icon icon="carbon:cube" class="text-ant-primary text-2xl" />
          <span class="text-ant-primary font-bold">
            {{ appTitle }}
          </span>
        </div>

        <Menu
          mode="horizontal"
          :items="horizontalMenuItems"
          :theme="isDarkMode ? 'dark' : 'light'"
          :selected-keys="topSelectedKeys"
          class="flex-1 border-none bg-transparent"
          @select="handleHorizontalMenuSelect"
        />
      </template>

      <!-- 混合布局：Logo + 水平菜单 -->
      <template v-else-if="mixed">
        <div class="flex items-center gap-2 border-r border-gray-200 pr-4 dark:border-gray-700">
          <Icon icon="carbon:cube" class="text-2xl" :class="isGeekStyle ? 'text-[#00ff88]' : 'text-ant-primary'" />
          <span class="font-bold" :class="isGeekStyle ? 'text-[#00ff88]' : 'text-ant-primary'">
            {{ appTitle }}
          </span>
        </div>

        <Menu
          mode="horizontal"
          :items="horizontalMenuItems"
          :theme="isDarkMode ? 'dark' : 'light'"
          :selected-keys="topSelectedKeys"
          class="flex-1 border-none bg-transparent"
          @select="handleHorizontalMenuSelect"
        />
      </template>
    </div>

    <div class="flex items-center gap-3">
      <div
        class="flex items-center gap-0.5 rounded-xl bg-white px-0.5 py-0.5 shadow-lg shadow-gray-300/40 dark:bg-gray-800 dark:shadow-black/40"
      >
        <div class="flex shrink-0 items-center gap-1">
          <component
            :is="defineAsyncComponent(meta.component as never)"
            v-for="meta in visibleWidgets"
            :key="meta.key"
            v-motion
            :initial="{ opacity: 0, y: -6 }"
            :enter="{
              opacity: 1,
              y: 0,
              transition: { duration: 220, delay: 40 },
            }"
            :hovered="{ scale: 1.08 }"
            :tapped="{ scale: 0.94 }"
            @open="handleWidgetEvent(meta.key)"
          />
        </div>
      </div>

      <Dropdown :menu="{ items: userDropdownItems, onClick: handleUserMenuClick }" placement="bottomRight">
        <div
          class="flex cursor-pointer items-center gap-2 rounded-xl py-0.5 pr-2 pl-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <a-avatar :size="28" :src="userStore.avatar" class="bg-ant-primary">
            {{ userStore.username?.charAt(0)?.toUpperCase() || 'U' }}
          </a-avatar>
          <span class="hidden text-sm text-gray-700 sm:inline dark:text-gray-200">
            {{ userStore.username || '用户' }}
          </span>
          <Icon icon="carbon:chevron-down" class="text-xs text-gray-400" />
        </div>
      </Dropdown>
    </div>

    <SettingDrawer v-model:visible="showSetting" />
    <AccountDrawer ref="accountDrawerRef" />
  </a-layout-header>
</template>

<style scoped>
:deep(.ant-breadcrumb-separator) {
  display: flex;
  justify-content: center;
  align-items: center;
}

:global(.ant-popover-inner) {
  padding: 0 !important;
}

/* 横向布局菜单样式 */
:deep(.ant-menu-horizontal) {
  border-bottom: none !important;
  background: transparent !important;
}

:deep(.ant-menu-horizontal > .ant-menu-item),
:deep(.ant-menu-horizontal > .ant-menu-submenu) {
  padding-inline: 16px;
}

:deep(.ant-menu-submenu-popup .ant-menu-item) {
  border-radius: 6px;
  margin: 2px 4px;
}
</style>
