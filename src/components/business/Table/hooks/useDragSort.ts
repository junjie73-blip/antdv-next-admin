import type { Ref } from 'vue'

import { isFunction } from 'es-toolkit'
import Sortable from 'sortablejs'
import { onUnmounted } from 'vue'

import type { Recordable } from '../types'

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

export function useDragSort(options: UseDragSortOptions): UseDragSortReturn {
  const {
    dataSource,
    enabled,
    handle,
    animation = 150,
    disabled,
    onDragEnd,
    canDrop,
  } = options

  let sortableInstance: Sortable | null = null

  const isDisabled = (record: Recordable): boolean =>
    isFunction(disabled) ? disabled(record) : (disabled ?? false)

  const initSortable = (el: HTMLElement) => {
    if (!enabled || sortableInstance) return

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
        if (!canDrop) return true
        const dragIndex =
          (evt as any).draggedRowIndex ?? (evt as any).oldIndex ?? 0
        const dropIndex =
          (evt as any).relatedRowIndex ?? (evt as any).newIndex ?? 0
        const dragRecord = dataSource.value[dragIndex]
        const dropRecord = dataSource.value[dropIndex]
        if (!dragRecord || !dropRecord) return false
        return canDrop(dragRecord, dropRecord)
      },
      onEnd: (evt) => {
        const { oldIndex, newIndex } = evt
        if (oldIndex === newIndex || oldIndex == null || newIndex == null)
          return

        const oldData = [...dataSource.value]
        const newData = [...dataSource.value]
        const [movedItem] = newData.splice(oldIndex, 1)
        if (movedItem) newData.splice(newIndex, 0, movedItem)

        dataSource.value = newData
        onDragEnd?.(newData, oldData)
      },
    })
  }

  const destroySortable = () => {
    sortableInstance?.destroy()
    sortableInstance = null
  }

  onUnmounted(destroySortable)

  return { initSortable, destroySortable }
}
