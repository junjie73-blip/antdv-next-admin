<script setup lang="ts">
import type { ListyItem, ListyScrollState } from '@antdv/common-ui';

import { computed, ref } from 'vue';

import { Card, Listy } from '@antdv/common-ui';
import { message } from '@antdv/popup-ui';
import { Button } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

/**
 * Listy 示例页：基础渲染、加载、空状态、自定义插槽，以及虚拟滚动模式的三种形态。
 */

const containerClassName = cn('space-y-6');
const pageHeaderClassName = cn('mb-2');
const pageTitleClassName = cn(
  'text-2xl font-bold text-gray-800 dark:text-gray-100',
);
const pageDescClassName = cn('mt-1 text-gray-500 dark:text-gray-400');
const gridClassName = cn('grid grid-cols-1 gap-6 xl:grid-cols-2');
const tipClassName = cn('mt-3 text-sm text-gray-400');

const TASKS: ListyItem[] = [
  {
    description: '每天 02:00 从业务库拉取增量',
    extra: '3 分钟前',
    icon: 'carbon:cloud-service-management',
    title: '数据同步',
  },
  {
    description: '保留 30 天，超期自动清理',
    extra: '1 小时前',
    icon: 'carbon:trash-can',
    title: '日志清理',
  },
  {
    description: '阈值 85%，通知到值班群',
    extra: '昨天',
    icon: 'carbon:notification',
    title: '磁盘告警',
  },
];

/** 加载态演示：点一下把列表清空并转 1.2 秒骨架 */
const loading = ref(false);
const rows = ref<ListyItem[]>(TASKS);

function reload() {
  loading.value = true;
  setTimeout(() => {
    rows.value = TASKS;
    loading.value = false;
  }, 1200);
}

function onPick(item: ListyItem, index: number) {
  message.success(`点了第 ${index + 1} 行：${item.title}`);
}

/**
 * 虚拟滚动模式。
 *
 * 三张卡各自验证一条链路：固定行高（算术）、函数行高（按规则变化）、
 * 动态行高（实测回灌）。数据量取 20 000 条，DOM 里始终只有窗口内那十几行。
 */
const VIRTUAL_TOTAL = 20_000;

/** 生成给定行数的数据；`descTimes` 让动态高度那张卡的行真的能高矮不一 */
function makeRows(
  count: number,
  descTimes: (index: number) => number = () => 1,
): ListyItem[] {
  const sentence =
    '这段说明的长度随行号变化，用来验证行高由内容撑开时不必写死数值。';
  return Array.from({ length: count }, (_, index) => ({
    description: sentence.repeat(descTimes(index)),
    extra: `${index}`,
    key: index,
    title: `条目 ${index}`,
  }));
}

const fixedRows = makeRows(VIRTUAL_TOTAL);
const ruleRows = makeRows(VIRTUAL_TOTAL);
const dynamicRows = makeRows(VIRTUAL_TOTAL, (index) => (index % 5) + 1);

/** 视口高度可切，用来验证容器尺寸变化后窗口会重算 */
const viewportHeight = ref(320);

const fixedListy = ref<InstanceType<typeof Listy> | null>(null);
const ruleListy = ref<InstanceType<typeof Listy> | null>(null);
const dynamicListy = ref<InstanceType<typeof Listy> | null>(null);

/**
 * 读数走组件暴露的响应式状态，不自己算。
 *
 * `defineExpose` 里的 computed 通过 `proxyRefs` 摊开，页面里读 `xxx.value.scrollState`
 * 仍然在依赖图里，所以窗口一移动这块文字就跟着变 —— 这正是"暴露状态供外部调用"的用意。
 */
const fixedStats = computed(() => fixedListy.value?.scrollState);
const ruleTotal = computed(() => ruleListy.value?.totalHeight ?? 0);
const dynamicTotal = computed(() => dynamicListy.value?.totalHeight ?? 0);

/** `@scroll` 只用来演示事件契约：抛了几次、最后一次到哪 */
const scrollEvents = ref(0);
const lastEmit = ref('—');

