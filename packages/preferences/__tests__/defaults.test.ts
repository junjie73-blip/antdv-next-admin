import type { AppSetting } from '@antdv/types';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PREFERENCES,
  pickKnownPreferences,
  withDefaultPreferences,
} from '../src/defaults';

/**
 * 编译期兜底：给 `AppSetting` 加了字段却没在这里补默认值时，
 * `Expect<false>` 不满足约束，`tsc --noEmit` 直接失败。
 * 运行时断言做不到这件事（类型信息早就擦除了）。
 */
type Expect<T extends true> = T;
type MissingDefaults = Exclude<keyof AppSetting, keyof typeof DEFAULT_PREFERENCES>;
export type ExhaustiveDefaults = Expect<
  [MissingDefaults] extends [never] ? true : false
>;

describe('DEFAULT_PREFERENCES', () => {
  it('每个字段都有值，不存在声明了却没赋值的项', () => {
    expect(Object.keys(DEFAULT_PREFERENCES).length).toBeGreaterThan(40);
    for (const value of Object.values(DEFAULT_PREFERENCES)) {
      expect(value).not.toBeUndefined();
    }
  });

  it('不依赖 import.meta.env：随项目而变的字段用中性兜底值', () => {
    // 包体在 dist 里，读不到 Vite 的静态替换；
    // 若这里变成 '' 或 undefined，说明有人把 env 读回了包里。
    expect(DEFAULT_PREFERENCES.watermarkContent).toBe('Admin');
    expect(DEFAULT_PREFERENCES.copyrightCompany).toBe('Antdv Admin');
  });

  it('主题相关默认值是可解析的合法值', () => {
    expect(DEFAULT_PREFERENCES.theme).toBe('auto');
    expect(DEFAULT_PREFERENCES.borderRadius).toBeTypeOf('number');
    expect(DEFAULT_PREFERENCES.fontSize).toBeTypeOf('number');
    expect(DEFAULT_PREFERENCES.primaryColor).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('withDefaultPreferences', () => {
  it('只覆盖传入的键，其余保持内置默认', () => {
    const next = withDefaultPreferences({ watermarkContent: 'Acme 控制台' });
    expect(next.watermarkContent).toBe('Acme 控制台');
    expect(next.copyrightCompany).toBe(DEFAULT_PREFERENCES.copyrightCompany);
    expect(next.theme).toBe('auto');
  });

  it('无参数时等价于默认值的副本', () => {
    const next = withDefaultPreferences();
    expect(next).toEqual(DEFAULT_PREFERENCES);
    expect(next).not.toBe(DEFAULT_PREFERENCES);
  });
});

describe('pickKnownPreferences', () => {
  it('丢掉 schema 之外的键', () => {
    const picked = pickKnownPreferences({
      legacyFlag: true,
      primaryColor: '#f5222d',
    });
    expect(picked).toEqual({ primaryColor: '#f5222d' });
  });

  it('丢掉类型不匹配的脏值，交给默认值兜底', () => {
    // 一个 primaryColor: 123 会让 antd 的色值派生整条链路崩掉
    const picked = pickKnownPreferences({
      fontSize: 'huge',
      primaryColor: 123,
      showTabs: 'true',
    });
    expect(picked).toEqual({});
  });

  it('空值与非法入参返回空对象', () => {
    expect(pickKnownPreferences(null)).toEqual({});
    expect(pickKnownPreferences(undefined)).toEqual({});
    expect(pickKnownPreferences('nope' as unknown as Partial<AppSetting>)).toEqual({});
  });

  it('可以指定 schema（应用侧覆盖了默认值时按其键集合过滤）', () => {
    const schema = withDefaultPreferences();
    const picked = pickKnownPreferences({ fontSize: 15 }, schema);
    expect(picked).toEqual({ fontSize: 15 });
  });
});
