import type { VueWrapper } from '@vue/test-utils';

import type { LoadingInstance } from '../src/loading';

import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref, withDirectives } from 'vue';

import { Spin } from 'antdv-next';

import {
  createContainerLoading,
  createFullscreenLoading,
  createLoading,
  Loading as LoadingComponent,
  useLoading,
  vLoading,
} from '../src/loading';
import { LEAVE_DURATION } from '../src/loading/overlay';

/**
 * 加载模块的契约测试。
 *
 * 抽离前先通读了一遍原实现，三类"看起来能用、实际上不生效"的问题（已修，注释标 REGRESSION）：
 * 1. props 在 createApp 时一次性快照，之后 open()/setTip() 不会改变视图；
 * 2. createContainerLoading 传的 `body: false` 被 createLoading 覆盖成全屏；
 * 3. 指令 mounted 时按 false 建实例，updated 见已有实例就跳过，于是永远不显示。
 */

const WRAPPER_SELECTOR = '.loading-wrapper';

/** 本轮创建的实例 / 挂载的宿主，afterEach 统一清理，避免用例间残留覆盖层 */
const instances: LoadingInstance[] = [];
const wrappers: VueWrapper[] = [];

function track<T extends LoadingInstance>(instance: T): T {
  instances.push(instance);
  return instance;
}

/** body 模式下的覆盖层元素 */
function overlayInBody(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(WRAPPER_SELECTOR);
}

function overlayIn(root: Element): HTMLElement | null {
  return root.querySelector<HTMLElement>(WRAPPER_SELECTOR);
}

function isInvisible(el: HTMLElement | null): boolean {
  return !el || el.style.display === 'none';
}

beforeEach(() => {
  // 只 fake setTimeout：淡出动画依赖 rAF，全 fake 会让 Transition 卡住
  vi.useFakeTimers({ toFake: ['clearTimeout', 'setTimeout'] });
});

afterEach(async () => {
  // 顺序很重要：先卸载宿主（会触发 directive 的 unmounted 清理），再清空 body
  for (const wrapper of wrappers) {
    wrapper.unmount();
  }
  wrappers.length = 0;
  for (const instance of instances) {
    instance.destroy();
  }
  instances.length = 0;

  vi.clearAllTimers();
  vi.useRealTimers();
  await nextTick();
  document.body.innerHTML = '';
});

describe('Loading 组件 —— 渲染与样式', () => {
  /**
   * 断言统一打在 `.loading-wrapper` 上：
   * @vue/test-utils 默认把内置 `Transition` stub 成 `<transition-stub>`，
   * 组件根节点并不是我们关心的那个 div。
   */
  function renderLoading(props: Record<string, unknown> = {}) {
    return mount(LoadingComponent, {
      props: { loading: true, ...props },
    }).find<HTMLElement>('.loading-wrapper');
  }

  it('loading 为 false 时保留节点但隐藏，为 true 时可见', () => {
    const hidden = mount(LoadingComponent, { props: { loading: false } });
    expect(hidden.find('.loading-wrapper').attributes('style')).toContain(
      'display: none',
    );

    const shown = renderLoading();
    expect(shown.exists()).toBe(true);
    expect(shown.classes()).toContain('loading-wrapper');
    expect(shown.attributes('style') ?? '').not.toContain('display: none');
  });

  it('tip 有值才渲染提示节点', () => {
    expect(renderLoading().find('.loading-tip').exists()).toBe(false);
    expect(renderLoading({ tip: '正在保存' }).text()).toContain('正在保存');
  });

  it('size 同时影响容器类名与内部 Spin 尺寸', () => {
    const large = renderLoading({ size: 'large' });
    expect(large.classes()).toContain('loading-large');
    expect(large.findComponent(Spin).props('size')).toBe('large');

    const small = renderLoading({ size: 'small' });
    expect(small.classes()).toContain('loading-small');
    expect(small.findComponent(Spin).props('size')).toBe('small');

    // 本包的 default 档对应 Spin 的 medium：传 'default' 会打 deprecation 警告
    expect(renderLoading().findComponent(Spin).props('size')).toBe('medium');
  });

  it('全屏模式用 fixed + 高不透明度背景，容器模式用 absolute + 低不透明度', () => {
    const fullscreen = renderLoading({ theme: 'dark' });
    expect(fullscreen.classes()).toContain('fixed');
    expect(fullscreen.classes()).toContain('bg-black/70');

    const container = renderLoading({ absolute: true, theme: 'dark' });
    expect(container.classes()).toContain('absolute');
    expect(container.classes()).toContain('bg-black/50');
    expect(container.classes()).not.toContain('h-screen');
  });

  it('background 优先于 theme：走行内样式，不再叠加主题背景类', () => {
    const overlay = renderLoading({
      background: 'rgba(0, 0, 0, 0.6)',
      theme: 'light',
    });
    expect(overlay.attributes('style')).toContain('background-color');
    expect(overlay.classes()).not.toContain('bg-white/80');
  });
});

