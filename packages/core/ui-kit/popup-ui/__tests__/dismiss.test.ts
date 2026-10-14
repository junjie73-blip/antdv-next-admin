import { describe, expect, it } from 'vitest';

import { isFocusOutsideEvent } from '../src/shared/dismiss';

describe('isFocusOutsideEvent', () => {
  it('区分 reka 汇总进 interactOutside 的两类来源', () => {
    expect(
      isFocusOutsideEvent(
        new Event('dismissableLayer.focusOutside') as unknown as Event,
      ),
    ).toBe(true);
    expect(
      isFocusOutsideEvent(
        new Event('dismissableLayer.pointerDownOutside') as unknown as Event,
      ),
    ).toBe(false);
  });
});
