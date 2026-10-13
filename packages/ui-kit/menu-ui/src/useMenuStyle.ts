import type { MenuMode, MenuVisualOptions } from './types';

import { cn } from '@antdv/shared/cn';

/** 一类行的归属：侧栏内联 / 顶部横向条 / 浮层面板 */
export type MenuVariant = 'bar' | 'inline' | 'popup';

export interface MenuRowState {
  /** 目录且当前展开（内联态用得上：箭头要转向） */
  expanded?: boolean;
  disabled?: boolean;
  /** 叶子且命中 selectedKeys */
  selected?: boolean;
  /** 目录的子树里命中了选中项（等价 antd 的 submenu-selected） */
  inSelectedPath?: boolean;
}

export interface MenuStyleApi {
  /**
   * 行排版。
   *
   * 折叠态不在这里处理：折叠时侧栏只画图标，文字与箭头由 `MenuLabel` 的
   * `collapsed` 分支决定，样式层只负责「这一行看起来是什么样」。
   */
  rowClass: (state: MenuRowState, variant: MenuVariant) => string;
  listClass: (variant: MenuVariant) => string;
  /** 浮层面板（折叠侧栏的子菜单、横向栏的下拉子菜单共用） */
  panelClass: () => string;
  /** 右侧展开箭头 */
  arrowClass: (variant: MenuVariant) => string;
  /** 选中项左侧的主色竖条 */
  activeBarClass: () => string;
}

/**
 * 菜单排版。
 *
 * 迁移前这些规则散在 `LayoutSidebar.vue` / `HeaderMenu.vue` 的 50 多条
 * `[&_.ant-menu-*]` 任意变体里，靠覆盖 antd 内部类生效；自绘之后同类选择器
 * 一条都不需要了，但**视觉口径必须逐条对上**，否则用户看到的侧栏就"变了"：
 * - 行高 40px、圆角 lg、上下 2px 间隙（`my-0.5`）
 * - 选中：主色 8% 淡底 + 主色文字 + 左侧 3px 圆角竖条（带一点主色辉光）
 * - hover：浅色叠主色 5%，深色叠白色 6%
 * - 深色侧栏 / 极客主题下选中底色加深到 18%
 *
 * 颜色一律走语义 token（`bg-primary/8`、`bg-popover`），不写 `var(--ant-*)`：
 * 这样浮层 portal 到 body 时照样取到值，明暗切换也不用重算。
 */
export function useMenuStyle(
  options: () => MenuVisualOptions & { mode?: MenuMode },
): MenuStyleApi {
  const resolve = (): Required<Pick<MenuVisualOptions, 'collapsed' | 'geek' | 'theme'>> & {
    mode: MenuMode;
  } => {
    const value = options();
    return {
      collapsed: value.collapsed ?? false,
      geek: value.geek ?? false,
      mode: value.mode ?? 'inline',
      theme: value.theme ?? 'light',
    };
  };

  const isDarkTheme = () => resolve().theme === 'dark';
  const isGeek = () => resolve().geek;

  /** 正文色：极客主题在深色底上偏青，普通深色侧栏用浅灰，浅色用 token 前景色 */
  const textClass = () => {
    if (isGeek()) return 'text-slate-200';
    return isDarkTheme() ? 'text-slate-300' : 'text-foreground';
  };

  const hoverClass = () => {
    if (isDarkTheme() || isGeek()) return 'hover:bg-white/6';
    return 'hover:bg-primary/5';
  };

  /**
   * 选中态。
   *
   * `font-semibold` 会让文字变宽，但行是 flex + 截断，标题省略号跟着重排，
   * 不会出现"选中时文字抖动换行"；迁移前 antd 也是同一处理。
   */
  const selectedClass = () => {
    const deep = isDarkTheme() || isGeek();
    return cn(
      'font-semibold',
      deep ? 'bg-primary/18' : 'bg-primary/8',
      isGeek()
        ? 'text-[#00ff88]'
        : 'text-primary',
    );
  };

  return {
    rowClass(state, variant) {
      const active = Boolean(state.selected);
      // 横向栏只区分「命中」与「未命中」，不叠底色：整条栏一列底色会盖住 Logo 区的层次
      const barActive = variant === 'bar' && (active || state.inSelectedPath);

      return cn(
        'group/menu-row relative flex w-full cursor-pointer select-none items-center gap-2',
        'rounded-lg pr-3 text-sm outline-none transition-colors duration-200',
        variant === 'bar' ? 'h-10 shrink-0' : 'my-0.5 h-10',
        textClass(),
        !state.disabled && hoverClass(),
        state.disabled &&
          'cursor-not-allowed text-slate-400 opacity-60 hover:bg-transparent dark:text-slate-500',
        variant !== 'bar' && active && selectedClass(),
        barActive && (isGeek() ? 'text-[#00ff88]' : 'text-primary'),
        // 键盘可达性：焦点环用主色，避免深色侧栏上看不见
        'focus-visible:ring-2 focus-visible:ring-ring/60',
      );
    },

    listClass(variant) {
      if (variant === 'bar') {
        return 'flex min-w-full flex-nowrap items-center gap-1';
      }
      return cn(
        'm-0 list-none p-0',
        variant === 'popup' ? 'flex min-w-[160px] flex-col' : 'flex w-full flex-col',
      );
    },

    panelClass() {
      return cn(
        'z-50 rounded-xl border p-1 shadow-md',
        isGeek()
          ? 'border-[#1f3b2f] bg-[#0d1117] text-slate-200'
          : 'bg-popover text-popover-foreground',
      );
    },

    arrowClass(variant) {
      return cn(
        'ml-auto shrink-0 text-xs opacity-70 transition-transform duration-200',
        variant === 'bar' ? 'text-current' : 'text-muted-foreground',
      );
    },

    activeBarClass() {
      return cn(
        'pointer-events-none absolute left-0 top-1/2 h-[22px] w-[3px] -translate-y-1/2 rounded-r-[3px]',
        'bg-primary',
        isGeek() && 'bg-[#00ff88]',
        'shadow-[0_0_6px_color-mix(in_srgb,var(--app-primary)_60%,transparent)]',
      );
    },
  };
}
