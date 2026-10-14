<script setup lang="ts">
import type { DraggableEvent, Options } from 'vue-draggable-plus';

import { ref } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';

import { Card, Tag } from '@antdv/common-ui';
import { Button, Switch } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/cn';

/**
 * 这一页讲的是「布局 / 卡片 / 列表」的拖拽，用 `vue-draggable-plus` 的 `VueDraggable` 组件；
 * 表格行内拖拽是另一条路（`BasicTable` 的 `dragSort`，见 table/drag-sort），两者不重复。
 *
 * `VueDraggable` 的 props 就是 sortablejs 的 Options（外加 `modelValue` / `tag` / `target`），
 * 事件名是去掉 on 的小写形式：`@start` / `@update` / `@add` / `@remove` / `@end` / `@filter`。
 */

interface DragItem {
  id: string;
  name: string;
  note: string;
}

interface PanelItem {
  id: string;
  name: string;
  hint: string;
}

type CardTone = 'blue' | 'cyan' | 'green' | 'orange' | 'purple' | 'red';

interface StatCard {
  delta: string;
  id: string;
  title: string;
  tone: CardTone;
  value: string;
}

interface RuleItem {
  id: string;
  locked: boolean;
  name: string;
}

const containerClassName = cn('space-y-6');
const descClassName = cn(
  'mb-3',
  'text-sm',
  'text-gray-500',
  'dark:text-gray-400',
);
const toolbarClassName = cn(
  'mb-4',
  'flex',
  'flex-wrap',
  'items-center',
  'justify-between',
  'gap-3',
);
const listClassName = cn('space-y-2');
const rowClassName = cn(
  'flex',
  'items-center',
  'gap-3',
  'rounded-md',
  'border',
  'border-gray-200',
  'bg-white',
  'px-3',
  'py-2',
  'dark:border-gray-700',
  'dark:bg-gray-900',
);
const dragRowClassName = cn(rowClassName, 'cursor-move');
const gripRowClassName = cn(rowClassName, 'cursor-default');
const indexClassName = cn(
  'w-6',
  'shrink-0',
  'text-center',
  'font-mono',
  'text-xs',
  'text-gray-400',
);
const titleClassName = cn(
  'shrink-0',
  'font-medium',
  'text-gray-800',
  'dark:text-gray-200',
);
const noteClassName = cn('text-xs', 'text-gray-500', 'dark:text-gray-400');
const selectableClassName = cn(
  'select-text',
  'text-xs',
  'text-gray-500',
  'dark:text-gray-400',
);
const gripClassName = cn(
  'drag-grip',
  'cursor-grab',
  'select-none',
  'text-lg',
  'leading-none',
  'text-gray-400',
  'hover:text-gray-600',
  'active:cursor-grabbing',
);
const orderRowClassName = cn(
  'mt-4',
  'flex',
  'flex-wrap',
  'items-center',
  'gap-1',
);
const panelClassName = cn(
  'rounded-lg',
  'border',
  'border-dashed',
  'border-gray-300',
  'bg-gray-50/60',
  'p-3',
  'dark:border-gray-600',
  'dark:bg-gray-800/40',
);
const panelHeadClassName = cn(
  'mb-3',
  'flex',
  'items-center',
  'justify-between',
  'text-sm',
  'font-medium',
);
/** 空容器也要有高度，否则拖不到空列表里（见下方文案里的 emptyInsertThreshold） */
const panelListClassName = cn('min-h-[112px]', 'space-y-2');
const cardGridClassName = cn(
  'grid',
  'grid-cols-1',
  'gap-3',
  'sm:grid-cols-2',
  'xl:grid-cols-4',
);
const cardClassName = cn(
  'cursor-move',
  'rounded-lg',
  'border',
  'border-gray-200',
  'bg-white',
  'p-4',
  'shadow-sm',
  'dark:border-gray-700',
  'dark:bg-gray-900',
);
const cardTitleClassName = cn('text-xs', 'text-gray-500', 'dark:text-gray-400');
const cardValueClassName = cn(
  'mt-1',
  'text-2xl',
  'font-semibold',
  'text-gray-900',
  'dark:text-gray-100',
);
const cardBarClassName = cn(
  'mt-3',
  'h-1',
  'w-full',
  'overflow-hidden',
  'rounded-full',
  'bg-gray-100',
);
const cardBarFillClassName = cn('h-full', 'rounded-full');
const cardBarWidthMap: Record<CardTone, string> = {
  blue: 'w-3/5',
  cyan: 'w-2/5',
  green: 'w-4/5',
  orange: 'w-1/2',
  purple: 'w-2/3',
  red: 'w-1/3',
};
const cardBarColorMap: Record<CardTone, string> = {
  blue: 'bg-blue-500',
  cyan: 'bg-cyan-500',
  green: 'bg-green-500',
  orange: 'bg-orange-500',
  purple: 'bg-purple-500',
  red: 'bg-red-500',
};
const payloadRowClassName = cn(
  'mt-4',
  'flex',
  'flex-wrap',
  'items-center',
  'gap-2',
  'text-sm',
);
const payloadClassName = cn(
  'font-mono',
  'text-xs',
  'text-gray-700',
  'dark:text-gray-300',
);

