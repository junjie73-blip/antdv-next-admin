import type { TabActionContext } from '../src/types';

import { ref } from 'vue';

import { configureTabs } from '../src/config';
import {
  buildTabActions,
  isActionDisabled,
  TAB_ACTIONS,
} from '../src/constants';
import { TAB_STYLE_OPTIONS, useTabStyle } from '../src/useTabStyle';

/**
 * 标签页动作集与视觉风格的纯逻辑测试。
 *
 * 菜单的可用性判断全部收敛在 constants（上下文由 TabsBar 从标签数组算出），
 * 所以这里不需要 DOM：顺序、label 随状态变化、禁用规则都能在数据层验完。
 * 文案走注入的 `t`，用例只关心"用了哪个 key、有没有带上数量"。
 */

/** 把 key 原样吐出、数量用括号附上的假翻译，断言可直接对着 key 写 */
function fakeT(key: string, named?: Record<string, number | string>): string {
  return named ? `${key}(${named.count})` : key;
}

beforeEach(() => {
  configureTabs({ t: fakeT });
});

function makeCtx(overrides: Partial<TabActionContext> = {}): TabActionContext {
  return {
    affixed: false,
    closeableLeft: 0,
    closeableRight: 0,
    isHome: false,
    maximized: false,
    others: 0,
    ...overrides,
  };
}

const MENU_ORDER = [
  'close',
  'affix',
  'maximize',
  'refresh',
  'divider',
  'openInNewWindow',
  'closeOther',
  'closeLeft',
  'closeRight',
  'closeAll',
] as const;

describe('tabsRuntime —— 文案注入点', () => {
  it('默认实现原样返回 key，未配置 i18n 时也有稳定文本', async () => {
    // 取一份干净的模块实例：本文件的 beforeEach 已经把单例换成假翻译了
    vi.resetModules();
    const fresh = await import('../src/config');
    expect(fresh.tabsRuntime.t('tabs.closeAll')).toBe('tabs.closeAll');
    expect(fresh.tabsRuntime.t('tabs.closeAll', { count: 2 })).toBe(
      'tabs.closeAll',
    );
  });

  it('label 在调用那一刻才读 t，注入新翻译后不必换上下文', () => {
    const ctx = makeCtx();
    expect(
      buildTabActions(ctx).find((item) => item.key === 'close')?.label,
    ).toBe('tabs.closeCurrent');

    configureTabs({ t: () => '关闭当前' });
    expect(
      buildTabActions(ctx).find((item) => item.key === 'close')?.label,
    ).toBe('关闭当前');
  });
});

describe('tAB_ACTIONS —— 菜单结构与文案', () => {
  it('顺序与旧实现一致：单标签操作在前，批量关闭在后，中间一条分隔线', () => {
    expect(TAB_ACTIONS.map((action) => action.key)).toEqual([...MENU_ORDER]);
  });

  it('buildTabActions 保持同样的顺序，分隔线渲染成 divider 项', () => {
    const items = buildTabActions(makeCtx());
    expect(items.map((item) => (item.divider ? 'divider' : item.key))).toEqual([
      ...MENU_ORDER,
    ]);
    expect(items.find((item) => item.divider)).toMatchObject({
      disabled: true,
      label: '',
    });
  });

  it('固定态切换与放大态会改变 label 用的 key', () => {
    const items = buildTabActions(makeCtx({ affixed: true, maximized: true }));
    expect(items.find((item) => item.key === 'affix')?.label).toBe(
      'tabs.affixOff',
    );
    expect(items.find((item) => item.key === 'maximize')?.label).toBe(
      'tabs.maximizeOff',
    );

    const normal = buildTabActions(makeCtx());
    expect(normal.find((item) => item.key === 'affix')?.label).toBe(
      'tabs.affix',
    );
    expect(normal.find((item) => item.key === 'maximize')?.label).toBe(
      'tabs.maximize',
    );
  });

  it('批量关闭项把可关闭数量带进 key，数量为 0 时走不带 Count 的键', () => {
    const items = buildTabActions(
      makeCtx({ closeableLeft: 1, closeableRight: 2, others: 3 }),
    );
    expect(items.find((item) => item.key === 'closeOther')?.label).toBe(
      'tabs.closeOtherCount(3)',
    );
    expect(items.find((item) => item.key === 'closeLeft')?.label).toBe(
      'tabs.closeLeftCount(1)',
    );
    expect(items.find((item) => item.key === 'closeRight')?.label).toBe(
      'tabs.closeRightCount(2)',
    );

    const empty = buildTabActions(makeCtx());
    expect(empty.find((item) => item.key === 'closeAll')?.label).toBe(
      'tabs.closeAll',
    );
    expect(empty.find((item) => item.key === 'closeOther')?.label).toBe(
      'tabs.closeOther',
    );
  });
});

