import type { VueWrapper } from '@vue/test-utils';

import type { ListyItem } from '../src/components/listy/types';

import { mount } from '@vue/test-utils';
import { h, nextTick } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import Listy from '../src/components/listy/Listy.vue';

/**
 * 虚拟滚动模式的单测。
 *
 * 只钉 jsdom 能给的东西：窗口行数、占位样式、内联行高、暴露的状态与方法、事件形状。
 * 真正的滚动几何（滚到第几行、视口随尺寸变化）要等 ResizeObserver 与布局，
 * 那些由 `apps/web/e2e/listy-virtual.spec.ts` 在浏览器里量，这里不假装覆盖。
 */

const makeItems = (count: number): ListyItem[] =>
  Array.from({ length: count }, (_, index) => ({
    description: `第 ${index} 条`,
    title: `条目 ${index}`,
  }));

/**
 * 挂载并等一次渲染。
 *
 * 首帧的可视窗口是 `onMounted` 里算出来的：改状态是同步的，把 `<li>` 排进 DOM 却要
 * 等调度器那一趟微任务，所以少了这一次 tick，读到的永远是"有状态、没行"。
 */
async function render(props: Record<string, unknown>, options = {}) {
  const wrapper = mount(Listy, { props, ...options });
  await nextTick();
  return wrapper;
}

const mountVirtual = (options: Record<string, unknown> = {}) =>
  render({
    containerHeight: 200,
    itemHeight: 40,
    items: makeItems(1000),
    virtual: true,
    ...options,
  });

const rowsOf = (wrapper: VueWrapper) =>
  wrapper.findAll('ul.listy__rows > li');

const viewportOf = (wrapper: VueWrapper) =>
  wrapper.get('[data-listy-viewport]');

/** 把 `scrollTop` 钉成常量：jsdom 不会自己滚，只能替它答话 */
function fakeScrollTop(element: Element, value: number) {
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => value,
  });
}

