import { readFileSync } from 'node:fs';

import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import LayoutContent from '../src/components/layout-content/index.vue';
import LayoutFooter from '../src/components/layout-footer/index.vue';
import LayoutOverlay from '../src/components/layout-sidebar/overlay.vue';
import { LAYOUT_DRAWER_WIDTH } from '../src/layout';

const mounted: Array<{ unmount: () => void }> = [];

function track<T extends { unmount: () => void }>(wrapper: T): T {
  mounted.push(wrapper);
  return wrapper;
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  document.body.innerHTML = '';
});

describe('LayoutFooter - 版权行', () => {
  it('给出稳定的区域钩子，年份可以显式传入以免随日期漂移', () => {
    const wrapper = mount(LayoutFooter, { props: { year: 2026 } });
    expect(wrapper.find('[data-layout-region="footer"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('2026');
    expect(wrapper.text()).toContain('Antdv Admin');
  });

  it('不传年份时取当前年', () => {
    expect(mount(LayoutFooter).text()).toContain(
      String(new Date().getFullYear()),
    );
  });

  it('没配置备案号就整段不出现，不留孤立分隔点', () => {
    expect(mount(LayoutFooter).text()).not.toContain('京ICP');
    const withIcp = mount(LayoutFooter, {
      props: { icp: '京ICP备00000000号', year: 2026 },
    });
    expect(withIcp.text()).toContain('京ICP备00000000号');
  });

  it('关掉版权开关时整行清空（可见性由使用方决定）', () => {
    const wrapper = mount(LayoutFooter, { props: { showCopyright: false } });
    expect(wrapper.text()).toBe('');
  });

  it('公司名没有链接时退化为文本', () => {
    const wrapper = mount(LayoutFooter, { props: { companyHref: '' } });
    expect(wrapper.find('a').exists()).toBe(false);
    expect(wrapper.text()).toContain('Antdv Admin');
  });
});

describe('LayoutContent - 滚动容器', () => {
  it('内容区钩子与宽度策略分开：行内样式来自 resolveContentStyle', () => {
    const wrapper = mount(LayoutContent, {
      props: { contentStyle: { maxWidth: '1200px' } },
      slots: { default: '<p>hi</p>' },
    });
    expect(
      wrapper.find('[data-layout-region="content"]').attributes('style'),
    ).toContain('max-width: 1200px');
    expect(wrapper.text()).toContain('hi');
  });

  it('沉浸视角下不留内边距（padding 挂在滚动视图上，不挂在滚动元素上）', () => {
    const padded = mount(LayoutContent, { slots: { default: '<p/>' } });
    const bare = mount(LayoutContent, {
      props: { padded: false },
      slots: { default: '<p/>' },
    });
    expect(padded.find('.scrollbar__view').classes()).toContain('p-4');
    expect(bare.find('.scrollbar__view').classes()).not.toContain('p-4');
  });

  it('overlay 插槽的内容排在滚动区之前，不跟着一起滚', () => {
    const wrapper = mount(LayoutContent, {
      slots: { default: '<p>正文</p>', overlay: '<div data-mark>x</div>' },
    });
    const content = wrapper.find('[data-layout-region="content"]');
    const mark = content.find('[data-mark]');
    expect(mark.exists()).toBe(true);
    // 覆盖层是内容区的第一个孩子，滚动容器在它之后
    expect(content.element.firstElementChild).toBe(mark.element);
  });

  it('scrollToTop 走组件暴露的 scrollTo，不去摸 DOM', () => {
    const scrollTo = vi.fn();
    // 只替掉滚动容器这一个依赖：验证的是"调用契约"，不是 Scrollbar 的内部 DOM
    const ScrollbarStub = defineComponent({
      name: 'FakeScrollbar',
      setup(_props, { expose, slots }) {
        expose({ scrollTo });
        return () => h('div', slots.default?.());
      },
    });
    const wrapper = track(
      mount(LayoutContent, {
        global: { stubs: { Scrollbar: ScrollbarStub } },
        slots: { default: '<p/>' },
      }),
    );
    const vm = wrapper.vm as unknown as { scrollToTop: () => void };
    expect(typeof vm.scrollToTop).toBe('function');
    vm.scrollToTop();
    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 0 });
  });
});