// ============================================
// 1. 基础列表拖拽
// ============================================

const basicList = ref<DragItem[]>([
  { id: 'mod-1', name: '待办审批', note: '按发起人聚合，默认在第一屏' },
  { id: 'mod-2', name: '数据看板', note: 'GMV / 订单量 / 转化率' },
  { id: 'mod-3', name: '客户列表', note: '带跟进状态与标签筛选' },
  { id: 'mod-4', name: '工单中心', note: '超时未处理置顶提醒' },
  { id: 'mod-5', name: '消息中心', note: '站内信与推送开关' },
  { id: 'mod-6', name: '系统设置', note: '仅管理员可见' },
]);

// ============================================
// 2. 手柄拖拽
// ============================================

const handleList = ref<DragItem[]>([
  {
    id: 'tpl-1',
    name: '月度经营分析',
    note: 'GMV、复购率、客单价三项同比，每月 3 日出稿',
  },
  {
    id: 'tpl-2',
    name: '渠道投放复盘',
    note: '按渠道拆分 ROI，支持导出 Excel 给财务',
  },
  { id: 'tpl-3', name: '库存周报', note: 'SKU 级别周转天数，异常批次高亮' },
  { id: 'tpl-4', name: '客服质检抽样', note: '随机 5% 会话，附带评分分布' },
  {
    id: 'tpl-5',
    name: '大促作战地图',
    note: '预热 / 爆发 / 返场三阶段指标对照',
  },
]);

// ============================================
// 3. 两个列表互拖
// ============================================

/**
 * 跨容器互拖靠的是两边一模一样的 `group.name`。
 * 这里把它提成模块级常量，而不是在模板里写 `:group="{ name: 'x' }"`：
 * 字面量每次渲染都是新对象，库对 options 做深比较后会重新逐个 `sortable.option(...)` 回灌，
 * 白折腾不说，拖拽中途重渲染还可能出现配置短暂不一致。
 */
const panelGroup: NonNullable<Options['group']> = {
  name: 'drag-layout-panel',
  pull: true,
  put: true,
};

const candidateInitial: PanelItem[] = [
  { id: 'card-1', name: '销售额趋势', hint: '近 30 天折线' },
  { id: 'card-2', name: '订单构成', hint: '新老客占比' },
  { id: 'card-3', name: '退货原因', hint: 'Top 8 词云' },
  { id: 'card-4', name: '门店排名', hint: '按坪效排序' },
  { id: 'card-5', name: '库存水位', hint: '低于安全线告警' },
];

const chosenInitial: PanelItem[] = [
  { id: 'card-6', name: '实时大盘', hint: '每 10 秒刷新' },
  { id: 'card-7', name: '流量来源', hint: '自然 / 付费拆分' },
];

const candidateList = ref<PanelItem[]>([...candidateInitial]);
const chosenList = ref<PanelItem[]>([...chosenInitial]);

function resetPanelLists() {
  candidateList.value = [...candidateInitial];
  chosenList.value = [...chosenInitial];
}

// ============================================
// 4. 栅格卡片布局拖拽
// ============================================

