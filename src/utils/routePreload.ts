/**
 * 路由预加载工具
 *
 * 优化策略：
 * 1. 鼠标悬停菜单时预加载目标页面组件
 * 2. 使用 requestIdleCallback 在空闲时预加载
 * 3. 智能预测：基于用户行为预测下一个可能访问的页面
 * 4. 缓存管理：限制预加载数量，避免内存溢出
 *
 * 使用场景：
 * - 侧边栏/顶部菜单 hover 时触发
 * - 用户在当前页面停留超过一定时间后触发
 * - 路由变化前提前加载下一个可能的页面
 */

import type { RouteLocationRaw } from 'vue-router'
import { tryOnScopeDispose } from '@vueuse/core'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

// 预加载缓存（已预加载的路由路径）
const preloadedRoutes = new Set<string>()

// 最大预加载数量（防止内存溢出）
const MAX_PRELOAD_COUNT = 5

// 当前预加载数量
let preloadCount = 0

/**
 * 预加载路由组件
 *
 * @param to - 目标路由（路径或路由对象）
 * @returns Promise 是否成功预加载
 */
export async function preloadRoute(to: string | RouteLocationRaw): Promise<boolean> {
  // 解析路径
  const path = typeof to === 'string' ? to : (to as any).path || ''

  if (!path) {
    console.warn('[RoutePreload] 无效的目标路径')
    return false
  }

  // 已预加载过，跳过
  if (preloadedRoutes.has(path)) {
    return true
  }

  // 超过最大数量，清理最早的
  if (preloadCount >= MAX_PRELOAD_COUNT) {
    const firstPath = preloadedRoutes.values().next().value
    if (firstPath) {
      preloadedRoutes.delete(firstPath)
      preloadCount--
      console.log(`[RoutePreload] 清理缓存: ${firstPath}`)
    }
  }

  try {
    // 动态导入组件（触发 Webpack/Vite 的代码分割）
    const router = useRouter()

    // 尝试匹配路由并获取组件
    const matched = router.resolve(path).matched

    if (matched.length > 0) {
      // 预加载所有匹配的路由组件
      const loadPromises = matched
        .map(record => record.components)
        .filter(Boolean)
        .flatMap(components =>
          Object.values(components).map((component: any) => {
            // 如果是动态导入函数，调用它来触发加载
            if (typeof component === 'function') {
              return component()
            }
            return null
          }),
        )
        .filter(Boolean)

      await Promise.all(loadPromises)

      // 标记为已预加载
      preloadedRoutes.add(path)
      preloadCount++

      console.log(`[RoutePreload] ✅ 成功预加载: ${path}`)
      return true
    }
    else {
      console.warn(`[RoutePreload] 未找到匹配路由: ${path}`)
      return false
    }
  }
  catch (error) {
    console.error(`[RoutePreload] ❌ 预加载失败: ${path}`, error)
    return false
  }
}

/**
 * 批量预加载多个路由
 *
 * @param routes - 路径数组
 */
export async function preloadRoutes(routes: string[]): Promise<void> {
  // 限制并发数
  const CONCURRENT_LIMIT = 2
  const chunks: string[][] = []

  for (let i = 0; i < routes.length; i += CONCURRENT_LIMIT) {
    chunks.push(routes.slice(i, i + CONCURRENT_LIMIT))
  }

  for (const chunk of chunks) {
    await Promise.allSettled(chunk.map(route => preloadRoute(route)))
  }
}

/**
 * Composable: useRoutePreloader
 *
 * 提供响应式的路由预加载功能，
 * 可用于侧边栏菜单等场景
 */
export function useRoutePreloader() {
  const router = useRouter()

  // 预加载状态
  const isPreloading = ref(false)
  const preloadedPaths = ref<string[]>([])

  /**
   * 预加载指定路径
   */
  async function prefetch(path: string): Promise<boolean> {
    isPreloading.value = true

    try {
      const success = await preloadRoute(path)

      if (success) {
        preloadedPaths.value.push(path)
      }

      return success
    }
    finally {
      isPreloading.value = false
    }
  }

  /**
   * 预测并预加载下一个可能的页面
   * 基于当前路径推断用户可能访问的相邻页面
   */
  async function predictAndPreload(): Promise<void> {
    const currentPath = router.currentRoute.value.path

    // 定义常见的相邻路径映射
    const adjacencyMap: Record<string, string[]> = {
      '/dashboard/echarts': ['/dashboard/analysis', '/system/user'],
      '/system/user': ['/system/role', '/system/dept'],
      '/system/role': ['/system/user', '/system/menu'],
      '/components/basic': ['/components/form/basic', '/components/table/basic'],
      '/account/center': ['/account/settings'],
    }

    // 获取候选路径
    const candidates = adjacencyMap[currentPath] || []

    if (candidates.length > 0) {
      // 只预加载第一个候选（最可能的）
      await prefetch(candidates[0])
    }
  }

  /**
   * 空闲时智能预加载
   */
  function idlePreload(): void {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(
        () => {
          predictAndPreload()
        },
        { timeout: 3000 },
      )
    }
    else {
      setTimeout(predictAndPreload, 2000)
    }
  }

  // 清理函数
  function cleanup() {
    preloadedRoutes.clear()
    preloadCount = 0
    preloadedPaths.value = []
  }

  // 组件卸载时自动清理
  tryOnScopeDispose(cleanup)

  return {
    // 状态
    isPreloading,
    preloadedPaths,

    // 方法
    prefetch,
    predictAndPreload,
    idlePreload,
    cleanup,
  }
}
