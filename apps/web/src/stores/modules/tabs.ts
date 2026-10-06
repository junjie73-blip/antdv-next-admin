import type { TabItem } from '@antdv-admin/types'

import { computed, ref, watch } from 'vue'

import { cache } from '~/utils'

/**
 * 标签页状态中心。
 *
 * 拆出 store 的原因：
 * - 布局层（隐藏侧边栏/头部）、页面缓存（keep-alive include）、设置面板都要读标签状态，
 *   放在组件内部只能靠 emit 层层透传；
 * - 拖拽排序、关闭左右、放大等操作是纯数据变换，store 化后才能被单元测试覆盖。
 */
const CACHE_KEY = 'tabsState'

/** 持久化结构：只存数据，运行态（maximized）不入库，刷新后回到正常布局 */
interface CachedTabsState {
  activeKey: string
  tabs: TabItem[]
}

function readCache(): CachedTabsState {
  const cached = cache.getItem(CACHE_KEY) as Partial<CachedTabsState> | null
  const tabs = Array.isArray(cached?.tabs) ? cached!.tabs : []
  return {
    tabs,
    // 缓存里的 activeKey 可能指向已被删除的标签，交给 store 初始化后再校验
    activeKey: typeof cached?.activeKey === 'string' ? cached.activeKey : '',
  }
}

export const useTabsStore = defineStore('tabs', () => {
  const initial = readCache()

  const tabs = ref<TabItem[]>(initial.tabs)
  const activeKey = ref<string>(initial.activeKey)
  /** 「放大当前标签页」：隐藏侧边栏、头部、标签栏，让内容区占满视口 */
  const maximizedKey = ref<string>('')

  watch(
    [tabs, activeKey],
    () => {
      cache.setItem(CACHE_KEY, {
        activeKey: activeKey.value,
        tabs: tabs.value,
      } satisfies CachedTabsState)
    },
    { deep: true },
  )

  const isMaximized = computed(() => maximizedKey.value !== '')

  const activeTab = computed(
    () => tabs.value.find((tab) => tab.key === activeKey.value) ?? null,
  )

  /** 固定标签（首页）数量：决定可拖拽区间与「关闭其他」的保留集合 */
  const affixCount = computed(
    () => tabs.value.filter((tab) => tab.affix).length,
  )

  /** 首页永远排在最前，且不可关闭 */
  function ensureHome(home: TabItem) {
    const existing = tabs.value.find((tab) => tab.affix)
    if (!existing) {
      tabs.value.unshift(home)
      return
    }
    // 菜单异步加载后首页标题/图标可能补全，需要覆盖字段但不能改变位置
    Object.assign(existing, home)
    if (tabs.value[0]?.key !== existing.key) {
      tabs.value = [existing, ...tabs.value.filter((tab) => tab !== existing)]
    }
  }

  function add(tab: TabItem) {
    const exists = tabs.value.some((item) => item.key === tab.key)
    if (exists) return
    tabs.value.push(tab)
  }

  function setActive(key: string) {
    if (tabs.value.some((tab) => tab.key === key)) activeKey.value = key
  }

  function tabIndex(key: string) {
    return tabs.value.findIndex((tab) => tab.key === key)
  }

  /** 可关闭判定：固定标签与「仅剩一个」保护在这里集中，组件不再各自判断 */
  function isClosable(key: string): boolean {
    const tab = tabs.value.find((item) => item.key === key)
    if (!tab || tab.affix) return false
    return tabs.value.length > affixCount.value
  }

  /**
   * 关闭标签。
   * 返回下一个应该激活的 key（由调用方决定如何跳转），store 不依赖 router，
   * 避免 pinia store ↔ 路由实例的循环引用。
   */
  function remove(key: string): string | undefined {
    if (!isClosable(key)) return undefined
    const index = tabIndex(key)
    if (index === -1) return undefined

    tabs.value.splice(index, 1)
    if (maximizedKey.value === key) maximizedKey.value = ''
    if (activeKey.value !== key) return undefined

    const next = tabs.value[index] ?? tabs.value[index - 1] ?? tabs.value[0]
    return next?.key
  }

  /** 关闭除目标外的所有可关闭标签；目标缺失时退回当前激活标签 */
  function closeOthers(key?: string) {
    const keep = key && tabIndex(key) !== -1 ? key : activeKey.value
    tabs.value = tabs.value.filter((tab) => tab.affix || tab.key === keep)
    if (tabIndex(activeKey.value) === -1) setActive(keep)
    if (maximizedKey.value && tabIndex(maximizedKey.value) === -1) {
      maximizedKey.value = ''
    }
    return keep
  }

  /** 关闭左侧：以「可关闭」为准，固定标签永远保留 */
  function closeLeft(key: string) {
    const index = tabIndex(key)
    if (index <= 0) return
    tabs.value = tabs.value.filter(
      (tab, i) => i >= index || tab.affix || tab.key === activeKey.value,
    )
    if (tabIndex(activeKey.value) === -1) setActive(key)
  }

  function closeRight(key: string) {
    const index = tabIndex(key)
    if (index === -1 || index === tabs.value.length - 1) return
    tabs.value = tabs.value.filter(
      (tab, i) => i <= index || tab.affix || tab.key === activeKey.value,
    )
    if (tabIndex(activeKey.value) === -1) setActive(key)
  }

  /** 关闭全部：只保留固定标签，并把激活项切回首页 */
  function closeAll(): string | undefined {
    tabs.value = tabs.value.filter((tab) => tab.affix)
    const home = tabs.value[0]
    if (home) setActive(home.key)
    maximizedKey.value = ''
    return home?.key
  }

  /**
   * 拖拽排序。
   * `from`/`to` 是拖拽前后的下标；固定标签不允许被挤到后面，也不允许别人插到它前面。
   */
  function move(from: number, to: number): boolean {
    if (from === to) return false
    const moved = tabs.value[from]
    const target = tabs.value[to]
    if (!moved || !target) return false
    if (moved.affix || target.affix) return false

    const next = [...tabs.value]
    next.splice(from, 1)
    next.splice(to, 0, moved)
    tabs.value = next
    return true
  }

  /** 放大 / 还原：再次放大同一个标签即为还原 */
  function toggleMaximize(key?: string): boolean {
    const target = key ?? activeKey.value
    if (!target) return false
    maximizedKey.value = maximizedKey.value === target ? '' : target
    return isMaximized.value
  }

  function restore() {
    maximizedKey.value = ''
  }

  function reset() {
    tabs.value = []
    activeKey.value = ''
    maximizedKey.value = ''
    cache.removeItem(CACHE_KEY)
  }

  return {
    activeKey,
    activeTab,
    add,
    affixCount,
    closeAll,
    closeLeft,
    closeOthers,
    closeRight,
    ensureHome,
    tabIndex,
    isClosable,
    isMaximized,
    maximizedKey,
    move,
    remove,
    reset,
    restore,
    setActive,
    tabs,
    toggleMaximize,
  }
})
