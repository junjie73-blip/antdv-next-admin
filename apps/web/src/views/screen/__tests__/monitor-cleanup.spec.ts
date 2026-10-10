import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Monitor from '../monitor/index.vue';

/**
 * 大屏的"离开之后不留尾巴"契约。
 *
 * 大屏有 7 张 ECharts 图，容器在 `useScreenAdapter` 的 scale 变换与 Scrollbar 之下
 * 首帧可能是 0×0，于是页面走 `whenReady` 的异步分支：挂一个 ResizeObserver，再加一个
 * 3s 的兜底 setTimeout。这段异步分支过去**没有登记进卸载清理**，于是
 * "进大屏 → 几秒内走掉"会留下：
 * - 兜底回调在组件已卸载后仍然 `echarts.init()` 到一个脱离文档的节点上，
 *   而 `disposeAll()` 早已清空 map —— 这批实例再没人 dispose，
 *   每个都自带一条 zrender 的 rAF 动画循环，在别的页面上继续空转；
 * - ResizeObserver 仍在 observe 已卸载的元素。
 *
 * 表现不是报错，而是"离开大屏以后整机变慢"：实测 WebKit 里 `/screen/monitor` 之后
 * 紧接 `/system/user` 的第一次导航能从 1s 涨到 25s（e2e 等待预算直接被顶穿）。
 * 所以这里钉三件事：卸载后不再新建实例、建过的实例全部销毁、观察器全部断开。
 */

/**
 * 假 echarts 的记账处必须放进 `vi.hoisted`：本文件顶部静态 import 了大屏 SFC，
 * 它的 `import * as echarts` 在**模块求值阶段**就要拿到 mock，而那时文件里的
 * `const init = vi.fn()` 还没初始化 —— TDZ 会让整个 suite 挂在"mock 模块时报错"。
 */
const echartsStub = vi.hoisted(() => {
  const instances: Array<{
    dispose: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
    setOption: ReturnType<typeof vi.fn>;
  }> = [];
  const init = vi.fn(() => {
    const instance = {
      dispose: vi.fn(),
      resize: vi.fn(),
      setOption: vi.fn(),
    };
    instances.push(instance);
    return instance;
  });
  return { init, instances };
});

vi.mock('echarts', () => ({
  graphic: {
    // 页面用它做渐变填充，参数个数不定，这里只保证 `new` 得出来
    LinearGradient: class {
      constructor(..._args: unknown[]) {}
    },
  },
  init: echartsStub.init,
}));

vi.mock('~/api/screen', () => ({
  getScreenMonitorData: vi.fn(() =>
    Promise.resolve({
      alerts: [],
      overview: {
        alertCount: 0,
        cpuUsage: 40,
        diskUsage: 50,
        memUsage: 60,
        networkIn: 10,
        networkOut: 20,
        onlineUsers: 100,
        todayVisits: 1000,
        totalRequests: 10_000,
      },
      regions: [],
      services: [],
      trend: [],
    }),
  ),
}));

/** 记录每个观察器是否被断开；jsdom 那层假实现只会"能注册"，测不出清理 */
const observers: Array<{
  cb: (entries: any[]) => void;
  disconnected: boolean;
  observed: boolean;
}> = [];

class RecordingObserver {
  cb: (entries: any[]) => void;
  disconnected = false;
  observed = false;

  constructor(cb: (entries: any[]) => void) {
    this.cb = cb;
    observers.push(this);
  }

  disconnect() {
    this.disconnected = true;
    this.observed = false;
  }
  observe() {
    // 关键：不立刻回调整寸，模拟"容器迟迟没有尺寸"，把兜底 setTimeout 那条路走满
    this.observed = true;
  }
  takeRecords() {
    return [];
  }
  unobserve() {}
}

