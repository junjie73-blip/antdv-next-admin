import type {
  Recordable,
  UseDragSortOptions,
  UseDragSortReturn,
} from '../types';

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

  /* ============================================================
   * 「DOM 行 ↔ 数据行」的对应关系：每次拖拽开始前量一次
   *
   * 不能在事件里现量：Sortable 在 `onMove` 期间就会真的把 `<tr>` 挪进新位置，
   * 兄弟行的子节点下标跟着漂移，靠下标去找记录会拿到隔壁那一条。
   * 量两样东西——
   * - `leadingRowCount`：首条数据行之前有几个非数据行（测量行 / 占位行）。
   *   `oldIndex` / `newIndex` 数的是 `<tbody>` 的全部子节点，要减掉这段才是数据下标；
   * - `rowByKey`：`data-row-key` → 记录。`BasicTable` 在 `<tr>` 上写了这个属性，
   *   认人比认下标稳。
   * ============================================================ */
  let leadingRowCount = 0;
  let rowByKey: Map<string, Recordable> = new Map();

  const childIndexOf = (row: HTMLElement | null | undefined) => {
    if (!sortableEl || !row) return -1;
    return [...sortableEl.children].indexOf(row);
  };

  /** 子节点下标 → 数据下标；不是本容器的子节点（如悬浮在 `<tbody>` 空白处）给 -1 */
  const dataIndex = (index: number) =>
    index < 0 ? -1 : index - leadingRowCount;

  const snapshotRows = () => {
    rowByKey = new Map();
    if (!sortableEl) {
      leadingRowCount = 0;
      return;
    }
    const children = [...sortableEl.children] as HTMLElement[];
    const dataRows = children.filter((row) => row.dataset.rowKey !== undefined);
    const firstDataRow = dataRows[0];
    leadingRowCount = firstDataRow ? children.indexOf(firstDataRow) : 0;
    dataRows.forEach((row, index) => {
      const key = row.dataset.rowKey;
      const record = options.dataSource.value[index];
      if (key && record) rowByKey.set(key, record);
    });
  };

  /** 行元素 → 数据记录：先按 `data-row-key` 认人，没写这个属性时退回下标换算 */
  const recordOf = (row: HTMLElement | null | undefined): null | Recordable => {
    const key = row?.dataset?.rowKey;
    if (key && rowByKey.has(key)) return rowByKey.get(key) ?? null;
    const index = dataIndex(childIndexOf(row));
    return index < 0 ? null : (options.dataSource.value[index] ?? null);
  };

  const isDisabled = (record: Recordable): boolean => {
    const disabled = options.disabled;
    return isFunction(disabled) ? disabled(record) : (disabled ?? false);
  };

  /**
   * 这一行此刻能不能起拖。两种形态都在这里判：
   * 布尔形态（`disabled: true`）整表冻结，函数形态按记录逐行判。
   */
  const isDragBlocked = (row: HTMLElement | null | undefined): boolean => {
    if (options.disabled === true) return true;
    const record = recordOf(row);
    return record ? isDisabled(record) : false;
  };

  const initSortable = (el: HTMLElement) => {
    if (!options.enabled || sortableInstance) return;

    sortableEl = el;
    sortableInstance = new Sortable(el, {
      animation: options.animation ?? 150,
      // 开关不能写在这里：构造参数只读一次，之后 `dragSortConfig.disabled`
      // 换了值也不会回头。真正的判定走 `filter`（每次按下都现读）。
      disabled: false,
      /**
       * Sortable 派发用户回调时只看 `filter` 的返回值——返回真值就取消这次拖拽；
       * `onStart` 里 `preventDefault()` / `return false` 是无效的
       * （`EventDispatcher.js` 里 `options[onName].call(sortable, evt)` 把返回值丢了），
       * 这就是「禁用行照样拖得动」的根因。
       */
      filter: (_evt, target) => {
        // filter 跑在 onStart 之前，此刻 DOM 还没被拖拽动过，快照在这一拍量最准
        snapshotRows();
        return isDragBlocked(target);
      },
      handle: options.handle,
      // 与「按在非手柄区域」那条路径保持一致：那条压根不 preventDefault。
      // 这里若拦掉 mousedown，禁用行里的按钮、链接、文本选中会一起被吞。
      preventOnFilter: false,
      onStart: () => {
        snapshotRows();
      },
      /**
       * `onMove` 的返回值 Sortable 是认的（`!== false` 才真的换位），
       * 但它给的事件对象上只有 `dragged` / `related` 这些元素引用，
       * 没有 `oldIndex` / `newIndex` / `draggedRowIndex` / `relatedRowIndex`
       * ——按那些字段取下标，永远比的是数据源第 0 条和自己。
       */
      onMove: (evt) => {
        const canDrop = options.canDrop;
        if (!canDrop) return true;

        const dragRecord = recordOf(evt.dragged);
        const dropRecord = recordOf(evt.related);
        if (!dragRecord || !dropRecord) return false;
        // 悬在自己原位不构成「越过」，别把 canDrop 的语义用歪
        if (dragRecord === dropRecord) return true;
        if (!canDrop(dragRecord, dropRecord)) return false;

        // 一次换位跨过的不止落点那一行（拖得远时甚至一步跨过去），
        // 落点约束要对路径上的每一行都成立，否则「不能越过锁定行」形同虚设
        const dragPosition = childIndexOf(evt.dragged);
        const dropPosition = childIndexOf(evt.related);
        const [from, to] =
          dragPosition < dropPosition
            ? [dragPosition, dropPosition]
            : [dropPosition, dragPosition];
        for (let position = from + 1; position < to; position += 1) {
          const crossed = sortableEl?.children[position] as
            | HTMLElement
            | undefined;
          if (!crossed || crossed === evt.dragged) continue;
          const record = recordOf(crossed);
          // 测量行/占位行没有对应记录，不参与落点判定
          if (record && !canDrop(dragRecord, record)) return false;
        }

        return true;
      },
      onEnd: (evt) => {
        // 越界（含 Sortable 没给下标）一律 -1，交给下面两个 `< 0` 兜住
        const oldIndex = dataIndex(evt.oldIndex ?? -1);
        const newIndex = dataIndex(evt.newIndex ?? -1);
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

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
    rowByKey = new Map();
    leadingRowCount = 0;
  };

  onUnmounted(destroySortable);

  return { initSortable, destroySortable };
}

export type { UseDragSortOptions, UseDragSortReturn } from '../types';