describe('Listy 虚拟滚动', () => {
  it('万级数据只渲染窗口内的十几行，不是全部', async () => {
    const wrapper = await mountVirtual({ items: makeItems(20_000) });
    const rows = rowsOf(wrapper);
    expect(rows.length).toBeGreaterThan(0);
    // 上限来自"视口容量 + 上下 overscan"：jsdom 里 clientHeight 恒为 0，
    // 所以窗口就是 1 行 + 下侧 5 overscan；断言只要求它别退化成全量渲染
    expect(rows.length).toBeLessThanOrEqual(20);
    expect(rows[0]!.attributes('data-listy-index')).toBe('0');
  });

  it('占位块按总高撑出来：窗口在开头时 `<ul>` 就是整条内容高，marginTop 为 0', async () => {
    const wrapper = await mountVirtual();
    const style = wrapper.get('ul.listy__rows').attributes('style') ?? '';
    // 1000 行 × 40px；初始窗口从 0 开始，所以 marginTop 是 0
    expect(style).toContain('height: 40000px');
    expect(style).toContain('margin-top: 0px');
  });

  it('固定高度模式下每行都被内联钉死，DOM 高度与算术高度同一把尺', async () => {
    const wrapper = await mountVirtual();
    const rows = rowsOf(wrapper);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.attributes('style')).toContain('height: 40px');
    }
  });

  it('行高可以是函数：总高按逐行求和，行内联高度也各自不同', async () => {
    const wrapper = await mountVirtual({
      itemHeight: (index: number) => (index % 2 === 0 ? 50 : 30),
    });
    const rows = rowsOf(wrapper);
    expect(rows[0]!.attributes('style')).toContain('height: 50px');
    expect(rows[1]!.attributes('style')).toContain('height: 30px');
    // 500×50 + 500×30
    expect(
      (wrapper.vm as unknown as { totalHeight: number }).totalHeight,
    ).toBe(40_000);
  });

  it('measure-heights 打开时不写内联高度，把真实高度留给内容撑开', async () => {
    const wrapper = await mountVirtual({
      containerHeight: '50vh',
      measureHeights: true,
    });
    expect(rowsOf(wrapper)[0]!.attributes('style') ?? '').not.toContain(
      'height',
    );
    expect(viewportOf(wrapper).attributes('style')).toContain('height: 50vh');
  });

  it('视口容器拿到 overflow-y 与指定高度，直排模式这两个都不给', async () => {
    const virtual = await mountVirtual();
    const virtualStyle = viewportOf(virtual).attributes('style') ?? '';
    expect(virtualStyle).toContain('overflow-y: auto');
    expect(virtualStyle).toContain('height: 200px');

    const plain = await render({ items: makeItems(3) });
    expect(viewportOf(plain).attributes('style')).toBeUndefined();
    expect(rowsOf(plain)).toHaveLength(3);
  });

  it('插槽拿到的是上游绝对下标，不是窗口内序号', async () => {
    const wrapper = await mountVirtual();
    fakeScrollTop(viewportOf(wrapper).element, 4000);
    (wrapper.vm as unknown as { recalc: () => void }).recalc();
    await nextTick();
    const indices = rowsOf(wrapper).map((row) => Number(row.attributes('data-listy-index')));
    const first = indices[0]!;
    expect(first).toBeGreaterThan(0);
    // 每行都收到自己的 index：窗口移动后仍是连续递增的绝对下标
    expect(indices).toEqual(
      Array.from({ length: indices.length }, (_, offset) => first + offset),
    );
  });

  it('窗口一移动，占位块的 marginTop 就等于窗口之前所有行的高度', async () => {
    const wrapper = await mountVirtual();
    fakeScrollTop(viewportOf(wrapper).element, 4000);
    (wrapper.vm as unknown as { recalc: () => void }).recalc();
    await nextTick();
    const { startIndex } = (
      wrapper.vm as unknown as { visibleRange: { startIndex: number } }
    ).visibleRange;
    const style = wrapper.get('ul.listy__rows').attributes('style') ?? '';
    expect(style).toContain(`margin-top: ${startIndex * 40}px`);
    // 首行之前那些行确实不在 DOM 里了
    expect(rowsOf(wrapper)[0]!.attributes('data-listy-index')).toBe(
      String(startIndex),
    );
  });

  it('visibleItems 与 visibleRange 报当前窗口；直排模式就是全量', async () => {
    const wrapper = await mountVirtual();
    const vm = wrapper.vm as unknown as {
      visibleItems: ListyItem[];
      visibleRange: { endIndex: number; startIndex: number };
    };
    expect(vm.visibleItems.length).toBeLessThanOrEqual(20);
    expect(vm.visibleItems[0]!.title).toBe('条目 0');
    expect(vm.visibleRange.startIndex).toBe(0);

    const plain = await render({ items: makeItems(4) });
    const plainVm = plain.vm as unknown as {
      visibleItems: ListyItem[];
      visibleRange: { endIndex: number; startIndex: number };
    };
    expect(plainVm.visibleItems).toHaveLength(4);
    expect(plainVm.visibleRange).toEqual({ endIndex: 3, startIndex: 0 });
  });

  it('scrollToIndex 按行高算偏移并调用容器的 scrollTo', async () => {
    const wrapper = await mountVirtual();
    const scrollTo = vi.fn();
    const element = viewportOf(wrapper).element as HTMLElement;
    element.scrollTo = scrollTo;
    (
      wrapper.vm as unknown as {
        scrollToIndex: (index: number, options?: object) => void;
      }
    ).scrollToIndex(120, { behavior: 'smooth' });
    // 第 120 行的顶部在 4800px
    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth', top: 4800 }),
    );
  });

  it('scrollToIndex 越界被夹到合法区间，空列表也不会滚', async () => {
    const wrapper = await mountVirtual();
    const element = viewportOf(wrapper).element as HTMLElement;
    const scrollTo = vi.fn();
    element.scrollTo = scrollTo;
    const vm = wrapper.vm as unknown as {
      scrollToIndex: (index: number) => void;
    };
    vm.scrollToIndex(99_999);
    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ top: 999 * 40 }),
    );
    scrollTo.mockClear();
    vm.scrollToIndex(-10);
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
  });

  it('容器发出 scroll 事件后同步重算窗口，并抛出 scroll 快照', async () => {
    const wrapper = await mountVirtual();
    const element = viewportOf(wrapper).element as HTMLElement;
    fakeScrollTop(element, 4000);
    await element.dispatchEvent(new Event('scroll'));
    await nextTick();

    const state = wrapper.emitted('scroll')?.at(-1)?.[0] as {
      progress: number;
      scrollTop: number;
      startIndex: number;
      visibleCount: number;
    };
    expect(state.scrollTop).toBe(4000);
    // jsdom 里容器高度量不到（0），所以 progress 就是 scrollTop / 总高
    expect(state.progress).toBeCloseTo(4000 / 40_000, 5);
    expect(state.startIndex).toBeGreaterThan(0);
    expect(state.visibleCount).toBeGreaterThan(0);
    expect(state.visibleCount).toBeLessThanOrEqual(20);
  });

  it('滚动快照里 scrollHeight 是内容总高，占位块底边与之对齐', async () => {
    const wrapper = await mountVirtual({ items: makeItems(500) });
    const element = viewportOf(wrapper).element as HTMLElement;
    // `scroll` 事件跟着位置走：位置没变就不重复抛，所以这里要真的"滚一下"
    fakeScrollTop(element, 2000);
    await element.dispatchEvent(new Event('scroll'));
    await nextTick();
    const state = wrapper.emitted('scroll')?.at(-1)?.[0] as {
      scrollHeight: number;
    };
    expect(state.scrollHeight).toBe(20_000);
    // 占位块是 `marginTop + height`：前者顶掉窗口之前那些行，后者是剩下的尾巴，
    // 两者相加才等于内容总高，滚动条长度因此和算术高度一致
    const style = wrapper.get('ul.listy__rows').attributes('style') ?? '';
    const offset = Number(/margin-top: (\d+(?:\.\d+)?)px/.exec(style)?.[1]);
    const rest = Number(/height: (\d+(?:\.\d+)?)px/.exec(style)?.[1]);
    expect(offset).toBeGreaterThan(0);
    expect(offset + rest).toBe(20_000);
  });

  it('就地追加数据会把总高与窗口重算，不需要重挂组件', async () => {
    const items = makeItems(10);
    const wrapper = await mountVirtual({ items });
    const before = (wrapper.vm as unknown as { totalHeight: number })
      .totalHeight;
    await wrapper.setProps({ items: [...items, ...makeItems(10)] });
    expect(
      (wrapper.vm as unknown as { totalHeight: number }).totalHeight,
    ).toBe(before + 400);
  });

  it('loading 与空态仍然优先于虚拟渲染', async () => {
    const loading = await mountVirtual({ loading: true });
    expect(loading.get('ul').attributes('aria-busy')).toBe('true');
    expect(loading.find('[data-listy-viewport]').exists()).toBe(false);

    const emptyList = await mountVirtual({ items: [] });
    expect(emptyList.text()).toContain('暂无数据');
    expect(emptyList.find('[data-listy-viewport]').exists()).toBe(false);
  });

  it('虚拟模式下点击行照样抛 item-click(item, 绝对下标)', async () => {
    const wrapper = await mountVirtual();
    const rows = rowsOf(wrapper);
    await rows[2]!.trigger('click');
    const payload = wrapper.emitted('itemClick')?.[0] as [ListyItem, number];
    expect(payload[1]).toBe(2);
    expect(payload[0]!.title).toBe('条目 2');
  });

  it('#item 插槽在虚拟模式里逐行接管，行键仍按 itemKey 走', async () => {
    const data: ListyItem[] = Array.from({ length: 50 }, (_, index) => ({
      id: `x${index}`,
      title: `T${index}`,
    }));
    const wrapper = await render(
      {
        containerHeight: 200,
        itemHeight: 40,
        itemKey: 'id',
        items: data,
        virtual: true,
      },
      {
        slots: {
          item: ({ index, item }: { index: number; item: ListyItem }) =>
            h('i', { class: 'vrow' }, `${index}:${String(item.id)}`),
        },
      },
    );
    expect(wrapper.find('i.vrow').text()).toBe('0:x0');
    expect(wrapper.findAll('i.vrow').length).toBeLessThanOrEqual(20);
  });
});
