import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  APP_BORDER_RADIUS,
  APP_FILTER,
  APP_FONT_SIZE,
  APP_PRIMARY,
  PREFERENCE_CSS_VARS,
} from '../src/constants/css-vars';
import {
  COLOR_WEAK_CLASS,
  DARK_CLASS,
  GRAY_MODE_CLASS,
} from '../src/constants/dom-classes';
import {
  BASE_FONT_SIZE,
  BORDER_RADIUS_BASE,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_PRIMARY_RGB,
} from '../src/constants/theme';

const designSrc = path.resolve(import.meta.dirname, '../../design/src');
const read = (file: string) =>
  readFileSync(path.join(designSrc, file), 'utf8').replaceAll('\\', '/');

/** `@antdv/design` 的全部样式源码，拼成一条字符串用来查"有没有人读这个变量" */
const designCss = ['token', 'css']
  .flatMap((dir) =>
    readdirSync(path.join(designSrc, dir)).map((file) =>
      read(`${dir}/${file}`),
    ),
  )
  .join('\n');

describe('css-vars', () => {
  it('名单里的每一项都是合法的自定义属性名且不重复', () => {
    for (const name of PREFERENCE_CSS_VARS) {
      expect(name).toMatch(/^--[\w-]+$/u);
    }
    expect(new Set(PREFERENCE_CSS_VARS).size).toBe(PREFERENCE_CSS_VARS.length);
  });

  /**
   * 名单纪律：只收有读取点的名字。
   * 多一项 = `clearPreferencesFromDom` 多清一个僵尸变量；少一项 = 偏好写的值清不掉。
   * `--ant-*` 那四条是 antd 兼容层的桥，桥对面已经没人站着了，所以这里反向钉住它不回来。
   */
  it('四条偏好变量各就各位，没有 --ant-* 兼容层', () => {
    expect([...PREFERENCE_CSS_VARS].sort()).toEqual(
      [APP_BORDER_RADIUS, APP_FILTER, APP_FONT_SIZE, APP_PRIMARY].sort(),
    );
    expect(PREFERENCE_CSS_VARS.join(' ')).not.toContain('--ant-');
  });

  it('每个偏好变量在 @antdv/design 里都有读取点', () => {
    // 写侧与读侧分家时的失效形态是"保存了但页面不动"，构建一声不吭，只能这样钉
    for (const name of PREFERENCE_CSS_VARS) {
      expect(designCss, `--app 变量 ${name} 没有任何样式读它`).toContain(
        `var(${name}`,
      );
    }
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

  /**
   * 两个基准值决定了"偏好里的倍率/px 换算成什么"，挪动它们等于全站半径与字号一起变。
   * 8px 是 Tailwind 的 `--radius-lg` 档（1 档 = 默认），14 是正文 `text-sm` 的 px 值，
   * 于是默认偏好（倍率 1、字号 14）换算后落回 `--app-font-size: 100%` —— 首屏零位移。
   */
  it('圆角与字号的换算基准：默认偏好换算后不改变视觉', () => {
    expect(BORDER_RADIUS_BASE).toBe(8);
    expect(BASE_FONT_SIZE).toBe(14);
  });
});
