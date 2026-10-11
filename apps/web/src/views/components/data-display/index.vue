<script setup lang="ts">
import { computed, h, ref } from 'vue';

import { cn } from '@antdv/shared/cn';
import { Icon } from '@iconify/vue';
import audioUrl from '~/assets/images/audio.jpg';
import excelUrl from '~/assets/images/excel.jpg';
import imgUrl from '~/assets/images/img.jpg';
import logoUrl from '~/assets/images/logo.png';
import pptUrl from '~/assets/images/ppt.jpg';

/**
 * 数据展示类组件示例。
 *
 * 与「通用」那页（表单控件）分开：这一页全是"把已经拿到的数据摆出来"的组件，
 * 统一用同一份订单/用户假数据，读起来才像同一个系统的不同视图，
 * 而不是各组件各自为政的官方 demo 拼接。
 *
 * 图片一律用 `src/assets/images` 里的本地图：示例页要进 e2e 巡检，
 * 外链图床（via.placeholder / picsum）在内网和 CI 里都会变成破图。
 */

const containerClassName = cn('space-y-4');
const hintClassName = cn(
  'mb-3',
  'text-xs',
  'text-gray-500',
  'dark:text-gray-400',
);

const descData = {
  amount: '1,280.00',
  creator: '张伟',
  department: '研发中心 / 平台组',
  id: 'SO-20261010-0042',
  remark: '客户催得急，优先发货并随单附发票。',
  status: '待发货',
  time: '2026-10-10 14:32:08',
};

const statisticLoading = ref(false);
const growth = ref(12.4);

const segmentedSize = ref<'large' | 'middle' | 'small'>('middle');
const segmentedValue = ref('列表');

const activeTab = ref('1');
const tabPanes = ref([
  { key: '1', label: '订单详情' },
  { key: '2', label: '物流轨迹' },
  { key: '3', label: '售后记录' },
]);
let tabSeed = 3;

/**
 * antdv-next 1.6 的 Tabs 是 `items` 数据驱动的：文档里没有 `a-tab-pane` 这一档，
 * 也没有 `add` 事件 —— 新增与关闭都从 `edit(key | MouseEvent, action)` 出来。
 * 写成 `@add` 不会报错，只会安静地什么都不做（第一版就是这么写的）。
 */
const tabItems = computed(() =>
  tabPanes.value.map((pane) => ({
    content: h('div', { class: 'py-4 text-sm' }, [
      '当前页签：',
      h('code', pane.label),
      `（key = ${pane.key}）`,
    ]),
    key: pane.key,
    label: pane.label,
  })),
);

const cardTabItems = [
  {
    content: h('div', { class: 'py-4 text-sm' }, [
      h('code', 'type="card"'),
      ' 带边框、不带新增按钮，适合纯切换。',
    ]),
    key: 'card-1',
    label: '卡片风格',
  },
  {
    content: h('div', { class: 'py-4 text-sm' }, [
      '外壳里的多标签页是另一套东西（',
      h('code', 'stores/modules/tabs'),
      '），和这里的页签示例互不相干。',
    ]),
    key: 'card-2',
    label: '说明',
  },
];

function addTab() {
  tabSeed += 1;
  const key = `new-${tabSeed}`;
  tabPanes.value.push({ key, label: `新标签 ${tabSeed}` });
  activeTab.value = key;
}

function removeTab(targetKey: string) {
  const index = tabPanes.value.findIndex((pane) => pane.key === targetKey);
  if (index === -1) return;
  tabPanes.value.splice(index, 1);
  // 关掉的是当前页时，把选中态挪到相邻页，否则内容区会空一块
  if (activeTab.value === targetKey) {
    const next = tabPanes.value[Math.max(0, index - 1)];
    activeTab.value = next?.key ?? '';
  }
}

function onTabEdit(
  target: KeyboardEvent | MouseEvent | string,
  action: 'add' | 'remove',
) {
  if (action === 'add') {
    addTab();
    return;
  }
  removeTab(String(target));
}