describe('useLoading —— 命令式实例', () => {
  it('open() 同步插入 body，close() 等淡出动画结束后移除', () => {
    const loading = track(useLoading({ tip: '加载中' }));

    expect(overlayInBody()).toBeNull();

    loading.open();
    const el = overlayInBody();
    expect(el).not.toBeNull();
    expect(isInvisible(el)).toBe(false);
    expect(el?.textContent).toContain('加载中');

    loading.close();
    vi.advanceTimersByTime(LEAVE_DURATION - 1);
    expect(overlayInBody()).not.toBeNull();
    vi.advanceTimersByTime(2);
    expect(overlayInBody()).toBeNull();
  });

  it('REGRESSION：open / setTip / setLoading 都能改变已存在实例的视图', async () => {
    const loading = track(useLoading());

    loading.open();
    await nextTick();
    expect(isInvisible(overlayInBody())).toBe(false);

    loading.setTip('马上好');
    await nextTick();
    expect(overlayInBody()?.textContent).toContain('马上好');

    loading.setLoading(false);
    vi.advanceTimersByTime(LEAVE_DURATION + 1);
    expect(overlayInBody()).toBeNull();

    loading.setLoading(true);
    expect(overlayInBody()).not.toBeNull();
  });

  it('初始 loading 为 true 时创建即挂载', () => {
    track(useLoading({ loading: true, tip: '立刻' }));
    expect(overlayInBody()?.textContent).toContain('立刻');
  });

  it('淡出期间重开会取消移除计时，不会把正在显示的覆盖层删掉', () => {
    const loading = track(useLoading());
    loading.open();
    loading.close();
    loading.open();
    vi.advanceTimersByTime(LEAVE_DURATION + 1);
    expect(overlayInBody()).not.toBeNull();
  });

  it('destroy() 立即移除，不等淡出', () => {
    const loading = track(useLoading());
    loading.open();
    loading.destroy();
    expect(overlayInBody()).toBeNull();
  });

  it('容器模式：覆盖层挂进目标元素，并把 static 定位改成 relative', () => {
    const box = document.createElement('div');
    document.body.append(box);

    track(useLoading({ body: false, target: box })).open();

    const el = overlayIn(box);
    expect(el).not.toBeNull();
    expect(el?.className).toContain('absolute');
    expect(box.style.position).toBe('relative');
  });

  it('target 支持 CSS 选择器字符串', () => {
    const box = document.createElement('div');
    box.id = 'selector-target';
    document.body.append(box);

    track(useLoading({ body: false, target: '#selector-target' })).open();
    expect(overlayIn(box)).not.toBeNull();
  });

  it('target 支持 getter：延迟到真正显示时才解析，容器晚到也能补挂', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let resolved: HTMLElement | undefined;
    const loading = track(
      useLoading({ body: false, target: () => resolved, tip: '懒解析' }),
    );

    // 容器还没就绪：只警告，不抛异常，也不留 DOM
    loading.open();
    expect(warn).toHaveBeenCalled();
    expect(document.querySelector(WRAPPER_SELECTOR)).toBeNull();
    warn.mockRestore();

    const box = document.createElement('div');
    document.body.append(box);
    resolved = box;
    // 状态本就是 true，靠 setVisible 的重试挂载补上 DOM
    loading.open();
    expect(overlayIn(box)).not.toBeNull();
  });

  it('找不到容器时给出警告而不是抛异常', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    track(useLoading({ body: false, target: '#not-exist-anywhere' })).open();
    expect(warn).toHaveBeenCalled();
    expect(overlayInBody()).toBeNull();
    warn.mockRestore();
  });

  it('在组件内调用时，宿主卸载会自动清理覆盖层', async () => {
    let loading!: LoadingInstance;
    const Host = defineComponent({
      setup() {
        loading = useLoading({ tip: '组件级' });
        loading.open();
        return () => h('div');
      },
    });

    const wrapper = mount(Host);
    expect(overlayInBody()?.textContent).toContain('组件级');

    wrapper.unmount();
    await nextTick();
    expect(overlayInBody()).toBeNull();
    instances.push(loading);
  });
});

