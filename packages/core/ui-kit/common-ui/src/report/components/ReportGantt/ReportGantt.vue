<script setup lang="ts">
// frappe-gantt 的手写声明只能引用、不能复制：下游按源码消费本包时看不到 report-ui 的 tsconfig include，
// 少了这一行，宿主 type-check 会在 `import Gantt from 'frappe-gantt'` 上报 TS7016。
// oxlint-disable-next-line typescript/triple-slash-reference
// / <reference path="../../types/frappe-gantt.d.ts" />
import type { HTMLAttributes } from 'vue';

import type { GanttChangePayload } from '../../core/gantt';
import type { GanttFieldMap, GanttViewMode, Row } from '../../core/types';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Skeleton,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { useResizeObserver } from '@vueuse/core';
import Gantt from 'frappe-gantt';

import {
  ganttDateWindow,
  resolveGanttViewMode,
  toGanttChange,
  toGanttOptions,
  toGanttTasks,
  toGanttViewModes,
} from '../../core/gantt';
import { ganttViewModeLabel } from '../../utils/labels';

/**
 * 甘特视图的渲染层：把「原始事实行 + 字段映射」交给 `core/gantt.ts` 翻译成任务，
 * 剩下的交给第三方库 frappe-gantt 去画。
 *
 * 分层位置：`components/`，**只画不算** —— 时间格式归一、脏行处置、依赖悬空过滤、
 * 档位名归一、options 组装全在 core；这里只剩「实例生命周期 + 事件转接 + 三态」。
 * 外壳（标题条 / 工具条 / 空态 / 错误态 / 加载态）一律用 `@antdv/shadcn-ui` 的现成组件，
 * 不引第二个 UI 库；frappe 只拥有它自己那块 SVG，外面套的还是本包的卡片。
 *
 * 四条实例管理的硬口径（漏一条就是线上事故）：
 * 1. **卸载要拆干净**：`new Gantt` 会往容器里塞 `.gantt-container` 与 `<svg class="gantt">`，
 *    这些节点不在 Vue 的 vnode 树里，Vue 卸载时不替我摘 —— 所以 `onBeforeUnmount` 先 `clear()`
 *    再手动清空容器，并把手上的实例引用丢掉（否则重挂载时两个实例往同一个 DOM 里画）。
 * 2. **数据变了走原地更新**：调 1.2.2 的 `refresh(tasks)`，不重建实例。重建会丢横向滚动位置、
 *    重绑事件、白闪一下。**1.x 没有 `update()`**，那是 0.x 的名字；这里不写「有 update 就用」的
 *    兼容分支 —— 本仓库锁的是 1.2.2，那条分支永远不会命中，只会在某天升级时静默换行为。
 * 3. **切档位只认 `change_view_mode(name, maintainPosition)`**：不要走 `update_options({ view_mode })`，
 *    它内部重跑 `setup_options`，而那里有一句 `view_mode = view_modes[0]`，切了会被打回白名单第一档。
 * 4. **容器尺寸变了要自己重绘**：库不监听 resize，靠 `useResizeObserver` 补一次重排。
 *
 * 不做的事：不做泳道/分组树（frappe 不画分组，`group` 值已由 core 透传给宿主）、
 * 不做里程碑图标、不做编辑表单（`readonly: false` 时拖拽改期由库完成，结果通过 `dateChange`
 * 回抛，落库是宿主的事）。
 */
const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes['class'];
    /** 上一轮取数/计算失败的原因；非空时这一格只出错误态 */
    error?: string;
    /** 字段映射：哪列是开始/结束/名称/进度/分组/依赖 */
    fieldMap: GanttFieldMap;
    /** 额外着色日（节假日）：`'YYYY-MM-DD'` 或任意 dayjs 认得的写法，归一在 core */
    holidays?: string[];
    loading?: boolean;
    /** 高级透传：原样并进 frappe 的 options（`view_mode` / `readonly` / 四个 `on_*` 由本组件接管） */
    options?: Record<string, unknown>;
    /** 是否只读，缺省 true：报表是看不是改 */
    readonly?: boolean;
    /** 原始事实行（甘特一行一任务，读明细而不是聚合结果） */
    rows: Row[];
    title?: string;
    /** 时间轴粒度（受控），缺省 'Day'；变化由 `update:viewMode` 回抛给宿主写回 DSL */
    viewMode?: GanttViewMode;
    /** 允许切换的档位白名单，顺序即工具条按钮顺序；不传用库的 7 档 */
    viewModes?: GanttViewMode[];
  }>(),
  {
    class: undefined,
    error: undefined,
    holidays: undefined,
    loading: false,
    options: undefined,
    readonly: true,
    title: undefined,
    viewMode: 'Day',
    viewModes: undefined,
  },
);

