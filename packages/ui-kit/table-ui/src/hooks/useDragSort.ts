import type { Recordable, UseDragSortOptions, UseDragSortReturn } from '../types';

import { onUnmounted } from 'vue';

import { isFunction } from 'es-toolkit';
import Sortable from 'sortablejs';

/**
 * 选项逐属性读取（不预先解构），调用方才能用 getter 传响应式的 props：
 * 拖拽开关、手柄、约束都来自 `BasicTable` 的 `dragSort` / `dragSortConfig`，
 * 配置对象被换成新引用时不应该要求重建 Sortable 实例。
 */
export function useDragSort(options: UseDragSortOptions): UseDragSortReturn {
  let sortableInstance: null | Sortable = null;
  let sortableEl: HTMLElement | null = null;

  const isDisabled = (record: Recordable): boolean => {
    const disabled = options.disabled;
    return isFunction(disabled) ? disabled(record) : (disabled ?? false);
  };

  /**
   * Sortable 的下标是 `<tbody>` 的全部子节点，而调用方可能在数据行
   * 前面插测量行/占位行，直接拿 `oldIndex` 去索引数据源会整体错位。
   * 数据行是 `<tbody>` 里唯一带 `data-row-key` 的 `<tr>`，所以每次事件都
   * 现量一次"第一行数据行前面有几行"——
   * 拖拽只重排数据行，不会改变这个前导偏移，量出来始终是当时的正确值。
   */
  const leadingOffset = () => {
    const children = sortableEl?.children;
    if (!children) return 0;
    for (let i = 0; i < children.length; i++) {
      const row = children[i] as HTMLElement;
      if (row.hasAttribute?.('data-row-key')) return i;
    }
    return 0;
  };

  const dataIndex = (index: number | undefined) => {
    if (index == null) return -1;
    return index - leadingOffset();
  };

  const initSortable = (el: HTMLElement) => {
    if (!options.enabled || sortableInstance) return;

    sortableEl = el;
    sortableInstance = new Sortable(el, {
      handle: options.handle,
      animation: options.animation ?? 150,
      disabled: !options.enabled,
      onStart: (evt) => {
        const record = options.dataSource.value[dataIndex(evt.oldIndex)];
        if (record && isDisabled(record)) {
          evt.preventDefault();
          return false;
        }
        return true;
      },
      onMove: (evt) => {
        const canDrop = options.canDrop;
        if (!canDrop) return true;
        const dragRecord =
          options.dataSource.value[
            dataIndex(
              (evt as any).draggedRowIndex ?? (evt as any).oldIndex ?? 0,
            )
          ];
        const dropRecord =
          options.dataSource.value[
            dataIndex(
              (evt as any).relatedRowIndex ?? (evt as any).newIndex ?? 0,
            )
          ];
        if (!dragRecord || !dropRecord) return false;
        return canDrop(dragRecord, dropRecord);
      },
      onEnd: (evt) => {
        const oldIndex = dataIndex(evt.oldIndex);
        const newIndex = dataIndex(evt.newIndex);
        if (
          oldIndex === newIndex ||
          oldIndex < 0 ||
          newIndex < 0 ||
          evt.oldIndex == null ||
          evt.newIndex == null
        )
          return;

        const oldData = [...options.dataSource.value];
        const newData = [...options.dataSource.value];
        const [movedItem] = newData.splice(oldIndex, 1);
        if (movedItem) newData.splice(newIndex, 0, movedItem);

        options.dataSource.value = newData;
        options.onDragEnd?.(newData, oldData);
      },
    });
  };

  const destroySortable = () => {
    sortableInstance?.destroy();
    sortableInstance = null;
    sortableEl = null;
  };

  onUnmounted(destroySortable);

  return { initSortable, destroySortable };
}

export type { UseDragSortOptions, UseDragSortReturn } from '../types';
