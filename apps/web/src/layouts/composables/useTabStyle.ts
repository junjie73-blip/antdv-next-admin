import type { TabStyle } from '@antdv/types';

import { computed } from 'vue';

import { cn } from '@antdv/shared/cn';
import { useAppStore } from '~/stores/modules/app';

/**
 * 标签页视觉风格的唯一定义处。
 *
 * 风格之间共用同一组语义槽位（bar / list / item / active / close），
 * 新增风格只需要在 STYLE_MAP 里补一项，组件不用改。
 */
interface TabStyleClasses {
  /** 单个标签 */
  item: string;
  /** 选中态标签（追加在 item 之后，靠后面的类覆盖前面的） */
  active: string;
  /** 标签栏容器（LayoutTabs 那一行）：只有需要改变行对齐或底边时才写 */
  bar: string;
  /** 标签容器（排列与分隔方式随风格变化） */
  list: string;
  /** 关闭按钮 */
  close: string;
  /** 是否显示标签间分隔线 */
  divider: boolean;
}

const STYLE_MAP: Record<TabStyle, TabStyleClasses> = {
  card: {
    item: 'gap-1.5 rounded-md border border-transparent px-3 py-1.5',
    active: 'bg-ant-primary border-ant-primary text-white shadow-sm',
    bar: '',
    list: 'gap-1.5',
    close: 'hover:bg-white/20 rounded-full p-0.5',
    divider: false,
  },
  /*
   * 谷歌风格：浏览器标签的样子 —— 只有顶部两个圆角、四边描边但不画底边、
   * 标签贴着标签栏底边排（`bar: items-stretch` 让滚动容器拿到整行高度，
   * 再配合 `list: items-end`，标签才会"坐"在底边上而不是垂直居中悬空）。
   * 选中页换成内容底色并在顶边压一条主色，未选中页留浅灰，
   * 相邻标签靠各自的左右描边天然形成浏览器那种分隔。
   */
  chrome: {
    item: 'h-8 gap-1.5 rounded-t-lg border border-b-0 border-gray-300 px-3 dark:border-gray-600',
    active:
      'border-t-ant-primary bg-white text-gray-800 shadow-sm dark:bg-gray-800 dark:text-white',
    bar: 'items-stretch',
    list: 'h-full items-end gap-0',
    close: 'hover:text-red-500 rounded-full p-0.5',
    divider: false,
  },
  rounded: {
    item: 'gap-1.5 rounded-full px-3.5 py-1.5',
    active: 'bg-ant-primary text-white shadow-sm',
    bar: '',
    list: 'gap-2',
    close: 'hover:bg-white/20 rounded-full p-0.5',
    divider: false,
  },
  line: {
    item: 'gap-1.5 border-b-2 border-transparent px-2 py-2',
    active: 'border-ant-primary text-ant-primary',
    bar: '',
    list: 'gap-0',
    close: 'hover:text-red-500 rounded-full p-0.5',
    divider: false,
  },
  plain: {
    item: 'gap-1.5 px-3 py-1.5',
    active: 'text-ant-primary',
    bar: '',
    list: 'gap-0 divide-x divide-gray-200 dark:divide-gray-700',
    close: 'hover:text-red-500 rounded-full p-0.5',
    divider: true,
  },
};

/** 未选中态：风格之间只有文字色差异，统一放这里避免四处复制 */
const IDLE_ITEM =
  'text-gray-600 hover:text-ant-primary dark:text-gray-300 dark:hover:text-ant-primary';

const IDLE_BG: Record<TabStyle, string> = {
  card: 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600',
  chrome:
    'bg-gray-100/80 hover:bg-gray-50 dark:bg-gray-900/40 dark:hover:bg-gray-800',
  line: '',
  plain: '',
  rounded:
    'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600',
};

export const TAB_STYLE_OPTIONS: { label: string; value: TabStyle }[] = [
  { label: '卡片', value: 'card' },
  { label: '谷歌', value: 'chrome' },
  { label: '胶囊', value: 'rounded' },
  { label: '下划线', value: 'line' },
  { label: '纯文本', value: 'plain' },
];

export function useTabStyle() {
  const appStore = useAppStore();

  const style = computed<TabStyle>(() => appStore.tabStyle ?? 'card');
  const classes = computed(() => STYLE_MAP[style.value]);

  /** 供 SettingDrawer 与单测直接使用：纯函数，不依赖组件实例 */
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

export type { TabStyleClasses };