const emit = defineEmits<{
  /** 单击任务条（非只读时库还会弹它自己的 popup） */
  (event: 'taskClick', payload: GanttChangePayload): void;
  /** 拖拽改期完成：payload.end 是「含当天的最后一天」，可直接写回事实表 */
  (event: 'dateChange', payload: GanttChangePayload): void;
  /** 拖动进度手柄完成：payload.progress 是 0~100 */
  (event: 'progressChange', payload: GanttChangePayload): void;
  /** 档位变化（工具条点击或库自己触发都算），宿主据此写回 `options.ganttViewMode` */
  (event: 'viewModeChange', mode: GanttViewMode): void;
  (event: 'update:viewMode', mode: GanttViewMode): void;
}>();

const host = ref<HTMLElement>();

/**
 * 实例不放 ref：frappe 内部维护几十个自引用成员（svg、各层 group、事件句柄），
 * 被响应式代理包一层会让它自己的 `this.xxx` 语义变得不可控，而这里没有任何「视图依赖实例状态」
 * 的渲染需求。普通 `let` 本来就不进响应式系统，连 `markRaw` 都省了。
 */
let gantt: Gantt | undefined;

/** 映射层跑一遍：tasks 是要画的条，skipped 是 core 判定丢弃的行（缺起止 / 区间反了 / 超十年） */
const build = computed(() => toGanttTasks(props.rows ?? [], props.fieldMap));
const taskList = computed(() => build.value.tasks);
const skipped = computed(() => build.value.skipped);
const skippedHint = computed(() =>
  skipped.value.length > 0
    ? `有 ${skipped.value.length} 行缺起止时间或区间不合法，已跳过`
    : '',
);
const dateWindow = computed(() => ganttDateWindow(taskList.value));
/** 工具条按钮顺序 = 白名单顺序；core 已保证「全非法退回 7 档」，这里不再兜底 */
const toolbarModes = computed(() => toGanttViewModes(props.viewModes));

/**
 * frappe 的 options。`view_mode` / `readonly` / 四个 `on_*` 在透传之后重新钉一遍：
 * 回调涉及 emit（core 不认识 vue，不该由它注入），而档位与只读是 props 决定的，
 * 不允许 `options` 把它们偷偷改掉 —— 那会让工具条的选中态和画布不一致。
 */
function frappeOptions(): Record<string, unknown> {
  return {
    ...toGanttOptions({
      holidays: props.holidays,
      readonly: props.readonly,
      viewMode: props.viewMode,
      viewModes: props.viewModes,
    }),
    ...props.options,
    on_click: (task: unknown) => {
      const payload = toGanttChange(task);
      if (payload) emit('taskClick', payload);
    },
    on_date_change: (task: unknown, startDate: Date, endDate: Date) => {
      const payload = toGanttChange(task, { end: endDate, start: startDate });
      if (payload) emit('dateChange', payload);
    },
    on_progress_change: (task: unknown, progress: number) => {
      const payload = toGanttChange(task, { progress });
      if (payload) emit('progressChange', payload);
    },
    // 库回调给的是档位对象（带 .name），对外只暴露名字：宿主不该依赖上游形状。
    // 再过一次 core 的归一：白名单外的名字（宿主透传的 options 里塞的、上游改了枚举的）
    // 退回当前档位，避免工具条选中态和画布不一致。
    on_view_change: (mode: { name?: string }) => {
      emit('viewModeChange', resolveGanttViewMode(mode?.name, props.viewMode));
    },
    readonly: props.readonly,
    view_mode: props.viewMode,
  };
}

/**
 * 建实例。`{ ...task }` 不是多余的复制：`GanttTask` 是 interface，直接递给 frappe 声明里的
 * `GanttTaskLike`（带索引签名）会撞上「interface 没有隐式索引签名」；展开一次得到匿名对象类型，
 * 才是 assignable 的那一站。
 */
function create() {
  if (!host.value || taskList.value.length === 0) return;
  destroy();
  gantt = new Gantt(
    host.value,
    taskList.value.map((task) => ({ ...task })),
    frappeOptions(),
  );
}

/** 拆实例 + 清容器：frappe 建的 SVG 挂在 host 上，不清就是 DOM 泄漏 */
function destroy() {
  if (gantt) {
    try {
      gantt.clear();
    } catch {
      // 容器已被摘走时 frappe 内部会抛；卸载路径不能因此中断
    }
    gantt = undefined;
  }
  if (host.value) host.value.innerHTML = '';
}

/** 数据变化：空→有 建一次；有→空 拆掉让模板出空态；有→有 原地 refresh，绝不重建 */
function sync() {
  if (!gantt) {
    create();
    return;
  }
  if (taskList.value.length === 0) {
    destroy();
    return;
  }
  gantt.refresh(taskList.value.map((task) => ({ ...task })));
}

