import type { TabItem } from '@antdv/types';

import { createPinia, setActivePinia } from 'pinia';
import { useTabsStore } from '~/stores/modules/tabs';

/**
 * 标签固定态（toggleAffix）的 store 测试。
 *
 * 固定/取消固定涉及数组重排，「固定标签永远在最前且相对顺序不变」是
 * ensureHome / syncOrder / 拖拽守卫共同依赖的不变量，这里把新入口验在同一层。
 */

function tab(key: string, extra: Partial<TabItem> = {}): TabItem {
  return { closable: true, key, path: `/${key}`, title: key, ...extra };
}

function makeStore(tabs: TabItem[]) {
  setActivePinia(createPinia());
  const store = useTabsStore();
  store.tabs = tabs;
  return store;
}

const HOME = tab('home', { affix: true, closable: false });

describe('tabs store —— toggleAffix', () => {
  it('固定标签并入固定区末尾，其余标签相对顺序不变', () => {
    const store = makeStore([HOME, tab('a'), tab('b'), tab('c')]);

    expect(store.toggleAffix('c')).toBe(true);
    expect(store.tabs.map((item) => item.key)).toEqual(['home', 'c', 'a', 'b']);
    expect(store.tabs[1]?.affix).toBe(true);
    // 固定区数量随之增长，isClosable 的「仅剩一个可关」保护同步收紧
    expect(store.affixCount).toBe(2);
    expect(store.isClosable('c')).toBe(false);
  });

  it('重复调用可切换：取消固定后回到固定区之后的位置', () => {
    const store = makeStore([HOME, tab('a'), tab('b')]);

    store.toggleAffix('a');
    expect(store.tabs.map((item) => item.key)).toEqual(['home', 'a', 'b']);

    expect(store.toggleAffix('a')).toBe(true);
    expect(store.tabs[1]?.affix).toBeFalsy();
    expect(store.affixCount).toBe(1);
    expect(store.isClosable('a')).toBe(true);
  });

  it('多个固定标签保持固定区在前且相对顺序稳定', () => {
    const store = makeStore([HOME, tab('a'), tab('b')]);
    store.toggleAffix('b');
    store.toggleAffix('a');
    expect(store.tabs.map((item) => item.key)).toEqual(['home', 'b', 'a']);
    expect(store.tabs.every((item) => item.affix)).toBe(true);

    // 固定前缀不变量与 syncOrder 的校验口径一致
    expect(
      store.syncOrder([tab('a'), tab('b'), HOME].map((item) => store.tabs.find((t) => t.key === item.key)!)),
    ).toBe(false);
  });

  it('首页不允许取消固定：位置与固定态都保持原样', () => {
    const store = makeStore([HOME, tab('a')]);

    expect(store.toggleAffix('home')).toBe(false);
    expect(store.tabs[0]?.affix).toBe(true);
    expect(store.tabs.map((item) => item.key)).toEqual(['home', 'a']);
  });

  it('不存在的 key 返回 false 且不动数组', () => {
    const store = makeStore([HOME, tab('a')]);
    expect(store.toggleAffix('nope')).toBe(false);
    expect(store.tabs).toHaveLength(2);
  });
});
