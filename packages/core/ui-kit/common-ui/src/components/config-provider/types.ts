import type { ConfigProviderProps } from 'reka-ui';

import type { InjectionKey } from 'vue';

/** 支持的界面语言。与 `@antdv/shared` 的偏好取值一致，只这两套内置词条。 */
export type LocaleKey = 'en-US' | 'zh-CN';

/** 阅读方向，直接透传给 reka-ui 的 ConfigProvider（`dir`） */
export type Direction = 'ltr' | 'rtl';

/**
 * 尺寸档位。
 *
 * `middle` 是 `@antdv/types` 的 `ComponentSize` 里存量的别名，收进来但**不落地**：
 * 解析时统一折成 `medium`，组件只见三档，避免"两处都能写、读侧要判四次"。
 */
export type ComponentSizeOption = 'large' | 'medium' | 'middle' | 'small';

/** 解析后的尺寸档位（`middle` 已折叠） */
export type ResolvedComponentSize = 'large' | 'medium' | 'small';

/**
 * 局部主题覆盖，写在 `ConfigProvider` 的那个元素上。
 *
 * 与偏好的分工：偏好是**全站唯一写侧**（`@antdv/preferences` 把值写在 `<html>`），
 * 这里是**子树覆盖**——只在这棵子树里改写规范名变量（`--primary`、`--radius`），
 * 不动 `<html>`，所以"某个抽屉里想要另一套主色"不会把整个应用换色。
 * 字段留空即"不覆盖"，不是"覆盖成默认值"。
 */
export interface GlobalTheme {
  /**
   * 明暗档位。`system` 跟随系统偏好；留空 = 沿用外层（最外层就是 `<html>` 上的档位）。
   * 落地方式是给容器加 `.dark` / `.light` class —— `@antdv/design` 的 token
   * 与 Tailwind 的 `dark:` 变体都按 `.dark` 祖先选择器写，所以加在任意祖先上都成立。
   */
  mode?: 'dark' | 'light' | 'system';
  /**
   * 预设主题名，落到 `data-theme`（取值见 `@antdv/shared/constants` 的 `theme-presets`）。
   * 留空 = 沿用外层档位；填 `'custom'` 时整套色板由 `primary` 决定。
   */
  preset?: string;
  /** 主色，写成 `--primary`。只有需要"这一块换个主色"时才用 */
  primary?: string;
  /**
   * 圆角。数值按 px 语义给出，落地一律换算成 rem（`8` → `0.5rem`，见
   * `@antdv/shared/utils` 的 `radiusToRem`），字符串原样写入。
   *
   * 注意与偏好不同：偏好的 `borderRadius` 存的是**倍率**（0–1，基准 16px），
   * 这里是绝对值——子树覆盖是给"这一块要更方/更圆"用的，倍率会让人以为在调全局刻度。
   */
  radius?: number | string;
}

/**
 * 全局系统配置：跨组件共用的默认值、文案、主题覆盖与 reka-ui 底座参数。
 *
 * 放进来的标准是"组件库自己能给默认值、但每个项目又想改"。
 * 全站主题色/字号仍以偏好为唯一写侧，这里只做子树覆盖，避免同一个配置两个写侧。
 */
export interface GlobalConfig {
  /** 内置取消按钮文案；不给则按 `locale` 取词条 */
  cancelText?: string;
  /** 组件默认尺寸档位，读侧是 `Loading` / `Segmented` / `Steps` 这些带 `size` 的组件 */
  componentSize?: ComponentSizeOption;
  /** 自定义样式变量，最后写入，优先级高于 `theme` 派生出的变量 */
  cssVars?: Record<string, number | string>;
  /** 阅读方向，透传给 reka-ui（弹层定位、日期排版都读它） */
  dir?: Direction;
  /** 空数据文案（`Empty` / `Transfer` 的默认描述） */
  emptyText?: string;
  /** 界面语言，决定内置词条，并透传给 reka-ui 供日期/数字格式化使用 */
  locale?: LocaleKey;
  /** CSP nonce，透传给 reka-ui（它注入样式时带上） */
  nonce?: string;
  okText?: string;
  /** 空值占位符（`Description` 的默认 `emptyText`） */
  placeholder?: string;
  /** 是否由弹层组件锁住 body 滚动，透传给 reka-ui */
  scrollBody?: boolean;
  /** 弹层挂载容器，透传给 reka-ui；局部主题要覆盖到弹层时指向同一个容器 */
  teleportTo?: ConfigProviderProps['teleportTo'];
  /** 主题覆盖，见 `GlobalTheme` */
  theme?: GlobalTheme;
  /** 自定义 id 生成器，透传给 reka-ui（SSR 水合一致性用） */
  useId?: ConfigProviderProps['useId'];
}

/**
 * 已解析的配置：可选项在这里都有确定值（除了"本来就可能没有"的底座参数），
 * 且 `theme` / `cssVars` 已经和外层合并过。
 */
export interface ResolvedGlobalConfig {
  cancelText: string;
  componentSize: ResolvedComponentSize;
  cssVars: Record<string, number | string>;
  dir: Direction;
  emptyText: string;
  locale: LocaleKey;
  nonce?: string;
  okText: string;
  placeholder: string;
  scrollBody?: boolean;
  teleportTo?: ConfigProviderProps['teleportTo'];
  theme: GlobalTheme;
  useId?: ConfigProviderProps['useId'];
}

/**
 * 注入键。
 *
 * `ConfigProvider` 嵌套时内层只覆盖自己声明的字段（见 `ConfigProvider.vue`），
 * 所以注入的值始终是"从外到内合并完"的完整配置，消费方不必自己做链式合并。
 * 类型为 `| null`：最外层 provider 需要区分"上面没有配置"与"上面配置成默认值"，
 * 前者才按 `locale` 展开词条。
 */
export const GLOBAL_CONFIG_KEY: InjectionKey<null | ResolvedGlobalConfig> =
  Symbol('antdv-global-config');

/** 未挂 `ConfigProvider` 时的兜底配置：中文、中等尺寸、不动主题 */
export const DEFAULT_GLOBAL_CONFIG: ResolvedGlobalConfig = {
  cancelText: '取消',
  componentSize: 'medium',
  cssVars: {},
  dir: 'ltr',
  emptyText: '暂无数据',
  locale: 'zh-CN',
  okText: '确定',
  placeholder: '-',
  theme: {},
};

/** 按语言取内置词条，`ConfigProvider` 用它把 `locale` 展开成文案 */
export function textsByLocale(locale: LocaleKey): {
  cancelText: string;
  emptyText: string;
  okText: string;
} {
  return locale === 'zh-CN'
    ? { cancelText: '取消', emptyText: '暂无数据', okText: '确定' }
    : { cancelText: 'Cancel', emptyText: 'No data', okText: 'OK' };
}

/** 把 `middle` 折成 `medium`，其余原样；读侧只判三档 */
export function normalizeComponentSize(
  size: ComponentSizeOption | undefined,
): ResolvedComponentSize {
  return size === 'large' || size === 'small' ? size : 'medium';
}
