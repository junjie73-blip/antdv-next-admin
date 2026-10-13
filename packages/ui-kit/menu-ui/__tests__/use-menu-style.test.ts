import type { MenuVisualOptions } from '../src';

import { describe, expect, it } from 'vitest';

import { useMenuStyle } from '../src/useMenuStyle';

/** 排版是纯函数：把 options 当输入传进去，不需要组件上下文 */
const styles = (options: MenuVisualOptions = {}) =>
  useMenuStyle(() => options);

describe('useMenuStyle —— 与迁移前 antd 排版的对齐口径', () => {
  it('行基线：40px 高、圆角 lg、上下 2px 间隙', () => {
    const cls = styles().rowClass({}, 'inline');
    expect(cls).toContain('h-10');
    expect(cls).toContain('rounded-lg');
    expect(cls).toContain('my-0.5');
  });

  it('选中：浅色 8% 淡底 + 主色文字 + 半粗', () => {
    const cls = styles().rowClass({ selected: true }, 'inline');
    expect(cls).toContain('bg-primary/8');
    expect(cls).toContain('text-primary');
    expect(cls).toContain('font-semibold');
  });

  it('选中：深色侧栏与极客主题把底色加深到 18%', () => {
    expect(
      styles({ theme: 'dark' }).rowClass({ selected: true }, 'inline'),
    ).toContain('bg-primary/18');
    expect(
      styles({ geek: true }).rowClass({ selected: true }, 'inline'),
    ).toContain('bg-primary/18');
  });

  it('极客主题的选中色固定为荧光绿，不跟主色走', () => {
    const cls = styles({ geek: true, theme: 'dark' }).rowClass(
      { selected: true },
      'inline',
    );
    expect(cls).toContain('text-[#00ff88]');
    expect(cls).not.toContain('text-primary');
  });

  it('hover：浅色叠主色 5%，深色叠白色 6%', () => {
    expect(styles().rowClass({}, 'inline')).toContain('hover:bg-primary/5');
    expect(styles({ theme: 'dark' }).rowClass({}, 'inline')).toContain(
      'hover:bg-white/6',
    );
  });

  it('禁用：不给 hover，光标与透明度换掉', () => {
    const cls = styles().rowClass({ disabled: true }, 'inline');
    expect(cls).toContain('cursor-not-allowed');
    expect(cls).toContain('opacity-60');
    expect(cls).not.toContain('hover:bg-primary/5');
    expect(cls).toContain('hover:bg-transparent');
  });

  it('横向栏：选中/命中都只换文字色，不铺底色（整条栏铺底会压过 Logo 区的层次）', () => {
    const selected = styles().rowClass({ selected: true }, 'bar');
    // 只认「整条类就是 bg-primary*」：hover:bg-primary/5 是悬停态，不算铺底
    expect(selected).not.toMatch(/(^|\s)bg-primary/u);
    expect(selected).toContain('text-primary');
    expect(selected).toContain('shrink-0');

    const branch = styles().rowClass({ inSelectedPath: true }, 'bar');
    expect(branch).toContain('text-primary');

    const geek = styles({ geek: true }).rowClass(
      { inSelectedPath: true },
      'bar',
    );
    expect(geek).toContain('text-[#00ff88]');
  });

  it('横向栏列表：内容宽（w-max 由宿主给），不换行、不压缩', () => {
    expect(styles().listClass('bar')).toContain('flex-nowrap');
    expect(styles().listClass('bar')).toContain('min-w-full');
  });

  it('浮层面板：走语义 token，暗色切换不用换类名', () => {
    const panel = styles().panelClass();
    expect(panel).toContain('bg-popover');
    expect(panel).toContain('text-popover-foreground');
    expect(styles({ geek: true }).panelClass()).toContain('bg-[#0d1117]');
  });

  it('选中竖条：3px 宽、22px 高、贴左边垂直居中', () => {
    const bar = styles().activeBarClass();
    expect(bar).toContain('w-[3px]');
    expect(bar).toContain('h-[22px]');
    expect(bar).toContain('left-0');
    expect(bar).toContain('-translate-y-1/2');
  });

  it('深色主题的正文色是浅灰，不是 token 前景色（旧侧栏就是这个观感）', () => {
    expect(styles({ theme: 'dark' }).rowClass({}, 'inline')).toContain(
      'text-slate-300',
    );
    expect(styles().rowClass({}, 'inline')).toContain('text-foreground');
  });
});
