import type {
  Recordable,
  TableRowSelection,
  UseRowSelectionOptions,
  UseRowSelectionReturn,
} from '../types'
import { isBoolean, isFunction } from 'es-toolkit'
import { computed, ref, unref, watch } from 'vue'

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

  // 选中的行 keys
  const selectedRowKeysRef = ref<string[]>([])
  // 选中的行数据
  const selectedRowsRef = ref<Recordable[]>([])

  /**
   * 获取 rowKey 值
   */
  const getRowKeyValue = (record: Recordable): string => {
    const key = unref(rowKey)
    if (isFunction(key)) {
      return key(record)
    }
    return record[key] as string
  }

  /**
   * 获取行选择配置
   */
  const getRowSelection = computed((): TableRowSelection | null => {
    const config = unref(rowSelection)

    if (!config) {
      return null
    }

    // 如果是布尔值，使用默认配置
    if (isBoolean(config)) {
      if (!config)
        return null
      return {
        type: 'checkbox',
        selectedRowKeys: selectedRowKeysRef.value,
        onChange: onSelectionChange,
      }
    }

    // 合并配置
    return {
      type: 'checkbox',
      ...config,
      selectedRowKeys: selectedRowKeysRef.value,
      onChange: onSelectionChange,
    }
  })

  /**
   * 选择改变回调
   */
  function onSelectionChange(
    keys: string[] | number[],
    rows: Recordable[],
    info?: { type: string },
  ): void {
    // 将 keys 转换为字符串数组
    const stringKeys = keys.map(String)
    selectedRowKeysRef.value = stringKeys
    selectedRowsRef.value = rows

    // 调用用户配置的回调
    const config = unref(rowSelection)
    if (!isBoolean(config) && config?.onChange) {
      config.onChange(keys, rows, info as { type: 'all' | 'single' | 'multiple' })
    }
  }

  /**
   * 清空选中
   */
  const clearSelectedRowKeys = () => {
    selectedRowKeysRef.value = []
    selectedRowsRef.value = []
  }

  /**
   * 删除指定 key 的选中
   */
  const deleteSelectRowByKey = (key: string) => {
    const index = selectedRowKeysRef.value.indexOf(key)
    if (index > -1) {
      selectedRowKeysRef.value.splice(index, 1)
      selectedRowsRef.value.splice(index, 1)
    }
  }

  /**
   * 设置选中的 keys
   */
  const setSelectedRowKeys = (keys: string[]) => {
    selectedRowKeysRef.value = keys

    // 同步更新 selectedRows
    if (dataSourceRef?.value) {
      const keySet = new Set(keys)
      selectedRowsRef.value = dataSourceRef.value.filter((row) => {
        return keySet.has(getRowKeyValue(row))
      })
    }
  }

  /**
   * 获取选中的行
   */
  const getSelectRows = (): Recordable[] => {
    return selectedRowsRef.value
  }

  /**
   * 监听数据源变化，同步更新选中行数据
   * 为什么需要：数据源刷新后，选中行的引用可能失效，需要重新匹配
   */
  if (dataSourceRef) {
    watch(
      () => dataSourceRef.value,
      (newData) => {
        if (selectedRowKeysRef.value.length === 0) {
          return
        }

        // 如果配置了分页切换清空选择
        if (clearSelectOnPageChange) {
          clearSelectedRowKeys()
          return
        }

        // 重新匹配选中行数据
        const keySet = new Set(selectedRowKeysRef.value)
        selectedRowsRef.value = newData.filter((row) => {
          return keySet.has(getRowKeyValue(row))
        })
      },
      { immediate: true },
    )
  }

  return {
    selectedRowKeysRef,
    selectedRowsRef,
    getRowSelection,
    clearSelectedRowKeys,
    deleteSelectRowByKey,
    setSelectedRowKeys,
    getSelectRows,
  }
}
