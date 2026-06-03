import type {
  Recordable,
  TableRowSelection,
  UseRowSelectionOptions,
  UseRowSelectionReturn,
} from '../types'
import { isBoolean, isFunction } from 'es-toolkit'
import { computed, reactive, unref, watch } from 'vue'

/**
 * 行选择管理 Hook
 * 为什么需要：统一管理表格行选择的状态和逻辑
 */
export function useRowSelection(options: UseRowSelectionOptions): UseRowSelectionReturn {
  const {
    rowSelection,
    dataSourceRef,
    rowKey = 'id',
    clearSelectOnPageChange = false,
  } = options

  // 选中的行 keys（用 reactive 保持引用稳定，避免每次渲染新数组）
  const state = reactive({
    selectedRowKeys: [] as string[],
    selectedRows: [] as Recordable[],
  })

  /**
   * 获取 rowKey 值
   */
  const getRowKeyValue = (record: Recordable): string => {
    const key = unref(rowKey)
    if (isFunction(key)) {
      return key(record)
    }
    return String(record[key])
  }

  /**
   * 获取行选择配置 — 对齐官方 demo 模式
   * 官方写法：computed(() => ({ type, selectedRowKeys, onChange }))
   * 关键：selectedRowKeys 和 onChange 必须同时提供，且引用稳定
   */
  const getRowSelection = computed<TableRowSelection | null>(() => {
    const config = unref(rowSelection)

    if (!config) {
      return null
    }

    // 如果是布尔值，使用默认配置
    if (isBoolean(config)) {
      if (!config)
        return null
      return {
        type: 'checkbox' as const,
        selectedRowKeys: state.selectedRowKeys,
        onChange: onSelectionChange,
      }
    }

    // 合并用户配置：保留用户传入的属性（type、checkStrictly 等）
    // 但强制覆盖 selectedRowKeys 和 onChange 为内部管理的状态
    return {
      ...config,
      selectedRowKeys: state.selectedRowKeys,
      onChange: onSelectionChange,
    }
  })

  /**
   * 选择改变回调 — 对齐官方签名 (selectedRowKeys, selectedRows, info)
   * 官方 demo：onChange = (_selectedRowKeys, selectedRows) => { selectedRowKeys.value = _selectedRowKeys }
   */
  function onSelectionChange(
    keys: string[] | number[],
    rows: Recordable[],
    info?: { type: 'all' | 'single' | 'multiple' },
  ): void {
    // 直接用原始 key 类型，不做 String 转换
    // antdv-next 内部用 === 匹配，必须与 rowKey 返回值类型一致
    state.selectedRowKeys = keys as any
    state.selectedRows = rows

    // 调用用户配置的回调（如果用户自己传了 onChange）
    const config = unref(rowSelection)
    if (!isBoolean(config) && isFunction(config?.onChange)) {
      config.onChange(keys, rows, info)
    }
  }

  /**
   * 清空选中
   */
  const clearSelectedRowKeys = () => {
    state.selectedRowKeys = []
    state.selectedRows = []
  }

  /**
   * 删除指定 key 的选中
   */
  const deleteSelectRowByKey = (key: string) => {
    const index = state.selectedRowKeys.indexOf(key)
    if (index > -1) {
      state.selectedRowKeys.splice(index, 1)
      state.selectedRows.splice(index, 1)
    }
  }

  /**
   * 设置选中的 keys
   */
  const setSelectedRowKeys = (keys: string[]) => {
    state.selectedRowKeys = [...keys]

    // 同步更新 selectedRows
    if (dataSourceRef?.value) {
      const keySet = new Set(keys)
      state.selectedRows = dataSourceRef.value.filter((row) => {
        return keySet.has(getRowKeyValue(row))
      })
    }
  }

  /**
   * 获取选中的行
   */
  const getSelectRows = (): Recordable[] => {
    return state.selectedRows
  }

  /**
   * 监听数据源变化，同步更新选中行数据
   * 为什么需要：数据源刷新后，选中行的引用可能失效，需要重新匹配
   */
  if (dataSourceRef) {
    watch(
      () => dataSourceRef.value,
      (newData) => {
        if (state.selectedRowKeys.length === 0) {
          return
        }

        // 如果配置了分页切换清空选择
        if (clearSelectOnPageChange) {
          clearSelectedRowKeys()
          return
        }

        // 重新匹配选中行数据
        const keySet = new Set(state.selectedRowKeys)
        state.selectedRows = newData.filter((row) => {
          return keySet.has(getRowKeyValue(row))
        })
      },
      { immediate: true },
    )
  }

  return {
    selectedRowKeysRef: computed(() => state.selectedRowKeys),
    selectedRowsRef: computed(() => state.selectedRows),
    getRowSelection,
    clearSelectedRowKeys,
    deleteSelectRowByKey,
    setSelectedRowKeys,
    getSelectRows,
  }
}