/**
 * 手动重绘（也是 resize 的兜底）：用 `change_view_mode(当前档位, true)` 触发一次全量重排。
 * 选它而不是别的内部方法：`maintain_pos = true` 会先把 `scroll_to` 置空再还原，
 * 于是「重绘不跳到别的日期」，用户横向滚到哪儿就停在哪儿。
 */
function redraw() {
  if (gantt) gantt.change_view_mode(props.viewMode, true);
}

/** 工具条切档：只回抛，真正的切换由 `viewMode` 的 watch 做（单向数据流，宿主可以拦住不让切） */
function pickViewMode(mode: GanttViewMode) {
  if (mode === props.viewMode) return;
  emit('update:viewMode', mode);
}

onMounted(create);
onBeforeUnmount(destroy);

// rows / fieldMap 变化后重算并同步；nextTick 保证「空→有」时 host 已经渲染进 DOM
watch(build, () => {
  void nextTick(sync);
});

// 换档位：原地切视图，不重建
watch(
  () => props.viewMode,
  (mode) => {
    if (!gantt) return;
    gantt.change_view_mode(mode, true);
    emit('viewModeChange', mode);
  },
);

// 档位白名单 / 只读 / 透传 options 变了要重建：白名单要重跑 setup_options 才生效，
// 只读决定库绑不绑拖拽事件，而 update_options 会把档位打回第一档（口径 3），所以不能用它
watch(
  [() => props.viewModes, () => props.readonly, () => props.options],
  () => {
    void nextTick(() => {
      if (gantt) create();
    });
  },
);

useResizeObserver(host, () => {
  redraw();
});

defineExpose({ redraw });
</script>

<template>
  <section
    :class="
      cn(
        'flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md border bg-card text-card-foreground shadow-sm',
        props.class,
      )
    "
    :data-skip-count="skipped.length"
    :data-task-count="taskList.length"
    data-slot="report-gantt"
  >
    <header
      v-if="props.title || skipped.length > 0 || $slots.actions"
      class="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2"
      data-slot="report-gantt-header"
    >
      <div class="min-w-0">
        <h3 class="truncate font-medium text-sm">{{ props.title }}</h3>
        <p
          v-if="skipped.length > 0"
          class="truncate text-muted-foreground text-xs"
        >
          {{ skippedHint }}
        </p>
      </div>
      <slot name="actions"></slot>
    </header>

    <div class="min-h-0 flex-1 p-3" data-slot="report-gantt-body">
      <div
        v-if="props.loading"
        class="flex flex-col gap-2"
        data-slot="report-gantt-loading"
      >
        <Skeleton class="h-4 w-1/3" />
        <Skeleton class="h-28 w-full" />
        <Skeleton class="h-4 w-2/3" />
      </div>

      <Alert
        v-else-if="props.error"
        class="border-dashed"
        data-slot="report-gantt-error"
        variant="destructive"
      >
        <AlertTitle>这张甘特图没能画出来</AlertTitle>
        <AlertDescription>{{ props.error }}</AlertDescription>
      </Alert>

      <Empty
        v-else-if="taskList.length === 0"
        class="border border-dashed"
        data-slot="report-gantt-empty"
      >
        <EmptyHeader>
          <EmptyTitle>暂无可绘制的时间轴</EmptyTitle>
          <EmptyDescription>
            当前没有带合法起止时间的行。检查字段映射里的开始/结束列，或放宽筛选条件。
          </EmptyDescription>
        </EmptyHeader>
      </Empty>

      <div v-else class="flex h-full min-h-0 flex-col gap-2">
        <!-- 工具条：档位切换 + 时间窗。库自带的 view_mode_select / today_button 已在 core 里关掉 -->
        <div
          class="flex shrink-0 flex-wrap items-center gap-2"
          data-slot="report-gantt-toolbar"
        >
          <span
            v-if="dateWindow"
            class="truncate text-muted-foreground text-xs"
            data-slot="report-gantt-window"
          >
            {{ dateWindow.start }} → {{ dateWindow.end }} ·
            {{ dateWindow.days }} 天
          </span>
          <div class="ml-auto flex items-center gap-1" role="group">
            <Button
              v-for="mode in toolbarModes"
              :key="mode"
              :aria-pressed="mode === props.viewMode"
              :variant="mode === props.viewMode ? 'outline' : 'ghost'"
              class="h-6 px-2 text-xs"
              data-action="gantt-view-mode"
              size="sm"
              type="button"
              @click="pickViewMode(mode)"
            >
              {{ ganttViewModeLabel(mode) }}
            </Button>
            <Button
              class="h-6 px-2 text-xs"
              data-action="gantt-redraw"
              size="sm"
              type="button"
              variant="ghost"
              @click="redraw"
            >
              重绘
            </Button>
          </div>
        </div>

        <!-- frappe 会在这个 div 里建 .gantt-container 与 <svg class="gantt">，尺寸交给库自己 -->
        <div
          ref="host"
          class="gantt-canvas min-h-0 w-full flex-1 overflow-auto"
          data-slot="report-gantt-host"
        ></div>
      </div>
    </div>
  </section>
