<script setup lang="ts">
import type {
  DescriptionInstance,
  DescriptionItem,
  DescriptionLayout,
  DescriptionSize,
} from '@antdv/common-ui';

import { computed, h, ref } from 'vue';

import { Card, Divider, Segmented, Space, Tag } from '@antdv/common-ui';
import { message } from '@antdv/popup-ui';
import { Button, Switch } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';
import { breakpointsTailwind, useBreakpoints, useClipboard } from '@vueuse/core';
import certUrl from '~/assets/images/img.jpg';
import avatarUrl from '~/assets/images/logo.png';
import { Description } from '@antdv/common-ui';

defineOptions({ name: 'ComponentsDescription' });

/**
 * 描述列表（详情列表）示例页 —— 用的是仓库自研的 `Description` 业务组件
 * （`src/components/business/Description`，内部包了一层 common-ui 的
 * `Descriptions` / `DescriptionsItem`），不是裸的通用描述列表。
 *
 * 组件是**配置驱动**的：`schema`（`DescriptionItem[]`）定义「标签 + 值 + 渲染方式」，
 * `data`（`Recordable`）提供字段值；每行的列数由 `column` 决定，
 * 值插槽名就是 `item.field`、标签插槽名是 `${item.field}-label`。
 *
 * 本页数据全部来自页面内的 `ref` 常量（模拟接口返回的详情对象），
 * 没有调用任何后端接口 —— 详情页这种场景先演示渲染，再谈取数。
 */

const { copy } = useClipboard();

const containerClassName = cn('space-y-6');
const hintClassName = cn('mb-3 text-xs text-gray-500 dark:text-gray-400');
const toolbarClassName = cn('mb-4 flex flex-wrap items-center gap-x-6 gap-y-3');

/* ── 1. 基础描述列表 ──────────────────────────────────────────── */

const userInfo = ref({
  userId: 'USR20261010001',
  username: 'zhangsan',
  realName: '张伟',
  department: '研发中心 / 平台组',
  position: '高级前端工程师',
  birthday: '1996-05-15',
  hireDate: '2024-01-15 10:30:00',
  address: '北京市朝阳区建国路 88 号 SOHO 现代城 A 座 1208',
  website: '',
});

/**
 * `type` 是组件内置的值类型：`date` / `datetime` 走 dayjs 格式化
 * （可用 `dateFormat` 覆盖模板），`image` / `images` 渲染可预览的 `Image`，
 * `dict` 走字典 store，其余按纯文本。`span` 控制占几列，
 * `labelStyle` / `contentStyle` 是逐项样式。
 */
const basicSchema: DescriptionItem[] = [
  { field: 'userId', label: '用户编号' },
  { field: 'username', label: '登录账号' },
  { field: 'realName', label: '姓名' },
  { field: 'department', label: '所属部门' },
  { field: 'position', label: '岗位' },
  { field: 'birthday', label: '出生日期', type: 'date' },
  // 占满整行的项必须正好落在新起的一行：跨行截断会在控制台告警（行内 `span`
  // 之和不能超过 `column`），所以它前面得是 3 的倍数个单元格。
  {
    field: 'address',
    label: '通信地址',
    span: 3,
    labelStyle: { fontWeight: '600' },
  },
  { field: 'hireDate', label: '入职时间', type: 'datetime' },
  { field: 'website', label: '个人主页' },
];

/* ── 2. 值渲染与插槽 ──────────────────────────────────────────── */

const profileData = ref({
  avatar: avatarUrl,
  status: '在职',
  certificates: [avatarUrl, certUrl],
  department: '研发中心 / 平台组',
  email: 'zhangsan@example.com',
  skills: ['Vue 3', 'TypeScript', 'Vite', 'Tailwind CSS'],
});

const statusColorMap: Record<string, string> = {
  在职: 'green',
  休假: 'orange',
  离职: 'red',
};

/** 演示「插槽接管值渲染」：邮箱用可复制的 code 文本呈现 */
function copyEmail(text: string) {
  copy(text);
  message.success(`已复制 ${text}`);
}

/**
 * 同一份 schema 里的四种取值优先级（源码 `renderValue`）：
 * 具名插槽 `#field` > `render` 函数 > `type` 内置渲染 > 文本。
 */
