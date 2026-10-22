<script setup lang="ts">
import type { ComponentPublicInstance, CSSProperties, StyleValue } from 'vue';

import type {
  ListyEmits,
  ListyItem,
  ListyProps,
  ListyRow,
  ListyScrollState,
  ListyScrollToOptions,
} from './types';

import { computed, onMounted, ref, useSlots, useTemplateRef, watch } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';
import { cn } from '@antdv/shared/utils/cn';
import { useResizeObserver, useScroll, useVirtualList } from '@vueuse/core';

import { EmptyState } from '../empty-state';

defineOptions({ name: 'Listy' });

const props = withDefaults(defineProps<ListyProps>(), {
  class: undefined,
  containerHeight: 320,
  emptyIcon: 'ant-design:inbox-outlined',
  emptyText: '暂无数据',
  itemHeight: 40,
  items: () => [],
  itemKey: undefined,
  loading: false,
  loadingRows: 3,
  measureHeights: false,
  overscan: 5,
  selectable: false,
  size: 'middle',
  style: undefined,
  virtual: false,
});

const emit = defineEmits<ListyEmits>();
const slots = useSlots();

const rowsList = useTemplateRef<HTMLUListElement>('rowsList');

/** 实测行高（`measure-heights` 才写）；下标即行下标，缺项表示还没量到 */
const measuredHeights = ref<number[]>([]);

/** 视口尺寸：`progress` 与"滚到底"的算术都要它，容器高度由外部给，不能假设已知 */
const containerSize = ref({ height: 0, width: 0 });

/**
 * 一行的算术高度：实测优先，没量到用 `item-height` 兜。
 *
 * 它是滚动算术里唯一的高度来源 —— 总高、偏移、视口容量三处都走这一个函数，
 * 三处一致，滚动条长度与 `marginTop` 才永远拼得上。所以它也**必须**等于行的实际占用高度：
 * 固定高度模式靠把 `height` 内联到 `<li>` 上钉死（`box-border`，含内边距），
 * 动态模式靠实测回灌。
 */
function rowHeight(index: number): number {
  const measured = measuredHeights.value[index];
  if (measured !== undefined) return measured;
  const { itemHeight } = props;
  if (typeof itemHeight !== 'function') return itemHeight;
  // 下标越界只在数据刚被换掉的那一帧出现，此时高度函数的结果马上会被下一次求值覆盖
  return itemHeight(index, props.items[index] as ListyItem);
}

/**
 * 虚拟列表的滚动算术全部交给 `@vueuse/core` 的 `useVirtualList`。
 *
 * 两个决定：
 * - `itemHeight` 一律给**函数**而不是数字。VueUse 在建立时把选项解构掉了
 *   （`const { itemHeight, overscan } = options`），传数字就等于把值冻在建立那一刻，
 *   之后改 `item-height` 属性不会重算；给函数则每次求值都读最新 props，
 *   代价是它内部的定位扫描从 O(1) 变成 O(n) —— 万级 uniform 高度实测在几十微秒量级。
 * - 数据源给 `computed`。它是 `shallowRef` 短路返回的那个 ref，被 VueUse 的 watch 认得，
 *   换整个数组会触发重算；就地 `push` 则由下面的 `totalHeight` 带着重算。
 */
const source = computed(() => props.items);
const {
  containerProps,
  list: virtualRows,
  scrollTo: virtualScrollTo,
  wrapperProps,
} = useVirtualList<ListyItem>(source, {
  itemHeight: rowHeight,
  // 这一项确实只在建立时读一次，改它要重挂组件（类型注释里写明了）
  overscan: props.overscan,
});

/** 内容总高：与 VueUse 同一套算法（对它也是逐项累加的 computed），这里要报 `progress` 与"滚到底" */
const totalHeight = computed(() =>
  props.items.reduce((sum, _item, index) => sum + rowHeight(index), 0),
);

