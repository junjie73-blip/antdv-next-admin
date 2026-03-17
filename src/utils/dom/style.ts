import type { DOMElement } from './types'
import { isPlainObject, isString } from 'es-toolkit'

export function setStyle(el: DOMElement, styles: Partial<CSSStyleDeclaration> | string, value?: string): void {
  if (!el)
    return

  const htmlEl = el as HTMLElement

  if (isString(styles) && value) {
    htmlEl.style.setProperty(styles, value)
  }
  else if (isPlainObject(styles)) {
    Object.assign(htmlEl.style, styles)
  }
}

export function getStyle(el: DOMElement, property: string): string | null {
  if (!el)
    return null
  return getComputedStyle(el).getPropertyValue(property)
}

export function removeStyle(el: DOMElement, property: string | string[]): void {
  if (!el)
    return
  const htmlEl = el as HTMLElement
  const properties = Array.isArray(property) ? property : [property]
  properties.forEach(prop => htmlEl.style.removeProperty(prop))
}

export function setCssVar(el: DOMElement, name: string, value: string): void {
  if (!el)
    return
  const htmlEl = el as HTMLElement
  htmlEl.style.setProperty(`--${name}`, value)
}

export function getCssVar(el: DOMElement, name: string): string | null {
  if (!el)
    return null
  return getComputedStyle(el).getPropertyValue(`--${name}`).trim()
}
