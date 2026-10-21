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
   * 谷歌风格 = 浏览器标签：32px 高的胶囊坐在标签栏下沿，**四角同半径（10px）、不描边**，
   * 选中页靠一段"反向圆角"与内容区接上（那段弧只能由伪元素画，见 `TabsBar.vue` 的样式块）。
   *
   * 标签栏底色保持中性（不染色）：参考稿的层次是"灰条 + 主色浅底选中页"，
   * 把整条染成 `bg-primary/10` 反而让选中页的分隔线发丝看不见了。
   * 未选中是透明底、悬停才有灰底，选中页的底色写在样式块里而不是这里 ——
   * 因为标签体与它的两只"脚"必须共用同一个颜色值。
   */
  chrome: {
    item: 'relative h-8 gap-1.5 rounded-[0.625rem] px-3.5',
    active: 'text-primary',
    bar: 'items-stretch',
    list: 'h-full items-end gap-1 px-2.5',
    close: 'hover:text-red-500 rounded-full p-0.5',
    divider: true,
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
  chrome: 'hover:bg-gray-100 dark:hover:bg-gray-700',
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
