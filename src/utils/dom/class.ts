import type { DOMElement } from './types'

export function addClass(el: DOMElement, className: string | string[]): void {
  if (!el)
    return
  const classes = Array.isArray(className) ? className : [className]
  el.classList.add(...classes)
}

export function removeClass(el: DOMElement, className: string | string[]): void {
  if (!el)
    return
  const classes = Array.isArray(className) ? className : [className]
  el.classList.remove(...classes)
}

export function hasClass(el: DOMElement, className: string): boolean {
  if (!el)
    return false
  return el.classList.contains(className)
}

export function toggleClass(el: DOMElement, className: string, force?: boolean): void {
  if (!el)
    return
  el.classList.toggle(className, force)
}

export function replaceClass(el: DOMElement, oldClass: string, newClass: string): void {
  if (!el)
    return
  removeClass(el, oldClass)
  addClass(el, newClass)
}
