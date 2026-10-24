import type { ComputedRef, CSSProperties } from 'vue';

import type {
  BasicColumn,
  BasicTableProps,
  Recordable,
  TableRowSelection,
} from '../types';
import type { UseMergedPropsReturn } from './useMergedProps';
import type { UseStickyColumnsReturn } from './useStickyColumns';

import { computed } from 'vue';

import { cn } from '@antdv/shared/utils/cn';
import { isFunction } from 'es-toolkit';

/**
 * 带 CSS 自定义属性的样式记录。
 *
 * Vue 的 `CSSProperties` 为了保持 csstype 的封闭类型，故意不带索引签名，
 * 所以"往 `:style` 里塞一个 `--x` 变量"必须先把类型打开一档。
 */
type VarStyle = CSSProperties & Record<`--${string}`, string | undefined>;

export interface UseTableClassesOptions {
  /** `onHeaderRow` 的第一个参数是**处理后的**列（含序号列与操作列），不是 `props.columns` */
  getColumns: () => BasicColumn[];
  getMergedProps: ComputedRef<BasicTableProps>;
  /** 选择列的 `fixed` / `columnWidth` 要落到表头与单元格的吸边样式上 */
  getRowSelection: ComputedRef<null | TableRowSelection>;
  /** 选中态要变成**实色**底色（见 `rowClass`），所以这里得能问"这行选中了吗" */
  isSelected: (record: Recordable) => boolean;
  /** `useMergedProps` 的产物，透传过来避免把同一批缺省值算两遍 */
  merged: UseMergedPropsReturn;
  /** 行上的两个点击出口，由调用方负责 `emit`；这里只管"绑上去" */
  onRowClick: (record: Recordable, index: number, event: Event) => void;
  onRowDbClick: (record: Recordable, index: number, event: Event) => void;
  /** 固定列的吸边类由 `useStickyColumns` 决定，配色要跟着它 */
  sticky: UseStickyColumnsReturn;
}

/**
 * 表格的样式层：容器 / 表头行 / 表头单元格 / 数据行 / 单元格 / 选择列。
 *
 * 抽出来之前，这一族东西在 `BasicTable.vue` 的 setup 里连写了 170 行，
 * 而模板还额外内联了选择列与 hover 的类名 —— 同一个"单元格该长什么样"的问题
 * 有两个答案。集中后只有一个：模板只问函数，不再拼字符串。
 *
 * 三条不能丢的实测结论（都写在对应函数上）：
 * 1. 表头与单元格共用一套盒模型（`cellBoxClass`），否则同一列上下错位；
 * 2. 固定列底色必须实色，`bg-inherit` 遇到半透明行底会被横向内容穿透；
 * 3. `scroll.y` 决定表头钉不钉（`sticky top-0`），滚动容器换成 shadcn
 *    `Table` 自带的那层后，宽高约束一律走 CSS 变量 + 类名，不走 `:style`
 *    （`Table.vue` 只声明 `class` prop，`style` 会落到外层容器而不是 `<table>`）。
 */
