import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref } from 'vue';

import { Scrollbar } from '../src/scrollbar';
import { useResponsiveMaxHeight } from '../src/scrollbar/useResponsiveMaxHeight';
import { BAR_MAP, renderThumbStyle } from '../src/scrollbar/util';

/**
 * 滚动条的契约测试。
 *
 * 自绘滚动条的几何计算（滑块长度、位移、方向判定）全靠元素度量，
 * jsdom 里 clientHeight / scrollHeight 恒为 0，所以用 defineProperty
 * 给具体实例打桩，把"算得对不对"这件事验证到，而不是只验证能渲染。
 */

/** 给某个元素伪造视口尺寸与内容尺寸（jsdom 不会自己做布局） */
function stubMetrics(
  el: HTMLElement,
  metrics: {
    clientHeight?: number;
    clientWidth?: number;
    scrollHeight?: number;
    scrollWidth?: number;
  },
) {
  for (const [key, value] of Object.entries(metrics)) {
    Object.defineProperty(el, key, { configurable: true, value, writable: true });
  }
}

describe('renderThumbStyle —— 滑块样式计算', () => {
  it('纵向：写 height 与 translateY，并带上历史浏览器前缀', () => {
    expect(
      renderThumbStyle({ bar: BAR_MAP.vertical, move: 30, size: '25%' }),
    ).toEqual({
      height: '25%',
      msTransform: 'translateY(30%)',
      transform: 'translateY(30%)',
      webkitTransform: 'translateY(30%)',
    });
  });

  it('横向：写 width 与 translateX', () => {
    const style = renderThumbStyle({ bar: BAR_MAP.horizontal, move: 5, size: '40%' });
    expect(style.width).toBe('40%');
    expect(style.transform).toBe('translateX(5%)');
    expect(style.height).toBeUndefined();
  });

  it('缺省 move / size 时给出 0 与 translateY(0%)，而不是 undefined', () => {
    // size 默认是 '0'（无单位零）：不溢出时滑块高度归零，轨道本身已被 v-if 摘掉
    expect(renderThumbStyle({ bar: BAR_MAP.vertical })).toMatchObject({
      height: '0',
      transform: 'translateY(0%)',
    });
  });

  it('BAR_MAP 两个方向的 key 决定轨道类名（is-vertical / is-horizontal）', () => {
    expect(BAR_MAP.vertical.key).toBe('vertical');
    expect(BAR_MAP.horizontal.key).toBe('horizontal');
    expect(BAR_MAP.vertical.scroll).toBe('scrollTop');
    expect(BAR_MAP.horizontal.scroll).toBe('scrollLeft');
  });
});

describe('useResponsiveMaxHeight —— 按视口高度缩放', () => {
  /** hook 依赖 computed + useWindowSize，必须在 setup 上下文里取 */
  function setup(options: Parameters<typeof useResponsiveMaxHeight>[0] = {}) {
    let result!: ReturnType<typeof useResponsiveMaxHeight>;
    const Host = defineComponent({
      setup() {
        result = useResponsiveMaxHeight(options);
        return () => h('div');
      },
    });
    mount(Host);
    return result;
  }

  it('默认下限 712 会兜住小视口的缩放结果', () => {
    const { maxHeight, windowHeight } = setup({ referenceMaxHeight: 495 });
    // jsdom 视口高 768：< 1080，缩放后远小于 712，于是落在下限
    expect(windowHeight.value).toBeLessThan(1080);
    expect(maxHeight.value).toBe(712);
  });

  it('min=0 时按 (窗口高 / 基准高) ^ 指数 缩放', () => {
    const { maxHeight, windowHeight } = setup({
      exponent: 1,
      min: 0,
      referenceHeight: 1080,
      referenceMaxHeight: 540,
    });
    // 线性：540 * (768 / 1080) = 384
    expect(maxHeight.value).toBe(
      Math.round(540 * (windowHeight.value / 1080) ** 1),
    );
  });

  it('max 生效，避免大屏把容器撑到不可用', () => {
    expect(setup({ max: 120, min: 0, referenceMaxHeight: 495 }).maxHeight.value).toBe(
      120,
    );
  });

  it('referenceMaxHeight 支持 getter：跟着响应式来源重算', async () => {
    const reference = ref(540);
    const { maxHeight } = setup({
      exponent: 1,
      max: 10_000,
      min: 0,
      referenceHeight: 1080,
      referenceMaxHeight: () => reference.value,
    });
    const first = maxHeight.value;
    reference.value = 1080;
    await nextTick();
    expect(maxHeight.value).toBeGreaterThan(first);
  });

  it('maxHeightPx 带上 px 单位', () => {
    expect(setup().maxHeightPx.value).toBe('712px');
  });
});

