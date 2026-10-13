<script setup lang="ts">
import type { ScrollbarType } from '@antdv/scrollbar-ui';
import type {
  TabContextMenuPayload,
  TabItem,
  TabStyle,
  ThemeStyle,
} from '@antdv/types';

import type { TabActionContext } from './types';

import { computed, ref, useTemplateRef, watch } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';
import { Scrollbar } from '@antdv/scrollbar-ui';
import { cn } from '@antdv/shared/cn';
import { useHorizontalScroll } from '@antdv/shared/scroll';

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

const { barClass, closeClass, itemClass, listClass } = useTabStyle(
  () => props.tabStyle,
);

/** 固定标签数量：与 store 的算法一致，由标签数组现量，包内不认 store */
const affixCount = computed(
  () => props.tabs.filter((tab) => tab.affix).length,
);

/**
 * 滚动的那一层现在是封装 Scrollbar 内部的 `.scrollbar__wrap`，
 * 组件把它以 `wrap` 暴露出来 —— 直接拿这个 ref 喂给 composable，
 * 不去 `document.querySelector` 摸 DOM：模板 ref 走组件实例，重渲染也不会失联。
 */
const tabsScrollbarRef = useTemplateRef<ScrollbarType>('tabsScrollbar');
/**
 * `ScrollbarType.wrap` 声明成 `Ref<HTMLElement>`，但 `defineExpose` 暴露出来的对象
 * 会被 Vue 用 proxyRefs 解包，实例上取到的其实就是那个 DOM 元素 —— 类型上对不上，
 * 只能显式转一次（组件内部同样按元素用）。
 */
const scrollContainerRef = computed<HTMLElement | undefined>(
  () => tabsScrollbarRef.value?.wrap as unknown as HTMLElement | undefined,
);
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
  <div :class="tabsClassName">
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
