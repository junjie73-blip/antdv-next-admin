import type { TabItem } from '@antdv/types';

import type { MaybeRefOrGetter } from 'vue';

import { onUnmounted, toValue, watch } from 'vue';

import Sortable from 'sortablejs';

export interface UseTabDragSortOptions {
  /** 拖拽动画时长（ms），与旧实现保持一致 */
  animation?: number;
  /** 固定标签数量：它们永远排在最前，不允许被拖到它们前面 */
  affixCount: MaybeRefOrGetter<number>;
  /** 拖拽占位样式 */
  ghostClass?: string;
  /** 允许拖拽排序（对应应用的 tabDragSort 偏好） */
  isDisabled?: MaybeRefOrGetter<boolean | undefined>;
  /** 拖拽结束后上报的完整新顺序，由使用方写回自己的数据源 */
  onReorder: (next: TabItem[]) => void;
  /** 当前顺序：回调触发时才读，因此偏好/列表变化都不需要重建实例 */
  tabs: MaybeRefOrGetter<TabItem[]>;
}

/**
 * 把数组里的第 `from` 项搬到第 `to` 位（返回新数组，不改原数组）。
 * 下标越界或原地不动时返回 null，调用方据此决定要不要上报。
 */
export function moveTab(
  list: TabItem[],
  from: number,
  to: number,
): null | TabItem[] {
  if (from === to || from < 0 || to < 0) return null;
  if (from >= list.length || to >= list.length) return null;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  if (!moved) return null;
  next.splice(to, 0, moved);
  return next;
}

/**
 * Sortable 的下标是容器全部子节点的下标，取不到时返回 -1，
 * 任何 `affixCount > 0` 的比较都会把它判成「不允许」，宁可拒绝一次拖拽
 * 也不能把固定标签挤到后面去。
 */
function indexOfChild(
  container: HTMLElement | null | undefined,
  node: HTMLElement | null | undefined,
): number {
  if (!container || !node) return -1;
  return [...container.children].indexOf(node);
}

/**
 * 标签拖拽排序（sortablejs 直连）。
 *
 * 关键点在于「谁拥有 DOM 顺序」：Sortable 会真的把节点搬走，而 Vue 的虚拟 DOM
 * 仍按旧顺序 patch，两边各写一次就会出现顺序错乱或重复节点。
 * 所以 onEnd 里先把节点放回原位（撤销 Sortable 的那次 DOM 移动），再改数据、
 * 由 `reorder` 事件让上层写回，Vue 按 key 重排一次即可 —— 这也是 vuedraggable
 * 内部的做法，顺序的真相始终只有数据源一份。
 */
export function useTabDragSort(options: UseTabDragSortOptions) {
  let instance: null | Sortable = null;

  /**
   * 固定标签守卫（sortable 的 onMove）。
   *
   * sortable 的 MoveEvent 只提供 dragged / related 两个 DOM 节点，没有
   * `draggedIndex` / `relatedIndex` 这种字段（早期 vuedraggable 才有），
   * 所以索引必须自己从容器里量。
   */
  function onMove(event: {
    dragged?: HTMLElement | null;
    from?: HTMLElement | null;
    related?: HTMLElement | null;
    to?: HTMLElement | null;
  }): boolean {
    const affixCount = toValue(options.affixCount);
    if (affixCount <= 0) return true;

    const draggedIndex = indexOfChild(event.to ?? event.from, event.dragged);
    const relatedIndex = indexOfChild(event.to ?? event.from, event.related);

    // 任一环节落在固定区就拒绝：被拖的不能是固定标签，落点也不能越过它们
    return draggedIndex >= affixCount && relatedIndex >= affixCount;
  }

  /** 把 Sortable 挪动的节点放回原来的位置，让 DOM 重新等于数据顺序 */
  function restoreDom(item: HTMLElement, oldIndex: number) {
    const parent = item.parentNode;
    if (!parent) return;
    parent.removeChild(item);
    // children 是活集合：摘掉 item 后，原本 oldIndex 之后的元素整体前移一位，
    // 因此"插到当前第 oldIndex 个元素之前"正好回到原位（前移/后移两个方向都成立）。
    const reference = parent.children[oldIndex] ?? null;
    parent.insertBefore(item, reference);
  }

  function onEnd(event: {
    item?: HTMLElement;
    newIndex?: number;
    oldIndex?: number;
  }) {
    const { item, newIndex, oldIndex } = event;
    if (!item || typeof oldIndex !== 'number') return;
    restoreDom(item, oldIndex);
    if (typeof newIndex !== 'number') return;

    const next = moveTab(toValue(options.tabs), oldIndex, newIndex);
    if (next) options.onReorder(next);
  }

  function initSortable(el: HTMLElement) {
    if (instance) return;
    instance = new Sortable(el, {
      animation: options.animation ?? 180,
      disabled: toValue(options.isDisabled) ?? false,
      ghostClass: options.ghostClass ?? 'tab-ghost',
      onEnd,
      onMove,
    });
  }

  function destroySortable() {
    instance?.destroy();
    instance = null;
  }

  // 开关变化只改 Sortable 的 disabled 选项，不重建实例：
  // 重建会丢掉正在进行的拖拽，而用户在设置面板里改偏好时通常是"拖不动了"这种静态场景。
  watch(
    () => toValue(options.isDisabled),
    (disabled) => {
      instance?.option('disabled', disabled ?? false);
    },
  );

  onUnmounted(destroySortable);

  return { destroySortable, initSortable };
}