const profileSchema: DescriptionItem[] = [
  { field: 'avatar', label: '头像', type: 'image', imageSize: 64 },
  {
    field: 'status',
    label: '在职状态',
    render: (value) =>
      h(Tag, { color: statusColorMap[String(value)] ?? 'default' }, () =>
        String(value),
      ),
  },
  { field: 'certificates', label: '资质证书', type: 'images', imageSize: 48 },
  { field: 'department', label: '所属部门' },
  // 下面两项交给插槽：schema 里只留字段与标签
  { field: 'email', label: '邮箱' },
  { field: 'skills', label: '技能栈' },
];

/* ── 3. 动态切换（编辑态 / 只读态） ───────────────────────────── */

const orderInfo = ref({
  orderNo: 'SO-20261010-0042',
  customerName: '李静',
  mobile: '13812348888',
  idCard: '11010119960515001X',
  invoiceTitle: '北京示例科技有限公司',
  payTime: '2026-10-10 16:30:00',
  deliveryNote: '',
});

const descRef = ref<DescriptionInstance>();
const showSensitive = ref(true);
const masked = ref(true);
const loading = ref(false);
const layout = ref<DescriptionLayout>('horizontal');

/** 数据源是 computed：改 `masked` 就是改字段值，组件跟着响应 */
const orderData = computed(() => {
  const { mobile, idCard, ...rest } = orderInfo.value;
  return {
    ...rest,
    idCard: masked.value
      ? `${idCard.slice(0, 4)}**********${idCard.slice(-4)}`
      : idCard,
    mobile: masked.value
      ? `${mobile.slice(0, 3)}****${mobile.slice(-4)}`
      : mobile,
  };
});

/** schema 也放进 computed：`show: false` 的项会被组件直接过滤掉 */
const orderSchema = computed<DescriptionItem[]>(() => [
  { field: 'orderNo', label: '订单编号' },
  { field: 'customerName', label: '客户姓名' },
  { field: 'mobile', label: '手机号' },
  { field: 'idCard', label: '身份证号', show: showSensitive.value },
  { field: 'invoiceTitle', label: '发票抬头', show: showSensitive.value },
  { field: 'payTime', label: '支付时间', type: 'datetime' },
  { field: 'deliveryNote', label: '配送备注', span: 2 },
]);

function refreshOrder() {
  loading.value = true;
  window.setTimeout(() => {
    orderInfo.value.payTime = '2026-10-12 09:05:32';
    orderInfo.value.deliveryNote = '工作日 18:00 前送达，随单附发票';
    loading.value = false;
    message.success('详情已刷新（本页 setTimeout 模拟，无后端请求）');
  }, 700);
}

/** 组件 defineExpose 出来的实例方法：只读模式下 setData 会告警，只有 getData 可用 */
function printData() {
  const data = descRef.value?.getData();
  message.info(
    `getData() 读到 ${Object.keys(data || {}).length} 个字段：${Object.keys(
      data || {},
    ).join('、')}`,
  );
}

/* ── 4. 响应式列数与分组 ──────────────────────────────────────── */

const orderBaseInfo = ref({
  orderNo: 'SO-20261010-0042',
  source: '企业采购平台',
  customerName: '李静',
  receiver: '王强',
  deliveryMethod: '专线配送',
  address: '上海市浦东新区世纪大道 100 号 环球金融中心 58 层',
  createTime: '2026-10-09 11:20:45',
});

const amountInfo = ref({
  totalAmount: 18_999,
  discountAmount: 2000,
  freight: 0,
  tax: 1117.91,
  payAmount: 18_116.91,
  paymentMethod: '企业网银',
  settlementCycle: '月结 30 天',
});

const breakpoints = useBreakpoints(breakpointsTailwind);
const columnMode = ref<'1' | '2' | '3' | 'auto'>('auto');

/**
 * `column` 的类型就是 `number`（源码里没有 antd 那种断点对象），
 * 所以响应式列数在页面这层按断点算好再传进去。
 */
const column = computed(() => {
  if (columnMode.value !== 'auto') return Number(columnMode.value);
  if (breakpoints.smaller('md').value) return 1;
  if (breakpoints.smaller('xl').value) return 2;
  return 3;
});