/** 虚拟与直排两条路径合成一份行序列，模板里因此只有一个 `<li>` 形状 */
const rowsOfList = computed<ListyRow[]>(() =>
  props.virtual
    ? virtualRows.value
    : props.items.map((data, index) => ({ data, index })),
);

/** 真正挂在 DOM 上的那些行（虚拟模式含上下 overscan） */
const visibleItems = computed(() => rowsOfList.value.map((row) => row.data));

const visibleRange = computed(() => {
  if (!props.virtual) {
    return { endIndex: props.items.length - 1, startIndex: 0 };
  }
  const rows = virtualRows.value;
  const last = rows[rows.length - 1];
  return {
    endIndex: last ? last.index : -1,
    startIndex: rows[0]?.index ?? 0,
  };
});

/** `useScroll` 提供滚动位置、方向与"到边"状态；位置写成可写的 `y` 就能反向滚 */
const {
  arrivedState,
  directions,
  isScrolling,
  y: scrollY,
} = useScroll(containerProps.ref);

const scrollState = computed<ListyScrollState>(() => {
  const scrollable = totalHeight.value - containerSize.value.height;
  const scrollTop = scrollY.value;
  return {
    endIndex: visibleRange.value.endIndex,
    progress:
      scrollable > 0 ? Math.min(1, Math.max(0, scrollTop / scrollable)) : 0,
    scrollHeight: totalHeight.value,
    scrollTop,
    startIndex: visibleRange.value.startIndex,
    visibleCount: rowsOfList.value.length,
  };
});

// 位置一变就报出去：程序化滚动与就地换数据也走这条路，不需要额外补发
watch(scrollY, () => emit('scroll', scrollState.value));

useResizeObserver(containerProps.ref, () => {
  const el = containerProps.ref.value;
  if (el) {
    containerSize.value = { height: el.clientHeight, width: el.clientWidth };
  }
});

/**
 * 动态高度的实测目标：只观察当前窗口里的行。
 *
 * 读 `virtualRows` 是必要的 —— 窗口一移动就要把新进入的行挂上观察；
 * VueUse 在目标数组变化时会重建 observer，而 `observe()` 对新元素必定回调一次，
 * 所以头部插数据导致下标整体错位时，错位的缓存会被下一轮实测覆盖掉，不需要手动清。
 */
const measuredTargets = computed(() => {
  const list = rowsList.value;
  if (!props.virtual || !props.measureHeights || !list) return [];
  return virtualRows.value
    .map((row) =>
      list.querySelector<HTMLElement>(`[data-listy-index="${row.index}"]`),
    )
    .filter((el): el is HTMLElement => el !== null);
});

useResizeObserver(measuredTargets, (entries) => {
  for (const entry of entries) {
    const el = entry.target as HTMLElement;
    const index = Number(el.dataset.listyIndex);
    // `offsetHeight` 是 border-box 口径，与内联高度、滚动算术同一把尺
    const height = el.offsetHeight;
    if (!Number.isInteger(index) || index < 0 || height <= 0) continue;
    if (measuredHeights.value[index] === height) continue;
    measuredHeights.value[index] = height;
  }
  // 不在这里手动重算窗口：写 `measuredHeights` 会让 `totalHeight` 变化，
  // VueUse 内部正 watch 着总高，自己会重算 —— 在这里同步滚一下反而容易撞
  // "ResizeObserver loop" 那类回调里改布局的警告。
});

const viewportHeight = computed(() =>
  typeof props.containerHeight === 'number'
    ? `${props.containerHeight}px`
    : props.containerHeight,
);

// 视口样式是"数组式 `:style`"：VueUse 给的那份（`overflow-y: auto`）与高度叠在一起，
// 直排模式什么都不给，这一层就是个普通 div。
const viewportStyle = computed<StyleValue>(() =>
  props.virtual
    ? [{ height: viewportHeight.value }, containerProps.style]
    : undefined,
);

