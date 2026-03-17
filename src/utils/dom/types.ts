export type DOMElement = HTMLElement | Element | null | undefined

export interface ScrollOptions {
  behavior?: ScrollBehavior
  block?: ScrollLogicalPosition
  inline?: ScrollLogicalPosition
}

export interface Position {
  x: number
  y: number
}
