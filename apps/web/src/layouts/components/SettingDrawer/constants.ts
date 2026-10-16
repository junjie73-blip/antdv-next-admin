import { THEME_PRESETS } from '@antdv/shared/constants';
import { cn } from '@antdv/shared/utils/cn';
import i18n from '~/locales';

/** `@antdv/common-ui` Segmented 的选项形状（icon 是图标名，不是 VNode） */
interface SegmentedOption {
  disabled?: boolean;
  icon?: string;
  label: string;
  value: number | string;
}

/**
 * Segmented 选项：label 用 getter 现取现翻。
 * 模块级常量在文件求值时就把字符串固化了，切语言后抽屉的分组名还是中文；
 * 改成 getter 后，是"渲染选项的那个组件"读 label，locale 就成了它渲染依赖的一部分。
 */
function segmentedOption(
  value: string,
  labelKey: string,
  iconName: string,
): SegmentedOption {
  return {
    get label() {
      return i18n.global.t(labelKey);
    },
    icon: iconName,
    value,
  };
}

/* ============================================================
 * 分类 Segmented
 * ============================================================ */
export type SettingSection = 'appearance' | 'common' | 'layout';

export const SECTION_OPTIONS: SegmentedOption[] = [
  segmentedOption(
    'appearance',
    'preferences.appearance',
    'carbon:color-palette',
  ),
  segmentedOption('layout', 'preferences.layout', 'carbon:grid'),
  segmentedOption('common', 'preferences.common', 'carbon:settings-adjust'),
];

/* ============================================================
 * 圆角倍率
 * ============================================================ */
export const BORDER_RADIUS_OPTIONS = [
  { value: 0, label: '0' },
  { value: 0.25, label: '0.25' },
  { value: 0.5, label: '0.5' },
  { value: 0.75, label: '0.75' },
  { value: 1, label: '1' },
];

/* ============================================================
 * 主题色
 * ============================================================ */

/**
 * 色块名单来自 `@antdv/shared` 的 `THEME_PRESETS`（预设色板的单一来源），
 * 这里只补中文名；key 对不上时退回显示 key 本身，避免出现"点了没名字"的空块。
 */
const THEME_LABELS: Record<string, string> = {
  default: '默认',
  violet: '紫罗兰',
  pink: '樱花粉',
  yellow: '柠檬黄',
  'sky-blue': '天蓝色',
  green: '浅绿色',
  zinc: '锌色灰',
  'deep-green': '深绿色',
  'deep-blue': '深蓝色',
  orange: '橙黄色',
  rose: '玫瑰红',
  neutral: '中性色',
  slate: '石板灰',
  gray: '中灰色',
};

export const PRIMARY_COLORS = THEME_PRESETS.map((preset) => ({
  key: preset.key,
  value: preset.color,
  get label() {
    return THEME_LABELS[preset.key] ?? preset.key;
  },
}));

/* ============================================================
 * 页面切换动画
 * ============================================================ */
export const TRANSITION_OPTIONS = [
  { value: 'fade', label: '淡入淡出' },
  { value: 'slide', label: '滑动' },
  { value: 'slide-right', label: '向右滑入' },
  { value: 'slide-left', label: '向左滑入' },
  { value: 'slide-up', label: '向上滑入' },
  { value: 'slide-down', label: '向下滑入' },
  { value: 'zoom', label: '缩放' },
  { value: 'fade-slide', label: '淡入滑动' },
  { value: 'scale', label: '缩放淡入' },
  { value: 'flip', label: '翻转' },
];

/* ============================================================
 * 通知位置
 * ============================================================ */
export const NOTIFICATION_POSITION_OPTIONS = [
  { value: 'topLeft', label: '左上' },
  { value: 'topRight', label: '右上' },
  { value: 'bottomLeft', label: '左下' },
  { value: 'bottomRight', label: '右下' },
];

/* ============================================================
 * 时区
 * ============================================================ */
export const TIMEZONE_OPTIONS = [
  {
    value: 'Asia/Shanghai',
    label: '中国标准时间 (UTC+8)',
    offset: 'UTC+8',
    city: '上海',
  },
  {
    value: 'Asia/Tokyo',
    label: '日本标准时间 (UTC+9)',
    offset: 'UTC+9',
    city: '东京',
  },
  {
    value: 'Asia/Singapore',
    label: '新加坡时间 (UTC+8)',
    offset: 'UTC+8',
    city: '新加坡',
  },
  {
    value: 'Europe/London',
    label: '伦敦时间 (UTC+0)',
    offset: 'UTC+0',
    city: '伦敦',
  },
  {
    value: 'Europe/Paris',
    label: '巴黎时间 (UTC+1)',
    offset: 'UTC+1',
    city: '巴黎',
  },
  {
    value: 'America/New_York',
    label: '纽约时间 (UTC-5)',
    offset: 'UTC-5',
    city: '纽约',
  },
  {
    value: 'America/Los_Angeles',
    label: '洛杉矶时间 (UTC-8)',
    offset: 'UTC-8',
    city: '洛杉矶',
  },
  { value: 'UTC', label: '协调世界时 (UTC)' },
];

/* ============================================================
 * 通用样式
 * ============================================================ */
export const drawerHeaderClassName = cn(
  'flex shrink-0 items-center justify-between gap-2',
);

/**
 * 内容列：分类切换条（固定高度）+ 面板滚动区（吃掉剩下的高度）。
 *
 * 外层是 BasicDrawer 的滚动区，不是 flex 容器，所以这里用 `h-full` 而不是 `flex-1`：
 * 少了它切换条会跟着面板一起滚走，面板高度也算不准。
 */
export const drawerContentClassName = cn(
  'flex h-full min-h-0 flex-col overflow-hidden',
);

export const panelWrapperClassName = cn('space-y-6 p-5');

export const groupIconClassName = cn(
  'flex size-7 shrink-0 items-center justify-center rounded-lg',
  'bg-linear-to-br from-blue-500/15 to-indigo-500/15',
  'text-primary text-[15px]',
);

export const groupBoxClassName = cn(
  'space-y-2 rounded-2xl p-3',
  'bg-slate-50/80 dark:bg-slate-900/40',
  'outline outline-1 outline-slate-200/70 dark:outline-slate-700/50',
);

export const itemRowClassName = cn(
  'flex w-full items-center justify-between gap-3',
  'rounded-xl bg-white px-4 py-3',
  'outline outline-1 outline-slate-200',
  'transition-all duration-200',
  'hover:outline-primary/40 hover:shadow-sm',
  'dark:bg-slate-800 dark:outline-slate-700',
);

export const itemLabelClassName = cn(
  'text-[13px] font-medium text-slate-700 dark:text-slate-200',
);

export const itemDescClassName = cn(
  'mt-0.5 text-[11px] text-slate-400 dark:text-slate-500',
);

export const groupTitleClassName = cn(
  'relative mb-3 flex w-fit items-center gap-2 pb-2',
  'text-[13px] font-semibold text-slate-700 dark:text-slate-200',
  'after:absolute after:right-0 after:bottom-0 after:left-9',
  'after:h-[2px] after:rounded-full',
  'after:from-primary after:to-primary/20 after:bg-linear-to-r',
  'after:origin-left after:scale-x-0',
  'after:transition-transform after:duration-300 after:ease-out',
  'hover:after:scale-x-100',
);