/**
 * 行的可点暗示由 `selectable` 显式给，不去嗅"有没有人监听 item-click"：
 * 组件声明了 `emits`，监听器就不会出现在 `attrs` 里；就算嗅得到，
 * 给纯展示的列表加上 hover 也是在骗用户去点一个点了没用的东西。
 */
const rowClass = computed(() =>
  cn('border-border flex items-center border-b last:border-b-0', {
    'gap-4 p-4': props.size === 'large',
    'gap-3 px-4 py-3': props.size === 'middle',
    'gap-2 px-3 py-2': props.size === 'small',
    'hover:bg-accent cursor-pointer transition-colors': props.selectable,
  }),
);

const titleClass = computed(
  () =>
    ({
      large: 'text-base',
      middle: 'text-sm',
      small: 'text-[13px]',
    })[props.size],
);

const empty = computed(() => props.items.length === 0);

function rowKey(item: ListyItem, index: number) {
  const { itemKey } = props;
  if (typeof itemKey === 'function') return itemKey(index, item);
  if (itemKey !== undefined) return String(item[itemKey] ?? index);
  return item.key ?? index;
}

/** 固定高度模式才内联钉死；动态模式要留自然高度给内容撑开再量 */
function rowStyle(index: number): CSSProperties | undefined {
  if (!props.virtual || props.measureHeights) return undefined;
  return { height: `${rowHeight(index)}px` };
}

/** 滚到第 `index` 行。虚拟模式按行高算偏移，直排模式退化成 `scrollIntoView` */
function scrollToIndex(index: number, options: ListyScrollToOptions = {}) {
  const clamped = Math.max(0, Math.min(index, props.items.length - 1));
  const behavior = options.behavior ?? 'auto';
  const block = options.block ?? 'start';
  if (!props.virtual) {
    rowsList.value
      ?.querySelector<HTMLElement>(`[data-listy-index="${clamped}"]`)
      ?.scrollIntoView({ behavior, block });
    return;
  }
  virtualScrollTo(clamped, { behavior, block });
}

/** 按像素滚（"回到上次位置"这类），只在虚拟模式有可滚的容器 */
function scrollTo(offset: number, behavior: ScrollBehavior = 'auto') {
  containerProps.ref.value?.scrollTo({ behavior, top: Math.max(0, offset) });
}

function scrollToTop(behavior: ScrollBehavior = 'auto') {
  scrollTo(0, behavior);
}

function scrollToBottom(behavior: ScrollBehavior = 'auto') {
  if (props.virtual) {
    scrollTo(totalHeight.value - containerSize.value.height, behavior);
    return;
  }
  scrollToIndex(props.items.length - 1, { behavior });
}

/**
 * 强制按当前行高重算可视窗口。
 *
 * 换掉整个数组、改行高、容器尺寸变化都不用调（那些都在依赖链上）；
 * 需要它的是"高度变了但既没触发 ResizeObserver 也没进依赖"的自定义高度函数。
 */
function recalc() {
  containerProps.onScroll();
}

/**
 * 视口用**函数式 ref** 把元素交给 `useVirtualList`，而不是 `:ref="containerProps.ref"`。
 *
 * 函数 ref 在挂载时就同步调用，紧接着的 `onMounted` 里那次 `recalc()` 才量得到元素；
 * 绑 Ref 对象要等 watcher flush 才写入，首帧永远算不出窗口 —— 万级列表在第一次滚动之前是空的。
 */
function setViewportRef(el: ComponentPublicInstance | Element | null) {
  containerProps.ref.value = el instanceof HTMLElement ? el : null;
}

onMounted(() => {
  // 首帧自己算一次窗口：`useElementSize` 与 ResizeObserver 都是异步回调，
  // 没有这一下，万级列表在第一次滚动之前是空的（无 ResizeObserver 的环境更是永远等不到）
  const el = containerProps.ref.value;
  if (el)
    containerSize.value = { height: el.clientHeight, width: el.clientWidth };
  recalc();
});