const cardInitial: StatCard[] = [
  {
    id: 'stat-1',
    title: '今日 GMV',
    value: '¥ 1,284,300',
    delta: '+12.4%',
    tone: 'blue',
  },
  {
    id: 'stat-2',
    title: '支付订单',
    value: '8,642',
    delta: '+5.1%',
    tone: 'green',
  },
  {
    id: 'stat-3',
    title: '客单价',
    value: '¥ 148.6',
    delta: '-2.3%',
    tone: 'orange',
  },
  {
    id: 'stat-4',
    title: '新客数',
    value: '1,975',
    delta: '+21.8%',
    tone: 'purple',
  },
  {
    id: 'stat-5',
    title: '退款率',
    value: '1.32%',
    delta: '+0.18pt',
    tone: 'red',
  },
  {
    id: 'stat-6',
    title: '活跃门店',
    value: '412 / 430',
    delta: '+6',
    tone: 'cyan',
  },
];

const cardList = ref<StatCard[]>([...cardInitial]);

function resetCardOrder() {
  cardList.value = [...cardInitial];
}

// ============================================
// 5. 约束与开关
// ============================================

const lockedSelector = '.drag-locked';
const lockedClassName = cn(
  'drag-locked',
  'border-red-200',
  'bg-red-50/70',
  'dark:border-red-900',
  'dark:bg-red-900/15',
);

const ruleList = ref<RuleItem[]>([
  { id: 'rule-1', name: '置顶公告', locked: true },
  { id: 'rule-2', name: '活动 Banner', locked: false },
  { id: 'rule-3', name: '新人指南', locked: false },
  { id: 'rule-4', name: '版本说明', locked: false },
  { id: 'rule-5', name: '常见问题', locked: false },
]);

/** 开关演示 `disabled`：整列表冻结，任何一行都拖不起来 */
const dragDisabled = ref(false);

const lastOrder = ref('');
const lastMove = ref('');
const endCount = ref(0);

/**
 * 纯本地状态，这里没有任何网络请求：`onEnd` 只是把当前 id 顺序拼成字符串塞进一个 ref，
 * 真实项目里这一步才换成把 payload POST 给排序接口。
 *
 * 顺序能直接读 ref，是因为 Sortable 先派发 `update`（vue-draggable-plus 在 update 里已经把
 * `v-model` 的数组按下标 splice 好），再派发 `end`。所以在 end 里再手动 move 一次是重复劳动，
 * 两次重排叠加还会把顺序排乱 —— 这是这批示例里最容易踩的一个坑。
 */
function handleEnd(event: DraggableEvent) {
  lastOrder.value = ruleList.value.map((item) => item.id).join(',');
  lastMove.value = `${String(event.oldIndex)} → ${String(event.newIndex)}`;
  endCount.value += 1;
}

function toggleLocked(item: RuleItem) {
  item.locked = !item.locked;
}
</script>

