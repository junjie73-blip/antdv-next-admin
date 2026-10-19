<script setup lang="ts">
import type { ScrollbarType } from '@antdv/common-ui';
import type {
  TabContextMenuPayload,
  TabItem,
  TabStyle,
  ThemeStyle,
} from '@antdv/types';

import type { TabActionContext } from './types';

import { computed, ref, useTemplateRef, watch } from 'vue';

import { Scrollbar } from '@antdv/common-ui';
import { IconifyIcon as Icon } from '@antdv/icons/icon';
import { cn } from '@antdv/shared/utils/cn';
import { useHorizontalScroll } from '@antdv/shared/utils/scroll';

import TabActions from './components/TabActions.vue';
import TabContextMenu from './components/TabContextMenu.vue';
import TabList from './components/TabList.vue';
import { tabsRuntime } from './config';
import { useTabStyle } from './useTabStyle';

defineOptions({ name: 'TabsBar' });

const props = withDefaults(
  defineProps<{
    activeKey: string;
    /** 右键菜单开关（对应应用的 tabContextMenu 偏好） */
    contextMenu?: boolean;
    /** 允许拖拽排序（对应应用的 tabDragSort 偏好） */
    draggable?: boolean;
    /** 当前处于「放大」状态的标签 key，用于 maximize 动作的 label 与禁用判断 */
    maximizedKey?: string;
    showIcon?: boolean;
    tabStyle?: TabStyle;
    tabs: TabItem[];
    /** 主题风格：geek 主题的标签栏是固定的深色，不跟随明暗模式 */
    themeStyle?: ThemeStyle;
  }>(),
  {
    contextMenu: true,
    draggable: true,
    maximizedKey: '',
    showIcon: true,
    tabStyle: undefined,
    themeStyle: undefined,
  },
);

const emit = defineEmits<{
  activate: [key: string];
  /** 动作 key + 目标标签（缺省时以当前激活标签为目标） */
  action: [key: string, tabKey?: string];
  close: [key: string];
  reorder: [tabs: TabItem[]];
}>();

/** 右键菜单命中的标签与坐标 */
const contextPayload = ref<null | TabContextMenuPayload>(null);

const {
  barClass,
  closeClass,
  itemClass,
  listClass,
  style: currentStyle,
} = useTabStyle(() => props.tabStyle);

/** 固定标签数量：与 store 的算法一致，由标签数组现量，包内不认 store */
const affixCount = computed(() => props.tabs.filter((tab) => tab.affix).length);

/**
 * 滚动的那一层现在是封装 Scrollbar 内部的 `.scrollbar__wrap`，
 * 组件把它以 `wrap` 暴露出来 —— 直接拿这个 ref 喂给 composable，
 * 不去 `document.querySelector` 摸 DOM：模板 ref 走组件实例，重渲染也不会失联。
 */
const tabsScrollbarRef = useTemplateRef<ScrollbarType>('tabsScrollbar');
const scrollContainerRef = computed(() => tabsScrollbarRef.value?.wrap);
/**
 * 标签栏横向滚动复用导航栏那套逻辑（滚轮 / 箭头 / 触摸滑动）。
 * 这里关掉指针拖拽平移：标签本身要参与拖拽排序，两种 drag 语义会互相打断。
 */
const scroller = useHorizontalScroll(scrollContainerRef, {
  draggable: false,
  step: 160,
});

/**
 * 标签栏容器样式 = 固定排版 + 主题底色 + 当前风格追加的类。
 * 用 `cn` 而不是数组 join：谷歌风格要把 `items-center` 换成 `items-stretch`
 * （标签贴底边排），后者必须覆盖前者，裸拼接会被 Tailwind 的书写顺序决定胜负。
 *
 * 开头的 `tab-bar` 是给用例留的稳定钩子：容器本身没有语义化属性，
 * 靠 `.tab-list` 的父节点反查太脆（中间层一改就断），而风格切换要看的就是这一层。
 * `data-tab-style` 同一用途，但服务对象是下面那段 CSS —— 谷歌风格的分隔线与
 * 反向圆角都要按"当前是哪一种风格"生效，写进 Tailwind 类名反而没法表达 clip-path。
 */
