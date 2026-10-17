<script setup lang="ts">
import type { Ref, VNode } from 'vue';

import { h, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';

import {
  Card,
  createLoading,
  EmptyState,
  ErrorBoundary,
  Loading,
  PageSkeleton,
  Space,
  StatusTag,
  TableSkeleton,
  useLoading,
} from '@antdv/common-ui';

import {
  Button,
  Checkbox,
  Input,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { PageLoading } from '@antdv/layouts';
import { Icon } from '@iconify/vue';

import ErrorProneContent from './components/ErrorProneContent.vue';

const containerClassName = cn('space-y-6');

const sectionTitleClassName = cn(
  'mb-3 text-base font-medium text-gray-700 dark:text-gray-300',
);
const hintClassName = cn('text-sm text-gray-500 dark:text-gray-400');
const codeClassName = cn(
  'rounded-sm bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:bg-gray-800',
);
const demoBoxClassName = cn(
  'rounded-lg border border-dashed border-gray-300 bg-gray-50/60 p-4',
  'dark:border-gray-600 dark:bg-gray-900/40',
);
const frameClassName = cn(
  'relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700',
);

/** 旧版「按钮式单选」的观感：RadioGroupItem 藏进 sr-only，label 本身画成按钮段 */
const radioGroupClassName = cn('flex flex-wrap');
const radioOptionClassName = cn(
  'relative m-0 -ms-px flex min-h-9 cursor-pointer items-center justify-center border border-input bg-transparent px-3 py-1.5 text-sm first:ms-0 first:rounded-s-md last:rounded-e-md',
  'has-[[data-state=checked]]:z-10 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary has-[[data-state=checked]]:font-medium has-[[data-state=checked]]:[&>span]:text-primary-foreground',
);

/* ============================================================
 * 计时器登记：示例页全是 setTimeout，离开页面时统一清掉，
 * 免得回来时补触发一次"加载完成"，或把全屏遮罩留在屏幕上。
 * ============================================================ */
const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
let globalLoadingInstance: null | ReturnType<typeof createLoading> = null;

function scheduleTimeout(fn: () => void, duration: number) {
  const timer = setTimeout(() => {
    pendingTimers.delete(timer);
    fn();
  }, duration);
  pendingTimers.add(timer);
  return timer;
}

function cancelScheduled(timer: null | ReturnType<typeof setTimeout>) {
  if (!timer) return;
  clearTimeout(timer);
  pendingTimers.delete(timer);
}

onBeforeUnmount(() => {
  for (const timer of pendingTimers) clearTimeout(timer);
  pendingTimers.clear();
  // 全屏 loading 挂在 body 上，不属于本页面的卸载范围，要显式拆掉
  globalLoadingInstance?.destroy();
  globalLoadingInstance = null;
});

/* ============================================================
 * 1. 骨架屏 —— PageSkeleton / TableSkeleton（本项目封装）
 * ============================================================ */
type SkeletonVariant = 'card' | 'detail' | 'form' | 'page';

const SKELETON_COST = 2600;

const pageSkeletonLoading = ref(true);
const skeletonVariant = ref<SkeletonVariant>('page');
const skeletonRows = ref(4);
const skeletonShowSidebar = ref(false);
const skeletonFinishedAt = ref('');
let skeletonTimer: null | ReturnType<typeof setTimeout> = null;

const loadedRows = [
  { key: 'name', label: '任务名称', value: '订单履约日报' },
  { key: 'owner', label: '负责人', value: '平台工程组' },
  { key: 'cron', label: '调度表达式', value: '0 30 8 * * ?' },
];

/**
 * 开关的 `model-value` 就是骨架屏的显示状态：
 * 打开 → 显示骨架并起一个真实计时，到点自动翻回真实内容；
 * 中途关掉 → 取消计时（否则上一次的延时会在你重新打开后把它提前掐掉），立刻交还内容。
 */
function startPageSkeletonLoad() {
  cancelScheduled(skeletonTimer);
  pageSkeletonLoading.value = true;
  skeletonFinishedAt.value = '';
  skeletonTimer = scheduleTimeout(() => {
    skeletonTimer = null;
    pageSkeletonLoading.value = false;
    skeletonFinishedAt.value = `${SKELETON_COST}ms 后加载完成，骨架已换成真实内容`;
  }, SKELETON_COST);
}

function togglePageSkeleton(checked: boolean) {
  if (checked) {
    startPageSkeletonLoad();
    return;
  }
  cancelScheduled(skeletonTimer);
  skeletonTimer = null;
  pageSkeletonLoading.value = false;
  skeletonFinishedAt.value = '手动结束加载，已直接显示真实内容';
}

const tableSkeletonLoading = ref(true);
let tableSkeletonTimer: null | ReturnType<typeof setTimeout> = null;

function reloadTableSkeleton() {
  cancelScheduled(tableSkeletonTimer);
  tableSkeletonLoading.value = true;
  tableSkeletonTimer = scheduleTimeout(() => {
    tableSkeletonTimer = null;
    tableSkeletonLoading.value = false;
  }, 2000);
}

const tableRows = [
  { key: '1', code: 'JOB-2048', name: '每日营收汇总', count: 128 },
  { key: '2', code: 'JOB-2049', name: '订单索引重建', count: 512 },
  { key: '3', code: 'JOB-2050', name: '短信网关探活', count: 32 },
];

const skeletonTableColumns: {
  dataIndex: 'code' | 'count' | 'name';
  title: string;
}[] = [
  { dataIndex: 'code', title: '任务编号' },
  { dataIndex: 'name', title: '任务名称' },
  { dataIndex: 'count', title: '处理条数' },
];

/** 进页面就补一次真实加载，让"骨架 → 内容"的切换第一眼就能看到 */
onMounted(() => {
  startPageSkeletonLoad();
  reloadTableSkeleton();
});

/* ============================================================
 * 2. 空状态 —— EmptyState（本项目封装）
 * ============================================================ */
const defaultNotices = [
  { key: '1', text: 'v0.4.0 已发布，新增表单设计器' },
  { key: '2', text: '周五 20:00 灰度环境例行停机' },
  { key: '3', text: '权限模型迁移：菜单码不再走本地缓存' },
];

const noticeList = ref([...defaultNotices]);
let noticeSeq = 0;

function clearNoticeList() {
  noticeList.value = [];
}

function restoreNoticeList() {
  noticeList.value = [...defaultNotices];
}

/** 空状态动作插槽的用武之地：把用户从"这里什么都没有"推回有数据的分支 */
function addNotice() {
  noticeSeq += 1;
  noticeList.value = [
    ...noticeList.value,
    {
      key: `new-${noticeSeq}`,
      text: `通过空状态里的按钮新建的第 ${noticeSeq} 条公告`,
    },
  ];
}

/* ============================================================
 * 3. 错误边界 —— ErrorBoundary（本项目封装）
 * ============================================================ */
const boundaryFail = ref(false);
/**
 * ErrorBoundary 与子组件一起重挂。
 *
 * 兜底状态是组件内部的 ref，script setup 没 expose，页面调不到它的 resetError；
 * 所以"开关关掉""点恢复"这些动作在已经崩了的情况下要立刻见效，换 key 重挂边界本身
 * 是最直白的办法（重试那条路径仍然走组件自己的 reset 事件）。
 */
const boundaryKey = ref(0);
const lastBoundaryError = ref('还没有捕获到错误');
const boundaryResetCount = ref(0);

function crashChild() {
  boundaryFail.value = true;
  boundaryKey.value += 1;
}

function healChild() {
  boundaryFail.value = false;
  boundaryKey.value += 1;
}

function handleBoundaryChange(checked: boolean) {
  if (checked) crashChild();
  else healChild();
}

function handleBoundaryError(error: Error) {
  lastBoundaryError.value = error.message;
}

/**
 * 兜底 UI 里那个「重试」按钮调的是 ErrorBoundary 自己的 `resetError()`，
 * 它会顺手 emit 一个 `reset` —— 页面在这里把抛错开关关掉，
 * 于是重新挂载的子组件走成功分支，重试是真的能恢复，而不是再崩一次。
 */
function handleBoundaryReset() {
  boundaryResetCount.value += 1;
  healChild();
  lastBoundaryError.value = '';
}

/* 自定义兜底：fallback 是渲染函数，拿到 error 与 reset */
const customFallbackFail = ref(false);
const customFallbackKey = ref(0);

function customFallback(error: Error, reset: () => void): VNode {
  return h('div', { class: 'flex flex-col items-center gap-3 py-2' }, [
    h('span', { class: 'text-3xl' }, '🛠'),
    h(
      'p',
      {
        class:
          'max-w-md text-center text-sm text-amber-700 dark:text-amber-400',
      },
      `fallback 渲染函数接到的错误：${error.message}`,
    ),
    h(
      'button',
      {
        class: cn(
          'cursor-pointer rounded-md bg-amber-500 px-4 py-1.5',
          'text-sm font-medium text-white transition-colors hover:bg-amber-600',
        ),
        onClick: () => {
          customFallbackFail.value = false;
          reset();
        },
      },
      '回退到本地配置并重挂',
    ),
  ]);
}

function crashWithCustomFallback() {
  customFallbackFail.value = true;
  customFallbackKey.value += 1;
}

/* ============================================================
 * 4. 状态标签 —— StatusTag（本项目封装）
 * ============================================================ */
const jobRows = [
  { key: '1', name: '每日营收汇总', status: 'completed' },
  { key: '2', name: '订单索引重建', status: 'processing' },
  // 后端把枚举数字直出给前端也照样能上色
  { key: '3', name: '月度对账任务', status: '3' },
  { key: '4', name: '历史数据归档', status: 'failed' },
  { key: '5', name: '临时导出任务', status: 'cancelled' },
  { key: '6', name: '风控模型回放', status: 'timeout' },
  // 映射表里没有的原始值：原样显示文案，颜色退回 default
  { key: '7', name: '试验中的新状态', status: 'draft' },
];

const statusTableColumns: {
  dataIndex: 'name' | 'status';
  title: string;
}[] = [
  { dataIndex: 'name', title: '任务' },
  { dataIndex: 'status', title: '状态' },
];

/** 后端枚举直出（'0' ~ '3'）也走同一张映射表 */
const enumCodes = ['0', '1', '2', '3'] as const;

const statusOptions = [
  { label: "'completed'（成功 · 绿）", value: 'completed' },
  { label: "'processing'（进行中 · 蓝）", value: 'processing' },
  { label: "'3'（已挂起 · 橙）", value: '3' },
  { label: "'failed'（失败 · 红）", value: 'failed' },
  { label: "'cancelled'（默认灰）", value: 'cancelled' },
  { label: "'draft'（未命中映射）", value: 'draft' },
];

const rawStatus = ref('processing');

/* ============================================================
 * 5. 加载家族 —— @antdv/loading-ui 的 Loading / 指令 / Hook
 * ============================================================ */
const spinLoading = ref(true);
const spinTip = ref('加载中...');
const spinStyle = ref<'circle' | 'dot' | 'grid'>('circle');

const skeletonActive = ref(false);

const componentLoading = ref(false);
const componentSize = ref<'default' | 'large' | 'small'>('default');
const componentTheme = ref<'dark' | 'light'>('light');

/**
 * key 必须显式传给 `useTemplateRef`：无参写法在这个 Vue 版本里解析不出变量名，
 * `target` 拿到 undefined，`open()` 静默什么都不做（这条就是本页最早"点了没反应"的坑）。
 */
const hookContainerRef = useTemplateRef<HTMLElement>('hookContainerRef');
const hookLoading = useLoading({
  target: () => hookContainerRef.value!,
  body: false,
  tip: 'Hook 控制加载...',
});

const btnLoading1 = ref(false);
const btnLoading2 = ref(false);
const btnLoading3 = ref(false);

/** PageLoading：路由级占位（明暗跟随偏好设置），loading 为 false 时不渲染任何节点 */
const pageLoadingVisible = ref(false);

function togglePageLoading(checked: boolean) {
  pageLoadingVisible.value = checked;
  if (checked) {
    scheduleTimeout(() => {
      pageLoadingVisible.value = false;
    }, 2500);
  }
}

/**
 * 延迟遮罩：请求快于 300ms 时根本不显示 loading，避免"闪一下"。
 * 这里没有后端，用两个真实定时器分别代表"遮罩延迟"与"请求耗时"。
 */
const DELAY = 300;
const delayedLoading = ref(false);
const delayedResult = ref('还没发起请求');
let delayedShowTimer: null | ReturnType<typeof setTimeout> = null;
let delayedRequestTimer: null | ReturnType<typeof setTimeout> = null;

function runDelayedRequest(cost: number) {
  cancelScheduled(delayedShowTimer);
  cancelScheduled(delayedRequestTimer);
  delayedLoading.value = false;
  delayedResult.value = `请求中…（耗时 ${cost}ms，遮罩延迟 ${DELAY}ms）`;

  delayedShowTimer = scheduleTimeout(() => {
    delayedShowTimer = null;
    delayedLoading.value = true;
  }, DELAY);

  delayedRequestTimer = scheduleTimeout(() => {
    delayedRequestTimer = null;
    // 请求先回来时把"还没亮起来的遮罩"取消掉，这就是不闪烁的全部秘密
    cancelScheduled(delayedShowTimer);
    delayedLoading.value = false;
    delayedResult.value =
      cost > DELAY
        ? `请求完成（${cost}ms）：超过 ${DELAY}ms，遮罩出现过`
        : `请求完成（${cost}ms）：快于 ${DELAY}ms，遮罩一次都没闪`;
  }, cost);
}

/** v-loading 指令（main.ts 里 app.directive('loading', vLoading) 注册） */
const directiveLoading = ref(false);
const directiveDarkLoading = ref(false);
const fullscreenDirectiveLoading = ref(false);

function flashDirective(key: 'dark' | 'full' | 'plain') {
  const targetMap = {
    dark: directiveDarkLoading,
    full: fullscreenDirectiveLoading,
    plain: directiveLoading,
  } as Record<'dark' | 'full' | 'plain', Ref<boolean>>;
  const target = targetMap[key];
  target.value = true;
  scheduleTimeout(() => {
    target.value = false;
  }, 2000);
}

function simulateAsync(loadingRef: Ref<boolean>, duration = 2000) {
  loadingRef.value = true;
  scheduleTimeout(() => {
    loadingRef.value = false;
  }, duration);
}

function toggleSpinStyle(style: 'circle' | 'dot' | 'grid') {
  spinStyle.value = style;
}

function triggerComponentLoading() {
  componentLoading.value = true;
  scheduleTimeout(() => {
    componentLoading.value = false;
  }, 2500);
}

function triggerUseLoading() {
  hookLoading.open();
  scheduleTimeout(() => {
    hookLoading.close();
  }, 2500);
}

function triggerBtnLoading(index: number) {
  const refs = [btnLoading1, btnLoading2, btnLoading3];
  const target = refs[index];
  if (target) simulateAsync(target, 2000 + index * 500);
}

function triggerGlobalLoading() {
  globalLoadingInstance = createLoading({
    tip: '正在处理请求，请稍候...',
    theme: 'dark',
    background: 'rgba(0, 0, 0, 0.6)',
  });
  globalLoadingInstance.open();

  scheduleTimeout(() => {
    globalLoadingInstance?.setTip('即将完成...');
  }, 1500);

  scheduleTimeout(() => {
    globalLoadingInstance?.close();
    globalLoadingInstance = null;
  }, 3000);
}
</script>

<template>
  <div :class="containerClassName">
    <Card variant="borderless" title="骨架屏（PageSkeleton / TableSkeleton）">
      <div :class="cn('space-y-8')">
        <div>
          <h4 :class="sectionTitleClassName">
            加载状态切换（开关 → 骨架 → 真实内容）
          </h4>
          <p :class="hintClassName">
            <code :class="codeClassName">PageSkeleton</code>
            用默认插槽承载真实内容，只靠
            <code :class="codeClassName">loading</code>
            一个布尔值决定"给看骨架还是给看内容"。打开开关会起一个 2600ms
            的真实计时，到点自动换成内容；中途关掉立刻交还。
          </p>
          <div class="flex flex-wrap items-center gap-4">
            <Switch
              :model-value="pageSkeletonLoading"
              @update:model-value="(v: any) => togglePageSkeleton(v === true)"
            />
            <span class="text-sm">{{
              pageSkeletonLoading ? '加载中' : '已完成'
            }}</span>
            <RadioGroup
              :model-value="skeletonVariant"
              :class="radioGroupClassName"
              @update:model-value="
                (v: any) => (skeletonVariant = v as SkeletonVariant)
              "
            >
              <label :class="radioOptionClassName">
                <RadioGroupItem value="page" class="sr-only" />
                <span>page</span>
              </label>
              <label :class="radioOptionClassName">
                <RadioGroupItem value="card" class="sr-only" />
                <span>card</span>
              </label>
              <label :class="radioOptionClassName">
                <RadioGroupItem value="form" class="sr-only" />
                <span>form</span>
              </label>
              <label :class="radioOptionClassName">
                <RadioGroupItem value="detail" class="sr-only" />
                <span>detail</span>
              </label>
            </RadioGroup>
            <Input
              class="w-[110px]"
              :max="10"
              :min="1"
              :model-value="String(skeletonRows)"
              type="number"
              @update:model-value="(v: any) => (skeletonRows = Number(v) || 0)"
            />
            <label class="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                :model-value="skeletonShowSidebar"
                @update:model-value="
                  (v: any) => (skeletonShowSidebar = v === true)
                "
              />
              带侧边栏
            </label>
            <span :class="hintClassName">rows 与侧边栏只在 page 变体生效</span>
          </div>
          <p v-if="skeletonFinishedAt" :class="cn(hintClassName, 'mt-2')">
            {{ skeletonFinishedAt }}
          </p>

          <div :class="cn(frameClassName, 'mt-4')">
            <PageSkeleton
              :loading="pageSkeletonLoading"
              :rows="skeletonRows"
              :show-sidebar="skeletonShowSidebar"
              :variant="skeletonVariant"
            >
              <div :class="cn('p-4 lg:p-6')">
                <h4 :class="cn('mb-4 text-lg font-semibold')">
                  任务详情（加载完成）
                </h4>
                <div
                  v-for="row in loadedRows"
                  :key="row.key"
                  class="flex items-center justify-between border-b border-dashed border-gray-200 py-2 last:border-b-0 dark:border-gray-700"
                >
                  <span :class="hintClassName">{{ row.label }}</span>
                  <span
                    class="font-mono text-sm text-gray-900 dark:text-gray-100"
                    >{{ row.value }}</span
                  >
                </div>
              </div>
            </PageSkeleton>
          </div>
        </div>

        <div>
          <h4 :class="sectionTitleClassName">
            表格骨架屏（列数/行数/表头/操作列/分页都可关）
          </h4>
          <div class="mb-3 flex flex-wrap items-center gap-3">
            <Button @click="reloadTableSkeleton"> 重新加载表格 </Button>
            <span :class="hintClassName">
              真实项目里把它放进
              <code :class="codeClassName">&lt;BasicTable&gt;</code>
              的 skeleton 插槽，或直接对着
              <code :class="codeClassName">loading</code> 绑请求状态
            </span>
          </div>
          <TableSkeleton
            :loading="tableSkeletonLoading"
            :columns="4"
            :rows="3"
            :show-actions="true"
            :show-pagination="false"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    v-for="col in skeletonTableColumns"
                    :key="col.dataIndex"
                  >
                    {{ col.title }}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in tableRows" :key="row.key">
                  <TableCell
                    v-for="col in skeletonTableColumns"
                    :key="col.dataIndex"
                  >
                    {{ row[col.dataIndex] }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableSkeleton>
        </div>
      </div>
    </Card>

    <Card variant="borderless" title="空状态（EmptyState）">
      <div :class="cn('space-y-8')">
        <div>
          <h4 :class="sectionTitleClassName">
            默认 / 带描述 / 带动作（默认插槽）
          </h4>
          <p :class="hintClassName">
            <code :class="codeClassName">title</code>、
            <code :class="codeClassName">description</code>、
            <code :class="codeClassName">icon</code>（iconify
            名）三个属性覆盖文案与图标，
            描述为空时那一行不渲染；需要引导用户下一步动作时，把按钮塞进默认插槽。
          </p>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div :class="demoBoxClassName">
              <EmptyState />
            </div>
            <div :class="demoBoxClassName">
              <EmptyState
                title="还没有配置"
                description="点右上角「新建」添加第一条调度规则"
                icon="ant-design:setting-outlined"
              />
            </div>
            <div :class="demoBoxClassName">
              <EmptyState
                title="没有匹配的订单"
                description="换个时间范围或状态再试一次"
                icon="ant-design:filter-outlined"
              >
                <Button class="mt-4" @click="addNotice"> 新建一条公告 </Button>
              </EmptyState>
            </div>
          </div>
        </div>

        <div>
          <h4 :class="sectionTitleClassName">列表清空后自动落到空状态分支</h4>
          <div :class="cn(demoBoxClassName, 'min-h-[160px]')">
            <template v-if="noticeList.length > 0">
              <p :class="cn('mb-2 text-sm font-medium')">
                系统公告（{{ noticeList.length }} 条）
              </p>
              <div
                v-for="notice in noticeList"
                :key="notice.key"
                class="border-b border-dashed border-gray-200 py-2 text-sm last:border-b-0 dark:border-gray-700"
              >
                {{ notice.text }}
              </div>
            </template>
            <EmptyState
              v-else
              title="公告已清空"
              description="列表长度为 0 时组件接管整块区域，不需要页面再写 v-if 兜底文案"
            >
              <Button class="mt-4" @click="restoreNoticeList">
                恢复示例数据
              </Button>
            </EmptyState>
          </div>
          <div class="mt-3 flex gap-3">
            <Button
              :disabled="noticeList.length === 0"
              variant="destructive"
              @click="clearNoticeList"
            >
              清空列表
            </Button>
            <Button
              :disabled="noticeList.length > 0"
              @click="restoreNoticeList"
            >
              恢复数据
            </Button>
          </div>
        </div>
      </div>
    </Card>

    <Card variant="borderless" title="错误边界（ErrorBoundary）">
      <div :class="cn('space-y-8')">
        <div>
          <h4 :class="sectionTitleClassName">
            捕获子组件抛错 + 默认兜底的重试链路
          </h4>
          <p :class="hintClassName">
            <code :class="codeClassName">ErrorBoundary</code> 内部用
            <code :class="codeClassName">onErrorCaptured</code>
            收子组件 setup / render / 生命周期钩子 / watcher
            阶段的异常，命中就换成兜底 UI，并向外
            <code :class="codeClassName">emit('error')</code
            >。兜底里的「重试」调
            <code :class="codeClassName">resetError()</code> 后会 emit
            <code :class="codeClassName">reset</code
            >，页面在这个回调里关掉抛错开关，
            所以重试是真的恢复到内容，而不是原地再崩一次。
          </p>
          <div class="mb-3 flex flex-wrap items-center gap-4">
            <Switch
              :model-value="boundaryFail"
              @update:model-value="(v: any) => handleBoundaryChange(v === true)"
            />
            <span class="text-sm">{{ boundaryFail ? '抛错' : '正常' }}</span>
            <Button variant="destructive" @click="crashChild">
              模拟一次崩溃
            </Button>
            <Button variant="outline" @click="healChild">恢复子组件</Button>
            <span :class="hintClassName"
              >已重试 {{ boundaryResetCount }} 次</span
            >
          </div>
          <p :class="cn(hintClassName, 'mb-3 break-all')">
            最近捕获：{{ lastBoundaryError }}
          </p>
          <ErrorBoundary
            :key="boundaryKey"
            @error="handleBoundaryError"
            @reset="handleBoundaryReset"
          >
            <ErrorProneContent :fail="boundaryFail" />
          </ErrorBoundary>
        </div>

        <div>
          <h4 :class="sectionTitleClassName">
            自定义兜底（fallback 渲染函数）
          </h4>
          <p :class="hintClassName">
            <code :class="codeClassName">fallback</code> 是个渲染函数
            <code :class="codeClassName">(error, reset) =&gt; VNode</code>
            ，业务想换成品牌化的报错卡、或带「上报工单」按钮时用这一档；出口必须保留
            <code :class="codeClassName">reset</code
            >，否则用户就被困死在兜底页。
          </p>
          <div class="mb-3 flex flex-wrap items-center gap-3">
            <Button
              class="border-amber-400 text-amber-600 hover:bg-amber-50 dark:text-amber-400"
              variant="outline"
              @click="crashWithCustomFallback"
            >
              抛错（走自定义兜底）
            </Button>
            <span :class="hintClassName">
              子组件先正常挂载，点一下才失败 —— 页面初次进入不制造无害的错误日志
            </span>
          </div>
          <ErrorBoundary :key="customFallbackKey" :fallback="customFallback">
            <ErrorProneContent :fail="customFallbackFail" />
          </ErrorBoundary>
        </div>
      </div>
    </Card>

    <Card variant="borderless" title="状态标签（StatusTag）">
      <div :class="cn('space-y-8')">
        <div>
          <h4 :class="sectionTitleClassName">任务列表里的状态列</h4>
          <p :class="hintClassName">
            组件内部是一张 <code :class="codeClassName">MAP</code>
            把状态原文案与
            <code :class="codeClassName">a-tag</code>
            的颜色一次配好：<code :class="codeClassName">completed</code>
            成功绿、 <code :class="codeClassName">processing</code> /
            <code :class="codeClassName">pending</code> 进行蓝、
            <code :class="codeClassName">3</code> 挂起橙、
            <code :class="codeClassName">failed</code> /
            <code :class="codeClassName">timeout</code> 失败红、
            <code :class="codeClassName">cancelled</code>
            默认灰；映射不到的原始字符串 原样当文案、颜色退回
            <code :class="codeClassName">default</code>，
            所以后端新增状态时页面只是少了配色，不会白屏。
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  v-for="col in statusTableColumns"
                  :key="col.dataIndex"
                >
                  {{ col.title }}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in jobRows" :key="row.key">
                <TableCell
                  v-for="col in statusTableColumns"
                  :key="col.dataIndex"
                >
                  <template v-if="col.dataIndex === 'status'">
                    <StatusTag :status="row.status" />
                    <span
                      :class="cn(hintClassName, 'ml-2 font-mono text-xs')"
                      >{{ row.status }}</span
                    >
                  </template>
                  <template v-else>{{ row[col.dataIndex] }}</template>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div>
          <h4 :class="sectionTitleClassName">后端枚举直出（'0' ~ '3'）</h4>
          <div class="flex flex-wrap items-center gap-4">
            <div
              v-for="code in enumCodes"
              :key="code"
              class="flex items-center gap-2"
            >
              <StatusTag :status="code" />
              <span :class="cn(hintClassName, 'font-mono text-xs')">{{
                code
              }}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 :class="sectionTitleClassName">换一个原始值看映射结果</h4>
          <div class="flex flex-wrap items-center gap-4">
            <Select v-model="rawStatus">
              <SelectTrigger class="w-[220px]">
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in statusOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <StatusTag :status="rawStatus" />
            <span :class="hintClassName">
              <code :class="codeClassName">type</code>
              属性（export / instance / task /
              workflow）目前是预留分组位，组件还没按它 分表映射
            </span>
          </div>
        </div>
      </div>
    </Card>

    <Card variant="borderless" title="Spin 加载器">
      <div :class="cn('space-y-8')">
        <div>
          <h4 :class="sectionTitleClassName">基础用法</h4>
          <div class="flex flex-wrap items-center gap-8">
            <Spinner class="size-6" />
            <div v-if="spinLoading" class="flex items-center gap-2">
              <Spinner class="size-6" />
              <span :class="hintClassName">数据加载中...</span>
            </div>
            <Button variant="outline" @click="spinLoading = !spinLoading">
              {{ spinLoading ? '停止' : '开始' }}加载
            </Button>
          </div>
        </div>

        <div>
          <h4 :class="sectionTitleClassName">包裹内容</h4>
          <div class="flex flex-wrap gap-6">
            <div class="relative w-[240px]">
              <div :class="demoBoxClassName">内容区域被加载遮罩包裹</div>
              <Loading :loading="true" :absolute="true" />
            </div>
            <div class="relative w-[240px]">
              <div
                class="rounded-lg bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400"
              >
                点击按钮切换加载状态
              </div>
              <Loading :loading="spinLoading" :absolute="true" />
            </div>
          </div>
        </div>

        <div>
          <h4 :class="sectionTitleClassName">自定义提示文字</h4>
          <div class="flex flex-wrap items-center gap-4">
            <div class="flex items-center gap-2">
              <Spinner class="size-6" />
              <span class="text-sm">正在加载用户信息...</span>
            </div>
            <div class="relative">
              <div
                class="h-[80px] w-[200px] rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20"
              ></div>
              <Loading
                :loading="true"
                :absolute="true"
                tip="请稍候，数据同步中..."
              />
            </div>
            <Input
              v-model="spinTip"
              placeholder="输入提示文字"
              class="w-[180px]"
            />
            <div class="flex items-center gap-2">
              <Spinner class="size-6" />
              <span class="text-sm">{{ spinTip }}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 :class="sectionTitleClassName">尺寸大小</h4>
          <div class="flex items-center gap-8">
            <div class="flex flex-col items-center gap-2">
              <Spinner class="size-4" />
              <span class="text-xs text-gray-500">Small</span>
            </div>
            <div class="flex flex-col items-center gap-2">
              <Spinner class="size-6" />
              <span class="text-xs text-gray-500">Medium</span>
            </div>
            <div class="flex flex-col items-center gap-2">
              <Spinner class="size-9" />
              <span class="text-xs text-gray-500">Large</span>
            </div>
          </div>
        </div>

        <div>
          <h4 :class="sectionTitleClassName">样式切换（点状 / 圆圈 / 网格）</h4>
          <div class="flex flex-wrap items-center gap-6">
            <Space>
              <Button
                :variant="spinStyle === 'circle' ? 'default' : 'outline'"
                size="sm"
                @click="toggleSpinStyle('circle')"
              >
                圆圈 Circle
              </Button>
              <Button
                :variant="spinStyle === 'dot' ? 'default' : 'outline'"
                size="sm"
                @click="toggleSpinStyle('dot')"
              >
                点状 Dot
              </Button>
              <Button
                :variant="spinStyle === 'grid' ? 'default' : 'outline'"
                size="sm"
                @click="toggleSpinStyle('grid')"
              >
                网格 Grid
              </Button>
            </Space>
            <div
              class="ml-4 flex min-h-[100px] min-w-[160px] items-center justify-center rounded-lg bg-gray-50 p-4 dark:bg-gray-800"
            >
              <Spinner v-if="spinStyle === 'circle'" class="size-8" />
              <Icon
                v-else-if="spinStyle === 'dot'"
                icon="svg-spinners:pulse-multiple"
                class="size-8"
              />
              <Icon
                v-else-if="spinStyle === 'grid'"
                icon="svg-spinners:bars-scale-fade"
                class="size-8"
              />
            </div>
          </div>
        </div>
      </div>
    </Card>

    <Card variant="borderless" title="Skeleton 骨架屏">
      <div :class="cn('space-y-8')">
        <div>
          <h4 :class="sectionTitleClassName">头像 + 文本骨架</h4>
          <div class="flex gap-8">
            <div class="flex w-full max-w-md items-start gap-4">
              <Skeleton class="size-12 shrink-0 rounded-full" />
              <div class="w-full space-y-2">
                <Skeleton class="h-4 w-full" />
                <Skeleton class="h-4 w-full" />
                <Skeleton class="h-4 w-3/5" />
              </div>
            </div>
            <div class="flex w-full max-w-md items-start gap-4">
              <Skeleton class="size-12 shrink-0 rounded-full" />
              <div class="w-full space-y-2">
                <Skeleton class="h-4 w-full" />
                <Skeleton class="h-4 w-4/5" />
              </div>
            </div>
          </div>
        </div>

        <div>
          <h4 :class="sectionTitleClassName">图片骨架</h4>
          <div class="flex flex-wrap gap-6">
            <Skeleton class="size-16" />
            <Skeleton class="size-16" />
            <Skeleton class="h-[160px] w-[280px]" />
          </div>
        </div>

        <div>
          <h4 :class="sectionTitleClassName">表格骨架</h4>
          <!-- 没有独立的表格骨架子组件，用 Skeleton 的多行段落占位还原表格观感。 -->
          <div class="w-full space-y-2">
            <Skeleton class="h-4 w-[18%]" />
            <Skeleton class="h-4 w-[30%]" />
            <Skeleton class="h-4 w-[22%]" />
            <Skeleton class="h-4 w-[26%]" />
          </div>
        </div>

        <div>
          <h4 :class="sectionTitleClassName">按钮骨架</h4>
          <div class="flex gap-4">
            <Skeleton class="h-8 w-[80px]" />
            <Skeleton class="h-8 w-full" />
          </div>
        </div>

        <div>
          <h4 :class="sectionTitleClassName">动画控制</h4>
          <div class="flex items-center gap-4">
            <Switch
              :model-value="skeletonActive"
              @update:model-value="(v: any) => (skeletonActive = v === true)"
            />
            <span class="text-sm">{{ skeletonActive ? '激活' : '静止' }}</span>
            <span :class="hintClassName">
              当前状态：<span class="font-medium">{{
                skeletonActive ? '流动动画' : '静止'
              }}</span>
            </span>
          </div>
          <div class="mt-4 max-w-md rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
            <div class="w-full space-y-2">
              <Skeleton
                :class="cn('h-4 w-full', !skeletonActive && 'animate-none')"
              />
              <Skeleton
                :class="cn('h-4 w-4/5', !skeletonActive && 'animate-none')"
              />
            </div>
          </div>
        </div>
      </div>
    </Card>

    <Card variant="borderless" title="Loading 组件（项目封装）">
      <div :class="cn('space-y-6')">
        <p :class="hintClassName">
          <code :class="codeClassName">@antdv/loading-ui</code>
          的 <code :class="codeClassName">Loading</code>
          组件，支持全屏/容器内两种模式，可配置尺寸、主题、提示文字等
        </p>

        <div class="flex items-center gap-4">
          <span class="text-sm font-medium text-gray-600 dark:text-gray-400"
            >尺寸：</span
          >
          <RadioGroup
            :model-value="componentSize"
            :class="radioGroupClassName"
            @update:model-value="
              (v: any) => (componentSize = v as 'default' | 'large' | 'small')
            "
          >
            <label :class="radioOptionClassName">
              <RadioGroupItem value="small" class="sr-only" />
              <span> Small </span>
            </label>
            <label :class="radioOptionClassName">
              <RadioGroupItem value="default" class="sr-only" />
              <span> Default </span>
            </label>
            <label :class="radioOptionClassName">
              <RadioGroupItem value="large" class="sr-only" />
              <span> Large </span>
            </label>
          </RadioGroup>
        </div>

        <div class="flex items-center gap-4">
          <span class="text-sm font-medium text-gray-600 dark:text-gray-400"
            >主题：</span
          >
          <RadioGroup
            :model-value="componentTheme"
            :class="radioGroupClassName"
            @update:model-value="
              (v: any) => (componentTheme = v as 'dark' | 'light')
            "
          >
            <label :class="radioOptionClassName">
              <RadioGroupItem value="light" class="sr-only" />
              <span> Light </span>
            </label>
            <label :class="radioOptionClassName">
              <RadioGroupItem value="dark" class="sr-only" />
              <span> Dark </span>
            </label>
          </RadioGroup>
        </div>

        <div :class="frameClassName">
          <div
            class="min-h-[180px] bg-gradient-to-br from-blue-50 to-indigo-50 p-6 dark:from-gray-800 dark:to-gray-900"
          >
            <div class="text-center">
              <p :class="cn('mb-4 text-sm', hintClassName)">
                这是一个容器内 Loading 演示区域
              </p>
              <Button
                :disabled="componentLoading"
                @click="triggerComponentLoading"
              >
                <Icon
                  v-if="componentLoading"
                  class="animate-spin"
                  icon="svg-spinners:bouncing-ball"
                />
                触发 Loading ({{ componentSize }} / {{ componentTheme }})
              </Button>
            </div>
          </div>
          <!-- tip 才是 Loading 组件的文案属性（没有 description 这个 prop） -->
          <Loading
            :loading="componentLoading"
            :size="componentSize"
            :theme="componentTheme"
            :absolute="true"
            tip="组件式加载中..."
          />
        </div>
      </div>
    </Card>

    <Card variant="borderless" title="PageLoading 与延迟遮罩">
      <div :class="cn('space-y-6')">
        <p :class="hintClassName">
          <code :class="codeClassName">PageLoading</code>
          是应用侧的薄壳（读 app
          store，明暗跟随偏好设置），布局里路由切换的那层占位就是它；
          右边演示"请求快就不闪遮罩"的延迟加载写法 ——
          <code :class="codeClassName">@antdv/loading-ui</code> 本身没有 delay
          属性， 延迟这层由调用方用一个定时器决定要不要把
          <code :class="codeClassName">loading</code> 置真。
        </p>

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div :class="frameClassName">
            <div
              class="flex min-h-[180px] items-center justify-center bg-gradient-to-br from-sky-50 to-cyan-50 p-6 dark:from-gray-800 dark:to-gray-900"
            >
              <div class="text-center">
                <p :class="cn('mb-4 text-sm', hintClassName)">
                  PageLoading 覆盖整个容器（absolute inset-0）
                </p>
                <Switch
                  :model-value="pageLoadingVisible"
                  @update:model-value="
                    (v: any) => togglePageLoading(v === true)
                  "
                />
                <span class="text-sm">{{
                  pageLoadingVisible ? '占位中' : '空闲'
                }}</span>
              </div>
            </div>
            <PageLoading
              :loading="pageLoadingVisible"
              text="正在编译页面产物..."
            />
          </div>

          <div :class="frameClassName">
            <div
              class="flex min-h-[180px] flex-col items-center justify-center gap-3 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-6 dark:from-gray-800 dark:to-gray-900"
            >
              <Space>
                <Button variant="outline" @click="runDelayedRequest(150)">
                  快请求 150ms
                </Button>
                <Button @click="runDelayedRequest(1800)">
                  慢请求 1800ms
                </Button>
              </Space>
              <p :class="cn('text-center text-xs', hintClassName)">
                {{ delayedResult }}
              </p>
            </div>
            <Loading
              :loading="delayedLoading"
              :absolute="true"
              tip="请稍候..."
            />
          </div>
        </div>
      </div>
    </Card>

    <Card variant="borderless" title="v-loading 指令">
      <div :class="cn('space-y-4')">
        <p :class="hintClassName">
          <code :class="codeClassName">main.ts</code> 里
          <code :class="codeClassName">app.directive('loading', vLoading)</code>
          注册过的元素级遮罩：配置走
          <code :class="codeClassName">loading-tip</code> /
          <code :class="codeClassName">loading-theme</code> /
          <code :class="codeClassName">loading-size</code> 属性，
          <code :class="codeClassName">.fullscreen</code> 修饰符挂到 body
          盖住整页。
        </p>
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div v-loading="directiveLoading" :class="demoBoxClassName">
            <p class="m-0 text-sm">默认浅色遮罩，2 秒后自动收起。</p>
          </div>
          <div
            v-loading="directiveDarkLoading"
            :class="demoBoxClassName"
            loading-size="large"
            loading-theme="dark"
            loading-tip="正在拉取报表…"
          >
            <p class="m-0 text-sm">深色主题 + 大尺寸 + 自定义文案。</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-4">
          <Button
            variant="outline"
            :disabled="directiveLoading"
            @click="flashDirective('plain')"
          >
            <Icon
              v-if="directiveLoading"
              class="animate-spin"
              icon="svg-spinners:bouncing-ball"
            />
            加载左块
          </Button>
          <Button
            :disabled="directiveDarkLoading"
            @click="flashDirective('dark')"
          >
            <Icon
              v-if="directiveDarkLoading"
              class="animate-spin"
              icon="svg-spinners:bouncing-ball"
            />
            加载右块
          </Button>
          <Button
            v-loading.fullscreen="fullscreenDirectiveLoading"
            variant="outline"
            @click="flashDirective('full')"
          >
            整页遮罩 2 秒
          </Button>
        </div>
      </div>
    </Card>

    <Card variant="borderless" title="useLoading Hook">
      <div :class="cn('space-y-4')">
        <p :class="hintClassName">
          通过
          <code :class="codeClassName">useLoading</code>
          组合式函数编程式控制加载状态，支持动态修改提示文字
        </p>

        <div :class="frameClassName">
          <div
            ref="hookContainerRef"
            class="flex min-h-[160px] items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 p-6 dark:from-gray-800 dark:to-gray-900"
          >
            <div class="text-center">
              <p :class="cn('mb-4 text-sm', hintClassName)">
                useLoading 控制此容器的加载状态
              </p>
              <Button
                class="bg-emerald-600 text-white hover:bg-emerald-700"
                @click="triggerUseLoading"
              >
                触发 useLoading
              </Button>
            </div>
          </div>
        </div>

        <div class="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/60">
          <pre
            class="font-mono text-xs leading-relaxed whitespace-pre-wrap text-gray-600 dark:text-gray-400"
          >
const hookLoading = useLoading({
  target: containerRef,
  body: false,
  tip: '加载中...'
})

hookLoading.open() // 打开
hookLoading.close() // 关闭
hookLoading.setTip('新提示文字') // 修改提示</pre>
        </div>
      </div>
    </Card>

    <Card variant="borderless" title="按钮加载态">
      <div :class="cn('space-y-6')">
        <p :class="hintClassName">
          按钮没有内置
          <code :class="codeClassName">loading</code>
          属性：加载态用
          <code :class="codeClassName">disabled</code>
          加一个旋转图标表达，点击后禁用交互
        </p>

        <div class="flex flex-wrap gap-4">
          <Button :disabled="btnLoading1" @click="triggerBtnLoading(0)">
            <Icon
              v-if="btnLoading1"
              class="animate-spin"
              icon="svg-spinners:bouncing-ball"
            />
            主要按钮
          </Button>
          <Button
            variant="outline"
            :disabled="btnLoading2"
            @click="triggerBtnLoading(1)"
          >
            <Icon
              v-if="btnLoading2"
              class="animate-spin"
              icon="svg-spinners:bouncing-ball"
            />
            默认按钮
          </Button>
          <Button
            class="border-dashed"
            variant="outline"
            :disabled="btnLoading3"
            @click="triggerBtnLoading(2)"
          >
            <Icon
              v-if="btnLoading3"
              class="animate-spin"
              icon="svg-spinners:bouncing-ball"
            />
            虚线按钮
          </Button>
          <Button variant="outline" disabled> 禁用按钮 </Button>
        </div>

        <div class="flex flex-wrap gap-4">
          <Button disabled>
            <Icon class="animate-spin" icon="svg-spinners:bouncing-ball" />
            常驻加载态
          </Button>
          <Button disabled>
            <Icon class="animate-spin" icon="svg-spinners:bouncing-ball" />
            提交中...
          </Button>
          <Button
            class="rounded-full"
            :disabled="btnLoading2"
            @click="triggerBtnLoading(1)"
          >
            <Icon
              v-if="btnLoading2"
              class="animate-spin"
              icon="svg-spinners:bouncing-ball"
            />
            圆角按钮
          </Button>
        </div>
      </div>
    </Card>

    <Card variant="borderless" title="全局加载遮罩">
      <div :class="cn('space-y-4')">
        <p :class="hintClassName">
          使用
          <code :class="codeClassName">createLoading</code>
          创建全屏加载实例， 适用于路由跳转、API
          请求拦截器等场景。支持动态修改提示文字
        </p>

        <div class="flex gap-4">
          <Button variant="destructive" @click="triggerGlobalLoading">
            模拟 API 请求 (全屏遮罩)
          </Button>
        </div>

        <div class="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/60">
          <pre
            class="font-mono text-xs leading-relaxed whitespace-pre-wrap text-gray-600 dark:text-gray-400"
          >
const instance = createLoading({
  tip: '正在处理请求...',
  theme: 'dark',
  background: 'rgba(0, 0, 0, 0.6)'
})

instance.open()
instance.setTip('即将完成...') // 动态更新提示
instance.close() // 关闭并自动销毁</pre>
        </div>
      </div>
    </Card>
  </div>
</template>
