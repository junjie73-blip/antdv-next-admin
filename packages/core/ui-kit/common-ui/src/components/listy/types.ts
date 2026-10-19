import type { CSSProperties } from 'vue';

/**
 * 一行数据。
 *
 * 四个约定字段（`title` / `description` / `extra` / `icon`）够默认行渲染，
 * 业务字段随对象一起传进来，在 `#item` 一类插槽里按原样取用。
 */
export interface ListyItem {
  /** 行尾的次要内容（时间、数量之类） */
  extra?: string;
  /** 标题下的一行说明 */
  description?: string;
  /** 行首图标（iconify 名）；不传就不占位 */
  icon?: string;
  /** 行键；`itemKey` 没指定时退到下标 */
  key?: number | string;
  /** 标题 */
  title?: string;
  [field: string]: unknown;
}

export type ListySize = 'large' | 'middle' | 'small';

/**
 * 行高：固定值，或按索引给值（动态高度的第一手来源）。
 *
 * 给函数时它会被虚拟滚动反复调用（求总高、求偏移、求视口容量各一次全量或半量扫描），
 * 所以必须是**纯函数且只读响应式数据**：把实测高度存进 `ref` 数组再在这里取，
 * Vue 的 computed 才认得到它的变化。读数时顺便写状态（`items[i].h = …`）会让整条
 * 滚动链进入自激循环。
 */
export type ListyItemHeight =
  | ((index: number, item: ListyItem) => number)
  | number;

/** `scroll-to-index` 的落点选项，与 DOM `ScrollToOptions` 的竖直轴子集 */
export interface ListyScrollToOptions {
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
}

/** `@scroll` 抛出的滚动快照，也是 `scrollState` 暴露的内容 */
export interface ListyScrollState {
  /** 当前窗口的末行下标（不含 overscan 之外的空窗口时为 -1） */
  endIndex: number;
  /** 滚到内容底部的比例，0–1；容器或总高为 0 时给 0 */
  progress: number;
  /** 内容总高（虚拟模式下由行高累加而来） */
  scrollHeight: number;
  /** 滚动位置 */
  scrollTop: number;
  /** 当前窗口的首行下标 */
  startIndex: number;
  /** 真正挂到 DOM 上的行数（含上下 overscan） */
  visibleCount: number;
}

export interface ListyProps {
  class?: string;
  /**
   * 虚拟模式的视口高度：数字按 px，字符串原样写进 `style`（`'60vh'`、`'100%'` 都行）。
   *
   * 虚拟滚动必须有一个**能滚的盒子**：给 `'100%'` 就要保证祖先链有高度，
   * 否则视口高度是 0，窗口里只剩 overscan 那几行。
   *
   * @default 320
   */
  containerHeight?: number | string;
  /** 空状态图标（iconify 名） */
  emptyIcon?: string;
  /** 空状态文案 */
  emptyText?: string;
  /**
   * 行高：固定值或 `(index, item) => number`。
   *
   * 固定值时每行都按这个高度内联到 `<li>` 上（`box-border`，含内边距），
   * 这样 DOM 与实际算术高度必然一致；`measure-heights` 打开时不写内联高度，
   * 由内容撑开后实测回灌。
   *
   * @default 40
   */
  itemHeight?: ListyItemHeight;
  /** 列表数据（万级条数配 `virtual` 使用；非虚拟模式全量渲染） */
  items?: ListyItem[];
  /** 行键：字段名或取值函数，缺省依次取 `item.key` 与下标 */
  itemKey?:
    | ((index: number, item: ListyItem) => number | string)
    | keyof ListyItem;
  /** 加载中：用骨架行占住高度，数据回来时内容不跳 */
  loading?: boolean;
  /** 骨架行数 */
  loadingRows?: number;
  /**
   * 动态高度：渲染后用 ResizeObserver 实测行高并回灌给滚动算术。
   *
   * 关掉时行高完全由 `item-height` 决定（更快，固定值走 O(1) 定位的写法）；
   * 打开时 `item-height` 退为**首帧估算值**，实测到位后总高与偏移会自动校正。
   *
   * @default false
   */
  measureHeights?: boolean;
  /**
   * 视口上下各多渲染几行，用来吃掉快速滚动时的白屏。
   *
   * 只读一次：VueUse 在建立虚拟列表时就把这个数解构走了，运行中改它不会生效，
   * 要改就重挂组件（`key` 换一下）。
   *
   * @default 5
   */
  overscan?: number;
  /** 行可点：给出手型与 hover 底色，配合 `@item-click` 使用 */
  selectable?: boolean;
  /** 行的紧凑程度 */
  size?: ListySize;
  style?: CSSProperties;
  /**
   * 打开虚拟滚动：只渲染视口 ± `overscan` 行的 DOM。
   *
   * @default false
   */
  virtual?: boolean;
}

export interface ListyEmits {
  (e: 'itemClick', item: ListyItem, index: number): void;
  (e: 'scroll', state: ListyScrollState): void;
}

/** 渲染层内部用的"行"：数据加它在上游的下标，虚拟与直排两条路径共用一份行模板 */
export interface ListyRow {
  data: ListyItem;
  index: number;
}
