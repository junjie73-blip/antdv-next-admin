import type { TabStyle } from '@antdv/types';

import type { MaybeRefOrGetter } from 'vue';

import type { TabStyleClasses } from './types';

import { computed, toValue } from 'vue';

import { cn } from '@antdv/shared/utils/cn';

import { tabsRuntime } from './config';

/**
 * 标签页视觉风格的唯一定义处。
 *
 * 风格之间共用同一组语义槽位（bar / list / item / active / close），
 * 新增风格只需要在 STYLE_MAP 里补一项，组件不用改。
 */
const STYLE_MAP: Record<TabStyle, TabStyleClasses> = {
  card: {
    item: 'gap-1.5 rounded-md border border-transparent px-3 py-1.5',
    active: 'bg-primary border-primary text-white shadow-sm',
    bar: '',
    list: 'gap-1.5',
    close: 'hover:bg-white/20 rounded-full p-0.5',
    divider: false,
  },
  /*
   * 谷歌风格：浏览器标签的样子 —— 只有顶部两个圆角、左右+顶描边但不画底边、
   * 标签贴着标签栏底边排（`bar: items-stretch` 让滚动容器拿到整行高度，
   * 再配合 `list: items-end`，标签才会"坐"在底边上而不是垂直居中悬空）。
   *
   * 关键：标签栏（strip）铺一层**主色浅底**，选中页换成内容底色
   * （`bg-background`）才能从浅底里"跳"出来 —— Chrome 的窗口条本身就是主题色
   * 染出来的灰蓝，用中性 muted 就少了那层染色。相邻标签靠各自的左右描边天然分隔。
   */
  chrome: {
    item: 'h-8 gap-1.5 rounded-t-lg border border-b-0 border-transparent px-3',
    active: 'border-border bg-background text-foreground shadow-sm',
    bar: 'items-stretch bg-primary/10',
    list: 'h-full items-end gap-0',
    close: 'hover:text-red-500 rounded-full p-0.5',
    divider: false,
  },
  rounded: {
    item: 'gap-1.5 rounded-full px-3.5 py-1.5',
    active: 'bg-primary text-white shadow-sm',
    bar: '',
    list: 'gap-2',
    close: 'hover:bg-white/20 rounded-full p-0.5',
    divider: false,
  },
  line: {
    item: 'gap-1.5 border-b-2 border-transparent px-2 py-2',
    active: 'border-primary text-primary',
    bar: '',
    list: 'gap-0',
    close: 'hover:text-red-500 rounded-full p-0.5',
    divider: false,
  },
  plain: {
    item: 'gap-1.5 px-3 py-1.5',
    active: 'text-primary',
    bar: '',
    list: 'gap-0 divide-x divide-gray-200 dark:divide-gray-700',
    close: 'hover:text-red-500 rounded-full p-0.5',
    divider: true,
  },
};

/** 未选中态：风格之间只有文字色差异，统一放这里避免四处复制 */
const IDLE_ITEM =
  'text-gray-600 hover:text-primary dark:text-gray-300 dark:hover:text-primary';

const IDLE_BG: Record<TabStyle, string> = {
  card: 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600',
  chrome:
    'bg-background/40 hover:bg-background/70 dark:bg-background/10 dark:hover:bg-background/20',
  line: '',
  plain: '',
  rounded:
    'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600',
};

/**
 * 风格名用 getter：模块加载时就把字符串固化下来的话，切语言后选项仍是中文。
 * 读 `.label` 的那一刻才取文案，消费方（设置面板的风格选项）只要在
 * computed 里读，locale 就成了那个 computed 的依赖，切换时自动重算。
 */
function styleOption(value: TabStyle, labelKey: string) {
  return {
    get label() {
      return tabsRuntime.t(labelKey);
    },
    value,
  };
}

export const TAB_STYLE_OPTIONS: { label: string; value: TabStyle }[] = [
  styleOption('card', 'tabs.styleCard'),
  styleOption('chrome', 'tabs.styleChrome'),
  styleOption('rounded', 'tabs.styleRounded'),
  styleOption('line', 'tabs.styleLine'),
  styleOption('plain', 'tabs.stylePlain'),
];

/**
 * 风格来源由调用方给（store 里的偏好、prop、常量都行），包内不认 store。
 * 不传即 `card`，与应用的默认偏好一致。
 */
export function useTabStyle(source?: MaybeRefOrGetter<TabStyle | undefined>) {
  const style = computed<TabStyle>(() => toValue(source) ?? 'card');
  const classes = computed(() => STYLE_MAP[style.value]);

  /** 供设置面板与单测直接使用：纯函数，不依赖组件实例 */
  function itemClass(active: boolean) {
    const base =
      'flex shrink-0 cursor-pointer items-center whitespace-nowrap text-sm transition-colors duration-200';
    return cn(
      base,
      classes.value.item,
      active ? classes.value.active : cn(IDLE_ITEM, IDLE_BG[style.value]),
    );
  }

  function listClass() {
    return cn('inline-flex h-full items-center', classes.value.list);
  }

  function closeClass() {
    return cn('ml-0.5 text-xs', classes.value.close);
  }

  /** 标签栏容器附加样式：风格需要整行参与排版时（chrome 贴底）由这里给出 */
  function barClass() {
    return classes.value.bar;
  }

  return {
    barClass,
    classes,
    closeClass,
    itemClass,
    listClass,
    style,
  };
}
