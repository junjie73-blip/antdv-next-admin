import type { PaginationProps as AntPaginationProps } from 'antdv-next'
import type { UsePaginationOptions, UsePaginationReturn } from '../types'
import { isPlainObject } from 'es-toolkit'
import { computed, ref, unref } from 'vue'

// 使用原生方法替代 es-toolkit
const _isBoolean = (val: unknown): val is boolean => typeof val === 'boolean'

/**
 * 默认分页配置
 */
const DEFAULT_PAGINATION_CONFIG: AntPaginationProps = {
  current: 1,
  pageSize: 10,
  total: 0,
  showTotal: (total: number) => `共 ${total} 条`,
  showSizeChanger: true,
  showQuickJumper: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  size: 'middle',
}

/**
 * 分页管理 Hook
 * 为什么需要：统一管理表格分页状态和逻辑
 */
export function usePagination(options: UsePaginationOptions): UsePaginationReturn {
  const { pagination } = options

  // 是否显示分页
  const showPaginationRef = ref(true)
  // 分页配置
  const paginationRef = ref<AntPaginationProps | false>({ ...DEFAULT_PAGINATION_CONFIG })

  /**
   * 获取分页配置
   */
  const getPagination = computed((): AntPaginationProps | false => {
    const config = unref(pagination)

    // 如果分页配置为 false，不显示分页
    if (config === false) {
      return false
    }

    // 如果分页配置为 true，使用默认配置
    if (config === true) {
      return unref(paginationRef) || DEFAULT_PAGINATION_CONFIG
    }

    // 合并配置
    // 优先级：paginationRef（内部状态）> config（传入的配置）> DEFAULT_PAGINATION_CONFIG（默认配置）
    // 这样 setPagination 设置的 current 和 pageSize 不会被 props 覆盖
    return {
      ...DEFAULT_PAGINATION_CONFIG,
      ...config,
      ...unref(paginationRef),
    }
  })

  /**
   * 设置分页配置
   */
  const setPagination = (paginationInfo: Partial<AntPaginationProps>) => {
    const currentPagination = unref(paginationRef)
    if (currentPagination === false) {
      paginationRef.value = { ...DEFAULT_PAGINATION_CONFIG, ...paginationInfo }
    }
    else {
      paginationRef.value = { ...currentPagination, ...paginationInfo }
    }
  }

  /**
   * 设置是否显示分页
   */
  const setShowPagination = (show: boolean): void => {
    showPaginationRef.value = show
    if (!show) {
      paginationRef.value = false
    }
    else {
      paginationRef.value = { ...DEFAULT_PAGINATION_CONFIG }
    }
  }

  /**
   * 获取是否显示分页
   */
  const getShowPagination = (): boolean => {
    return showPaginationRef.value
  }

  /**
   * 初始化分页配置
   */
  const initPagination = () => {
    const config = unref(pagination)

    if (config === false) {
      paginationRef.value = false
      showPaginationRef.value = false
    }
    else if (isPlainObject(config)) {
      paginationRef.value = { ...DEFAULT_PAGINATION_CONFIG, ...config }
      showPaginationRef.value = true
    }
    else {
      paginationRef.value = { ...DEFAULT_PAGINATION_CONFIG }
      showPaginationRef.value = true
    }
  }

  // 初始化
  initPagination()

  return {
    paginationRef,
    getPagination,
    setPagination,
    setShowPagination,
    getShowPagination,
  }
}
