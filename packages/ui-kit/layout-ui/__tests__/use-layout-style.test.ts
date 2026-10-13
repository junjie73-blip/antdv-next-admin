import type { LayoutTone } from '../src/types';

import { describe, expect, it } from 'vitest';

import { useLayoutStyle } from '../src/useLayoutStyle';

/** 每个用例都从干净的一档开始，避免上一次的 tone 残留 */
function styleOf(tone: LayoutTone) {
  return useLayoutStyle(() => tone);
}

describe('useLayoutStyle - 区域骨架', () => {
  it('外壳是纵向全屏且不产生页面滚动', () => {
    const shell = styleOf({}).shellClass();
    expect(shell).toContain('flex h-screen flex-col');
    expect(shell).toContain('overflow-hidden');
  });

  it('图标栏 + 侧栏 + 内容列这一行是横向 flex 且允许收缩', () => {
    const row = styleOf({}).rowClass();
    expect(row).toContain('flex min-h-0 flex-1');
    expect(styleOf({}).columnClass()).toContain('min-w-0 flex-1 flex-col');
  });

  it('侧栏与图标栏都不参与内容区宽度计算（shrink-0）', () => {
    expect(styleOf({}).siderClass()).toContain('shrink-0');
    expect(styleOf({}).railClass()).toContain('shrink-0');
  });

  it('内容区留出 min-h-0，让内部 Scrollbar 拿得到真实高度', () => {
    expect(styleOf({}).contentClass()).toContain('min-h-0 flex-1');
  });
});

describe('useLayoutStyle - 配色优先级 geek > dark > light', () => {
  it('浅色档用白底深字', () => {
    const style = styleOf({});
    expect(style.headerClass()).toContain('bg-white');
    expect(style.siderClass()).toContain('bg-white');
    expect(style.shellClass()).toContain('bg-gray-50');
  });

  it('深色档用灰底白字', () => {
    const style = styleOf({ dark: true });
    expect(style.headerClass()).toContain('bg-gray-800');
    expect(style.siderClass()).toContain('bg-gray-900');
    expect(style.shellClass()).toContain('dark:bg-gray-900');
  });

  it('极客档固定深色 + 荧光绿，且不与 dark 叠加出别的颜色', () => {
    const style = styleOf({ dark: true, geek: true });
    expect(style.headerClass()).toContain('bg-[#0a0a0a]');
    expect(style.headerClass()).toContain('text-[#00ff88]');
    expect(style.shellClass()).toContain('bg-[#0a0a0a]');
    expect(style.exitButtonClass()).toContain('bg-[#00ff88]');
  });
});

describe('useLayoutStyle - 「深色侧栏 / 深色顶栏」偏好', () => {
  it('浅色模式下偏好深色侧栏，只把左那一列换成深色', () => {
    const style = styleOf({ sidebarDark: true });
    expect(style.sidebarDark()).toBe(true);
    expect(style.headerDark()).toBe(false);
    expect(style.siderClass()).toContain('bg-gray-900');
    expect(style.headerClass()).toContain('bg-white');
    expect(style.railClass()).toContain('bg-gray-900');
  });

  it('偏好深色顶栏只影响顶栏那一行的菜单配色，外壳底色仍随明暗', () => {
    const style = styleOf({ headerDark: true });
    expect(style.headerDark()).toBe(true);
    expect(style.sidebarDark()).toBe(false);
    expect(style.headerClass()).toContain('bg-white');
    expect(style.siderClass()).toContain('bg-white');
  });

  it('整体深色时两个偏好开关多余，左右两列与顶栏都深色', () => {
    const style = styleOf({ dark: true });
    expect(style.sidebarDark()).toBe(true);
    expect(style.headerDark()).toBe(true);
    expect(style.logoClass()).toContain('border-gray-800');
    expect(style.collapseBarClass()).toContain('border-gray-800');
    expect(style.overlayClass()).toContain('bg-gray-900');
  });
});

describe('useLayoutStyle - 细节档位', () => {
  it('图标栏选中项带主色淡底与加粗，未选中不带', () => {
    const style = styleOf({});
    expect(style.railItemClass(true)).toContain('bg-primary/12');
    expect(style.railItemClass(true)).toContain('font-semibold');
    expect(style.railItemClass(false)).not.toContain('bg-primary/12');
  });

  it('面包屑在顶栏里窄屏让位，独立成行时有高度与底边', () => {
    // 断言按 token 比对：`cn` 会合并相邻工具类，字符串顺序不是契约的一部分
    const tokens = (cls: string) => cls.split(' ');
    const header = tokens(styleOf({}).breadcrumbClass('header'));
    expect(header).toContain('hidden');
    expect(header).toContain('md:flex');

    const content = tokens(styleOf({}).breadcrumbClass('content'));
    expect(content).toContain('h-9');
    expect(content).toContain('bg-white');
  });

  it('默认按 header 档输出，调用方不传第二参数也不会报错', () => {
    expect(styleOf({}).breadcrumbClass()).toContain('md:flex');
  });
});
