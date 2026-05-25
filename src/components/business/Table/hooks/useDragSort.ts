import type { Ref } from 'vue'
import type { Recordable } from '../types'
import Sortable from 'sortablejs'
import { onUnmounted } from 'vue'

export interface UseDragSortOptions {
  dataSource: Ref<Recordable[]>
  enabled: boolean
  rowKey: string | ((record: Recordable) => string)
  handle?: string
  animation?: number
  disabled?: boolean | ((record: Recordable) => boolean)
  onDragEnd?: (newData: Recordable[], oldData: Recordable[]) => void
  canDrop?: (dragRecord: Recordable, dropRecord: Recordable) => boolean
}

export interface UseDragSortReturn {
  initSortable: (el: HTMLElement) => void
  destroySortable: () => void
}

/**
 * 拖拽排序 Hook
 * 为什么需要：实现表格行的拖拽排序功能
 */
export function useDragSort(options: UseDragSortOptions): UseDragSortReturn {
  const {
    dataSource,
    enabled,
    rowKey,
    handle,
    animation = 150,
    disabled,
    onDragEnd,
    canDrop,
  } = options

  // Sortable 实例
  let sortableInstance: Sortable | null = null

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
   * 检查是否禁用拖拽
   */
  const isDisabled = (record: Recordable): boolean => {
    if (typeof disabled === 'function') {
      return disabled(record)
    }
    return disabled ?? false
  }

  /**
   * 初始化 Sortable
   */
  const initSortable = (el: HTMLElement) => {
    if (!enabled || sortableInstance)
      return

    sortableInstance = new Sortable(el, {
      handle,
      animation,
      disabled: !enabled,
      onStart: (evt) => {
        const record = dataSource.value[evt.oldIndex!]
        if (record && isDisabled(record)) {
          evt.preventDefault()
          return false
        }
      },
      onMove: (evt) => {
        if (!canDrop)
          return true

        const dragIndex = (evt as any).draggedRowIndex ?? (evt as any).oldIndex ?? 0
        const dropIndex = (evt as any).relatedRowIndex ?? (evt as any).newIndex ?? 0
        const dragRecord = dataSource.value[dragIndex!]
        const dropRecord = dataSource.value[dropIndex!]

        if (!dragRecord || !dropRecord)
          return false

        return canDrop(dragRecord, dropRecord)
      },
      onEnd: (evt) => {
        const { oldIndex, newIndex } = evt

        if (oldIndex === newIndex)
          return

        // 保存旧数据
        const oldData = [...dataSource.value]

        // 移动数据
        const newData = [...dataSource.value]
        const [movedItem] = newData.splice(oldIndex!, 1)
        if (movedItem) {
          newData.splice(newIndex!, 0, movedItem)
        }

        // 更新数据源
        dataSource.value = newData

        // 触发回调
        onDragEnd?.(newData, oldData)
      },
    })
  }

  /**
   * 销毁 Sortable
   */
  const destroySortable = () => {
    if (sortableInstance) {
      sortableInstance.destroy()
      sortableInstance = null
    }
  }

  // 组件卸载时销毁
  onUnmounted(() => {
    destroySortable()
  })

  return {
    initSortable,
    destroySortable,
  }
}