describe('isActionDisabled —— 禁用规则', () => {
  it('首页：affix 与 close 都禁用（首页是固定区锚点，不可取消也不可关闭）', () => {
    const ctx = makeCtx({ affixed: true, isHome: true });
    expect(isActionDisabled('affix', ctx)).toBe(true);
    expect(isActionDisabled('close', ctx)).toBe(true);
  });

  it('用户固定的非首页标签：只禁用 close，仍可取消固定', () => {
    const ctx = makeCtx({ affixed: true, isHome: false });
    expect(isActionDisabled('close', ctx)).toBe(true);
    expect(isActionDisabled('affix', ctx)).toBe(false);
  });

  it('普通标签的 affix / close / maximize / refresh / openInNewWindow 都可用', () => {
    const ctx = makeCtx();
    for (const key of [
      'affix',
      'close',
      'maximize',
      'refresh',
      'openInNewWindow',
    ] as const) {
      expect(isActionDisabled(key, ctx), key).toBe(false);
    }
  });

  it('关闭左/右/其他按各自计数禁用', () => {
    const zero = makeCtx();
    expect(isActionDisabled('closeLeft', zero)).toBe(true);
    expect(isActionDisabled('closeRight', zero)).toBe(true);
    expect(isActionDisabled('closeOther', zero)).toBe(true);

    const full = makeCtx({ closeableLeft: 1, closeableRight: 1, others: 2 });
    expect(isActionDisabled('closeLeft', full)).toBe(false);
    expect(isActionDisabled('closeRight', full)).toBe(false);
    expect(isActionDisabled('closeOther', full)).toBe(false);
  });

  it('关闭全部只在「三个方向都数不出可关闭标签」时禁用', () => {
    expect(isActionDisabled('closeAll', makeCtx())).toBe(true);
    expect(isActionDisabled('closeAll', makeCtx({ closeableRight: 1 }))).toBe(
      false,
    );
    expect(isActionDisabled('closeAll', makeCtx({ others: 1 }))).toBe(false);
  });
});

describe('useTabStyle —— 五种风格的类名', () => {
  it('不传风格即 card，与偏好默认值一致', () => {
    const { itemClass, style } = useTabStyle();
    expect(style.value).toBe('card');
    expect(itemClass(true)).toContain('rounded-md');
    expect(itemClass(true)).toContain('bg-primary');
  });

  it('未选中态只有文字色与底色差异，选中态用风格的 active', () => {
    const { itemClass } = useTabStyle(() => 'line');
    const idle = itemClass(false);
    expect(idle).toContain('text-gray-600');
    // line 风格未选中没有底色
    expect(idle).not.toContain('bg-gray-100');
    expect(itemClass(true)).toContain('border-primary');
  });

  it('chrome 风格：标签坐底边、四角同半径不描边，栏体自己不染主色', () => {
    const { barClass, classes, closeClass, itemClass, listClass } = useTabStyle(
      () => 'chrome',
    );
    expect(barClass()).toContain('items-stretch');
    // 参考稿的层次是"中性灰条 + 主色浅底选中页"，栏体染色会淹掉标签间的发丝线
    expect(barClass()).not.toContain('bg-');
    expect(listClass()).toContain('items-end');
    // 左右各留 10px：选中页的"脚"要横向伸出 10px，贴着滚动容器边缘会被裁掉
    expect(listClass()).toContain('px-2.5');

    // 反向圆角由 TabsBar 的样式块按 [data-tab-style] 画，类名这边只留几何与文字色
    expect(itemClass(true)).toContain('relative');
    expect(itemClass(true)).toContain('rounded-[0.625rem]');
    expect(itemClass(true)).toContain('text-primary');
    // 标签体底色与两只脚共用 `--tab-chrome-fill`，所以这里不能再出现底色工具类
    expect(itemClass(true)).not.toContain('bg-');
    expect(itemClass(true)).not.toContain('border');
    // 未选中是透明底，只有悬停才落一层灰
    expect(itemClass(false)).toContain('hover:bg-gray-100');
    expect(
      itemClass(false)
        .split(' ')
        .some((cls) => cls.startsWith('bg-')),
    ).toBe(false);
    expect(classes.value.divider).toBe(true);
    expect(closeClass()).toContain('hover:text-red-500');
  });

  it('plain 风格靠 divide-x 画分隔线', () => {
    const { classes, listClass } = useTabStyle(() => 'plain');
    expect(classes.value.divider).toBe(true);
    expect(listClass()).toContain('divide-x');
  });

  it('风格来源是 ref 时，切偏好不用重新调用 composable', () => {
    const style = ref<'card' | 'rounded'>('card');
    const { itemClass } = useTabStyle(() => style.value);
    expect(itemClass(true)).toContain('rounded-md');

    style.value = 'rounded';
    expect(itemClass(true)).toContain('rounded-full');
  });

  it('items 顺序覆盖 cn 的去重：rounded 风格把 py-1.5 与 px-3.5 都保留', () => {
    const { itemClass } = useTabStyle(() => 'rounded');
    expect(itemClass(false)).toContain('px-3.5');
    expect(itemClass(false)).toContain('text-sm');
  });
});

describe('tAB_STYLE_OPTIONS —— 设置面板选项', () => {
  it('五个风格全在，label 读的是 tabs.styleXxx', () => {
    expect(TAB_STYLE_OPTIONS.map((option) => option.value)).toEqual([
      'card',
      'chrome',
      'rounded',
      'line',
      'plain',
    ]);
    expect(TAB_STYLE_OPTIONS[1]?.label).toBe('tabs.styleChrome');
  });

  it('label 是 getter：切语言后（重新注入 t）选项文案跟着变', () => {
    configureTabs({ t: () => '胶囊' });
    expect(TAB_STYLE_OPTIONS[2]?.label).toBe('胶囊');
  });
});