/**
 * 响应式列数下 `span` 要跟着算：address 想占满一行，就必须「正好起于一行行首」，
 * 也就是它前面的项数（这里是 6，1/2/3 的公倍数）能被当前 column 整除，
 * 且自己的 span 恰好等于 column。写死 `span: 3` 在 1 列 / 2 列下都会超出本行余量并告警。
 */
const baseInfoSchema = computed<DescriptionItem[]>(() => [
  { field: 'orderNo', label: '订单编号' },
  { field: 'source', label: '订单来源' },
  { field: 'customerName', label: '下单客户' },
  { field: 'receiver', label: '收货人' },
  { field: 'deliveryMethod', label: '配送方式' },
  { field: 'createTime', label: '创建时间', type: 'datetime' },
  { field: 'address', label: '收货地址', span: column.value },
]);

const amountSchema = computed<DescriptionItem[]>(() => [
  {
    field: 'totalAmount',
    label: '商品总额',
    render: (value) => h('span', `¥ ${Number(value).toFixed(2)}`),
  },
  {
    field: 'discountAmount',
    label: '优惠金额',
    render: (value) =>
      h('span', { class: 'text-green-600' }, `- ¥ ${Number(value).toFixed(2)}`),
  },
  {
    field: 'freight',
    label: '运费',
    render: (value) =>
      Number(value) === 0
        ? h(Tag, { color: 'blue' }, () => '包邮')
        : h('span', `¥ ${Number(value).toFixed(2)}`),
  },
  {
    field: 'tax',
    label: '税额',
    render: (value) => h('span', `¥ ${Number(value).toFixed(2)}`),
  },
  {
    field: 'payAmount',
    label: '实付金额',
    // 同样是「不超过本行剩余列数」：1 列时占 1 列，其余占 2 列
    span: Math.min(2, column.value),
    contentStyle: { fontWeight: '600' },
    render: (value) =>
      h(
        'span',
        { class: 'text-red-500 text-base font-semibold' },
        `¥ ${Number(value).toFixed(2)}`,
      ),
  },
  { field: 'paymentMethod', label: '支付方式' },
  { field: 'settlementCycle', label: '结算周期' },
]);

const bordered = ref(true);
const colon = ref(true);
const size = ref<DescriptionSize>('large');
</script>