function onVirtualScroll(state: ListyScrollState) {
  scrollEvents.value += 1;
  lastEmit.value = `#${state.startIndex}–#${state.endIndex} / ${(state.progress * 100).toFixed(1)}%`;
}

function jumpTo(index: number) {
  const clamped = Math.min(Math.max(index, 0), VIRTUAL_TOTAL - 1);
  fixedListy.value?.scrollToIndex(clamped, { behavior: 'smooth' });
}

function toggleViewportHeight() {
  viewportHeight.value = viewportHeight.value === 320 ? 200 : 320;
}
</script>

<template>
  <div :class="containerClassName">
    <div :class="pageHeaderClassName">
      <h2 :class="pageTitleClassName">通用列表 Listy</h2>
      <p :class="pageDescClassName">
        带空状态与骨架加载态的通用列表，行内容整段可被插槽替换
      </p>
    </div>

    <div :class="gridClassName">
      <Card title="基础列表" variant="borderless">
        <Listy :items="rows" selectable @item-click="onPick" />
        <p :class="tipClassName">
          「selectable」才给行加手型与 hover；不传时列表就是纯展示。
        </p>
      </Card>

      <Card title="加载状态" variant="borderless">
        <template #extra>
          <Button size="sm" variant="outline" @click="reload">重新加载</Button>
        </template>
        <Listy :items="rows" :loading="loading" :loading-rows="4" />
        <p :class="tipClassName">
          骨架行占住列表自己的高度，数据回来时页面不跳。
        </p>
      </Card>

      <Card title="空状态" variant="borderless">
        <Listy :items="[]" empty-text="还没有任务，先创建一个吧" />
        <Listy class="mt-4" :items="[]">
          <template #empty>
            <div class="flex flex-col items-center gap-2 py-10">
              <p class="text-sm text-muted-foreground">#empty 插槽接管整块空状态</p>
              <Button size="sm" @click="reload">用插槽里的按钮加载</Button>
            </div>
          </template>
        </Listy>
      </Card>

      <Card title="自定义插槽" variant="borderless">
        <Listy :items="rows" item-key="title">
          <template #header>任务清单（{{ rows.length }}）</template>
          <template #item-media="{ item }">
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary"
            >
              {{ item.title?.slice(0, 1) }}
            </span>
          </template>
          <template #item-extra="{ index }">
            <Button size="sm" variant="outline" @click="onPick(rows[index]!, index)">
              查看
            </Button>
          </template>
          <template #footer>底部统计与分页放这里</template>
        </Listy>
        <p :class="tipClassName">
          #item 换整行，#item-media / #item-extra 只换两端，#header / #footer
          缺席时不留分隔条。
        </p>
      </Card>
    </div>

    <div :class="pageHeaderClassName">
      <h2 :class="pageTitleClassName">虚拟滚动</h2>
      <p :class="pageDescClassName">
        「virtual」打开后只渲染视口内的行，滚动算术来自 VueUse 的 useVirtualList
      </p>
    </div>

    <div :class="gridClassName">
      <Card title="固定行高 · 20 000 条" variant="borderless">
        <template #extra>
          <div class="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" @click="fixedListy?.scrollToTop()">
              顶部
            </Button>
            <Button
              size="sm"
              variant="outline"
              @click="fixedListy?.scrollToBottom()"
            >
              底部
            </Button>
            <Button size="sm" @click="jumpTo(10_000)">跳到 #10000</Button>
            <Button size="sm" variant="outline" @click="jumpTo(19_999)">
              跳到末行
            </Button>
            <Button size="sm" variant="ghost" @click="toggleViewportHeight">
              视口 {{ viewportHeight }}px
            </Button>
          </div>
        </template>
        <Listy
          ref="fixedListy"
          data-demo="virtual-fixed"
          :container-height="viewportHeight"
          :items="fixedRows"
          :item-height="48"
          item-key="key"
          selectable
          :virtual="true"
          @item-click="onPick"
          @scroll="onVirtualScroll"
        />
        <p
          class="mt-3 font-mono text-xs text-muted-foreground"
          data-testid="listy-stats"
          :data-end="fixedStats?.endIndex ?? -1"
          :data-events="scrollEvents"
          :data-progress="fixedStats?.progress ?? 0"
          :data-rendered="fixedStats?.visibleCount ?? 0"
          :data-start="fixedStats?.startIndex ?? 0"
          :data-total="fixedStats?.scrollHeight ?? 0"
          :data-top="Math.round(fixedStats?.scrollTop ?? 0)"
        >
          渲染 {{ fixedStats?.visibleCount ?? 0 }} 行 · 窗口
          #{{ fixedStats?.startIndex ?? 0 }}–#{{ fixedStats?.endIndex ?? 0 }} ·
          scrollTop {{ Math.round(fixedStats?.scrollTop ?? 0) }}px · 总高
          {{ fixedStats?.scrollHeight ?? 0 }}px · 进度
          {{ ((fixedStats?.progress ?? 0) * 100).toFixed(1) }}% · 事件
          {{ scrollEvents }} 次（{{ lastEmit }}）
        </p>
        <p :class="tipClassName">
          行数不随数据量增长：20 000 条只挂
          {{ fixedStats?.visibleCount ?? 0 }} 行，行高 48px 内联钉死，所以 DOM
          高度与滚动算术是同一把尺。
        </p>
      </Card>

      <Card title="函数行高 · 每组首行更高" variant="borderless">
        <template #extra>
          <span
            class="text-xs text-muted-foreground"
            data-testid="listy-rule-total"
            :data-height="ruleTotal"
          >
            内容总高 {{ ruleTotal }}px
          </span>
        </template>
        <Listy
          ref="ruleListy"
          :container-height="320"
          data-demo="virtual-rule"
          :items="ruleRows"
          :item-height="(index) => (index % 10 === 0 ? 72 : 44)"
          item-key="key"
          :virtual="true"
        >
          <template #item-media="{ index }">
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground"
            >
              {{ Math.floor(index / 10) + 1 }}
            </span>
          </template>
        </Listy>
        <p :class="tipClassName">
          行高按规则变化时不必实测：把同一个函数交给 `item-height`，
          总高与偏移都用它算，所以滚动条仍然精确（本页 20 000 行合计 936 000px）。
        </p>
      </Card>

      <Card title="动态行高 · 内容撑开" variant="borderless">
        <template #extra>
          <span
            class="text-xs text-muted-foreground"
            data-testid="listy-dynamic-total"
            :data-height="dynamicTotal"
          >
            内容总高 {{ dynamicTotal }}px
          </span>
        </template>
        <Listy
          ref="dynamicListy"
          :container-height="320"
          data-demo="virtual-dynamic"
          :items="dynamicRows"
          item-key="key"
          :item-height="52"
          :measure-heights="true"
          :virtual="true"
        >
          <!-- 默认行会把说明截成一行，量不到高度差；这里换成可换行的段落 -->
          <template #item="{ item }">
            <span class="min-w-0 flex-1 py-3 text-sm leading-5">
              {{ item.title }}
              <span class="block text-xs text-muted-foreground">
                {{ item.description }}
              </span>
            </span>
          </template>
        </Listy>
        <p :class="tipClassName">
          `measure-heights` 关掉内联高度，行由内容决定；进入视口的行由
          ResizeObserver 量完回灌，`item-height` 退化成首帧估算值。
        </p>
      </Card>

      <Card title="直排对照 · 同一份数据不开虚拟" variant="borderless">
        <Listy
          data-demo="plain-30"
          :items="fixedRows.slice(0, 30)"
          item-key="key"
        />
        <p :class="tipClassName">
          不开 `virtual` 时它就是原来那个 Listy：外层不滚、行全量渲染，
          长列表交给页面自己滚动。
        </p>
      </Card>
    </div>
  </div>
</template>
