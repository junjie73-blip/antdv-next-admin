import type { CSSProperties, Ref } from 'vue';

export interface BarMapItem {
  offset: string;
  scroll: string;
  scrollSize: string;
  size: string;
  key: string;
  /** CSS transform 的轴向：只能是对应坐标轴的字母，索引拖拽缓存时靠它保证类型安全 */
  axis: 'X' | 'Y';
  client: string;
  direction: string;
}

export interface BarMap {
  vertical: BarMapItem;
  horizontal: BarMapItem;
}

export type ScrollbarStyle =
  | (CSSProperties | string)[]
  | CSSProperties
  | string;

export interface ScrollbarProps {
  native?: boolean;
  wrapStyle?: ScrollbarStyle;
  wrapClass?: (string | undefined)[] | string;
  viewClass?: (string | undefined)[] | string;
  viewStyle?: ScrollbarStyle;
  noresize?: boolean;
  tag?: string;
  always?: boolean;
  minSize?: number;
  scrollHeight?: number;
  maxHeight?: number | string;
  rootClass?: (string | undefined)[] | string;
  /** ⭐ 停止滚动后隐藏滚动条的延迟（ms），默认 800 */
  hideDelay?: number;
}

export type ScrollbarWrapRef = Ref<HTMLElement | undefined>;

export interface ScrollbarType {
  wrap: Ref<HTMLElement | undefined>;
  update: () => void;
  setScrollTop: (value: number) => void;
  setScrollLeft: (value: number) => void;
  scrollTo: (options: ScrollToOptions) => void;
}
