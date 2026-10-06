import type { MenuConfig, TabItem } from '@antdv-admin/types'

import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useTabsStore } from '~/stores/modules/tabs'
import { useRouteStore } from '~/stores/modules/route'

/**
 * 标签页与路由之间的桥接层。
 *
 * 规则集中在这里，组件只负责渲染：
 * - tab key 与菜单 key 同源（路由 name），保证一级导航、侧边导航、标签页三者的选中状态一致；
 * - 首页来自菜单树第一个叶子，异步菜单加载完成后回填；
 * - 关闭 / 跳转 / 刷新都要经过 router，所以 store 不持有路由实例。
 */
function findMenuByName(list: MenuConfig[], name: string): MenuConfig | undefined {
  for (const item of list) {
    if (item.name === name) return item
    if (item.children?.length) {
      const found = findMenuByName(item.children, name)
      if (found) return found
    }
  }
  return undefined
}

function findFirstLeaf(list: MenuConfig[]): MenuConfig | undefined {
  const first = list[0]
  if (!first) return undefined
  if (!first.children?.length) return first
  return findFirstLeaf(first.children)
}

export function useTabs() {
  const route = useRoute()
  const router = useRouter()
  const tabsStore = useTabsStore()
  const routeStore = useRouteStore()

  /** 内容区滚动容器（放大时用于把页面重新滚到顶部） */
  const scrollRef = ref<HTMLElement | null>(null)

  function resolveMeta(name: string) {
    try {
      const target = router.resolve({ name } as never)
      return {
        icon: target?.meta?.icon as string | undefined,
        path: target?.path ?? route.path,
        title: target?.meta?.title as string | undefined,
      }
    } catch {
      return { icon: undefined, path: route.path, title: undefined }
    }
  }

  /** 首页 tab：菜单还没到位时给一个稳定的兜底，避免首屏没有标签 */
  const homeTab = computed<TabItem>(() => {
    const leaf = findFirstLeaf(routeStore.menus)
    if (leaf?.name) {
      const meta = resolveMeta(leaf.name)
      return {
        affix: true,
        closable: false,
        icon: leaf.icon ?? meta.icon,
        key: leaf.name,
        path: meta.path,
        title: leaf.title || meta.title || leaf.name,
      }
    }
    return {
      affix: true,
      closable: false,
      icon: 'carbon:data-vis-4',
      key: 'Analysis',
      path: '/analysis',
      title: '分析面板',
    }
  })

  /** 菜单异步到达后，首页的标题 / 图标需要回填 */
  watch(homeTab, (home) => tabsStore.ensureHome(home), { immediate: true })

  watch(
    () => route.name,
    (name) => {
      if (!name) return
      const key = name as string
      const meta = resolveMeta(key)
      const menu = findMenuByName(routeStore.menus, key)

      tabsStore.add({
        closable: true,
        icon: (route.meta?.icon as string) ?? menu?.icon ?? meta.icon,
        key,
        path: route.path,
        title:
          (route.meta?.title as string) ?? menu?.title ?? meta.title ?? key,
      })
      tabsStore.setActive(key)
      nextTick(scrollToActive)
    },
    { immediate: true },
  )

  const tabs = computed(() => tabsStore.tabs)
  const activeKey = computed(() => tabsStore.activeKey)

  /** 点击 / 右键菜单跳转：统一走 name，避免 path 拼写出错 */
  function activate(key: string) {
    if (!router.hasRoute(key)) return
    if (key !== route.name) router.push({ name: key })
  }

  function close(key: string) {
    const next = tabsStore.remove(key)
    if (next) activate(next)
  }

  function closeOthers(key?: string) {
    const keep = tabsStore.closeOthers(key)
    if (keep) activate(keep)
  }

  function closeLeft(key: string) {
    tabsStore.closeLeft(key)
  }

  function closeRight(key: string) {
    tabsStore.closeRight(key)
  }

  function closeAll() {
    const home = tabsStore.closeAll()
    if (home) activate(home)
  }

  /**
   * 刷新：走 /redirect 中转页，是本项目里唯一可靠的「重建 keep-alive 实例」手段，
   * 直接 router.refresh() 在部分浏览器上不会触发组件重建。
   */
  function refresh(key?: string) {
    const target = key ? tabsStore.tabs.find((tab) => tab.key === key) : undefined
    const path = target?.path ?? route.path
    router.replace({ path: `/redirect${path}` })
  }

  function toggleMaximize(key?: string) {
    tabsStore.toggleMaximize(key)
  }

  /** 让选中项留在可视区：拖拽排序与新增标签后都要用到 */
  function scrollToActive() {
    const el = scrollRef.value
    if (!el) return
    const active = el.querySelector<HTMLElement>('[data-active="true"]')
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }

  return {
    activate,
    activeKey,
    close,
    closeAll,
    closeLeft,
    closeOthers,
    closeRight,
    homeTab,
    refresh,
    scrollRef,
    scrollToActive,
    tabs,
    tabsStore,
    toggleMaximize,
  }
}
