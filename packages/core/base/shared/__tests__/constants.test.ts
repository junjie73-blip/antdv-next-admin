import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CSS_VAR_FILTER,
  CSS_VAR_FONT_SIZE,
  CSS_VAR_PRIMARY,
  CSS_VAR_RADIUS,
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
   * 名字一律是 shadcn-vue 的裸规范名（不带 `--app-`、也不带回撤的 `--ant-*` 兼容层），
   * 一旦有人把前缀加回来，偏好写到 `<html>` 上的值就再也读不到。
   */
  it('四条偏好变量各就各位，用裸规范名且没有 --ant-* 兼容层', () => {
    expect([...PREFERENCE_CSS_VARS].toSorted()).toEqual(
      [
        CSS_VAR_FILTER,
        CSS_VAR_FONT_SIZE,
        CSS_VAR_PRIMARY,
        CSS_VAR_RADIUS,
      ].toSorted(),
    );
    expect(PREFERENCE_CSS_VARS.join(' ')).not.toContain('--ant-');
    expect(PREFERENCE_CSS_VARS.join(' ')).not.toContain('--app-');
  });

  it('每个偏好变量在 @antdv/design 里都有读取点', () => {
    // 写侧与读侧分家时的失效形态是"保存了但页面不动"，构建一声不吭，只能这样钉
    for (const name of PREFERENCE_CSS_VARS) {
      expect(designCss, `变量 ${name} 没有任何样式读它`).toContain(
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
   * 圆角基准固定在 16px：倍率 1 就是 `--radius` = 1rem，整条刻度按它派生。
   * 字号基准 14 是正文 `text-sm` 的 px 值，所以默认偏好（倍率 1、字号 14）换算后
   * 落回 `--font-size: 100%` —— 字号首屏零位移（半径是有意变大，不是漂移）。
   */
  it('圆角基准固定 16px，字号基准换算后默认偏好落回 100%', () => {
    expect(BORDER_RADIUS_BASE).toBe(16);
    expect(BASE_FONT_SIZE).toBe(14);
  });
});
