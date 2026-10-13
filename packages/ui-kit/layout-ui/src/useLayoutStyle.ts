import type { BreadcrumbVariant, LayoutTone } from './types';

import { computed } from 'vue';

import { cn } from '@antdv/shared/cn';

/**
 * 外壳各区域的类名计算。
 *
 * 迁移前这些三元表达式散在六个组件里：同一个"深色"在顶栏是 `bg-gray-800`、
 * 在侧栏是 `bg-gray-900`、在图标栏还要多带两个 `dark:` 变体，改一处就要全找一遍。
 * 收成一个纯函数后，包内可以单测配色分支，应用只需要交出三个布尔开关。
 *
 * 优先级固定为 `geek > dark > light`：极客风格是"深色 + 荧光绿"的定制主题，
 * 不随明暗模式回摆（与标签栏 `TabsBar` 的处理一致）。
 */
export interface LayoutStyleApi {
  breadcrumbClass: (variant?: BreadcrumbVariant) => string;
  collapseBarClass: () => string;
  columnClass: () => string;
  contentClass: () => string;
  exitButtonClass: () => string;
  footerClass: () => string;
  headerClass: () => string;
  logoClass: () => string;
  overlayClass: () => string;
  railClass: () => string;
  railItemClass: (active?: boolean) => string;
  rowClass: () => string;
  shellClass: () => string;
  siderClass: () => string;
  /** 左那一列（侧栏 / 图标栏）到底走不走深色：偏好「深色侧栏」或整体深色都算 */
  sidebarDark: () => boolean;
  /** 顶栏那一行走不走深色：偏好「深色顶栏」或整体深色都算 */
  headerDark: () => boolean;
  triggerClass: () => string;
}

/** 图标栏选中项：主色淡底 + 主色文字，与侧栏选中态同一套语言 */
const RAIL_ACTIVE_CLASS =
  'bg-primary/12 text-primary hover:text-primary font-semibold';

const RAIL_ITEM_BASE = [
  'relative flex w-full items-center justify-center gap-1.5',
  'mx-2 rounded-lg py-2.5 transition-colors duration-200',
];