<template>
  <div :class="containerClassName">
    <Card title="基础列表拖拽" variant="borderless">
      <div :class="descClassName">
        `VueDraggable` 用 `v-model`
        直接接管数组：松手时库已经在老下标和新下标之间把元素 splice
        过一次，所以「看到的顺序」和「数据的顺序」是同一份状态，不需要在回调里手动重排。
        要守的只有一条：`v-for` 的 key 必须是稳定 id —— 写成 index 时，Sortable
        搬的是真实 DOM 节点、Vue 按位置打补丁，结果就是错位闪一下，
        行内若有输入框还会把内容跟着跑。下面这排标签跟着 `v-model`
        实时变，可以直接对照。
      </div>
      <VueDraggable
        v-model="basicList"
        :animation="150"
        ghost-class="drag-ghost"
        chosen-class="drag-chosen"
        :class="listClassName"
      >
        <div
          v-for="(item, index) in basicList"
          :key="item.id"
          :class="dragRowClassName"
        >
          <span :class="indexClassName">{{ index + 1 }}</span>
          <span :class="titleClassName">{{ item.name }}</span>
          <span :class="noteClassName">{{ item.note }}</span>
        </div>
      </VueDraggable>
      <div :class="orderRowClassName">
        <span :class="noteClassName">当前顺序（来自 v-model，实时）：</span>
        <Tag v-for="(item, index) in basicList" :key="item.id" color="blue">
          {{ index + 1 }}. {{ item.name }}
        </Tag>
      </div>
    </Card>

    <Card title="手柄拖拽" variant="borderless">
      <div :class="descClassName">
        `handle: '.drag-grip'` 把拖拽触发区收敛到左边的 ⠿：行内文字保持可选中，
        划词复制、双击选词都正常，不会出现「想抄一句话却把整行拖走」。
        反过来，整行可拖的写法只适合没有文本价值的纯条目；给整行加 `select-none`
        是第三种做法，代价是内容再也复制不了。三种取舍在带文字的列表里差别最大。
      </div>
      <VueDraggable
        v-model="handleList"
        handle=".drag-grip"
        :animation="150"
        ghost-class="drag-ghost"
        chosen-class="drag-chosen"
        :class="listClassName"
      >
        <div
          v-for="item in handleList"
          :key="item.id"
          :class="gripRowClassName"
        >
          <span :class="gripClassName" title="按住此处拖动整行">⠿</span>
          <div class="min-w-0">
            <div :class="titleClassName">{{ item.name }}</div>
            <div :class="selectableClassName">{{ item.note }}</div>
          </div>
        </div>
      </VueDraggable>
    </Card>

    <Card title="两个列表互拖" variant="borderless">
      <div :class="toolbarClassName">
        <span :class="descClassName">
          两边共用同一个 `group`（名字必须相同），条目就能左右互转：跨容器时
          Sortable 先派发 `remove` /
          `add`，库按这两个事件把源数组删掉、往目标数组插入，所以两个 `v-model`
          各自都是准的，不需要手工同步。注意空容器要给高度（这里给了
          `min-h-[112px]`）—— 塌成 0
          高的空列表接不住落点，`emptyInsertThreshold`（默认 5px）根本够不着。
        </span>
        <Button size="sm" @click="resetPanelLists">还原示例数据</Button>
      </div>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div :class="panelClassName">
            <div :class="panelHeadClassName">
              <span>待选组件</span>
              <Tag color="orange">{{ candidateList.length }} 项</Tag>
            </div>
            <VueDraggable
              v-model="candidateList"
              :group="panelGroup"
              :animation="150"
              ghost-class="drag-ghost"
              chosen-class="drag-chosen"
              :class="panelListClassName"
            >
              <div
                v-for="item in candidateList"
                :key="item.id"
                :class="dragRowClassName"
              >
                <span :class="titleClassName">{{ item.name }}</span>
                <span :class="noteClassName">{{ item.hint }}</span>
              </div>
            </VueDraggable>
          </div>
        </div>
        <div>
          <div :class="panelClassName">
            <div :class="panelHeadClassName">
              <span>已选上墙</span>
              <Tag color="green">{{ chosenList.length }} 项</Tag>
            </div>
            <VueDraggable
              v-model="chosenList"
              :group="panelGroup"
              :animation="150"
              ghost-class="drag-ghost"
              chosen-class="drag-chosen"
              :class="panelListClassName"
            >
              <div
                v-for="item in chosenList"
                :key="item.id"
                :class="
                  cn(dragRowClassName, 'border-green-200 dark:border-green-800')
                "
              >
                <span :class="titleClassName">{{ item.name }}</span>
                <span :class="noteClassName">{{ item.hint }}</span>
              </div>
            </VueDraggable>
          </div>
        </div>
      </div>
    </Card>

    <Card title="栅格卡片布局拖拽" variant="borderless">
      <div :class="toolbarClassName">
        <span :class="descClassName">
          把上面那套配置原样搬进响应式栅格就行：`animation`、`ghostClass`（要跨容器互拖再加同一个
          `group`）一个都不用改 —— Sortable
          只认「容器的直接子元素」这一件事，卡片到底怎么摆是 CSS
          的事，所以从列表换成网格，改的只有容器类名。也因此这层 `VueDraggable`
          必须自己就是栅格容器（它默认渲染一个 `div`，`tag`
          可换），卡片外面再套一层 wrapper 就拖不动了。
        </span>
        <Button size="sm" @click="resetCardOrder">还原卡片顺序</Button>
      </div>
      <VueDraggable
        v-model="cardList"
        :animation="150"
        ghost-class="drag-ghost"
        chosen-class="drag-chosen"
        :class="cardGridClassName"
      >
        <div
          v-for="(card, index) in cardList"
          :key="card.id"
          :class="cardClassName"
        >
          <div class="flex items-center justify-between">
            <span :class="cardTitleClassName">{{ card.title }}</span>
            <Tag>{{ index + 1 }}</Tag>
          </div>
          <div :class="cardValueClassName">{{ card.value }}</div>
          <div :class="cardBarClassName">
            <div
              :class="
                cn(
                  cardBarFillClassName,
                  cardBarWidthMap[card.tone],
                  cardBarColorMap[card.tone],
                )
              "
            ></div>
          </div>
          <div :class="noteClassName">环比 {{ card.delta }}</div>
        </div>
      </VueDraggable>
    </Card>

    <Card title="约束与开关" variant="borderless">
      <div :class="toolbarClassName">
        <span :class="descClassName">
          三个约束同时生效：`disabled` 由开关驱动，整列表冻结；`filter`
          用选择器把「置顶公告」排除在 拖拽之外（其余行照样能越过它）；`onEnd`
          把落定后的 id 顺序写进下面那行等宽字， 也就是你真正要发给后端的那串
          payload。这里没有任何网络请求，纯本地 ref，刷新即回初始顺序。
        </span>
        <span class="flex items-center gap-2">
          <span :class="noteClassName">整列表禁用</span>
          <Switch
            :model-value="dragDisabled"
            @update:model-value="(v: boolean) => (dragDisabled = v)"
          />
        </span>
      </div>
      <VueDraggable
        v-model="ruleList"
        :disabled="dragDisabled"
        :filter="lockedSelector"
        :prevent-on-filter="false"
        :animation="150"
        ghost-class="drag-ghost"
        chosen-class="drag-chosen"
        :class="listClassName"
        @end="handleEnd"
      >
        <div
          v-for="(item, index) in ruleList"
          :key="item.id"
          :class="
            cn(
              rowClassName,
              item.locked && lockedClassName,
              !item.locked && 'cursor-move',
            )
          "
        >
          <span :class="indexClassName">{{ index + 1 }}</span>
          <span :class="titleClassName">{{ item.name }}</span>
          <Tag v-if="item.locked" color="red">filter 命中 · 拖不起</Tag>
          <Tag v-else color="green">可拖动</Tag>
          <Button size="sm" @click="toggleLocked(item)">
            {{ item.locked ? '解锁' : '锁定' }}
          </Button>
        </div>
      </VueDraggable>
      <div :class="payloadRowClassName">
        <span :class="noteClassName">onEnd 得到的顺序（第 {{ endCount }} 次落定）：</span>
        <span :class="payloadClassName">
          {{ lastOrder || '还没拖过，先把上面的行拖一下' }}
        </span>
        <span v-if="lastMove" :class="noteClassName">下标 {{ lastMove }}</span>
        <Tag v-if="dragDisabled" color="volcano">
          disabled: true，现在拖不动
        </Tag>
      </div>
      <div :class="descClassName">
        两个容易忽略的点：`preventOnFilter` 默认是 `true`，它会对被 `filter`
        命中的元素 `preventDefault()`，行里的「解锁」按钮就跟着点了没反应 ——
        这里显式设成 `false`， 条目依然拖不起来，但按钮正常。另外 `disabled` /
        `filter` 改值不需要重建拖拽实例， 库对 options 做深比较后逐项
        `sortable.option()` 回灌，开关一拨立刻生效。
      </div>
    </Card>
  </div>
</template>

<style scoped>
/**
 * `ghostClass` / `chosenClass` 传的是类名字符串，Sortable 把它们加在被拖的那个真实节点上。
 * 跨容器搬运时这个节点会被挪到另一侧列表的 DOM 里，而 scoped 样式靠 `data-v-*` 属性命中，
 * 所以这里用 `:deep()` 退成普通选择器才稳。
 */
:deep(.drag-ghost) {
  opacity: 0.4;
  outline: 1px dashed rgb(148 163 184);
  outline-offset: 2px;
}

:deep(.drag-chosen) {
  border-color: rgb(96 165 250);
  box-shadow: 0 4px 12px rgb(0 0 0 / 12%);
}
</style>
