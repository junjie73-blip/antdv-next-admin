/**
 * Descriptions 的 24 栅格计算与响应式断点处理。
 *
 * 规则：
 * - 每行固定 24 col，每个 col 宽 = 100% / 24；
 * - 单个 item 基础占 `24 / column` col；带 `span` 时占 `基础 col × span`；
 * - `column` 为数字时所有断点一致；为对象时按断点从小到大「向下继承」；
 * - 项宽用百分比实现（等价于 24 栅格），换行交给 flex-wrap，故 24/column
 *   出现小数（如 column=5 → 4.8 col）时仍能精确排布，不需要整数取整。
 */

export type Breakpoint = 'lg' | 'md' | 'sm' | 'xl' | 'xs' | 'xxl';
export type ResponsiveColumn = number | Partial<Record<Breakpoint, number>>;

export const GRID_COLUMNS = 24;

/** 断点最小宽度（与 antd 一致）；xs 为基线断点，不生成 min-width 规则 */
export const BREAKPOINT_MIN: Record<Breakpoint, number> = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1600,
};

export const BREAKPOINTS: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];

function clampColumn(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(BREAKPOINT_MIN.xxl, Math.floor(value)));
}

/**
 * 把 column 归一化为每个断点的列数。
 * 对象写法按 xs→xxl 依次「向下继承」：未显式配置的断点沿用更小断点的列数。
 * xs 未配置时回落到 1（窄屏每项独占一行，最稳的边界行为）。
 */
export function normalizeColumns(
  column: ResponsiveColumn | undefined,
): Record<Breakpoint, number> {
  if (column === undefined) return normalizeColumns(3);
  if (typeof column === 'number') {
    const value = clampColumn(column, 3);
    return BREAKPOINTS.reduce(
      (acc, bp) => ({ ...acc, [bp]: value }),
      {} as Record<Breakpoint, number>,
    );
  }

  const source = column ?? {};
  const result = {} as Record<Breakpoint, number>;
  let inherited = 1;
  for (const bp of BREAKPOINTS) {
    inherited = clampColumn(source[bp], inherited);
    result[bp] = inherited;
  }
  return result;
}

/** 每 item 占的 col 数（未乘 span）：24 / column */
export function colsPerItem(columns: number): number {
  return GRID_COLUMNS / clampColumn(columns, 3);
}

/**
 * 生成响应式 CSS：用 CSS 变量按断点切换「每 item 占的 col 数」，
 * 避免运行时监听 resize（SSR 友好、断点与 antd 一致）。
 *
 * - `--desc-cols`：当前断点下每 item 占几 col（可为小数）；
 * - `--desc-span`：单个 item 的跨列倍数，由 item 内联设置；
 * - item 宽度 = min(每 col 宽 × cols × span, 100%)，span 超出当前列数时自动占满整行；
 * - label 宽度默认 min(84px, 40%)：上限 84px，但在多列窄容器里最多占 item 的 40%，
 *   保证 content 至少留 60%；xs 窄屏收窄到 min(76px, 45%)。显式 labelWidth 由内联 style 覆盖。
 */
export function buildResponsiveCss(
  scope: string,
  column: ResponsiveColumn | undefined,
): string {
  const resolved = normalizeColumns(column);
  const widthExpr =
    'min(calc(100% / 24 * var(--desc-cols) * var(--desc-span, 1)), 100%)';
  const rules: string[] = [
    `${scope} { --desc-cols: ${colsPerItem(resolved.xs)}; --desc-label-width: min(84px, 40%); }`,
    `${scope} [data-common-descriptions-item] { flex: 0 0 ${widthExpr}; max-width: ${widthExpr}; box-sizing: border-box; min-width: 0; }`,
  ];

  for (const bp of BREAKPOINTS.slice(1)) {
    rules.push(
      `@media (min-width: ${BREAKPOINT_MIN[bp]}px) { ${scope} { --desc-cols: ${colsPerItem(resolved[bp])}; } }`,
    );
  }
  // 窄屏 label 收窄，给 content 让出空间；显式 labelWidth 由内联 style 覆盖（优先级更高）
  rules.push(
    `@media (max-width: ${BREAKPOINT_MIN.sm - 1}px) { ${scope} { --desc-label-width: min(76px, 45%); } }`,
  );

  return rules.join('\n');
}