const stepCurrent = ref(1);
/** antdv-next 的步骤条是数据驱动的（`items`），没有 `<a-step>` 这种子组件写法 */
const stepItems = [
  { content: '订单已提交，等待支付', title: '提交订单' },
  { content: '支付宝已扣款 ￥1,280.00', title: '支付' },
  { content: '仓库拣货完成，等待出库', title: '出库' },
  { content: '客户签收，工单关闭', title: '签收' },
];

const timelineItems = [
  { color: 'gray', text: '2026-10-08 09:12 创建订单' },
  { color: 'blue', text: '2026-10-09 16:40 支付完成（支付宝）' },
  { color: 'green', text: '2026-10-10 11:05 仓库拣货完成' },
  { color: 'red', text: '2026-10-10 14:32 缺货，等待补货' },
];

const images = [audioUrl, excelUrl, imgUrl, pptUrl];
</script>

<template>
  <div :class="containerClassName">
    <a-card title="Descriptions 描述列表" variant="borderless">
      <p :class="hintClassName">
        详情页的骨架。<code>bordered</code> + <code>:span</code> 就能排出不规则的字段网格。
      </p>
      <a-descriptions :column="3" bordered>
        <a-descriptions-item label="订单号">{{ descData.id }}</a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag color="orange">{{ descData.status }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="创建时间">{{ descData.time }}</a-descriptions-item>
        <a-descriptions-item label="创建人">{{ descData.creator }}</a-descriptions-item>
        <a-descriptions-item label="所属部门">{{ descData.department }}</a-descriptions-item>
        <a-descriptions-item label="金额">
          <span class="font-semibold">￥{{ descData.amount }}</span>
        </a-descriptions-item>
        <a-descriptions-item :span="3" label="备注">
          {{ descData.remark }}
        </a-descriptions-item>
      </a-descriptions>
    </a-card>

    <a-card title="Statistic 统计数值" variant="borderless">
      <div class="flex flex-wrap items-center gap-8">
        <a-statistic
          title="订单金额"
          :value="1280"
          :precision="2"
          :loading="statisticLoading"
          prefix="￥"
        />
        <a-statistic
          title="周增长率"
          :value="growth"
          :precision="2"
          :value-style="growth < 0 ? { color: '#cf1322' } : undefined"
        >
          <template #suffix>
            <span class="inline-flex items-center">
              %
              <Icon
                class="ml-1"
                :icon="growth < 0 ? 'carbon:chart-line-data' : 'carbon:arrow-up'"
              />
            </span>
          </template>
        </a-statistic>
        <a-statistic title="活跃用户" :value="112_890" suffix="/ 人" />
        <a-button @click="statisticLoading = !statisticLoading">
          切换 loading
        </a-button>
      </div>
    </a-card>

    <a-card title="Segmented 分段控制器" variant="borderless">
      <div class="flex flex-wrap items-center gap-6">
        <a-segmented v-model:value="segmentedValue" :size="segmentedSize" :options="['列表', '看板', '甘特图']" />
        <a-segmented :options="['默认', { disabled: true, label: '禁用项' }]" />
        <a-radio-group v-model:value="segmentedSize" button-style="solid" size="small">
          <a-radio-button value="small">small</a-radio-button>
          <a-radio-button value="middle">middle</a-radio-button>
          <a-radio-button value="large">large</a-radio-button>
        </a-radio-group>
      </div>
    </a-card>

    <a-card title="Tabs 标签页" variant="borderless">
      <p :class="hintClassName">
        <code>editable-card</code> 用来做"可增删的视图页签"，关闭当前页时选中态要自己挪。
      </p>
      <a-tabs
        v-model:active-key="activeTab"
        :items="tabItems"
        type="editable-card"
        @edit="onTabEdit"
      />
      <a-tabs :items="cardTabItems" class="mt-4" type="card" />
    </a-card>

    <a-card title="Collapse 折叠面板" variant="borderless">
      <a-collapse accordion default-active-key="1">
        <a-collapse-panel key="1" header="为什么菜单是唯一数据源">
          路由表由文件约定生成，但"能不能进、叫什么、给不给看"都回到菜单接口，
          这样后台改配置就能下线一个页面，不必发版。
        </a-collapse-panel>
        <a-collapse-panel key="2" header="为什么示例页不写内边距">
          内边距归布局的滚动容器统一提供（见 <code>layouts/index.vue</code> 的
          <code>view-class</code>），页面再写一层就会出现 32px 的双份留白。
        </a-collapse-panel>
        <a-collapse-panel key="3" header="暗黑模式怎么对色">
          强调色用 <code>*-ant-primary</code> 这一类主题 token，中性色成对写
          <code>dark:</code>，剩下的交给偏好设置。
        </a-collapse-panel>
      </a-collapse>
    </a-card>

    <a-card title="Timeline 时间线" variant="borderless">
      <div class="flex flex-wrap gap-10">
        <a-timeline>
          <a-timeline-item
            v-for="item in timelineItems"
            :key="item.text"
            :color="item.color"
          >
            {{ item.text }}
          </a-timeline-item>
        </a-timeline>
        <a-timeline mode="alternate">
          <a-timeline-item v-for="item in timelineItems" :key="`alt-${item.text}`">
            {{ item.text }}
          </a-timeline-item>
        </a-timeline>
      </div>
    </a-card>

    <a-card title="Steps 步骤条" variant="borderless">
      <p :class="hintClassName">
        <code>items</code> 数据驱动，<code>v-model:current</code> 直接回写当前步。
      </p>
      <a-steps v-model:current="stepCurrent" :items="stepItems" size="small" />
      <div class="mt-4 flex items-center gap-2">
        <a-button
          :disabled="stepCurrent === 0"
          @click="stepCurrent = Math.max(0, stepCurrent - 1)"
        >
          上一步
        </a-button>
        <a-button
          type="primary"
          :disabled="stepCurrent === stepItems.length - 1"
          @click="stepCurrent = Math.min(stepItems.length - 1, stepCurrent + 1)"
        >
          下一步
        </a-button>
        <span :class="hintClassName">当前第 {{ stepCurrent + 1 }} 步</span>
      </div>
    </a-card>

    <a-card title="Tag、Badge、Avatar 与 Empty" variant="borderless">
      <div class="flex flex-wrap items-center gap-6">
        <div class="flex items-center gap-2">
          <a-tag color="processing">进行中</a-tag>
          <a-tag color="success">已完成</a-tag>
          <a-tag>closable 演示</a-tag>
        </div>
        <div class="flex items-center gap-4">
          <a-badge :count="12">
            <a-button>待办</a-button>
          </a-badge>
          <a-badge dot>
            <a-button>消息</a-button>
          </a-badge>
          <a-badge status="processing" text="运行中" />
        </div>
        <div class="flex items-center gap-2">
          <!-- 超出 max.count 的头像收进 "+N"，悬浮用 popover 展开 -->
          <a-avatar-group :max="{ count: 3 }">
            <a-avatar class="bg-ant-primary text-white">Z</a-avatar>
            <a-avatar :src="logoUrl" />
            <a-avatar>W</a-avatar>
            <a-avatar>L</a-avatar>
            <a-avatar>X</a-avatar>
          </a-avatar-group>
        </div>
      </div>
      <div class="mt-4 flex items-center gap-6">
        <a-empty class="flex-1" description="暂无数据（列表筛选后为空的兜底）" />
      </div>
    </a-card>

    <a-card title="Image 图片预览" variant="borderless">
      <p :class="hintClassName">
        图源是仓库里的本地文件：示例页会进三引擎巡检，外链图床在内网只剩破图。
      </p>
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <a-image
          v-for="src in images"
          :key="src"
          :height="128"
          :src="src"
          :width="176"
        />
      </div>
    </a-card>
  </div>
</template>