export function useTableClasses(options: UseTableClassesOptions) {
  const {
    getColumns,
    getMergedProps,
    getRowSelection,
    isSelected,
    merged,
    onRowClick,
    onRowDbClick,
    sticky,
  } = options;

  // ============================================
  // 外层：根节点 → 滚动容器 → `<table>`
  // ============================================

  /** 根节点：`canResize` 时表格要吃满父高 */
  const tableContainerClassName = computed(() =>
    cn('basic-table w-full', getMergedProps.value.canResize && 'h-full'),
  );

  /**
   * shadcn `Table` 自带一层 `data-slot="table-container"`（`relative overflow-auto`），
   * 它就是唯一的滚动容器。所以这一层 `.basic-table-body` 只负责三件事：
   * 给固定列的表格外框（`bordered`）、给 loading 浮层的定位祖先（`relative`）、
   * 给调用方与单测留一个稳定的 class 钩子。**不要再写 `overflow-auto`** ——
   * 两层都能滚时，表头 `sticky top-0` 认的是内层，外层滚起来表头就跟着走了。
   */
  const bodyClassName = computed(() =>
    cn(
      'basic-table-body relative w-full',
      merged.mergedBordered.value && 'border-border border',
    ),
  );

  /** 需要横向滚动时给 `<table>` 的下限宽（走变量，见下） */
  const scrollX = computed(() => {
    const x = merged.mergedScroll.value?.x;
    if (typeof x === 'number') return `${x}px`;
    return typeof x === 'string' ? x : undefined;
  });

  /**
   * 挂在 shadcn 容器上的样式：纵向高度上限 + 供 `<table>` 用的宽度变量。
   *
   * `Table.vue` 只声明了 `class` 这一个 prop，其余属性（含 `style`）透传给它的
   * 根元素 —— 也就是那层容器。于是 `min-width` 没法直接写在这层：写在这儿会让
   * 容器自己被撑宽，滚动条跑到外壳上去。改成"容器上放变量、`<table>` 上放一个
   * 引用变量的类名"，`overflow-auto` 与 `sticky` 就还都归同一层管。
   */
  const scrollerStyle = computed<undefined | VarStyle>(() => {
    const style: VarStyle = {};
    const y = merged.mergedScrollY.value;
    if (y !== undefined) style.maxHeight = `${y}px`;
    if (scrollX.value) style['--basic-table-min-width'] = scrollX.value;
    return Object.keys(style).length > 0 ? style : undefined;
  });

  /**
   * 挂在 `<table>` 上的类：边框合并 + 下限宽。
   *
   * `min-w-(--basic-table-min-width)`（v4 的变量简写，等价于
   * `min-w-[var(--basic-table-min-width)]`）必须是**字面量**写在这里 ——
   * Tailwind 只认源码里出现过的类名，拼出来的字符串不会生成任何工具类
   * （`@source` 已覆盖 `table-ui/src`，见 design 包的说明）。
   */
  const tableClassName = computed(() =>
    cn(
      merged.mergedBordered.value && 'border-collapse',
      scrollX.value && 'min-w-(--basic-table-min-width)',
    ),
  );

  // ============================================
  // 盒模型：表头与单元格共用
  // ============================================

  /**
   * 表头与单元格共用同一套盒模型。
   *
   * 两边各写一份时，字号 / 行高 / 内边距只要有一条不一致，行高就错开：
   * 原先表头是 `text-xs py-2`、单元格是 `text-sm py-1.5`，同一列的表头与数据
   * 视觉上对不齐，横向滚动时更明显。
   *
   * 行高取 `leading-6`（24px）而不是 `leading-5`：单元格里住的不只是一行文字
   * （标签、按钮实测 24px 高），文本行盒只有 20px 时表头就比数据行矮出一线。
   * 别用 `h-6` 顶——Tailwind 预置的 `box-sizing: border-box` 会让它连内边距一起算，
   * 24px 反而小于"内边距 16 + 内容 20"，等于没设。
   *
   * 这套值同时要盖得住 shadcn 原语的出厂类（`TableHead` 是 `h-10 px-2`、
   * `TableCell` 是 `p-2`）：`cn()` 里调用方的类排在后面，tailwind-merge 会丢掉出厂那条。
   */
  const cellBoxClass = 'px-3 py-2 text-sm leading-6 align-middle';

  /** 对齐：`headerAlign` 缺省跟随 `align`；两者都没写就是靠左 */
  const alignClass = (col: BasicColumn, header = false) => {
    const align =
      (header ? (col.headerAlign ?? col.align) : col.align) || 'left';
    if (align === 'center') return 'text-center';
    return align === 'right' ? 'text-right' : 'text-left';
  };

  /**
   * 表头行的底色。
   *
   * `<th>` 自己带了实色（`headClass`），这层再给一份是为了让 `bordered` 关闭、
   * 表头没钉住时，整行仍然与数据区有一眼可分的分界。
   *
   * `hover:bg-muted` 是**必需的覆写**：原语 `TableRow` 自带 `hover:bg-muted/50`，
   * 鼠标扫过表头会把实色底换成半透明底 —— 纵向滚动时数据行会从表头后面透出来。
   */
  const headRowClass = cn('bg-muted', 'hover:bg-muted');

  const getHeaderRowProps = (index: number) => {
    const userProps = getMergedProps.value.onHeaderRow?.(getColumns(), index);
    if (!userProps) return undefined;
    return { ...userProps, class: cn(userProps.class) };
  };

  /**
   * 表头单元格。
   *
   * 对齐排在**最后**（连 `col.className` / `col.headerClassName` 之后）：
   * 模板原先就是 `cn(headClass(col), alignClass(col, true))`，调用方在 `className`
   * 里写的对齐不该把 `headerAlign` 顶掉，这条 precedence 得原样保住。
   */
  const headClass = (col: BasicColumn) =>
    cn(
      'basic-table-head',
      cellBoxClass,
      'text-muted-foreground font-medium',
      // 表头底色一律实色：钉住的表头会被数据行从下面滚过，固定列表头还要压住
      // 同行横向滚过去的普通单元格（`bg-inherit` 拿到的就是这条底色）
      'bg-muted',
      merged.mergedScrollY.value !== undefined && 'sticky top-0 z-10',
      sticky.pinnedHeadClass(col),
      col.sorter && 'cursor-pointer select-none',
      col.className,
      col.headerClassName,
      alignClass(col, true),
    );

  const cellClass = (col: BasicColumn, record: Recordable, index: number) => {
    const userClass = isFunction(merged.mergedCellClassName.value)
      ? merged.mergedCellClassName.value(record, index, col)
      : merged.mergedCellClassName.value;
    return cn(
      cellBoxClass,
      // 省略号要靠 `max-width` 才截得出来；`truncate` 自带 `white-space: nowrap`
      col.ellipsis ? 'max-w-px truncate' : 'whitespace-nowrap',
      sticky.pinnedCellClass(col),
      col.className,
      userClass,
      // 同 `headClass`：对齐是最后一道，覆盖 `cellClassName` 里顺带写的对齐
      alignClass(col),
    );
  };

  /**
   * 数据行的底色。
   *
   * 一律取**实色**，包括 hover 与选中：固定列的单元格是 `bg-inherit`，
   * 半透明的叠加色（shadcn 出厂的 `hover:bg-muted/50` 就是）会让横向滚过去的
   * 内容透出来。所以这里刻意覆盖掉原语的 hover，换成 `hover:bg-accent`。
   *
   * 选中态用主色与卡片底色 `color-mix` 出一个实色，明暗各一档（深色下要更亮一点
   * 才看得出来）；这条排在 `bg-card` 之后，tailwind-merge 会把 `bg-card` 顶掉。
   */
  const rowClass = (record: Recordable, index: number) => {
    const userClass = isFunction(merged.mergedRowClassName.value)
      ? merged.mergedRowClassName.value(record, index)
      : merged.mergedRowClassName.value;
    return cn(
      'basic-table-row bg-card group hover:bg-accent border-b transition-colors',
      userClass,
      isSelected(record) &&
        'bg-[color-mix(in_srgb,var(--color-primary)_8%,var(--color-card))] dark:bg-[color-mix(in_srgb,var(--color-primary)_16%,var(--color-card))]',
    );
  };

  /**
   * 行属性：调用方 `onRow` 返回的东西排在最前，我们补的 class 与两个点击处理器
   * 在后 —— 点击要先 `emit` 再转调用户自己的处理器，顺序不能反。
   */
  const getRowProps = (record: Recordable, index: number) => {
    const userOnRow = getMergedProps.value.onRow;
    const userProps = userOnRow?.(record, index) || {};
    return {
      ...userProps,
      class: cn(rowClass(record, index), userProps.class),
      onClick: (event: MouseEvent) => {
        onRowClick(record, index, event);
        userProps.onClick?.(event);
      },
      onDblclick: (event: MouseEvent) => {
        onRowDbClick(record, index, event);
        userProps.onDblclick?.(event);
      },
      style: userProps.style,
    };
  };

  // ============================================
  // 选择列（它不在 `visibleColumns` 里，宽度与吸边另有来源）
  // ============================================

  /** 选择列表头：借用表头盒模型，居中；`fixed` 时和固定列一样压层级 */
  const selectionHeadClass = computed(() =>
    cn(
      headClass({ key: 'ant-table-selection-column' } as BasicColumn),
      'text-center',
      getRowSelection.value?.fixed && 'z-20',
    ),
  );

  /** 选择列单元格：与固定列同一套（`bg-inherit` 从行上取实色底） */
  const selectionCellClass = computed(() =>
    cn(
      cellBoxClass,
      'text-center',
      getRowSelection.value?.fixed && 'sticky z-2 bg-inherit',
    ),
  );

  /**
   * 选择列的宽度只有显式给了 `columnWidth` 才写死。
   *
   * 不给就交给内容自己撑（勾选框就那么宽）；这里兜一个默认值反而会让
   * 没配宽度的表在 `tableLayout: fixed` 下把这一列撑到别处的份上去。
   */
  const selectionColumnStyle = (fixedEdge: boolean): CSSProperties => {
    const fixed = getRowSelection.value?.fixed;
    const columnWidth = getRowSelection.value?.columnWidth;
    return {
      left: fixed === 'left' ? '0px' : undefined,
      position: fixedEdge ? 'sticky' : undefined,
      right: fixed === 'right' ? '0px' : undefined,
      width: columnWidth ? `${columnWidth}px` : undefined,
    };
  };

  const selectionHeadStyle = computed(() =>
    selectionColumnStyle(Boolean(getRowSelection.value?.fixed)),
  );

  const selectionCellStyle = computed(() =>
    selectionColumnStyle(Boolean(getRowSelection.value?.fixed)),
  );

  return {
    alignClass,
    bodyClassName,
    cellBoxClass,
    cellClass,
    getHeaderRowProps,
    getRowProps,
    headClass,
    headRowClass,
    rowClass,
    scrollerStyle,
    selectionCellClass,
    selectionCellStyle,
    selectionHeadClass,
    selectionHeadStyle,
    tableClassName,
    tableContainerClassName,
  };
}

export type UseTableClassesReturn = ReturnType<typeof useTableClasses>;