describe('LayoutOverlay - 浮层侧栏', () => {
  it('收起时不往 body 上留任何东西', () => {
    track(mount(LayoutOverlay, { props: { open: false } }));
    expect(document.body.querySelector('[data-layout-overlay]')).toBeNull();
  });

  it('展开时遮罩 + 面板都在 body 上，默认宽度与抽屉常量同源', () => {
    track(mount(LayoutOverlay, { props: { open: true } }));
    const panel = document.body.querySelector<HTMLElement>(
      '[data-layout-overlay-panel]',
    );
    expect(panel).not.toBeNull();
    expect(panel?.style.width).toBe(`${LAYOUT_DRAWER_WIDTH}px`);
    expect(
      document.body.querySelector('[data-layout-overlay-mask]'),
    ).not.toBeNull();
  });

  it('点遮罩发一次 update:open=false', async () => {
    const wrapper = track(mount(LayoutOverlay, { props: { open: true } }));
    document.querySelector<HTMLElement>('[data-layout-overlay-mask]')?.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false]);
  });

  it('按 Esc 收起；已经收起时不再发第二次关闭事件', async () => {
    const wrapper = track(mount(LayoutOverlay, { props: { open: true } }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('update:open')).toHaveLength(1);

    const closed = track(mount(LayoutOverlay, { props: { open: false } }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await closed.vm.$nextTick();
    expect(closed.emitted('update:open')).toBeUndefined();
  });

  it('面板里没有标题栏也没有关闭叉（与迁移前的 Drawer 一致）', () => {
    track(
      mount(LayoutOverlay, {
        props: { open: true, width: 300 },
        slots: { default: '<aside data-mark/>' },
      }),
    );
    const panel = document.body.querySelector('[data-layout-overlay-panel]');
    expect(panel?.querySelector('[data-layout-sidebar-collapse]')).toBeNull();
    expect(panel?.querySelector('[data-mark]')).not.toBeNull();
    expect(panel?.getAttribute('style')).toContain('width: 300px');
  });
});

/**
 * 开合动画。
 *
 * jsdom 不解析组件的 `<style>`，也没有真的过渡时长，所以"往哪滑、淡不淡"只能在源码层面钉；
 * DOM 这边钉的是这个结构的两个前提：包裹层自己不参与布局（`display: contents`、
 * 不带 transform —— 祖先一旦有变换，两个 `fixed` 子层就改以它为包含块，遮罩不再铺满全屏），
 * 以及三个 `data-layout-*` 钩子还落在原来的层上。
 * 真实的滑入与淡入由 e2e 在浏览器里看。
 */
describe('LayoutOverlay - 开合动画', () => {
  const SOURCE = readFileSync(
    'src/components/layout-sidebar/overlay.vue',
    'utf8',
  );

  it('面板从左侧滑入、遮罩淡入，收起走同一套档位', () => {
    for (const state of ['enter-from', 'appear-from', 'leave-to'] as const) {
      expect(
        SOURCE.includes(`.layout-overlay-${state} [data-layout-overlay-panel]`),
      ).toBe(true);
      expect(
        SOURCE.includes(`.layout-overlay-${state} [data-layout-overlay-mask]`),
      ).toBe(true);
    }
    expect(SOURCE).toContain('transform: translateX(-100%)');
    expect(SOURCE).toContain('opacity: 0');
  });

  it('动画前缀与样式里的选择器同名（改名要两边一起改）', () => {
    expect(SOURCE).toContain('<Transition appear name="layout-overlay">');
  });

  /**
   * 取某条规则里第一条 `transition` 声明的秒数（没有就当 0）。
   *
   * 为什么要在源码里比大小：Vue 决定"何时摘掉离场节点"读的是**挂动画类那一层**的时长。
   * 包裹层是 `display: contents`，没有盒、不会真的派发 transitionend，
   * 时长读成 0 就等于"没有过渡"→ leave 第一帧把面板 detach，子层那条滑出根本没机会开始。
   * 所以挂点必须自带一条不短于子层最长过渡的时长（到点由 Vue 的兜底定时器 resolve）。
   * 这条不变量只在浏览器里看得见（e2e 的 `mobile-nav.spec.ts` 量滑出），jsdom 里必须靠源码钉。
   */
  function transitionSeconds(selector: string): number {
    const start = SOURCE.indexOf(`\n${selector} {`);
    expect(start, `样式里找不到 ${selector} 这条规则`).toBeGreaterThan(-1);
    const body = SOURCE.slice(start, SOURCE.indexOf('}', start));
    const raw = /transition:[^;]*?([\d.]+)s/.exec(body)?.[1];
    return raw ? Number.parseFloat(raw) : 0;
  }

  it('挂动画类的包裹层自带时长，且不短于子层最长的那条', () => {
    const panel = transitionSeconds('[data-layout-overlay-panel]');
    const shade = transitionSeconds('[data-layout-overlay-mask]');
    expect(Math.max(panel, shade), '子层压根没有时长').toBeGreaterThan(0);
    expect(transitionSeconds('[data-layout-overlay]')).toBeGreaterThanOrEqual(
      Math.max(panel, shade),
    );
  });

  it('包裹层只当动画挂点：自己是 contents，不带自己的盒模型', async () => {
    const wrapper = track(
      mount(LayoutOverlay, { props: { open: false }, attachTo: document.body }),
    );
    await wrapper.setProps({ open: true });

    const overlay = document.body.querySelector<HTMLElement>(
      '[data-layout-overlay]',
    );
    expect(overlay).not.toBeNull();
    expect(overlay?.classList.contains('contents')).toBe(true);
    // jsdom 里没有真的过渡时长，enter 类在下一帧就被摘掉，所以这里钉的是结构不是类名
    expect(overlay?.style.transform).toBe('');
    // 遮罩与面板还是那两个固定层，钩子位置没被动画改写
    expect(overlay?.querySelector('[data-layout-overlay-mask]')).not.toBeNull();
    expect(
      overlay?.querySelector('[data-layout-overlay-panel]'),
    ).not.toBeNull();
  });
});