describe('Scrollbar 组件', () => {
  function mountScrollbar(
    props: Record<string, unknown> = {},
    content = '内容',
  ) {
    return mount(Scrollbar, { props, slots: { default: () => h('p', content) } });
  }

  it('渲染根 / 滚动区 / 视图三层，slot 落在视图里', () => {
    const wrapper = mountScrollbar();
    expect(wrapper.find('.scrollbar__wrap').exists()).toBe(true);
    const view = wrapper.find('.scrollbar__view');
    expect(view.exists()).toBe(true);
    expect(view.element.tagName).toBe('DIV');
    expect(view.text()).toBe('内容');
  });

  it('tag 属性决定视图元素，非 div 时依然带 scrollbar__view 类', () => {
    const view = mountScrollbar({ tag: 'ul' }).find('.scrollbar__view');
    expect(view.element.tagName).toBe('UL');
  });

  it('wrapClass / viewClass / wrapStyle 原样附加，便于宿主布局', () => {
    const wrapper = mountScrollbar({
      viewClass: 'my-view',
      wrapClass: 'my-wrap',
      wrapStyle: 'padding: 8px',
    });
    const wrap = wrapper.find('.scrollbar__wrap');
    expect(wrap.classes()).toContain('my-wrap');
    expect(wrap.attributes('style')).toContain('padding: 8px');
    expect(wrapper.find('.scrollbar__view').classes()).toContain('my-view');
  });

  it('非 native 模式隐藏原生滚动条，native 模式保留原生且不自绘', () => {
    const custom = mountScrollbar();
    expect(custom.find('.scrollbar__wrap').classes()).toContain(
      'scrollbar__wrap--hidden-default',
    );

    const native = mountScrollbar({ native: true });
    expect(native.find('.scrollbar__wrap').classes()).not.toContain(
      'scrollbar__wrap--hidden-default',
    );
    expect(native.findAll('.scrollbar__bar')).toHaveLength(0);
  });

  it('只在真正溢出的方向渲染轨道：纵向溢出不出横向条', async () => {
    const wrapper = mountScrollbar({}, undefined);
    stubMetrics(wrapper.find('.scrollbar__wrap').element as HTMLElement, {
      clientHeight: 100,
      clientWidth: 300,
      scrollHeight: 400,
      scrollWidth: 300,
    });

    // update() 是 defineExpose 出来的公共 API，宿主重排后可手动触发
    (wrapper.vm as unknown as { update: () => void }).update();
    await nextTick();

    expect(wrapper.find('.scrollbar__bar.is-vertical').exists()).toBe(true);
    expect(wrapper.find('.scrollbar__bar.is-horizontal').exists()).toBe(false);
  });

  it('滑块长度按 视口/内容 比例计算，并受 minSize 下限约束', async () => {
    const wrapper = mountScrollbar();
    const wrap = wrapper.find('.scrollbar__wrap').element as HTMLElement;
    stubMetrics(wrap, {
      clientHeight: 100,
      clientWidth: 100,
      scrollHeight: 400,
      scrollWidth: 1000,
    });
    (wrapper.vm as unknown as { update: () => void }).update();
    await nextTick();

    const vertical = wrapper.find('.scrollbar__bar.is-vertical .scrollbar__thumb');
    expect(vertical.attributes('style')).toContain('height: 25%');

    // 100 / 1000 = 10% < minSize(20) → 抬到 20%，滑块不会细到点不到
    const horizontal = wrapper.find(
      '.scrollbar__bar.is-horizontal .scrollbar__thumb',
    );
    expect(horizontal.attributes('style')).toContain('width: 20%');
  });

  it('内容不溢出时两条轨道都不存在', async () => {
    const wrapper = mountScrollbar();
    stubMetrics(wrapper.find('.scrollbar__wrap').element as HTMLElement, {
      clientHeight: 300,
      clientWidth: 300,
      scrollHeight: 300,
      scrollWidth: 300,
    });
    (wrapper.vm as unknown as { update: () => void }).update();
    await nextTick();
    expect(wrapper.findAll('.scrollbar__bar')).toHaveLength(0);
  });

  it('always 让轨道常驻可见，默认则靠滚动/悬停显形', async () => {
    const always = mountScrollbar({ always: true });
    stubMetrics(always.find('.scrollbar__wrap').element as HTMLElement, {
      clientHeight: 100,
      clientWidth: 100,
      scrollHeight: 400,
      scrollWidth: 100,
    });
    (always.vm as unknown as { update: () => void }).update();
    await nextTick();
    expect(always.find('.scrollbar__bar').classes()).toContain('opacity-100');

    const auto = mountScrollbar();
    stubMetrics(auto.find('.scrollbar__wrap').element as HTMLElement, {
      clientHeight: 100,
      clientWidth: 100,
      scrollHeight: 400,
      scrollWidth: 100,
    });
    (auto.vm as unknown as { update: () => void }).update();
    await nextTick();
    expect(auto.find('.scrollbar__bar').classes()).toContain('pointer-events-none');
  });

  it('对外暴露 setScrollTop / setScrollLeft / scrollTo，宿主可以直接驱动滚动', () => {
    const wrapper = mountScrollbar(undefined, '内容');
    // 注意：@vue/test-utils 的 `wrapper.vm` 会自动解包 `defineExpose` 暴露出来的 ref，
    // 所以这里 `vm.wrap` 拿到的就是 wrap 元素本身，而不是 `Ref<HTMLElement>`。
    const vm = wrapper.vm as unknown as {
      scrollTo: (options: ScrollToOptions) => void;
      setScrollLeft: (value: number) => void;
      setScrollTop: (value: number) => void;
      wrap: HTMLElement | undefined;
    };
    const wrapEl = wrapper.find('.scrollbar__wrap').element as HTMLElement;

    vm.setScrollTop(120);
    expect(wrapEl.scrollTop).toBe(120);
    vm.setScrollLeft(60);
    expect(wrapEl.scrollLeft).toBe(60);

    // 非数字直接忽略，避免把 NaN 写进 DOM
    vm.setScrollTop(Number.NaN);
    expect(wrapEl.scrollTop).toBe(120);

    const scrollTo = vi.fn();
    wrapEl.scrollTo = scrollTo;
    vm.scrollTo({ left: 10, top: 20 });
    expect(scrollTo).toHaveBeenCalledWith({ left: 10, top: 20 });
    expect(vm.wrap).toBe(wrapEl);
  });

  it('滚动时抛 scroll 事件，携带 scrollTop / scrollLeft', async () => {
    const wrapper = mountScrollbar();
    const wrapEl = wrapper.find('.scrollbar__wrap').element as HTMLElement;
    stubMetrics(wrapEl, {
      clientHeight: 100,
      clientWidth: 100,
      scrollHeight: 400,
      scrollWidth: 400,
    });
    wrapEl.scrollTop = 40;
    wrapEl.scrollLeft = 20;

    await wrapper.vm.$nextTick();
    (wrapper.vm as unknown as { handleScroll: () => void }).handleScroll();

    const event = wrapper.emitted('scroll')?.at(-1)?.[0] as {
      scrollLeft: number;
      scrollTop: number;
    };
    expect(event).toEqual({ scrollLeft: 20, scrollTop: 40 });
  });

  it('maxHeight 转成响应式 px 落到根节点行内样式', () => {
    const wrapper = mountScrollbar({ maxHeight: 495 });
    expect(wrapper.attributes('style')).toContain('max-height:');
  });
});