export function useLayoutStyle(options: () => LayoutTone): LayoutStyleApi {
  const tone = computed<Required<LayoutTone>>(() => {
    const {
      dark = false,
      geek = false,
      headerDark = false,
      sidebarDark = false,
    } = options() ?? {};
    return { dark, geek, headerDark, sidebarDark };
  });

  /** 整体深色：geek 恒深色 */
  const isDark = () => tone.value.dark || tone.value.geek;
  const sidebarDark = () => isDark() || tone.value.sidebarDark;
  const headerDark = () => isDark() || tone.value.headerDark;

  /**
   * 外壳根节点。
   *
   * `gap-4` 是七种形态共用的"区域之间留白"，`overflow-hidden` 保证内部
   * 任何一列溢出都不会把整页撑出滚动条（内容区自己有 Scrollbar）。
   */
  const shellClass = () =>
    cn(
      'flex h-screen flex-col gap-4 overflow-hidden',
      tone.value.geek ? 'bg-[#0a0a0a]' : 'bg-gray-50 dark:bg-gray-900',
    );

  /** 「图标栏 + 侧栏 + 内容列」这一整行必须是横向 flex */
  const rowClass = () => 'flex min-h-0 flex-1 overflow-hidden';

  /** 主内容列（顶栏 / 面包屑 / 标签页 / 内容 / 底栏 纵向排） */
  const columnClass = () => 'flex min-w-0 flex-1 flex-col overflow-hidden';

  /**
   * 顶栏。
   *
   * `min-w-0` 是关键：列向 flex 里的 flex item 默认 `min-width: auto`，
   * 会被横向导航的 min-content 撑到比视口还宽 —— 表现是窄屏下右侧按钮被裁掉、
   * 横向菜单既不收缩也不滚动。
   * 高度不在这里写：由 `LAYOUT_HEADER_ROW_STYLE` 以 inline style 给出，
   * 侧栏 Logo / 图标栏 Logo 同源取值（见 @antdv/layouts 的注释）。
   */
  const headerClass = () =>
    cn(
      'flex min-w-0 items-center justify-between px-6',
      'shrink-0 border-b shadow-sm',
      tone.value.geek
        ? 'border-[#1a1a1a] bg-[#0a0a0a] text-[#00ff88]'
        : isDark()
          ? 'border-gray-700 bg-gray-800 text-white'
          : 'border-gray-200 bg-white text-gray-800',
    );

  /** 顶栏里的图标按钮（侧栏触发） */
  const triggerClass = () =>
    cn(
      'flex size-8 shrink-0 items-center justify-center rounded-lg',
      'transition-colors duration-200',
      tone.value.geek
        ? 'text-[#00ff88] hover:bg-[#00ff88]/10'
        : isDark()
          ? 'text-gray-300 hover:bg-gray-700'
          : 'text-gray-500 hover:bg-gray-100',
    );

  /** 常驻侧栏 */
  const siderClass = () =>
    cn(
      'relative flex h-full shrink-0 flex-col border-e transition-[width] duration-200',
      sidebarDark()
        ? 'border-gray-800 bg-gray-900'
        : 'border-gray-100 bg-white',
    );

  /** Logo 那一格：分隔线跟随所在列的配色 */
  const logoClass = () =>
    cn(
      'flex shrink-0 items-center justify-center overflow-hidden border-b whitespace-nowrap transition-all duration-300',
      sidebarDark() ? 'border-gray-800' : 'border-gray-100',
    );

  /** 底部折叠条：hover 反馈与菜单项用同一档强度 */
  const collapseBarClass = () =>
    cn(
      'flex h-10 shrink-0 cursor-pointer items-center justify-center border-t',
      'transition-colors duration-200',
      sidebarDark()
        ? 'border-gray-800 text-gray-400 hover:bg-white/6 hover:text-gray-200'
        : 'border-gray-100 text-gray-500 hover:bg-gray-100 hover:text-gray-700',
    );

  /** 图标栏（双列形态的第一列） */
  const railClass = () =>
    cn(
      'flex h-full shrink-0 flex-col border-e transition-[width] duration-200',
      sidebarDark()
        ? 'border-gray-800 bg-gray-900'
        : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900',
    );

  const railItemClass = (active = false) =>
    cn(
      ...RAIL_ITEM_BASE,
      sidebarDark()
        ? 'text-slate-300 hover:bg-white/6 hover:text-white'
        : 'text-slate-500 hover:bg-black/5 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-white/6 dark:hover:text-white',
      active && RAIL_ACTIVE_CLASS,
    );

  /**
   * 面包屑。
   *
   * `header`：住在顶栏里，窄屏先让位给 Logo 与工具区（`hidden md:flex`）；
   * `content`：独立成行，补上顶栏底色，与标签栏连成同一块外壳。
   */
  const breadcrumbClass = (variant: BreadcrumbVariant = 'header') =>
    cn(
      'min-w-0 text-sm',
      variant === 'header'
        ? 'hidden items-center md:flex'
        : 'flex h-9 shrink-0 items-center bg-white px-4 dark:bg-gray-800',
    );

  const footerClass =
    () =>
    cn(
      'flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t px-4 py-3 text-xs',
      'border-slate-100 text-slate-400 dark:border-slate-800 dark:text-slate-500',
    );

  /**
   * 内容区自己不滚动：滚动交给封装的 <Scrollbar>，这里只做"列向 flex + 允许收缩"，
   * 让 Scrollbar 的 flex-1 拿得到真实高度。内边距也挂在 Scrollbar 的 view 上 ——
   * 挂在滚动元素上会把滚动条挤到 padding 外侧，底部留白还会被算进滚动高度。
   */
  const contentClass = () =>
    cn(
      'box-border relative flex min-h-0 flex-1 flex-col',
      tone.value.geek ? 'bg-[#0a0a0a]' : 'bg-gray-50 dark:bg-gray-900',
    );

  /** 浮层侧栏的面板：定位与遮罩由 LayoutOverlay 负责，这里只给底色 */
  const overlayClass = () =>
    cn(
      'fixed inset-y-0 left-0 z-50 flex flex-col shadow-xl',
      sidebarDark() ? 'bg-gray-900' : 'bg-white',
    );

  /** 「隐藏外壳」时唯一的退出入口，悬浮在右下角 */
  const exitButtonClass = () =>
    cn(
      'fixed right-6 bottom-6 z-50 flex items-center gap-1.5 rounded-full px-4 py-2',
      'text-sm shadow-lg transition-opacity hover:opacity-90',
      tone.value.geek
        ? 'bg-[#00ff88] text-[#0a0a0a]'
        : 'bg-primary text-white shadow-gray-300/40 dark:shadow-black/40',
    );

  return {
    breadcrumbClass,
    collapseBarClass,
    columnClass,
    contentClass,
    exitButtonClass,
    footerClass,
    headerClass,
    headerDark,
    logoClass,
    overlayClass,
    railClass,
    railItemClass,
    rowClass,
    shellClass,
    siderClass,
    sidebarDark,
    triggerClass,
  };
}