/**
 * 空壳组件：替掉带 rAF / 全屏 API 的装饰性子组件，聚焦本页的资源清理。
 *
 * 不能用 VTU 的 `true` 自动桩 —— 它会把父组件传下来的 props 原样写成 DOM 属性，
 * 于是 `<realtime-number-stub prefix=...>` 撞上 Element 的只读 `prefix`，
 * 每条用例刷一片 `Failed setting prop` 的假告警。空壳只渲染一个 div，不吃 props。
 *
 * `ScreenCard` 不能替：7 个图表容器 div 就写在它的默认插槽里，
 * 换成空壳后模板 ref 拿不到元素，`whenReady` 连观察器都不会挂，测试就失去对象了。
 */
const Blank = { name: 'Blank', template: '<div />' };

const STUBS = {
  MarqueeNotice: Blank,
  RealtimeNumber: Blank,
  ScreenHeader: Blank,
};

/**
 * 假定时器装上之后再挂载；也别用 `await import()` 动态取组件 ——
 * 模块运行器的文件 I/O 回调是宏任务，被 `vi.useFakeTimers()` 冻住后
 * 首条用例只会等到真实超时（实测白烧 5s 才想明白）。
 */
function mountMonitor() {
  return mount(Monitor as unknown as Parameters<typeof mount>[0], {
    global: { stubs: STUBS },
  });
}

/** 让观察器"终于看到尺寸"，模拟适配完成后图表照常建立 */
function giveSize() {
  for (const observer of observers) {
    observer.cb([{ contentRect: { height: 240, width: 320 } }]);
  }
}

function setOptionCalls() {
  return echartsStub.instances.reduce(
    (sum, instance) => sum + instance.setOption.mock.calls.length,
    0,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  observers.length = 0;
  echartsStub.instances.length = 0;
  echartsStub.init.mockClear();
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    value: RecordingObserver,
    writable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('大屏监控页的资源清理', () => {
  it('容器一直没有尺寸时，卸载后兜底定时器不得再创建图表实例', async () => {
    const wrapper = mountMonitor();
    await flushPromises();

    // 挂载阶段容器尺寸是 0（jsdom），所以此时一张图都还没建，全在"等尺寸"
    expect(echartsStub.init).not.toHaveBeenCalled();
    expect(observers.length).toBeGreaterThan(0);

    await wrapper.unmount();

    // 兜底窗口是 3s，跨过去就暴露"卸载后仍在建实例"的老问题
    vi.advanceTimersByTime(10_000);

    expect(echartsStub.init).not.toHaveBeenCalled();
    expect(echartsStub.instances).toHaveLength(0);
  });

  it('卸载要断开所有还在观察的观察器', async () => {
    const wrapper = mountMonitor();
    await flushPromises();
    await wrapper.unmount();

    expect(observers.length).toBeGreaterThan(0);
    expect(observers.filter((observer) => !observer.disconnected)).toEqual([]);
  });

  it('容器后来才有尺寸时照常建图，且每个实例都在卸载时被销毁', async () => {
    const wrapper = mountMonitor();
    await flushPromises();

    giveSize();
    await flushPromises();

    expect(echartsStub.init).toHaveBeenCalled();
    const created = echartsStub.instances.length;
    expect(created).toBeGreaterThan(0);

    await wrapper.unmount();

    expect(
      echartsStub.instances.every(
        (instance) => instance.dispose.mock.calls.length > 0,
      ),
    ).toBe(true);

    // 卸载之后再推进定时器，实例总数不该变（没有"复活"的漏网实例）
    vi.advanceTimersByTime(10_000);
    expect(echartsStub.instances).toHaveLength(created);
  });

  it('离开大屏后刷新数据的循环也停了', async () => {
    const wrapper = mountMonitor();
    await flushPromises();
    giveSize();
    await flushPromises();

    const before = setOptionCalls();
    expect(before).toBeGreaterThan(0);

    await wrapper.unmount();
    vi.advanceTimersByTime(30_000);

    expect(setOptionCalls()).toBe(before);
  });
});
