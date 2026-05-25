import type { ComputedRef, Ref } from 'vue'
import type { Recordable } from '../types'
import { computed, ref, watch } from 'vue'

export interface UseTreeDataOptions {
  dataSource: Ref<Recordable[]>
  isTree: ComputedRef<boolean>
  childrenField?: string
  rowKey: string | ((record: Recordable) => string)
  defaultExpandAll?: boolean
  expandedKeys?: Ref<string[]>
  loadData?: (record: Recordable) => Promise<Recordable[]>
}

export interface UseTreeDataReturn {
  flatData: ComputedRef<Recordable[]>
  expandedKeysRef: Ref<string[]>
  expandRow: (key: string) => void
  collapseRow: (key: string) => void
  toggleExpand: (key: string) => void
  expandAll: () => void
  collapseAll: () => void
  isExpanded: (key: string) => boolean
  hasChildren: (record: Recordable) => boolean
  getLevel: (record: Recordable) => number
  getChildren: (record: Recordable) => Recordable[]
}

/**
 * 树形数据 Hook
 * 为什么需要：处理树形数据的展开/折叠、异步加载等功能
 */
export function useTreeData(options: UseTreeDataOptions): UseTreeDataReturn {
  const {
    dataSource,
    isTree,
    childrenField = 'children',
    rowKey,
    defaultExpandAll = false,
    expandedKeys,
    loadData,
  } = options

  // 展开的节点 keys
  const expandedKeysRef = ref<string[]>(expandedKeys?.value || [])
  // 加载状态
  const loadingKeys = ref<Set<string>>(new Set())
  // 层级缓存
  const levelMap = ref<Map<string, number>>(new Map())

  /**
   * 获取 rowKey 值
   */
  const getRowKeyValue = (record: Recordable): string => {
    if (typeof rowKey === 'function') {
      return rowKey(record)
    }
    return record[rowKey] as string
  }

  /**
   * 获取子节点
   */
  const getChildren = (record: Recordable): Recordable[] => {
    return record[childrenField] || []
  }

  /**
   * 是否有子节点
   */
  const hasChildren = (record: Recordable): boolean => {
    const children = getChildren(record)
    return Array.isArray(children) && children.length > 0
  }

  /**
   * 是否展开
   */
  const isExpanded = (key: string): boolean => {
    return expandedKeysRef.value.includes(key)
  }

  /**
   * 展开行
   */
  const expandRow = async (key: string) => {
    if (isExpanded(key))
      return

    // 如果需要异步加载数据
    if (loadData) {
      const record = findRecordByKey(dataSource.value, key)
      if (record && !hasChildren(record) && !loadingKeys.value.has(key)) {
        loadingKeys.value.add(key)
        try {
          const children = await loadData(record)
          record[childrenField] = children
        }
        finally {
          loadingKeys.value.delete(key)
        }
      }
    }

    expandedKeysRef.value = [...expandedKeysRef.value, key]
  }

  /**
   * 折叠行
   */
  const collapseRow = (key: string) => {
    expandedKeysRef.value = expandedKeysRef.value.filter(k => k !== key)
  }

  /**
   * 切换展开状态
   */
  const toggleExpand = (key: string) => {
    if (isExpanded(key)) {
      collapseRow(key)
    }
    else {
      expandRow(key)
    }
  }

  /**
   * 展开所有
   */
  const expandAll = () => {
    const keys: string[] = []
    const traverse = (data: Recordable[]) => {
      data.forEach((record) => {
        const key = getRowKeyValue(record)
        keys.push(key)
        const children = getChildren(record)
        if (children.length > 0) {
          traverse(children)
        }
      })
    }
    traverse(dataSource.value)
    expandedKeysRef.value = keys
  }

  /**
   * 折叠所有
   */
  const collapseAll = () => {
    expandedKeysRef.value = []
  }

  /**
   * 获取层级
   */
  const getLevel = (record: Recordable): number => {
    const key = getRowKeyValue(record)
    return levelMap.value.get(key) || 0
  }

  /**
   * 根据 key 查找记录
   */
  const findRecordByKey = (data: Recordable[], key: string): Recordable | null => {
    for (const record of data) {
      const recordKey = getRowKeyValue(record)
      if (recordKey === key) {
        return record
      }
      const children = getChildren(record)
      if (children.length > 0) {
        const found = findRecordByKey(children, key)
        if (found)
          return found
      }
    }
    return null
  }

  /**
   * 扁平化树形数据
   */
  const flatData = computed(() => {
    if (!isTree.value)
      return dataSource.value

    const result: Recordable[] = []
    levelMap.value = new Map()

    const traverse = (data: Recordable[], level: number) => {
      data.forEach((record) => {
        const key = getRowKeyValue(record)
        levelMap.value.set(key, level)
        result.push(record)

        // 如果展开，递归处理子节点
        if (isExpanded(key)) {
          const children = getChildren(record)
          if (children.length > 0) {
            traverse(children, level + 1)
          }
        }
      })
    }

    traverse(dataSource.value, 0)
    return result
  })

  // 监听 expandedKeys 变化
  watch(
    () => expandedKeys?.value,
    (newVal) => {
      if (newVal) {
        expandedKeysRef.value = newVal
      }
    },
    { immediate: true },
  )

  // 默认展开所有
  watch(
    () => dataSource.value,
    () => {
      if (defaultExpandAll && isTree.value) {
        expandAll()
      }
    },
    { immediate: true, once: true },
  )

  return {
    flatData,
    expandedKeysRef,
    expandRow,
    collapseRow,
    toggleExpand,
    expandAll,
    collapseAll,
    isExpanded,
    hasChildren,
    getLevel,
    getChildren,
  }
}