describe('createLoading —— 函数式快捷方法', () => {
  it('close() 触发 onClose，destroy() 不触发', () => {
    const onClose = vi.fn();
    const loading = track(createLoading({ onClose, tip: '提交中' }));

    loading.open();
    expect(onClose).not.toHaveBeenCalled();

    loading.close();
    expect(onClose).toHaveBeenCalledTimes(1);

    loading.destroy();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('主题与背景配置透传到覆盖层', () => {
    track(
      createLoading({ background: 'rgba(0, 0, 0, 0.6)', theme: 'dark' }),
    ).open();
    expect(overlayInBody()?.getAttribute('style')).toContain('background-color');
  });

  it('createFullscreenLoading 挂 body、带 tip 且为 fixed 定位', () => {
    track(createFullscreenLoading('全屏处理中')).open();
    expect(overlayInBody()?.textContent).toContain('全屏处理中');
    expect(overlayInBody()?.className).toContain('fixed');
  });

  it('REGRESSION：createContainerLoading 真的落在容器内而不是全屏', () => {
    const box = document.createElement('div');
    document.body.append(box);

    track(createContainerLoading(box, '容器里')).open();

    const el = overlayIn(box);
    expect(el).not.toBeNull();
    expect(el?.className).toContain('absolute');
    expect(el?.className).not.toContain('fixed');
  });
});

describe('v-loading 指令', () => {
  /** 用 render + withDirectives，省掉对运行时模板编译器的依赖 */
  function mountWithDirective(
    options: {
      arg?: string;
      attributes?: Record<string, string>;
      initial?: boolean;
      modifiers?: Record<string, boolean>;
    } = {},
  ) {
    const visible = ref(options.initial ?? false);
    const Host = defineComponent({
      setup: () => () =>
        withDirectives(
          h('div', { class: 'box', ...options.attributes }, '内容'),
          [[vLoading, visible.value, options.arg, options.modifiers ?? {}]],
        ),
    });
    const wrapper = mount(Host);
    wrappers.push(wrapper);
    return {
      box: wrapper.element as HTMLElement,
      setVisible: (value: boolean) => {
        visible.value = value;
      },
      wrapper,
    };
  }

  it('REGRESSION：初始 false、随后 true 也能显示', async () => {
    const { box, setVisible } = mountWithDirective({ initial: false });
    expect(overlayIn(box)).toBeNull();

    setVisible(true);
    await nextTick();
    expect(isInvisible(overlayIn(box))).toBe(false);
  });

  it('初始 true 时直接显示，置回 false 后延迟移除', async () => {
    const { box, setVisible } = mountWithDirective({ initial: true });
    expect(isInvisible(overlayIn(box))).toBe(false);

    setVisible(false);
    await nextTick();
    vi.advanceTimersByTime(LEAVE_DURATION + 1);
    expect(overlayIn(box)).toBeNull();
  });

  it('binding.arg 作为提示文本，loading-* 属性提供尺寸等配置', async () => {
    const { box, setVisible } = mountWithDirective({
      arg: '参数提示',
      attributes: {
        'loading-background': 'rgba(0,0,0,0.5)',
        'loading-size': 'large',
      },
    });
    setVisible(true);
    await nextTick();

    const el = overlayIn(box);
    expect(el?.className).toContain('loading-large');
    expect(el?.textContent).toContain('参数提示');
  });

  it('loading-tip 属性优先于默认空提示', async () => {
    const { box, setVisible } = mountWithDirective({
      attributes: { 'loading-tip': '属性提示' },
    });
    setVisible(true);
    await nextTick();
    expect(overlayIn(box)?.textContent).toContain('属性提示');
  });

  it('.fullscreen 修饰符挂到 body 并使用 fixed 定位', async () => {
    const { box, setVisible } = mountWithDirective({
      modifiers: { fullscreen: true },
    });
    setVisible(true);
    await nextTick();

    const el = overlayInBody();
    expect(el).not.toBeNull();
    expect(el?.className).toContain('fixed');
    expect(box.contains(el)).toBe(false);
  });

  it('宿主元素卸载时同步清理，不留僵尸节点', async () => {
    const { box, wrapper } = mountWithDirective({ initial: true });
    expect(overlayIn(box)).not.toBeNull();

    // 用例自己卸载，因此不登记到 afterEach 的 wrappers 里
    const index = wrappers.indexOf(wrapper);
    if (index !== -1) {
      wrappers.splice(index, 1);
    }
    wrapper.unmount();
    await nextTick();
    expect(overlayIn(box)).toBeNull();
  });
});
