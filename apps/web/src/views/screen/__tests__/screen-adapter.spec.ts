import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useScreenAdapter } from '../composables/useScreenAdapter';

/**
 * 大屏缩放器：量的是**内容区**，不是 `window`。
 *
 * 大屏是管理后台内容区里的一页，外面还有侧栏 / 标签页 / 面包屑 / 布局内边距。
 * 早先按 `window.innerWidth/innerHeight` 算 scale，1440 视口下缩完正好 1440 宽，
 * 可内容区实际只有约 1198 宽 —— 右侧「资源使用率 / 地区用户分布」整列被裁到视口外，
 * 还多出一条横向滚动条。更隐蔽的是第二半：折叠侧栏、标签页放大、切「内容全屏」
 * 都只改内容区尺寸、不动视口，只听 `window.resize` 就永远停在旧比例。
 *
 * 所以这里钉四条契约：
 * 1. scale 由容器宽度与外层滚动盒高度决定（用例把 `innerWidth` 故意设成 3840，
 *    按 window 算的实现会立刻对不上）；
 * 2. 观察的是外层滚动盒，它一变就重算 —— 这正是"折叠侧栏后不重算"的回归；
 * 3. 容器高度要写死，`transform: scale()` 不改布局占位，不写死就会被 1080 的
 *    布局盒子撑出滚动；
 * 4. 卸载后清干净：样式复位、观察器断开、迟到的回调不再写 DOM。
 */

class FakeObserver {
  cb: () => void;
  disconnected = false;
  targets: unknown[] = [];

  constructor(cb: () => void) {
    this.cb = cb;
    observers.push(this);
  }

  disconnect() {
    this.disconnected = true;
    this.targets = [];
  }
  observe(target: unknown) {
    this.targets.push(target);
  }
  takeRecords() {
    return [];
  }
  unobserve() {}
}

let observers: FakeObserver[] = [];
let wrap: HTMLElement;
let view: HTMLElement;
let container: HTMLElement;
let content: HTMLElement;

/**
 * jsdom 里所有盒子都是 0×0，尺寸只能逐个元素挂 getter 伪造。
 * 挂在自己的实例上而不是原型上，用例之间互不污染。
 */
function setSizes(size: {
  containerWidth?: number;
  padX?: number;
  padY?: number;
  wrapHeight?: number;
  wrapWidth?: number;
}) {
  const {
    containerWidth = 1198,
    padX = 16,
    padY = 16,
    wrapHeight = 752,
    wrapWidth = 1230,
  } = size;
  view.style.padding = `${padY}px ${padX}px`;
  Object.defineProperty(wrap, 'clientHeight', {
    configurable: true,
    get: () => wrapHeight,
  });
  Object.defineProperty(wrap, 'clientWidth', {
    configurable: true,
    get: () => wrapWidth,
  });
  Object.defineProperty(container, 'clientWidth', {
    configurable: true,
    get: () => containerWidth,
  });
}

