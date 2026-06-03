import type { BasicColumn, UseColumnsOptions, UseColumnsReturn } from '../types'
import { cloneDeep, isString } from 'es-toolkit'
import { ref, unref, watch } from 'vue'

// 使用原生 Array.isArray 替代 es-toolkit 的 isArray
const isArray = Array.isArray

/**
 * 列管理 Hook
 * 为什么需要：统一管理表格列的配置、缓存和更新
 */
export function useColumns(options: UseColumnsOptions): UseColumnsReturn {
  const {
    columns,
    showIndexColumn = false,
    indexColumnProps = {},
    actionColumn,
  } = options

  // 列数据
  const columnsRef = ref<BasicColumn[]>([])
  // 缓存列数据（用于重置）
  const cacheColumnsRef = ref<BasicColumn[]>([])

  /**
   * 获取序号列配置
   */
  const getIndexColumn = (): BasicColumn => ({
    key: 'index',
    dataIndex: 'index',
    title: '序号',
    width: 60,
    align: 'center',
    fixed: 'left',
    customRender: ({ index }) => index + 1,
    ...indexColumnProps,
  })

  /**
   * 获取操作列配置
   */
  const getActionColumn = (): BasicColumn | null => {
    const actionCol = unref(actionColumn)
    if (!actionCol)
      return null

    return {
      key: 'action',
      dataIndex: 'action',
      title: '操作',
      width: actionCol.width || 200,
      fixed: actionCol.fixed || 'right',
      align: 'center',
      ...actionCol,
    }
  }

  /**
   * 处理列配置
   * 为什么需要：根据配置添加序号列和操作列，并设置默认对齐方式
   */
  const processColumns = (cols: BasicColumn[]): BasicColumn[] => {
    const result: BasicColumn[] = []

    // 添加序号列
    if (unref(showIndexColumn)) {
      result.push(getIndexColumn())
    }

    // 添加数据列，设置默认 align 为 center
    const processedCols = cols.map(col => ({
      align: 'center' as const,
      ...col,
    }))
    result.push(...processedCols)

    // 添加操作列
    const actionCol = getActionColumn()
    if (actionCol) {
      result.push(actionCol)
    }

    return result
  }

  /**
   * 初始化列
   */
  const initColumns = () => {
    const rawColumns = unref(columns)
    if (!isArray(rawColumns))
      return

    const processed = processColumns(cloneDeep(rawColumns))
    columnsRef.value = processed
    cacheColumnsRef.value = processed
  }

  /**
   * 设置列
   * 支持传入列配置数组或列 key 数组（用于快速设置显示/隐藏）
   */
  const setColumns = (columnList: BasicColumn[] | string[]) => {
    if (!isArray(columnList))
      return

    // 如果是字符串数组，从缓存中查找对应列
    if (columnList.length > 0 && isString(columnList[0])) {
      const keys = columnList as string[]
      const newColumns: BasicColumn[] = []

      keys.forEach((key) => {
        const col = cacheColumnsRef.value.find(item => item.key === key || item.dataIndex === key)
        if (col) {
          newColumns.push(col)
        }
      })

      columnsRef.value = newColumns
    }
    else {
      // 直接设置列配置
      columnsRef.value = columnList as BasicColumn[]
    }
  }

  /**
   * 获取列
   */
  const getColumns = (): BasicColumn[] => {
    return unref(columnsRef)
  }

  /**
   * 获取缓存列
   */
  const getCacheColumns = (): BasicColumn[] => {
    return unref(cacheColumnsRef)
  }

  /**
   * 设置缓存列
   */
  const setCacheColumns = (cols: BasicColumn[]) => {
    cacheColumnsRef.value = cols
  }

  /**
   * 更新单个列
   */
  const updateColumn = (column: Partial<BasicColumn>, key: string) => {
    const index = columnsRef.value.findIndex(col => col.key === key || col.dataIndex === key)
    if (index > -1) {
      columnsRef.value[index] = { ...columnsRef.value[index], ...column }
    }
  }

  /**
   * 监听列配置变化
   */
  watch(
    () => unref(columns),
    () => {
      initColumns()
    },
    { immediate: true, deep: true },
  )

  /**
   * 监听序号列配置变化
   */
  watch(
    () => unref(showIndexColumn),
    () => {
      initColumns()
    },
    { immediate: true },
  )

  /**
   * 监听操作列配置变化
   */
  watch(
    () => unref(actionColumn),
    () => {
      initColumns()
    },
    { immediate: true, deep: true },
  )

  return {
    columnsRef,
    cacheColumnsRef,
    setColumns,
    getColumns,
    getCacheColumns,
    setCacheColumns,
    updateColumn,
  }
}
