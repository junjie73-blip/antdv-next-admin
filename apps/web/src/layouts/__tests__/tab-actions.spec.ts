import type { TabActionContext } from '../components/tabs/constants';

import { buildTabActions, isActionDisabled, TAB_ACTIONS } from '../components/tabs/constants';

/**
 * 标签页右键菜单动作集的纯数据测试。
 *
 * 菜单的可用性判断全部收敛在 constants.ts（上下文由 LayoutTabs 从 store 算出），
 * 所以这里不需要 DOM：顺序、label 随状态变化、禁用规则都能在数据层验完。
 */

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

describe('TAB_ACTIONS —— 菜单结构与文案', () => {
  it('顺序与截图一致：单标签操作在前，批量关闭在后，中间一条分隔线', () => {
    expect(TAB_ACTIONS.map((action) => action.key)).toEqual([...MENU_ORDER]);
  });

  it('buildTabActions 保持同样的顺序，分隔线渲染成 divider 项', () => {
    const items = buildTabActions(makeCtx());
    expect(items.map((item) => (item.divider ? 'divider' : item.key))).toEqual([...MENU_ORDER]);
    expect(items.find((item) => item.divider)).toMatchObject({ disabled: true, label: '' });
  });

  it('固定态切换与放大态会改变 label', () => {
    const items = buildTabActions(makeCtx({ affixed: true, maximized: true }));
    expect(items.find((item) => item.key === 'affix')?.label).toBe('取消固定');
    expect(items.find((item) => item.key === 'maximize')?.label).toBe('还原当前页');

    const normal = buildTabActions(makeCtx());
    expect(normal.find((item) => item.key === 'affix')?.label).toBe('固定标签页');
    expect(normal.find((item) => item.key === 'maximize')?.label).toBe('放大当前页');
  });

  it('批量关闭项把可关闭数量带进 label，数量为 0 时省略括号', () => {
    const items = buildTabActions(makeCtx({ closeableLeft: 1, closeableRight: 2, others: 3 }));
    expect(items.find((item) => item.key === 'closeOther')?.label).toBe('关闭其他（3）');
    expect(items.find((item) => item.key === 'closeLeft')?.label).toBe('关闭左侧（1）');
    expect(items.find((item) => item.key === 'closeRight')?.label).toBe('关闭右侧（2）');

    const empty = buildTabActions(makeCtx());
    expect(empty.find((item) => item.key === 'closeAll')?.label).toBe('关闭全部');
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
    for (const key of ['affix', 'close', 'maximize', 'refresh', 'openInNewWindow'] as const) {
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
    expect(isActionDisabled('closeAll', makeCtx({ closeableRight: 1 }))).toBe(false);
    expect(isActionDisabled('closeAll', makeCtx({ others: 1 }))).toBe(false);
  });
});
