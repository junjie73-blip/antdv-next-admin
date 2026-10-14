import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PREFERENCE_CSS_VARS,
  ANT_COLOR_PRIMARY,
  ANT_PRIMARY_COLOR,
  APP_FILTER,
} from '../src/constants/css-vars';
import {
  COLOR_WEAK_CLASS,
  DARK_CLASS,
  GRAY_MODE_CLASS,
} from '../src/constants/dom-classes';
import {
  BORDER_RADIUS_BASE,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_PRIMARY_RGB,
} from '../src/constants/theme';

const designSrc = path.resolve(import.meta.dirname, '../../design/src');
const read = (file: string) =>
  readFileSync(path.join(designSrc, file), 'utf8').replaceAll('\\', '/');

describe('css-vars', () => {
  it('名单里的每一项都是合法的自定义属性名且不重复', () => {
    for (const name of PREFERENCE_CSS_VARS) {
      expect(name).toMatch(/^--[\w-]+$/u);
    }
    expect(new Set(PREFERENCE_CSS_VARS).size).toBe(PREFERENCE_CSS_VARS.length);
  });

  it('主色的新旧两种命名都在名单里', () => {
    // 只写一种会出现"改了主色、进度条还是旧的"半更新
    expect(PREFERENCE_CSS_VARS).toContain(ANT_COLOR_PRIMARY);
    expect(PREFERENCE_CSS_VARS).toContain(ANT_PRIMARY_COLOR);
    expect(PREFERENCE_CSS_VARS).toContain(APP_FILTER);
  });
});

describe('dom-classes', () => {
  it('class 名与 @antdv/design 里的样式规则对得上', () => {
    const a11y = read('css/a11y.css');
    expect(a11y).toContain(`html.${COLOR_WEAK_CLASS}`);
    expect(a11y).toContain(`html.${GRAY_MODE_CLASS}`);

    const index = read('index.css');
    expect(index).toContain(
      `@custom-variant dark (&:where(.${DARK_CLASS}, .${DARK_CLASS} *));`,
    );
  });
});

describe('theme', () => {
  it('默认主色的字符串与 RGB 两种写法同源', () => {
    const hex = DEFAULT_PRIMARY_COLOR.replace('#', '');
    expect(DEFAULT_PRIMARY_RGB).toEqual({
      b: Number.parseInt(hex.slice(4, 6), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      r: Number.parseInt(hex.slice(0, 2), 16),
    });
  });

  it('圆角基准与 antd 的默认值一致', () => {
    expect(BORDER_RADIUS_BASE).toBe(8);
  });
});
