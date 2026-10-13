/**
 * 示意图的调色板。
 *
 * 迁移前这份配色是从 `antdv-next` 的 `theme.useToken()` 里取的
 * （`colorPrimary / colorPrimaryHover / colorPrimaryBg / colorPrimaryBorder`）。
 * 那等于让一个纯表现层的 SVG 组件绑死组件库的运行时上下文：
 * 在 `@ant-design/cssinjs` 的 StyleProvider 之外调用直接抛错，
 * 而把主色换到 CSS 变量上又会让示意图与主题脱节。
 * 现在改成外部注入这四个值，包内只认颜色。
 */
export interface LayoutIconPalette {
  primary: string;
  primaryBorder: string;
  primaryBg: string;
  primaryHover: string;
}

/**
 * 默认色板：antd 亮色主题下 primary=#1677ff 派生出的那四个值。
 *
 * 只在调用方没传 `palette` 时兜底 —— 示意图宁可颜色略偏，也不该整块空白。
 */
export const DEFAULT_ICON_PALETTE: LayoutIconPalette = {
  primary: '#1677ff',
  primaryHover: '#4096ff',
  primaryBg: '#e6f4ff',
  primaryBorder: '#91caff',
};

/** 中性色直接写死（原本就是 gray/slate 系工具类，不走主色派生） */
const NEUTRAL = {
  slate300: '#cbd5e1',
  slate500: '#64748b',
  slate800: '#1e293b',
  white: '#ffffff',
};

/** 主色叠加：亮色下用主色 10%，深色下用主色 30% 才压得住深底 */
function primaryAlpha(color: string, alpha: number) {
  return `color-mix(in srgb, ${color} ${alpha}%, transparent)`;
}

export interface IconPaletteSet {
  /** 内容底色 */
  content: string;
  /** 图标线条：一级项 */
  line: string;
  /** 图标线条：次级项 */
  lineSoft: string;
  /** 外壳（顶栏 / 侧栏）底色 */
  panel: string;
  /** 外壳底色（次级栏，例如图标栏旁边的主栏） */
  panelSoft: string;
  /** 内容区块的高亮条 */
  stripe: string;
  /** 内容区块的次级条 */
  stripeSoft: string;
  /** 主内容面板底色 */
  surface: string;
}

/**
 * 一张示意图在「选中 / 未选中 × 浅色 / 深色」四种组合下的取色。
 *
 * 选中时外壳用主色铺满、线条转成白色半透明，未选中时外壳只是很淡的主色底 ——
 * 这套映射与迁移前的 `getColors()` 一致，只是把「深色时线条颜色」这类
 * 散在各处的三元表达式收成了一个函数，方便单测覆盖。
 */
export function resolveIconPalette(
  palette: LayoutIconPalette,
  options: { active?: boolean; dark?: boolean } = {},
): IconPaletteSet {
  const { active = false, dark = false } = options;
  const { primary, primaryBg, primaryBorder, primaryHover } = palette;

  if (active) {
    return {
      content: dark ? '#141414' : NEUTRAL.white,
      line: 'rgba(255,255,255,0.85)',
      lineSoft: 'rgba(255,255,255,0.4)',
      panel: primary,
      panelSoft: primaryHover,
      stripe: primary,
      stripeSoft: primaryBorder,
      surface: dark ? '#1f1f1f' : '#f8fafc',
    };
  }

  return {
    content: dark ? '#141414' : NEUTRAL.white,
    line: dark ? NEUTRAL.slate300 : primaryBorder,
    lineSoft: dark ? NEUTRAL.slate500 : primaryBg,
    panel: primaryAlpha(primary, dark ? 30 : 10),
    panelSoft: primaryAlpha(primaryHover, dark ? 24 : 8),
    stripe: dark ? NEUTRAL.slate300 : primaryBorder,
    stripeSoft: dark ? NEUTRAL.slate500 : primaryBg,
    surface: dark ? '#1f1f1f' : '#f8fafc',
  };
}

/** 兼容旧签名：`getColors(active, colors)` —— 深色参数走默认浅色 */
export function getIconColors(
  active: boolean | undefined,
  palette: LayoutIconPalette,
): IconPaletteSet {
  return resolveIconPalette(palette, { active: Boolean(active) });
}
