import { layoutRuntime } from '@antdv/layout-ui';
import { menuRuntime } from '@antdv/menu-ui';
import { tabsRuntime } from '@antdv/tabs-ui';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '~/locales';
import { configureUiKitRuntimes } from '~/plugins/ui-runtime';

/**
 * 这个插件的全部职责就是把应用的 i18n 递给三个纯表现层包。
 * 所以断言的方式是"注入之后调用包里的 `t`，看拿到的是不是中文原文"，
 * 而不是去 mock `configureLayout` —— 包的默认实现会把 key 原样还回来，
 * 只看"函数被调用过"证明不了接对了。
 */
describe('configureUiKitRuntimes', () => {
  beforeEach(() => {
    configureUiKitRuntimes();
  });

  it('布局、菜单、页签三处文案都取到译文', () => {
    expect(layoutRuntime.t('common.confirm')).toBe('确认');
    expect(menuRuntime.t('common.confirm')).toBe('确认');
    expect(tabsRuntime.t('common.confirm')).toBe('确认');
  });

  it('带名参数的文案能插值', () => {
    expect(layoutRuntime.t('common.total', { count: 12 })).toBe('共 12 条');
    expect(menuRuntime.t('common.total', { count: 3 })).toBe('共 3 条');
  });

  it('translateMenu 能区分"没有这个键"与"值和键同名"', () => {
    expect(layoutRuntime.translateMenu('menu.Dashboard')).toBe('仪表盘');
    expect(layoutRuntime.translateMenu('menu.这个键不存在')).toBeUndefined();
    // 这正是 `t` 办不到的地方：miss 时它把键还给你，包没法判断该不该回退到原文
    expect(layoutRuntime.t('menu.这个键不存在')).toBe('menu.这个键不存在');
  });

  it('切语言后注入的函数跟着变：现取现算，不是配置时的快照', () => {
    const previous = i18n.global.locale.value;
    i18n.global.locale.value = 'en-US';
    try {
      expect(layoutRuntime.t('common.confirm')).toBe('Confirm');
      expect(tabsRuntime.t('common.confirm')).toBe('Confirm');
    } finally {
      i18n.global.locale.value = previous;
    }
  });
});