</template>

<style>
/*
 * 画布着色：把 frappe 自带的 20 个 `--g-*` 全部改吃本包的 shadcn token。
 *
 * 为什么必须重写：库里那两套值是写死的裸色（`:root` 一整套亮色 + `html[data-theme='dark']`
 * 一整套暗色），与本包的 `[data-theme]` 预设毫无关系 —— 直接吃就是「暗色主题上浮着一块
 * #fff 画布」，而本仓库的主题只有 token 一个来源。
 *
 * 作用域为什么选在画布容器：自定义属性按元素继承，在这里声明一份天然压过库写在 `:root` 的那份，
 * 不需要 `!important`、也不碰全局；页面上别的 frappe 实例（如果有）不受影响。
 *
 * 三条硬口径：
 * - 只用 `hsl(var(--token))` 组合，不写裸色值；
 * - 不写 `--app-*` / `--ant-*`（这两个命名空间本仓库已废止）；
 * - token 只用 shadcn 裸规范名一套（`--border` / `--muted` / `--foreground` …），
 *   明暗由 token 自己翻，这里不写 `.dark` 分支。
 *
 * `--g-holiday-highlight` 是本包新增的一个（库只有周末那一格），键名由 `core/gantt.ts` 的
 * `GANTT_HOLIDAY_FILL` 引用，两边必须对得上。库另外那几个 `--gv-*`（grid / bar / header 尺寸）
 * 是它按 options 写在容器内联样式上的，不归这里管。
 *
 * 第三方 CSS 的引入方式：走**本包 node_modules 里那份真实文件**的相对路径，
 * 两个看起来更"正规"的写法都在 Vite 8 上实测过、都不成立：
 * - `@import 'frappe-gantt'`（裸包名）：这个包的 `exports` 只在 `.` 上挂了 `style` 条件，
 *   而 Vite 的 postcss-import 解析时不走 `style` 条件，实际命中 `./dist/frappe-gantt.es.js`，
 *   于是 postcss 拿 JS 当 CSS 解析，构建以 `Unknown word const` 失败；
 * - `@import 'frappe-gantt/dist/frappe-gantt.css'`（写全子路径）：`exports` 没导出这个子路径，
 *   报错 "is not defined by exports"。要让本地构建过，就得给本包配置 `resolve.alias` ——
 *   可本包是**源码发布**的，宿主 `apps/web` 用自己的 Vite 配置编译这些源码，alias 不会跟过去，
 *   于是"包自己绿、宿主红"。依赖边界漏进消费端配置，不算解决方案。
 * 相对路径不碰 `exports` 检查，解析基准又是**组件文件自己**（在 report-ui 目录内），
 * 库构建、vitest、宿主从源码消费三条路都指向同一份文件；代价是写死了 pnpm 的目录层级，
 * 上游哪天补上 `./dist/frappe-gantt.css` 导出，就该换回裸包名。
 */
@import '../../../../node_modules/frappe-gantt/dist/frappe-gantt.css';

@layer components {
  .gantt-canvas {
    --g-actions-background: hsl(var(--accent));
    --g-arrow-color: hsl(var(--muted-foreground));
    --g-bar-border: hsl(var(--border));
    /* 条身浅底、进度段主色：BI 里「已完成的部分」要最显眼 */
    --g-bar-color: hsl(var(--muted));
    --g-border-color: hsl(var(--border));
    --g-expected-progress: hsl(var(--primary) / 28%);
    --g-handle-color: hsl(var(--muted-foreground) / 70%);
    --g-header-background: hsl(var(--card));
    /* 本包新增：节假日列（core 的 GANTT_HOLIDAY_FILL 指到这里） */
    --g-holiday-highlight: hsl(var(--destructive) / 12%);
    --g-popup-actions: hsl(var(--accent));
    --g-progress-color: hsl(var(--primary));
    --g-row-border-color: hsl(var(--border));
    --g-row-color: hsl(var(--card));
    --g-text-dark: hsl(var(--foreground));
    --g-text-light: hsl(var(--primary-foreground));
    --g-text-muted: hsl(var(--muted-foreground));
    --g-tick-color: hsl(var(--border) / 55%);
    --g-tick-color-thick: hsl(var(--border));
    --g-today-highlight: hsl(var(--foreground) / 45%);
    --g-weekend-highlight-color: hsl(var(--muted) / 60%);
    --g-weekend-label-color: hsl(var(--secondary));
  }
}
</style>