defineExpose({
  arrivedState,
  containerElement: containerProps.ref,
  directions,
  isScrolling,
  recalc,
  scrollState,
  scrollTo,
  scrollToBottom,
  scrollToIndex,
  scrollToTop,
  totalHeight,
  visibleItems,
  visibleRange,
});
</script>

<template>
  <div
    class="listy"
    :class="
      cn(
        'overflow-hidden rounded-lg border border-border bg-card text-card-foreground',
        props.class,
      )
    "
    :style="props.style"
  >
    <!--
      `listy` 走静态 class，不进 `cn()`：tailwind-merge 把它认成 `list-{type}` 那一档，
      调用方一旦传了 `list-none` 之类的真工具类，同名冲突就把这个钩子类吃掉了。
    -->
    <div
      v-if="slots.header"
      class="listy__header border-b border-border px-4 py-3 text-sm font-medium"
    >
      <slot name="header"></slot>
    </div>

    <!-- 加载态占的是列表自己的位置：骨架行数与 `loading-rows` 一致，容器高度不跳 -->
    <ul v-if="props.loading" aria-busy="true">
      <li v-if="slots.loading" :class="rowClass">
        <slot name="loading"></slot>
      </li>
      <template v-else>
        <li v-for="row in props.loadingRows" :key="row" :class="rowClass">
          <span
            class="size-8 shrink-0 animate-pulse rounded-md bg-muted"
          ></span>
          <span class="min-w-0 flex-1">
            <span
              class="block h-3.5 w-2/5 animate-pulse rounded-sm bg-muted"
            ></span>
            <span
              class="mt-2 block h-3 w-3/5 animate-pulse rounded-sm bg-muted"
            ></span>
          </span>
        </li>
      </template>
    </ul>

    <slot v-else-if="empty" name="empty">
      <EmptyState :icon="props.emptyIcon" :title="props.emptyText" />
    </slot>

    <!--
      虚拟模式的外层就是滚动视口：`containerProps` 给 ref / onScroll / `overflow-y`，
      高度由 `container-height` 决定。直排模式这里退化成一个普通 div（不绑样式、不滚），
      两条路径的行渲染逻辑因此完全共用。
    -->
    <div
      v-else
      class="listy__viewport"
      data-listy-viewport
      :ref="setViewportRef"
      :style="viewportStyle"
      @scroll="containerProps.onScroll"
    >
      <!--
        `wrapperProps.style` 把 `<ul>` 本身变成占位块：`marginTop` 是窗口之前所有行的高度，
        `height` 是剩下的总高。两者都来自同一套行高算术，所以滚动条长度与实际排布一致。
      -->
      <ul
        class="listy__rows"
        ref="rowsList"
        :style="props.virtual ? wrapperProps.style : undefined"
      >
        <li
          v-for="row in rowsOfList"
          :key="rowKey(row.data, row.index)"
          :class="rowClass"
          :data-listy-index="row.index"
          :style="rowStyle(row.index)"
          @click="emit('itemClick', row.data, row.index)"
        >
          <slot name="item" :index="row.index" :item="row.data">
            <slot name="item-media" :index="row.index" :item="row.data">
              <span
                v-if="row.data.icon"
                class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-base text-muted-foreground"
              >
                <Icon :icon="row.data.icon" />
              </span>
            </slot>
            <span class="min-w-0 flex-1">
              <span :class="cn('block truncate', titleClass)">
                {{ row.data.title }}
              </span>
              <span
                v-if="row.data.description"
                class="mt-0.5 block truncate text-xs text-muted-foreground"
              >
                {{ row.data.description }}
              </span>
            </span>
            <slot name="item-extra" :index="row.index" :item="row.data">
              <span
                v-if="row.data.extra"
                class="shrink-0 text-xs text-muted-foreground"
              >
                {{ row.data.extra }}
              </span>
            </slot>
          </slot>
        </li>
      </ul>
    </div>

    <div
      v-if="slots.footer"
      class="listy__footer border-t border-border px-4 py-3 text-sm text-muted-foreground"
    >
      <slot name="footer"></slot>
    </div>
  </div>
</template>