/** jsdom 不解析 `transform`，浏览器会归一化成 `matrix(...)`，两边都认 */
function scaleOf() {
  const match =
    content.style.transform.match(/^matrix\(([\d.]+)/) ??
    content.style.transform.match(/^scale\(([\d.]+)\)$/);
  return match ? Number.parseFloat(match[1]) : Number.NaN;
}

const Host = defineComponent({
  setup() {
    useScreenAdapter();
    return () => h('div');
  },
});

function mountAdapter() {
  return mount(Host, { attachTo: document.body });
}

beforeEach(() => {
  observers = [];
  // 结构照搬真实页面：布局的滚动盒 + 滚动视图，里面才是大屏自己的容器
  document.body.innerHTML = `
    <div class="scrollbar__wrap">
      <div class="scrollbar__view">
        <div id="screen-container">
          <div id="screen-content"></div>
        </div>
      </div>
    </div>`;
  wrap = document.querySelector('.scrollbar__wrap') as HTMLElement;
  view = document.querySelector('.scrollbar__view') as HTMLElement;
  container = document.querySelector('#screen-container') as HTMLElement;
  content = document.querySelector('#screen-content') as HTMLElement;

  // 故意把视口撑到 4K：任何还在按 window 算的实现都会立刻露馅
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 3840,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: 2160,
  });
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    value: FakeObserver,
    writable: true,
  });
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useScreenAdapter', () => {
  it('按内容区而不是视口算缩放', () => {
    setSizes({});
    mountAdapter();

    // (752 - 16*2) / 1080 = 0.663 与 1198 / 1920 = 0.624 取小
    expect(scaleOf()).toBeCloseTo(1198 / 1920, 6);
    expect(content.style.width).toBe('1920px');
    expect(content.style.height).toBe('1080px');
    expect(container.style.height).toBe(`${752 - 32}px`);
  });

  it('缩放后不超出容器，并在容器里居中', () => {
    setSizes({});
    mountAdapter();

    const scale = 1198 / 1920;
    // 高度方向是短板时才会产生上下留白，这里宽度是短板 → 垂直居中
    expect(Number.parseFloat(content.style.marginTop)).toBeCloseTo(
      Math.max(0, (720 - 1080 * scale) / 2),
      6,
    );
    expect(Number.parseFloat(content.style.marginLeft)).toBeCloseTo(
      Math.max(0, (1198 - 1920 * scale) / 2),
      6,
    );
    expect(content.style.transformOrigin).toBe('left top');
  });

  it('侧栏折叠只改内容区尺寸，也要重算缩放', () => {
    // 给一个足够高的内容区，让"短板"落在宽度上，才能看出宽度变化带来的重算
    setSizes({ containerWidth: 1198, wrapHeight: 1400, wrapWidth: 1230 });
    mountAdapter();
    const before = scaleOf();

    // 折叠侧栏：视口一点没变，内容区从 1198 宽变成 1344 宽
    setSizes({ containerWidth: 1344, wrapHeight: 1400, wrapWidth: 1376 });
    observers[0].cb();

    expect(before).toBeCloseTo(1198 / 1920, 6);
    expect(scaleOf()).toBeCloseTo(1344 / 1920, 6);
  });

  it('观察的是外层滚动盒，不是只挂 window.resize', () => {
    setSizes({});
    mountAdapter();

    expect(observers).toHaveLength(1);
    expect(observers[0].targets).toEqual([wrap]);
  });

  it('首帧还没有尺寸时不写缩放，等下一次回调', () => {
    setSizes({ containerWidth: 0, wrapHeight: 0 });
    mountAdapter();

    expect(content.style.transform).toBe('');
    expect(container.style.height).toBe('');

    setSizes({ containerWidth: 1198, wrapHeight: 752 });
    observers[0].cb();
    expect(scaleOf()).toBeCloseTo(1198 / 1920, 6);
  });

  it('「内容全屏」没有内边距时，高度还给内容区', () => {
    setSizes({ padY: 0 });
    mountAdapter();

    expect(container.style.height).toBe('752px');
    expect(scaleOf()).toBeCloseTo(Math.min(1198 / 1920, 752 / 1080), 6);
  });

  it('卸载后复位样式并断开观察器', () => {
    setSizes({});
    const wrapper = mountAdapter();
    expect(content.style.transform).not.toBe('');

    wrapper.unmount();

    expect(observers[0].disconnected).toBe(true);
    expect(content.style.transform).toBe('');
    expect(content.style.width).toBe('');
    expect(content.style.marginLeft).toBe('');
    expect(container.style.height).toBe('');
    // 观察器已 disconnect，后续不会再有回调进来改样式
    expect(observers[0].targets).toEqual([]);
  });

  it('窗口尺寸变化仍然跟着重算（保底路径）', async () => {
    setSizes({});
    mountAdapter();

    setSizes({ containerWidth: 858, wrapHeight: 552, wrapWidth: 890 });
    window.dispatchEvent(new Event('resize'));
    await nextTick();

    expect(scaleOf()).toBeCloseTo(Math.min(858 / 1920, 520 / 1080), 6);
  });
});
