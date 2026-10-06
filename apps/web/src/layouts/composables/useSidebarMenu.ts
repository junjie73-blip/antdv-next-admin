import type { MenuProps } from 'antdv-next'

import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useAppStore } from '~/stores/modules/app'
import {
  buildMenuItems,
  findAncestorKeys,
  menuKeyOf,
} from '~/utils/helpers/menu'

import { useMenuTree } from './useMenuTree'

/**
 * 侧边栏菜单状态。
 *
 * 数据源随布局切换：
 * - vertical：整棵菜单树（一级为目录，二级/三级在内部展开）
 * - mixed：只渲染当前选中一级菜单的子节点，即「二级菜单」
 *
 * 选中态与展开态都由路由推导（key 走 `menuKeyOf`），因此导航栏点击一级菜单、
 * 侧边栏点击二级菜单、标签页、面包屑四者的高亮永远一致，不依赖任何本地记录。
 */
export function useSidebarMenu() {
  const route = useRoute()
  const appStore = useAppStore()
  const { menus, activeTopChildren, activeLeafKey, openMenuByKey } =
    useMenuTree()

  const isMixed = computed(() => appStore.layout === 'mixed')

  const sourceMenus = computed(() =>
    isMixed.value ? activeTopChildren.value : menus.value,
  )

  const menuItems = computed<MenuProps['items']>(() =>
    buildMenuItems(sourceMenus.value),
  )

  const selectedKeys = computed(() => {
    const key = activeLeafKey.value ?? (route.name as string | undefined)
    return key ? [key] : []
  })

  /** 用户手动展开过之后不再被路由同步覆盖，避免「点开的菜单自己收起」 */
  const userControlled = ref(false)
  const openKeys = ref<string[]>([])

  function syncOpenKeys() {
    if (userControlled.value) return
    openKeys.value = findAncestorKeys(sourceMenus.value, selectedKeys.value[0])
  }

  /**
   * 手风琴：只保留「本次展开项 + 它的祖先链」。
   * 直接截断成最后一个 key 会让三级菜单的父级被收起，看起来像点了没反应。
   */
  const handleOpenChange: MenuProps['onOpenChange'] = (keys) => {
    userControlled.value = true
    const next = keys as string[]

    if (!appStore.menuAccordion || !next.length) {
      openKeys.value = next
      return
    }

    const added = next.find((key) => !openKeys.value.includes(key))
    openKeys.value = added
      ? [...findAncestorKeys(sourceMenus.value, added), added]
      : next
  }

  const handleSelect: MenuProps['onSelect'] = ({ key }) => {
    openMenuByKey(key as string)
  }

  // 切换一级菜单 / 菜单数据变化时重新定位展开链
  watch(
    [() => sourceMenus.value, selectedKeys],
    () => {
      userControlled.value = false
      syncOpenKeys()
    },
    { immediate: true },
  )

  return {
    isMixed,
    menuItems,
    openKeys,
    selectedKeys,
    sourceMenus,
    handleOpenChange,
    handleSelect,
    syncOpenKeys,
    menuKeyOf,
  }
}