const tabsClassName = computed(() =>
  cn(
    'tab-bar flex h-10 shrink-0 items-center gap-1 px-2',
    props.themeStyle === 'geek'
      ? 'border-b border-[#1a1a1a] bg-[#0a0a0a]'
      : 'border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
    barClass(),
  ),
);

/** 可关闭数量等上下文：所有「能不能执行」的判断集中在数据源与这里，子组件只渲染 */
const actionContext = computed<TabActionContext>(() => {
  const target = contextPayload.value?.key ?? props.activeKey;
  const list = props.tabs;
  const index = list.findIndex((tab) => tab.key === target);
  const targetTab = index === -1 ? undefined : list[index];
  const closable = list.filter((tab) => !tab.affix);
  const targetClosable = list.some((tab) => tab.key === target && !tab.affix);

  return {
    affixed: Boolean(targetTab?.affix),
    closeableLeft:
      index <= 0 ? 0 : list.slice(0, index).filter((tab) => !tab.affix).length,
    closeableRight:
      index === -1
        ? 0
        : list.slice(index + 1).filter((tab) => !tab.affix).length,
    // 首页判定与数据源的固定区约定对齐：第一个固定标签即首页，永远排在最前
    isHome: index === 0 && Boolean(targetTab?.affix),
    maximized: props.maximizedKey === target,
    others: Math.max(0, closable.length - (targetClosable ? 1 : 0)),
  };
});

/** 选中项变化 / 标签增减时，把选中项滚进可视区 */
watch(
  () => [props.activeKey, props.tabs.length],
  () => scroller.scrollKeyIntoView(props.activeKey),
  { flush: 'post' },
);

function openContextMenu(event: MouseEvent, key: string) {
  if (!props.contextMenu) return;
  contextPayload.value = { key, x: event.clientX, y: event.clientY };
}
</script>

<template>
  <div :class="tabsClassName" :data-tab-style="currentStyle">
    <button
      v-show="scroller.canScrollLeft.value"
      :aria-label="tabsRuntime.t('shell.scrollTabsLeft')"
      class="shrink-0 self-center rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
      type="button"
      :title="tabsRuntime.t('shell.scrollHintLeft')"
      @click="scroller.scrollByStep(-1)"
      @dblclick="scroller.scrollToEnd(-1)"
    >
      <Icon icon="carbon:chevron-left" />
    </button>

    <!--
      滚动那一层由封装的 Scrollbar 提供（`.tab-scroll` 就是它的 wrap）：
      原先这里手写 `overflow-x-auto` + 一串 `::-webkit-scrollbar` 工具类去美化原生条，
      但那套样式只在 Chromium 生效，Firefox/WebKit 仍是一条系统灰杠。
      `@wheel` 挂在根上，滚轮事件从 wrap 冒泡上来一样能收到。
    -->
    <Scrollbar
      ref="tabsScrollbar"
      class="min-w-0 flex-1"
      root-class="min-h-0 flex-1"
      wrap-class="tab-scroll overflow-y-hidden"
      view-class="h-full"
      @wheel="scroller.onWheel"
    >
      <TabList
        :active-key="props.activeKey"
        :affix-count="affixCount"
        :close-class="closeClass()"
        :draggable="props.draggable"
        :item-class="itemClass"
        :list-class="listClass()"
        :show-icon="props.showIcon"
        :tabs="props.tabs"
        @activate="emit('activate', $event)"
        @close="emit('close', $event)"
        @contextmenu="openContextMenu"
        @reorder="(next) => emit('reorder', next)"
      />
    </Scrollbar>

    <button
      v-show="scroller.canScrollRight.value"
      :aria-label="tabsRuntime.t('shell.scrollTabsRight')"
      class="shrink-0 self-center rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
      type="button"
      :title="tabsRuntime.t('shell.scrollHintRight')"
      @click="scroller.scrollByStep(1)"
      @dblclick="scroller.scrollToEnd(1)"
    >
      <Icon icon="carbon:chevron-right" />
    </button>

    <TabActions
      :context="actionContext"
      @action="(key: string) => emit('action', key)"
    />
  </div>

  <TabContextMenu
    :context="actionContext"
    :payload="contextPayload"
    @action="(key: string, tabKey: string) => emit('action', key, tabKey)"
    @close="contextPayload = null"
  />
