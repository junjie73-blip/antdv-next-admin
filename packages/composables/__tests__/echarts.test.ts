import { nextTick } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import {
  analyticsCardClassName,
  KPI_COLOR_MAP,
  PALETTE,
  PALETTE_LIST,
  SCOPE_COLOR,
  SCOPE_LABEL,
  sectionTitleClassName,
  SEVERITY_COLOR,
  TIME_RANGE_OPTIONS,
} from '../src/echarts/constants';
import { setupEcharts } from '../src/echarts/setup';
import {
  axisLineColor,
  borderColor,
  echartsTheme,
  gradient,
  subTextColor,
  textColor,
  theme,
  tooltipBg,
} from '../src/echarts/theme';
import { useEcharts } from '../src/echarts/useEcharts';
import { withSetup } from './helpers/setup';

describe('echarts/theme 明暗取色', () => {
  it('每个取色函数都给明暗两套值', () => {
    expect(textColor(false)).toBe('#64748b');
    expect(textColor(true)).toBe('#cbd5e1');
    expect(subTextColor(false)).toBe('#9ca3af');
    expect(subTextColor(true)).toBe('#6b7280');
    expect(borderColor(false)).toBe('#e5e7eb');
    expect(borderColor(true)).toBe('#374151');
    expect(axisLineColor(false)).toBe('#e5e7eb');
    expect(axisLineColor(true)).toBe('#334155');
    expect(tooltipBg(false)).toBe('rgba(255,255,255,0.96)');
    expect(tooltipBg(true)).toBe('rgba(31,41,55,0.96)');
  });

  it('echartsTheme 只在暗色下返回内置主题名', () => {
    expect(echartsTheme(true)).toBe('dark');
    // 亮色必须返回 undefined：传 'light' 会去找一个没注册过的主题名
    expect(echartsTheme(false)).toBeUndefined();
  });

  it('gradient 生成 echarts 可用的渐变对象，方向由 vertical 决定', () => {
    const vertical = gradient(['#1677ff', '#52c41a']);
    expect(vertical.type).toBe('linear');
    expect(vertical.x).toBe(0);
    expect(vertical.y).toBe(0);
    expect(vertical.x2).toBe(0);
    expect(vertical.y2).toBe(1);
    expect(vertical.colorStops).toEqual([
      { offset: 0, color: '#1677ff' },
      { offset: 1, color: '#52c41a' },
    ]);

    const horizontal = gradient(['#1677ff', '#52c41a'], false);
    expect(horizontal.x2).toBe(1);
    expect(horizontal.y2).toBe(0);
  });

  it('theme 别名与函数指向同一实现', () => {
    expect(theme.text).toBe(textColor);
    expect(theme.gradient).toBe(gradient);
    expect(theme.echartsTheme).toBe(echartsTheme);
  });
});

describe('echarts/constants 设计令牌', () => {
  it('PALETTE_LIST 是 PALETTE 的子集，不引入新色值', () => {
    PALETTE_LIST.forEach((color) => {
      expect(Object.values(PALETTE)).toContain(color);
    });
    expect(PALETTE_LIST).toHaveLength(6);
  });

  it('变更范围的色值与文案一一对应', () => {
    expect(Object.keys(SCOPE_COLOR).sort()).toEqual(Object.keys(SCOPE_LABEL).sort());
    expect(SCOPE_LABEL.dept_tree).toBe('部门调整');
    expect(SEVERITY_COLOR.critical).toBe('#dc2626');
  });

  it('KPI 颜色映射的 beam 复用 PALETTE，wrap 是 Tailwind 类串', () => {
    Object.entries(KPI_COLOR_MAP).forEach(([name, entry]) => {
      expect(Object.values(PALETTE)).toContain(entry.beam);
      expect(entry.wrap).toContain('dark:');
      expect(entry.wrap).not.toContain('undefined');
      expect(name).toBeTruthy();
    });
  });

  it('时间范围选项 value 唯一', () => {
    const values = TIME_RANGE_OPTIONS.map((item) => item.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('类名走 cn 合并，不留多余空格', () => {
    expect(analyticsCardClassName).toContain('rounded-xl');
    expect(analyticsCardClassName).toContain('dark:border-slate-800');
    expect(sectionTitleClassName.trim()).toBe(sectionTitleClassName);
  });
});

describe('setupEcharts', () => {
  it('重复调用是幂等的（模块级 installed 门卫）', () => {
    expect(() => {
      setupEcharts();
      setupEcharts();
    }).not.toThrow();
  });
});

/**
 * happy-dom 没有布局引擎：任何元素的 clientWidth / clientHeight 都是 0，
 * 而 useEcharts 的 init 明确拒绝在零尺寸容器上建图（echarts 会画成 0×0）。
 * 所以这里验证的是「图表没建起来时 API 必须安全」，
 * 真实的渲染路径留给浏览器端的手工验证。
 */
describe('useEcharts 未就绪时的安全性', () => {
  it('容器零尺寸时不建图，setOption 排队而不是丢失', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result, unmount } = withSetup(() => useEcharts({ xAxis: {} }));

    const el = document.createElement('div');
    document.body.append(el);
    result.containerRef.value = el;
    await nextTick();

    expect(result.chart.value).toBeNull();
    expect(result.isReady.value).toBe(false);

    result.setOption({ series: [{ type: 'bar' }] });
    result.showLoading();
    result.hideLoading();
    result.resize();
    result.dispose();
    await nextTick();

    expect(result.chart.value).toBeNull();
    expect(spy).not.toHaveBeenCalledWith('[useEcharts] init failed', expect.anything());
    spy.mockRestore();
    unmount();
    el.remove();
  });

  it('容器还没绑定时同样不抛', async () => {
    const { result, unmount } = withSetup(() =>
      useEcharts(undefined, { autoResize: false, resizeStrategy: 'none' }),
    );
    result.setData({ series: [] } as never);
    await nextTick();
    expect(result.isReady.value).toBe(false);
    unmount();
  });
});
