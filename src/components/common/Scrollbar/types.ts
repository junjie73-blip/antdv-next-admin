import type { CSSProperties, Ref } from 'vue'

export interface BarMapItem {
  offset: string
  scroll: string
  scrollSize: string
  size: string
  key: string
  axis: string
  client: string
  direction: string
}

export interface BarMap {
  vertical: BarMapItem
  horizontal: BarMapItem
}

export type ScrollbarStyle = string | CSSProperties | (string | CSSProperties)[]

export interface ScrollbarProps {
  native?: boolean
  wrapStyle?: ScrollbarStyle
  wrapClass?: string | (string | undefined)[]
  viewClass?: string | (string | undefined)[]
  viewStyle?: ScrollbarStyle
  noresize?: boolean
  tag?: string
  always?: boolean
  minSize?: number
  scrollHeight?: number
  /** 视口相关的最大高度，例如 calc(100vh - 200px)；父级无高度时必填 */
  maxHeight?: string | number
  /** 最外层根容器附加 class */
  rootClass?: string | (string | undefined)[]
}

export type ScrollbarWrapRef = Ref<HTMLElement | undefined>

export interface ScrollbarType {
  wrap: Ref<HTMLElement | undefined>
  update: () => void
  setScrollTop: (value: number) => void
  setScrollLeft: (value: number) => void
  scrollTo: (options: ScrollToOptions) => void
}
