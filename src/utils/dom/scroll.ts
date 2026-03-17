import type { DOMElement, Position, ScrollOptions } from './types'

export function scrollTo(el: DOMElement, options?: ScrollOptions): void {
  if (!el)
    return
  el.scrollIntoView(options || { behavior: 'smooth' })
}

export function scrollToTop(el?: DOMElement | Window): void {
  if (!el || el === window) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  else {
    (el as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' })
  }
}

export function getScrollPosition(el?: DOMElement | Window): Position {
  if (!el || el === window) {
    return {
      x: window.scrollX || document.documentElement.scrollLeft,
      y: window.scrollY || document.documentElement.scrollTop,
    }
  }
  const htmlEl = el as HTMLElement
  return {
    x: htmlEl.scrollLeft,
    y: htmlEl.scrollTop,
  }
}

export function setScrollPosition(el: DOMElement | Window, position: Position): void {
  if (!el)
    return
  if (el === window) {
    window.scrollTo(position.x, position.y)
  }
  else {
    const htmlEl = el as HTMLElement
    htmlEl.scrollLeft = position.x
    htmlEl.scrollTop = position.y
  }
}

export function isScrollable(el: DOMElement): boolean {
  if (!el)
    return false
  const style = getComputedStyle(el as Element)
  return /(auto|scroll)/.test(style.overflow + style.overflowY + style.overflowX)
}

export function getScrollParent(el: DOMElement): HTMLElement | null {
  if (!el)
    return null

  let parent = (el as Element).parentElement

  while (parent) {
    if (isScrollable(parent)) {
      return parent
    }
    parent = parent.parentElement
  }

  return document.documentElement
}