</template>

<style>
/*
 * 谷歌风格的两处几何：选中页与内容区之间的**反向圆角**、相邻标签之间的发丝分隔线。
 * 都画不出来用 Tailwind 表达的图形（`clip-path` 的象限裁剪、伪元素的圆 + 扩散阴影），
 * 所以留在样式块里，按 `data-tab-style='chrome'` 生效，其余四种风格一概不受影响。
 *
 * 「脚」的做法：两个 20px 的圆，圆心正好落在标签下沿的外侧角上，
 * `box-shadow: 0 0 0 30px` 把同一种底色铺满圆外的方形区域，再用 `clip-path`
 * 只保留靠标签那一侧的下半象限 —— 于是标签底边左右各长出一段**凹**弧，
 * 与内容区的直角接上，读起来像标签"坐"在内容区上（浏览器标签的那口气）。
 *
 * 半径必须与标签自己的圆角**同一个值**（10px）：两条弧的圆心都在标签底边上、
 * 半径相同，交点处切线都是竖直的，接得上才是平滑的 S 形；
 * 参考稿用的 8px 圆角 + 10px 弧，接缝处差的那 2px 会露出一个针尖大的缺口。
 *
 * 底色写在 `--tab-chrome-fill` 上、标签体与两只脚共用同一个变量：
 * 换主题换明暗时三处一起变，不会出现"脚"和标签不同色的拼接缝。
 */
.tab-bar[data-tab-style='chrome'] .tab-item[data-active='true'] {
  --tab-chrome-fill: color-mix(
    in oklab,
    var(--app-primary) 12%,
    var(--app-background)
  );

  z-index: 1;
  background-color: var(--tab-chrome-fill);
}
.tab-bar[data-tab-style='chrome'] .tab-item[data-active='true']::before,
.tab-bar[data-tab-style='chrome'] .tab-item[data-active='true']::after {
  position: absolute;
  bottom: 0;
  width: 20px;
  height: 20px;
  content: '';
  border-radius: 9999px;
  box-shadow: 0 0 0 30px var(--tab-chrome-fill);
}
.tab-bar[data-tab-style='chrome'] .tab-item[data-active='true']::before {
  left: -20px;
  clip-path: inset(50% -10px 0 50%);
}
.tab-bar[data-tab-style='chrome'] .tab-item[data-active='true']::after {
  right: -20px;
  clip-path: inset(50% 50% 0 -10px);
}

/*
 * 分隔线走**未选中**标签的 `::after`、画在自己的左沿：
 * 选中页的那两个伪元素已经被上面的脚占用，用它自己的槽位就没有抢占之争，
 * 隐藏规则也只需要同步带上 `:not([data-active])` —— 少写一层判断的话，
 * 悬停到选中页时会把它的左脚一起 `opacity: 0` 掉。
 *
 * 该没线的四种情形（与参考稿一致）：整条的第一个（左边是栏边，没有邻居）、
 * 自己正被悬停、自己就是选中页、以及紧邻在悬停/选中页后面的那一个 ——
 * 线是"两个平级标签之间"的东西，任何一侧翘起来就该整段消失。
 */
.tab-bar[data-tab-style='chrome'] .tab-item:not([data-active='true'])::after {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 1px;
  height: 16px;
  margin: auto;
  content: '';
  background-color: var(--app-border);
  transition: opacity 0.3s ease;
}
.tab-bar[data-tab-style='chrome']
  .tab-list
  .tab-item:not([data-active='true']):first-child::after,
.tab-bar[data-tab-style='chrome']
  .tab-list
  .tab-item:not([data-active='true']):hover::after,
.tab-bar[data-tab-style='chrome']
  .tab-list
  .tab-item[data-active='true']
  + .tab-item:not([data-active='true'])::after,
.tab-bar[data-tab-style='chrome']
  .tab-list
  .tab-item:not([data-active='true']):hover
  + .tab-item:not([data-active='true'])::after {
  opacity: 0;
}
</style>
