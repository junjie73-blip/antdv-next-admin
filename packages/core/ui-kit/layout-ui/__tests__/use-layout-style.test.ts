import type { LayoutTone } from '../src/layout';

import { describe, expect, it } from 'vitest';

import { useLayoutStyle } from '../src/hooks/use-layout';

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
  /**
   * 外壳与内容区的底色在明暗两档是**同一个类名**（`bg-muted`）：颜色由 token 自己翻，
   * 所以这里钉的是"没有再挂 `dark:` 变体、也没有写死灰阶"。
   * 顶栏与侧栏仍然按明暗给两套类名，因为「深色顶栏 / 深色侧栏」是独立偏好开关，
   * 那两列不能跟着整体明暗走。
   */
  it('浅色档：顶栏白底深字，画布走 muted token', () => {
    const style = styleOf({});
    expect(style.headerClass()).toContain('bg-white');
    expect(style.siderClass()).toContain('bg-white');
    expect(style.shellClass()).toContain('bg-muted');
    expect(style.contentClass()).toContain('bg-muted');
    expect(style.shellClass()).not.toContain('dark:');
  });

  it('深色档：顶栏与侧栏换成深灰类名，画布仍是同一个 token 类', () => {
    const style = styleOf({ dark: true });
    expect(style.headerClass()).toContain('bg-gray-800');
    expect(style.siderClass()).toContain('bg-gray-900');
    expect(style.shellClass()).toContain('bg-muted');
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

  /**
   * 「顶栏反转色」的生效判据是顶栏那一行整条换深色：底色、文字、下边框、
   * 里面的图标按钮四样一起走，判据是 `headerDark()` 而不是 `isDark()`。
   * 侧栏与外壳不吃这个开关（那是「深色侧栏」与明暗模式的事）。
   */
  it('偏好深色顶栏只把顶栏整条换成深色，侧栏与外壳仍随明暗', () => {
    const style = styleOf({ headerDark: true });
    expect(style.headerDark()).toBe(true);
    expect(style.sidebarDark()).toBe(false);
    expect(style.headerClass()).toContain('bg-gray-800');
    expect(style.headerClass()).toContain('text-white');
    expect(style.headerClass()).toContain('border-gray-700');
    expect(style.triggerClass()).toContain('text-gray-300');
    expect(style.siderClass()).toContain('bg-white');
    // 外壳画布走 token，不跟着"深色顶栏"开关变深（token 类名恒定，所以反证不吃深灰类）
    expect(style.shellClass()).toContain('bg-muted');
    expect(style.shellClass()).not.toMatch(/gray-(7|8|9)00/);
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

  it('侧栏拖拽条是一根细竖条，覆盖在右边框上且给出横向游标', () => {
    const cls = styleOf({}).dragHandleClass();
    expect(cls).toContain('cursor-col-resize');
    expect(cls).toContain('w-1');
    expect(cls).toContain('inset-y-0');
  });

  it('深浅色与极客档下折叠条都带边界线与 hover 反馈', () => {
    expect(styleOf({}).collapseBarClass()).toContain('border-gray-100');
    expect(styleOf({ dark: true }).collapseBarClass()).toContain(
      'border-gray-800',
    );
    expect(styleOf({ geek: true }).collapseBarClass()).toContain(
      'border-gray-800',
    );
  });
});

/**
 * 窄屏档。
 *
 * `md` 就是本包的窄屏判据 `MOBILE_BREAKPOINT`（768px），两档在同一个宽度上切换，
 * 不会出现"已经按手机分流渲染、内边距还是桌面那 24px"的错位。
 */
describe('useLayoutStyle - 窄屏档', () => {
  it('顶栏左右内边距收到 12px，桌面档逐像素不变', () => {
    const cls = styleOf({}).headerClass();
    expect(cls).toContain('px-3');
    expect(cls).toContain('md:px-6');
  });

  it('侧栏触发按钮在窄屏给一层淡底，让它看起来能点', () => {
    const cls = styleOf({}).triggerClass();
    expect(cls).toContain('max-md:bg-black/6');
    // 常驻那一列的底部折叠条不受影响（它只在桌面档出现）
    expect(styleOf({}).collapseBarClass()).not.toContain('max-md:');
  });
});
