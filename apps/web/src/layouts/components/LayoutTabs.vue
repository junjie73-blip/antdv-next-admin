<script setup lang="ts">
import type { TabContextMenuPayload } from '@antdv/types';
import type { ScrollbarType } from '@antdv/ui/scrollbar';

import type { TabActionContext } from './tabs/constants';

import { computed, ref, useTemplateRef, watch } from 'vue';

import { cn } from '@antdv/shared/cn';
import { Icon } from '@iconify/vue';
import { useAppStore } from '~/stores/modules/app';

import { useHorizontalScroll } from '../composables/useHorizontalScroll';
import { useTabs } from '../composables/useTabs';
import { useTabStyle } from '../composables/useTabStyle';
import TabActions from './tabs/TabActions.vue';
import TabContextMenu from './tabs/TabContextMenu.vue';
import TabList from './tabs/TabList.vue';

defineOptions({ name: 'LayoutTabs' });

defineProps<{ showIcon?: boolean }>();

const appStore = useAppStore();
const tabsApi = useTabs();
const { barClass, closeClass, itemClass, listClass } = useTabStyle();

const { activeKey, tabs, tabsStore } = tabsApi;

/** 右键菜单命中的标签与坐标 */
const contextPayload = ref<null | TabContextMenuPayload>(null);

/**
 * 滚动的那一层现在是封装 Scrollbar 内部的 `.scrollbar__wrap`（`.tab-scroll`），
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

const isGeekStyle = computed(() => appStore.themeStyle === 'geek');

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
    isGeekStyle.value
      ? 'border-b border-[#1a1a1a] bg-[#0a0a0a]'
      : 'border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
    barClass(),
  ),
);

/** 可关闭数量等上下文：所有「能不能执行」的判断集中在 store 与这里，子组件只渲染 */
const actionContext = computed<TabActionContext>(() => {
  const target = contextPayload.value?.key ?? activeKey.value;
  const list = tabs.value;
  const index = list.findIndex((tab) => tab.key === target);
  const targetTab = index === -1 ? undefined : list[index];
  const closable = list.filter((tab) => !tab.affix);
  const targetClosable = list.some((tab) => tab.key === target && !tab.affix);

  return {
    affixed: Boolean(targetTab?.affix),
    closeableLeft:
      index <= 0 ? 0 : list.slice(0, index).filter((tab) => !tab.affix).length,
    closeableRight:
      index < 0
        ? 0
        : list.slice(index + 1).filter((tab) => !tab.affix).length,
    // 首页判定与 store 的 ensureHome 对齐：第一个固定标签即首页，永远排在最前
    isHome: index === 0 && Boolean(targetTab?.affix),
    maximized: tabsStore.maximizedKey === target,
    others: Math.max(0, closable.length - (targetClosable ? 1 : 0)),
  };
});

function handleAction(key: string, tabKey?: string) {
  const target = tabKey ?? activeKey.value;
  switch (key) {
    case 'affix': {
      tabsApi.toggleAffix(target);
      break;
    }
    case 'close': {
      tabsApi.close(target);
      break;
    }
    case 'closeAll': {
      tabsApi.closeAll();
      break;
    }
    case 'closeLeft': {
      tabsApi.closeLeft(target);
      break;
    }
    case 'closeOther': {
      tabsApi.closeOthers(target);
      break;
    }
    case 'closeRight': {
      tabsApi.closeRight(target);
      break;
    }
    case 'maximize': {
      tabsApi.toggleMaximize(target);
      break;
    }
    case 'openInNewWindow': {
      tabsApi.openInNewWindow(target);
      break;
    }
    case 'refresh': {
      tabsApi.refresh(target);
      break;
    }
    // reload 与 refresh 是同一动作的两种历史命名，语义都走 /redirect 重建
    case 'reload': {
      tabsApi.refresh(target);
      break;
    }
  }
}

/** 选中项变化 / 标签增减时，把选中项滚进可视区 */
watch(
  () => [activeKey.value, tabs.value.length],
  () => scroller.scrollKeyIntoView(activeKey.value),
  { flush: 'post' },
);

function openContextMenu(event: MouseEvent, key: string) {
  if (!appStore.tabContextMenu) return;
  contextPayload.value = { key, x: event.clientX, y: event.clientY };
}
</script>

<template>
  <div v-if="appStore.showTabs" :class="tabsClassName">
    <button
      v-show="scroller.canScrollLeft.value"
      type="button"
      class="shrink-0 self-center rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
      aria-label="向左滚动标签栏"
      title="单击逐步滚动，双击滚到最左"
      @click="scroller.scrollByStep(-1)"
      @dblclick="scroller.scrollToEnd(-1)"
    >
      <Icon icon="carbon:chevron-left" />
    </button>

    <!--
      滚动那一层由封装的 Scrollbar 提供（`.tab-scroll` 就是它的 wrap）：
      原先这里手写 `overflow-x-auto` + 一串 `::-webkit-scrollbar` 工具类去美化原生条，
      但那套样式只在 Chromium 生效，Firefox/WebKit 仍是一条系统灰杠。
      `data-tab-scroll` 这个钩子随之改成类名 —— 用例要量的始终是"真的会滚的那个元素"，
      现在它是 `.tab-scroll`；`@wheel` 挂在根上，滚轮事件从 wrap 冒泡上来一样能收到。
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
        :active-key="activeKey"
        :affix-count="tabsStore.affixCount"
        :close-class="closeClass()"
        :draggable="appStore.tabDragSort !== false"
        :item-class="itemClass"
        :list-class="listClass()"
        :show-icon="showIcon ?? appStore.tabShowIcon !== false"
        :tabs="tabs"
        @activate="tabsApi.activate"
        @close="tabsApi.close"
        @contextmenu="openContextMenu"
        @reorder="tabsApi.reorder"
      />
    </Scrollbar>

    <button
      v-show="scroller.canScrollRight.value"
      type="button"
      class="shrink-0 self-center rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
      aria-label="向右滚动标签栏"
      title="单击逐步滚动，双击滚到最右"
      @click="scroller.scrollByStep(1)"
      @dblclick="scroller.scrollToEnd(1)"
    >
      <Icon icon="carbon:chevron-right" />
    </button>

    <TabActions :context="actionContext" @action="handleAction" />
  </div>

  <TabContextMenu
    :context="actionContext"
    :payload="contextPayload"
    @action="handleAction"
    @close="contextPayload = null"
  />
</template>