<template>
  <div :class="containerClassName">
    <Card title="基础描述列表" variant="borderless">
      <p :class="hintClassName">
        由 <code>schema</code>（字段 + 标签 + 渲染方式）与
        <code>data</code>（字段值）两份配置驱动，
        <code>:column="3"</code> 决定每行三列。日期用内置
        <code>type: 'date' / 'datetime'</code> 自动格式化，
        <code>span: 3</code> 让地址占满一行，值为空的
        <code>website</code> 会落到 <code>emptyText</code>（默认
        <code>-</code>）。数据取自本页
        <code>ref</code> 里的假数据，没有请求后端。
      </p>
      <Description
        title="用户基本信息"
        :data="userInfo"
        :schema="basicSchema"
        :column="3"
        bordered
      />
    </Card>

    <Card title="值渲染与插槽" variant="borderless">
      <p :class="hintClassName">
        取值的优先级是：<strong>具名插槽 <code>#字段名</code> → <code>render</code> 函数 →
          <code>type</code> 内置渲染 → 文本</strong>。 头像走 <code>type: 'image'</code>（<code>imageSize</code>
        控制尺寸，可点击预览）， 资质证书走
        <code>type: 'images'</code>，在职状态用 <code>render</code> 返回一个
        <code>Tag</code>，邮箱与技能栈则由页面的 <code>#email</code>、<code>#skills</code>
        插槽接管， 标签也能单独换成 <code>#department-label</code> 插槽。
      </p>
      <Description
        :data="profileData"
        :schema="profileSchema"
        :column="2"
        bordered
        size="small"
      >
        <template #department-label="{ item }">
          <span class="inline-flex items-center gap-1 text-blue-600">
            <Icon icon="carbon:cloud-service-management" />
            {{ item.label }}
          </span>
        </template>

        <template #email="{ value }">
          <span class="inline-flex items-center gap-1">
            <code class="rounded-sm bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:bg-gray-800">{{ value }}</code>
            <Button
              variant="ghost"
              size="icon-sm"
              title="复制"
              @click="copyEmail(String(value))"
            >
              <Icon icon="carbon:copy" />
            </Button>
          </span>
        </template>

        <template #skills="{ value }">
          <Space :size="4" wrap>
            <Tag v-for="skill in value" :key="skill" color="purple">
              {{ skill }}
            </Tag>
          </Space>
        </template>
      </Description>
    </Card>

    <Card title="动态切换（编辑态 / 只读态）" variant="borderless">
      <p :class="hintClassName">
        同一份 <code>schema</code> + <code>data</code> 全程响应式：<code>show: false</code>
        的项被组件过滤掉（身份证、发票抬头），把 <code>data</code> 换成脱敏后的
        <code>computed</code> 就等于切换了字段值，<code>loading</code>
        为真时组件切到自己那层转圈占位。 组件是只读的，实例上只暴露
        <code>getData()</code>（<code>setData()</code> 会告警）。
      </p>

      <div :class="toolbarClassName">
        <span class="inline-flex items-center gap-2">
          <Switch
            :model-value="showSensitive"
            @update:model-value="(v: any) => (showSensitive = v === true)"
          />
          <span class="text-sm">显示敏感字段</span>
        </span>
        <span class="inline-flex items-center gap-2">
          <Switch
            :model-value="masked"
            @update:model-value="(v: any) => (masked = v === true)"
          />
          <span class="text-sm">手机号 / 身份证脱敏</span>
        </span>
        <Segmented
          v-model:value="layout"
          :options="[
            { label: '水平', value: 'horizontal' },
            { label: '垂直', value: 'vertical' },
          ]"
        />
        <Button size="sm" :disabled="loading" @click="refreshOrder">
          <Icon
            v-if="loading"
            class="animate-spin"
            icon="svg-spinners:bouncing-ball"
          />
          模拟刷新详情
        </Button>
        <Button size="sm" variant="outline" @click="printData">
          调用 getData()
        </Button>
      </div>

      <Description
        ref="descRef"
        :data="orderData"
        :schema="orderSchema"
        :column="2"
        :loading="loading"
        :layout="layout"
        bordered
      />
    </Card>

    <Card title="响应式列数与分组" variant="borderless">
      <p :class="hintClassName">
        一个业务详情页往往是多个分组的组合：下面用两个
        <code>Description</code>（基础信息 / 金额信息）各自带
        <code>title</code>、各自一份 <code>schema</code>。<code>column</code>
        的声明类型只是
        <code>number</code>，所以「窄屏降列」是在页面这层用断点算出来的 ——
        把窗口拖窄到 <code>md</code> 以下会看到每行从 3 列变 1
        列；<code>bordered</code>、 <code>colon</code>、<code>size</code>（<code>large</code>
        / <code>middle</code> / <code>small</code> 三档，<code>default</code>
        已废弃，等价写法是 <code>large</code>）可实时切换。
      </p>

      <div :class="toolbarClassName">
        <Segmented
          v-model:value="columnMode"
          :options="[
            { label: '自动(响应式)', value: 'auto' },
            { label: '1 列', value: '1' },
            { label: '2 列', value: '2' },
            { label: '3 列', value: '3' },
          ]"
        />
        <Segmented
          v-model:value="size"
          :options="[
            { label: 'large', value: 'large' },
            { label: 'middle', value: 'middle' },
            { label: 'small', value: 'small' },
          ]"
        />
        <span class="inline-flex items-center gap-2">
          <Switch
            :model-value="bordered"
            @update:model-value="(v: any) => (bordered = v === true)"
          />
          <span class="text-sm">bordered</span>
        </span>
        <span class="inline-flex items-center gap-2">
          <Switch
            :model-value="colon"
            @update:model-value="(v: any) => (colon = v === true)"
          />
          <span class="text-sm">colon</span>
        </span>
        <Tag color="blue">当前 column = {{ column }}</Tag>
      </div>

      <Description
        title="基础信息"
        :data="orderBaseInfo"
        :schema="baseInfoSchema"
        :column="column"
        :size="size"
        :bordered="bordered"
        :colon="colon"
      />

      <Divider />

      <Description
        title="金额信息"
        :data="amountInfo"
        :schema="amountSchema"
        :column="column"
        :size="size"
        :bordered="bordered"
        :colon="colon"
      />
    </Card>
  </div>
</template>
