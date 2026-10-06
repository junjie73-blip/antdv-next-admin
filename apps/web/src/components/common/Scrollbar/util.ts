import type { BarMap, BarMapItem } from './types';

import { isNil } from 'es-toolkit';

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
};

export interface ThumbStyleInput {
  move?: number;
  size?: string;
  bar: BarMapItem;
}

export function renderThumbStyle({
  move = 0,
  size = '0',
  bar,
}: ThumbStyleInput): Record<string, string> {
  // isNil 兜底 move（虽然默认参数已兜底，但显式更稳）
  const offset = isNil(move) ? 0 : move;
  const translate = `translate${bar.axis}(${offset}%)`;
  return {
    [bar.size]: size,
    transform: translate,
    msTransform: translate,
    webkitTransform: translate,
  };
}
