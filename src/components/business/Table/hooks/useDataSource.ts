import type {
  FetchParams,
  FetchSetting,
  Recordable,
  UseDataSourceOptions,
  UseDataSourceReturn,
} from '../types'
import { useTimeoutFn } from '@vueuse/core'
import { cloneDeep, isFunction, isPlainObject } from 'es-toolkit'
import { ref, unref, watch } from 'vue'

/**
 * 默认分页字段配置
 */
const DEFAULT_FETCH_SETTING: FetchSetting = {
  pageField: 'page',
  sizeField: 'pageSize',
  listField: 'items',
  totalField: 'total',
}

/**
 * 数据管理 Hook
 * 为什么需要：统一管理表格数据的获取、缓存和更新
 */
export function useDataSource(options: UseDataSourceOptions): UseDataSourceReturn {
  const {
    api,
    params,
    dataSource,
    beforeFetch,
    afterFetch,
    fetchSetting = DEFAULT_FETCH_SETTING,
    rowKey = 'id',
    immediate = true,
    pagination,
    loading,
  } = options

  // 数据列表
  const dataSourceRef = ref<Recordable[]>([])
  // 原始数据（未处理）
  const rawDataSourceRef = ref<Recordable[]>([])
  // 当前请求参数
  const currentParamsRef = ref<FetchParams>({})

  /**
   * 获取 rowKey 值
   */
  const getRowKeyValue = (record: Recordable): string => {
    const key = unref(rowKey)
    if (isFunction(key)) {
      return key(record)
    }
    return record[key!] as string
  }

  /**
   * 构建请求参数
   */
  const buildFetchParams = (opt?: FetchParams): FetchParams => {
    const setting = { ...DEFAULT_FETCH_SETTING, ...fetchSetting }
    const { pageField, sizeField } = setting

    // 合并参数 - 使用不同的变量名避免冲突
    const mergedParams: FetchParams = {
      ...unref(currentParamsRef),
      ...unref(options.params),
      ...opt,
    }

    // 将 searchInfo 展开到顶层，避免嵌套对象被 alova 序列化为 [object Object]
    const searchData = mergedParams.searchInfo
    if (searchData && isPlainObject(searchData)) {
      delete mergedParams.searchInfo
      Object.assign(mergedParams, searchData)
    }

    // 添加分页参数
    if (pagination) {
      const paginationInfo = pagination.getPagination()
      if (paginationInfo && isPlainObject(paginationInfo)) {
        const recordableParams = mergedParams as Recordable
        recordableParams[pageField!] = paginationInfo.current || 1
        recordableParams[sizeField!] = paginationInfo.pageSize || 10
      }
    }

    return mergedParams
  }

  /**
   * 处理返回数据
   */
  const processData = (res: Recordable): Recordable[] => {
    const setting = { ...DEFAULT_FETCH_SETTING, ...fetchSetting }
    const { listField } = setting

    // 从响应中提取数据列表
    let data: Recordable[] = []
    if (listField && listField in res) {
      data = res[listField] as Recordable[]
    }
    else if ('data' in res && Array.isArray(res.data)) {
      data = res.data as Recordable[]
    }
    else if ('list' in res && Array.isArray(res.list)) {
      data = res.list as Recordable[]
    }
    else if ('records' in res && Array.isArray(res.records)) {
      data = res.records as Recordable[]
    }
    else if (Array.isArray(res)) {
      data = res
    }

    // 后处理
    if (afterFetch && isFunction(afterFetch)) {
      data = afterFetch(data)
    }

    return data
  }

  /**
   * 处理返回的分页信息
   */
  const processPagination = (res: Recordable): { total: number } => {
    const setting = { ...DEFAULT_FETCH_SETTING, ...fetchSetting }
    const { totalField } = setting

    let total = 0
    if (totalField && totalField in res) {
      total = res[totalField] as number
    }
    else if ('totalCount' in res) {
      total = res.totalCount as number
    }
    else if ('total' in res) {
      total = res.total as number
    }

    return { total }
  }

  /**
   * 获取数据
   */
  const fetch = async (opt?: FetchParams): Promise<void> => {
    const apiFn = unref(api)
    if (!apiFn || !isFunction(apiFn)) {
      // 如果没有 API，使用传入的数据源
      const sourceData = unref(dataSource)
      if (sourceData) {
        dataSourceRef.value = sourceData
        rawDataSourceRef.value = sourceData
      }
      return
    }

    // 开始加载
    loading?.setLoading(true)

    try {
      // 构建参数
      let fetchParams = buildFetchParams(opt)

      // 前置处理
      if (beforeFetch && isFunction(beforeFetch)) {
        const result = beforeFetch(fetchParams)
        if (result === false) {
          // 返回 false 取消请求
          return
        }
        fetchParams = result
      }

      // 保存当前参数
      currentParamsRef.value = fetchParams

      // 执行请求
      const res = await apiFn(fetchParams)

      // 处理数据
      const data = processData(res)
      const { total } = processPagination(res)

      // 更新数据
      dataSourceRef.value = data
      rawDataSourceRef.value = cloneDeep(data)

      // 更新分页
      if (pagination && total > 0) {
        pagination.setPagination({ total })
      }
    }
    catch (error) {
      console.error('[useDataSource] fetch error:', error)
      // 请求失败，保留旧数据或清空
      // dataSourceRef.value = []
      // rawDataSourceRef.value = []
    }
    finally {
      loading?.setLoading(false)
    }
  }

  /**
   * 重新加载（重置到第一页）
   */
  const reload = async (opt?: FetchParams): Promise<void> => {
    // 重置分页到第一页
    if (pagination) {
      pagination.setPagination({ current: 1 })
    }
    await fetch({ ...opt, page: 1 })
  }

  /**
   * 设置表格数据
   */
  const setTableData = (data: Recordable[]) => {
    dataSourceRef.value = data
    rawDataSourceRef.value = cloneDeep(data)
  }

  /**
   * 插入数据
   */
  const insertTableDataRecord = (record: Recordable | Recordable[], index?: number) => {
    const records = Array.isArray(record) ? record : [record]
    const insertIndex = index ?? dataSourceRef.value.length
    dataSourceRef.value.splice(insertIndex, 0, ...records)
    rawDataSourceRef.value = cloneDeep(dataSourceRef.value)
  }

  /**
   * 删除数据
   */
  const deleteTableDataRecord = (key: string | string[]) => {
    const keys = Array.isArray(key) ? key : [key]
    const keySet = new Set(keys)

    dataSourceRef.value = dataSourceRef.value.filter((record) => {
      const recordKey = getRowKeyValue(record)
      return !keySet.has(recordKey)
    })
    rawDataSourceRef.value = cloneDeep(dataSourceRef.value)
  }

  /**
   * 更新数据
   */
  const updateTableDataRecord = (key: string, record: Recordable) => {
    const index = dataSourceRef.value.findIndex((item) => {
      return getRowKeyValue(item) === key
    })

    if (index > -1) {
      dataSourceRef.value[index] = { ...dataSourceRef.value[index], ...record }
      rawDataSourceRef.value = cloneDeep(dataSourceRef.value)
    }
  }

  /**
   * 查找数据
   */
  const findTableDataRecord = (key: string): Recordable | undefined => {
    return dataSourceRef.value.find((record) => {
      return getRowKeyValue(record) === key
    })
  }

  /**
   * 监听数据源变化（当没有 API 时）
   */
  watch(
    () => unref(dataSource),
    (newData) => {
      const apiFn = unref(api)
      if (!apiFn && newData) {
        dataSourceRef.value = newData
        rawDataSourceRef.value = cloneDeep(newData)
      }
    },
    { immediate: true, deep: true },
  )

  /**
   * 立即执行数据获取
   */
  if (immediate) {
    useTimeoutFn(() => {
      fetch()
    }, 0)
  }

  return {
    dataSourceRef,
    rawDataSourceRef,
    fetch,
    reload,
    setTableData,
    insertTableDataRecord,
    deleteTableDataRecord,
    updateTableDataRecord,
    findTableDataRecord,
  }
}
