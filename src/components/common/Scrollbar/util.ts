import type { BarMap, BarMapItem } from './types'

export const BAR_MAP: BarMap = {
  vertical: {
    offset: 'offsetHeight',
    scroll: 'scrollTop',
    scrollSize: 'scrollHeight',
    size: 'height',
    key: 'vertical',
    axis: 'Y',
    client: 'clientY',
    direction: 'top',
  },
  horizontal: {
    offset: 'offsetWidth',
    scroll: 'scrollLeft',
    scrollSize: 'scrollWidth',
    size: 'width',
    key: 'horizontal',
    axis: 'X',
    client: 'clientX',
    direction: 'left',
  },
}

export interface ThumbStyleInput {
  move?: number
  size?: string
  bar: BarMapItem
}

export function renderThumbStyle({ move = 0, size = '0', bar }: ThumbStyleInput): Record<string, string> {
  const translate = `translate${bar.axis}(${move}%)`
  return {
    [bar.size]: size,
    transform: translate,
    msTransform: translate,
    webkitTransform: translate,
  }
}
