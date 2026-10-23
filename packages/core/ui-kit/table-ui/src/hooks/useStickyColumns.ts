import type { ComputedRef, CSSProperties } from 'vue';

import type { BasicColumn, Recordable } from '../types';

import { isFunction } from 'es-toolkit';

import { getColumnId } from '../helper';

/** 只用到列宽这两个方法，按结构声明，不把 TanStack 的 `Column` 透出来 */
interface SizableColumn {
  getCanResize: () => boolean;
  getSize: () => number;
}

/** 只用到拖拽手柄的处理器，同上 */
interface ResizableHeader {
  getResizeHandler: () => (event: Event) => void;
}

export interface UseStickyColumnsOptions {
  /** TanStack 的 `table.getColumn(id)` */
  getColumn: (id: string) => SizableColumn | undefined;
  getHeader: (id: string) => ResizableHeader | undefined;
  /** 可见列：左右偏移要按它们的顺序累加 */
  visibleColumns: ComputedRef<BasicColumn[]>;
}

/**
 * 固定列（含操作列）的宽度、吸边偏移与配套样式。
 *
 * `position: sticky` 不会自己算偏移 —— 左固定第 2 列的 `left` 必须是它左边那些
 * 固定列的宽度之和，右固定同理。这套算法原先平铺在 setup 里，跟"这一列宽多少"
 * 混在一起；抽出来后两个问题都有唯一答案：
 * 宽度取"可拖拽列用 TanStack 实测宽，其余用声明宽"，偏移按可见列顺序累加。
 */
export function useStickyColumns(options: UseStickyColumnsOptions) {
  const { getColumn, getHeader, visibleColumns } = options;

  /** 列宽：TanStack 的实测宽（可拖拽列）优先，其次声明宽 */
  const colSize = (col: BasicColumn): number | string | undefined => {
    const column = getColumn(getColumnId(col));
    if (column?.getCanResize()) return column.getSize();
    return col.width;
  };

  /** 声明了 `fixed` 的列与操作列都吸边 */
  const stickyPosition = (col: BasicColumn) =>
    col.fixed || col.key === 'action' ? 'sticky' : undefined;

  /** 操作列没写 `fixed` 时也靠右吸边（它就是"操作列"） */
  const isRightPinned = (col: BasicColumn) =>
    col.fixed === 'right' || (!col.fixed && col.key === 'action');

  function stickyLeft(col: BasicColumn): string | undefined {
    if (col.fixed !== 'left') return undefined;
    let offset = 0;
    for (const item of visibleColumns.value) {
      if (item === col) break;
      if (item.fixed !== 'left') continue;
      offset += Number(colSize(item)) || 0;
    }
    return `${offset}px`;
  }

  /** 从最右往回累加，跳过自己右边那些没吸边的列 */
  function stickyRight(col: BasicColumn): string | undefined {
    if (!isRightPinned(col)) return undefined;
    let offset = 0;
    let passedSelf = false;
    for (let i = visibleColumns.value.length - 1; i >= 0; i -= 1) {
      const item = visibleColumns.value[i];
      if (!item) continue;
      if (item === col) {
        passedSelf = true;
        continue;
      }
      if (!passedSelf) continue;
      if (!isRightPinned(item)) continue;
      offset += Number(colSize(item)) || 0;
    }
    return `${offset}px`;
  }

  /** 表头单元格：宽度 + 吸边 + 调用方自己的 `headerStyle`（最后展开，允许覆盖） */
  const headStyle = (col: BasicColumn): CSSProperties => {
    const size = colSize(col);
    return {
      left: stickyLeft(col),
      minWidth: typeof size === 'number' ? `${size}px` : size,
      position: stickyPosition(col),
      right: stickyRight(col),
      width: typeof size === 'number' ? `${size}px` : size,
      ...col.headerStyle,
    };
  };

  const cellStyleOf = (
    col: BasicColumn,
    record: Recordable,
    index: number,
  ): CSSProperties => {
    const custom = isFunction(col.cellStyle)
      ? col.cellStyle(record, index)
      : col.cellStyle;
    return {
      ...custom,
      left: stickyLeft(col),
      position: stickyPosition(col),
      right: stickyRight(col),
    };
  };

  /**
   * 固定单元格必须自带不透明底色。
   *
   * `position: sticky` 只改变绘制位置，不给背景 —— 透明底的固定单元格会被同一行
   * 横向滚过去的普通单元格穿透，出现"2026-10-1新增35-24编辑删除"那种叠字。
   * 底色从 `<tr>` 继承（`bg-inherit`），所以行背景一律取实色：半透明的
   * hover / 选中叠加会同样穿透。
   */
  const pinnedCellClass = (col: BasicColumn) =>
    stickyPosition(col) ? 'z-[2] bg-inherit' : '';

  /** 固定表头要压住同样被钉住的单元格 */
  const pinnedHeadClass = (col: BasicColumn) =>
    stickyPosition(col) ? 'z-20' : '';

  /** 拖拽改列宽：把手把 mousedown/touchstart 原样交给 TanStack */
  const resizeHandler = (col: BasicColumn) => {
    const header = getHeader(getColumnId(col));
    return header ? header.getResizeHandler() : undefined;
  };

  return {
    cellStyleOf,
    colSize,
    headStyle,
    pinnedCellClass,
    pinnedHeadClass,
    resizeHandler,
    stickyLeft,
    stickyPosition,
    stickyRight,
  };
}

export type UseStickyColumnsReturn = ReturnType<typeof useStickyColumns>;
