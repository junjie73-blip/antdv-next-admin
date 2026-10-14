import type { CSSProperties } from 'vue';

export type ScrollbarStyle =
  | (CSSProperties | string)[]
  | CSSProperties
  | string;

export interface ScrollbarProps {
  /** 用浏览器原生滚动条，而不是 shadcn 的 ScrollArea */
  native?: boolean;
  wrapStyle?: ScrollbarStyle;
  wrapClass?: (string | undefined)[] | string;
  viewClass?: (string | undefined)[] | string;
  viewStyle?: ScrollbarStyle;
  tag?: string;
  /** 滚动条常驻 */
  always?: boolean;
  maxHeight?: number | string;
  rootClass?: (string | undefined)[] | string;
  /** 停止滚动后隐藏滚动条的延迟（ms） */
  hideDelay?: number;
}

export interface ScrollbarType {
  /** 真正的滚动盒：自绘模式下是 reka 的 viewport */
  wrap: HTMLElement | undefined;
  setScrollTop: (value: number) => void;
  setScrollLeft: (value: number) => void;
  scrollTo: (options: ScrollToOptions) => void;
}
