/**
 * 甘特视图的数据映射：`core/`，纯函数。
 *
 * 分层位置：本文件只认 `Row` 与本包在 `core/types.ts` 里声明的 `GanttFieldMap`，
 * **不 import `frappe-gantt`、不 import vue、不碰 DOM**（那个库只在 `components/ReportGantt` 里被 new 一次）。
 * 之所以能单独抽出这一层：frappe 的输入本来就是「一段 tasks 数组 + 一份 options 对象」这样的纯数据，
 * 把「报表行 → 任务」的翻译规则（时间格式、脏行处置、依赖串、进度量纲）收在这里就能在 Node 侧穷举单测，
 * 组件层只剩「实例生命周期 + 三态渲染」这一件事。
 *
 * 写在明面上的口径（改任何一条都要回来看理由）：
 *
 * 1. **时间统一收敛成 frappe 认得的格式**。
 *    frappe 的 `date_utils.parse` 是个手写解析器：先按空格切、再按 `-` 切、最后按 `.`/`:` 切。
 *    给它带 `T` 或带 `Z` 的 ISO 串会把时区/分隔符读丢，画出一个 `NaN` 的日期、条直接消失且不报错；
 *    给它时间戳或 `Date` 又绕过了它的字符串假设。所以进库前一律先归一：
 *    - 纯日期 → `'YYYY-MM-DD'`（frappe 对纯日期的 `end` 自己补一整天，正好一格，符合"活动到某天"）；
 *    - 带时刻 → `'YYYY-MM-DD HH:mm:ss'`（空格分隔、无 `T`/`Z`）。
 *    按**本地时区**格式化：报表里的日期本来就是业务日历上的日切，走 UTC 会让"月末 23 点"错归到次月。
 * 2. **缺起止 / 区间非法的行必须显式带回原因**。
 *    frappe 的 `setup_tasks` 对这些行是 `console.error` 后静默丢弃 —— 用户只会看到"少了几条"却查不到来源。
 *    这里在映射层就挡掉，并把原因（missing / invalid / end-before-start / span-too-long）随 `skipped` 一起返回，
 *    组件层据此给出"有 N 行被跳过"的提示。
 * 3. **工期为 0 是合法里程碑，不丢**。
 *    同日 / 同刻的起止 frappe 能画成一格 / 一条线，把它当脏数据丢掉反而丢了业务信息。
 * 4. **跨年超长（>10 年）丢弃**，与 frappe 自身"超过十年视为异常数据"的判定对齐；恰好十年保留，别错一格。
 * 5. **依赖只允许指向"真正画出来的任务"**。
 *    frappe 会为一根指向不存在 `id` 的依赖画出悬空箭头。这里用存活任务的 id 集合反查，
 *    把悬空引用与自引用剔除（但保留当前任务本身）；依赖串支持数组 / 逗号 / 空格 / 分号混写并去重。
 * 6. **id 与名称给稳定兜底**。
 *    id 是依赖引用的锚点，缺 id 列时按行序号生成 `r{index+1}`（而不是随机），保证刷新一次依赖不会整体错位；
 *    缺名称时名称回落成 id。
 *
 * 后半段（视图配置 → frappe 的 `options`）另有四条口径，都是对着 1.2.2 的源码核过的，
 * 与常见博客/0.x 文档不一致处以源码为准：
 *
 * 7. **档位名可以直接当 `view_modes` 传**。1.2.2 的 `setup_options` 会把字符串名换成它内置的
 *    档位对象（名字不认识时只 `console.error` 并塞进 `undefined`，下一次渲染才炸），
 *    所以这里对外收任意写法、先归一成 7 个合法名再交给库，且**顺序即工具条按钮顺序**。
 *    另外 `setup_options` 会把 `view_mode` 强行改写成 `view_modes[0]` —— 初始档位要靠组件
 *    随后再调一次 `change_view_mode()` 才准，而 `update_options({ view_mode })` 会重跑
 *    `setup_options` 把档位打回第一档，所以换档位**不能**走 `update_options`。
 * 8. **`holidays` 不是日期数组，是 `{ 填充色: 判定 }`**。键被原样拼进 `style="fill: …"`，
 *    值要么是 `'weekend'` 要么是日期串数组；数组项走 `new Date(k + ' ')` 与"本地零点"逐日比时间戳，
 *    所以只有 `YYYY-MM-DD` 这种日粒度写法能命中，带时分的串一根都不着色。这里统一截到日。
 *    两个键都填 CSS 变量而不是色值，明暗主题各自跟着 token 走（变量本体声明在组件的样式块里）。
 * 9. **`date_format` 这个选项在本能力里不暴露**：1.2.2 读的是 `view_mode.date_format || options.date_format`，
 *    而内置 7 档每个都自带 `date_format`，顶层传了永远被短路；要改每档表头格式只能传整份档位对象，
 *    那等于把库的 `DEFAULT_VIEW_MODES` 抄一份进本包，抄错一格就是"表头与条不对齐"这种难查的错位。
 *
 * 不做的事：不猜字段（哪列是起止、哪列是名称必须由 DSL 声明，猜错的表现是整图错位，比"没配"更难查）、
 * 不做渲染、不做取数、不 import `frappe-gantt`（连类型都只用本文件的字面量类型，
 * 那个库的类型声明只允许出现在 `src/types/frappe-gantt.d.ts` 与组件层）。
 */

import type { GanttFieldMap, GanttViewMode, Row, WidgetOptions } from './types';

import dayjs from 'dayjs';

import { isBlankCell, toNumberValue } from './number';

/** 归一后的时间值：粒度决定 frappe 是"补一整天"还是"按时刻画"，文本已是 frappe 认得的格式 */
export interface GanttDateValue {
  granularity: 'date' | 'datetime';
  text: string;
}

/** 被丢弃行的原因枚举（字面量字典序，方便与组件提示文案对照） */
export type GanttSkipReason =
  | 'end-before-start'
  | 'invalid-end'
  | 'invalid-start'
  | 'missing-end'
  | 'missing-start'
  | 'span-too-long';

/** 一条被跳过的行：带原行号与最终 id（含兜底 id），方便宿主回捞到底是哪一行 */
export interface GanttSkippedRow {
  id: string;
  index: number;
  reason: GanttSkipReason;
}

/** 喂给 frappe 的任务形状：progress 已归一到 0~100，dependencies 已是消毒后的 id 数组 */
export interface GanttTask {
  dependencies: string[];
  end: string;
  /** 分组列的值原样透传（frappe 本身不画泳道，留作 custom_class 或宿主自定义用） */
  group?: string;
  id: string;
  name: string;
  progress: number;
  start: string;
}

/** 一次映射的产物：可画的条 + 被挡掉的行（为什么分开返回：组件要对两者分别给态） */
export interface GanttBuildResult {
  skipped: GanttSkippedRow[];
  tasks: GanttTask[];
}

/** 纯日期串：只有 `YYYY-MM-DD` 本体才当"到天"处理，其余按带时刻处理 */
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/u;
/** frappe 视为异常数据的十年边界（恰好十年不算超，别和库的判定错开一格） */
const MAX_SPAN_YEARS = 10;

/**
 * 任意日期值 → frappe 认得的文本 + 粒度。
 *
 * 接受毫秒时间戳 / `Date` / 能被 dayjs 解析的字符串（含 `YYYY-MM-DD`、空格分隔的 datetime、带 `T`/`Z` 的 ISO）。
 * 非 number/string/Date、空串、解析不出（`'N/A'`/`'-'`/`'待定'`/`NaN` 日期）一律返回 `null` ——
 * 绝不"兜底成今天"：`dayjs(undefined)` 是当前时刻，少一道守卫就会把"没填日期"的报表行画成"今天开始"，
 * 那种条在图上看不出错，错的只有结论。
 */
export function toGanttDate(value: unknown): GanttDateValue | null {
  if (value === null || value === undefined || value === '') return null;

  // Date 实例总是带时刻语义（哪怕时分秒为 0），按 datetime 走，避免丢掉"当天 00:00 截止"这类信息
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return {
      granularity: 'datetime',
      text: dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
    };
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const stamped = dayjs(value);
    if (!stamped.isValid()) return null;
    return {
      granularity: 'datetime',
      text: stamped.format('YYYY-MM-DD HH:mm:ss'),
    };
  }

  if (typeof value !== 'string') return null; // 布尔 / 对象 / 数组都不是日期

  const parsed = dayjs(value);
  if (!parsed.isValid()) return null;
  // 粒度按"输入串本身长什么样"判断而不是格式化后再看：'YYYY-MM-DD' 判 date（交给 frappe 补一整天），
  // 带时分（空格或 T）判 datetime，原样落到秒；Z 后缀已被 dayjs 折进本地时刻，这里不再单独判
  if (DATE_ONLY_RE.test(value.trim())) {
    return { granularity: 'date', text: parsed.format('YYYY-MM-DD') };
  }
  return {
    granularity: 'datetime',
    text: parsed.format('YYYY-MM-DD HH:mm:ss'),
  };
}

/**
 * 进度值 → frappe 需要的 0~100。
 *
 * frappe 内部按 `条宽 * progress / 100` 画进度段，所以 BI 里常见的 0~1 比率必须放大，
 * 否则 0.4 会被当成 0.4% 而几乎看不见。判定：数值 ≤ 1 视为比率（×100），否则视为已是百分数。
 * `'12.5%'` 这类带百分号的串交给 `toNumberValue`（它会 /100 变成 0.125），再由比率分支还原成 12.5。
 * 非数值 / 空按 0（frappe 对缺省 progress 也是 0），越界夹回 [0,100]，保留两位小数与库弹窗精度一致。
 */
export function toGanttProgress(value: unknown): number {
  const numeric = toNumberValue(value);
  if (numeric === null) return 0;
  const percent = numeric <= 1 ? numeric * 100 : numeric;
  return Math.round(Math.min(100, Math.max(0, percent)) * 100) / 100;
}

/** 单元格文本：`null`/`undefined` 归一为空串，其余按字符串化（与透视/聚合同一套"空值不是 undefined"） */
function cellText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

/**
 * 依赖列 → 依赖 id 数组（去空、去重、保序）。
 *
 * 兼容三种手写习惯：数组 `['1','2']`、逗号串 `'1,2'`、空格/分号混写 `'1 2;3'`。
 * 这里只做切分与清洗，**不做悬空判定**（那要等全部任务算完才知道谁是悬空），故拆成独立小函数。
 */
function splitDependencies(value: unknown): string[] {
  if (value === null || value === undefined || value === '') return [];
  const rawParts = Array.isArray(value)
    ? value.map((item) => cellText(item))
    : cellText(value).split(/[\s,;]+/u);
  const picked: string[] = [];
  const seen = new Set<string>();
  for (const part of rawParts) {
    const dep = part.trim();
    if (dep === '' || seen.has(dep)) continue;
    seen.add(dep);
    picked.push(dep);
  }
  return picked;
}

/** 稳定 id：配了 id 列且非空取列值，否则按行序号兜底（`r1`/`r2`…）——绝不用随机，否则刷新一次依赖锚点全漂移 */
function taskIdOf(row: Row, fieldMap: GanttFieldMap, index: number): string {
  const raw = fieldMap.id === undefined ? undefined : row[fieldMap.id];
  return isBlankCell(raw) ? `r${index + 1}` : cellText(raw);
}

/** 名称：缺 name 列或空值时回落成 id，保证条上永远有一段可读文字而不是 undefined */
function taskNameOf(row: Row, fieldMap: GanttFieldMap, id: string): string {
  const raw = fieldMap.name === undefined ? undefined : row[fieldMap.name];
  return isBlankCell(raw) ? id : cellText(raw);
}

/** 分组值：缺列或空返回 `undefined`（不进 tasks 的 group 键），有值原样透传 */
function groupOf(row: Row, fieldMap: GanttFieldMap): string | undefined {
  const raw = fieldMap.group === undefined ? undefined : row[fieldMap.group];
  return isBlankCell(raw) ? undefined : cellText(raw);
}

/** 第一趟筛出的"画得出来"的行：起止已归一、依赖预切、进度已量纲化，等第二趟反查依赖后转成 GanttTask */
interface SurvivedRow {
  dependencies: string[];
  end: string;
  group: string | undefined;
  id: string;
  name: string;
  progress: number;
  start: string;
}

/**
 * 报表行 + 字段映射 → 可画任务 + 跳过明细。
 *
 * 两趟处理：
 * - 第一趟逐行校验起止（缺 / 非法 / 反向 / 超十年）并挑出合法行，其余带原因丢弃；
 * - 第二趟用"存活任务的 id 集合"反查依赖，把悬空引用与自引用剔掉（指向被丢弃行也算悬空，但当前行仍保留）。
 * 空行数组直接返回 `{ skipped: [], tasks: [] }`，交给组件层走它自己的空态，不在映射层造默认任务。
 * 跨月 / 跨季的合法行原样透传起止字符串，映射层不做任何"取整到月"的多余处理。
 */
export function toGanttTasks(
  rows: readonly Row[],
  fieldMap: GanttFieldMap,
): GanttBuildResult {
  const skipped: GanttSkippedRow[] = [];
  const survived: SurvivedRow[] = [];

  rows.forEach((row, index) => {
    const id = taskIdOf(row, fieldMap, index);
    const rawStart =
      fieldMap.start === undefined ? undefined : row[fieldMap.start];
    const rawEnd = fieldMap.end === undefined ? undefined : row[fieldMap.end];

    // 起止判定顺序固定：先 start 后 end，且"没填"（missing-*）优先于"填了但解析不出"（invalid-*），
    // 组件的跳过提示按这两类分别统计，口径不能在这里漂
    if (isBlankCell(rawStart)) {
      skipped.push({ id, index, reason: 'missing-start' });
      return;
    }
    const startHit = toGanttDate(rawStart);
    if (!startHit) {
      skipped.push({ id, index, reason: 'invalid-start' });
      return;
    }
    if (isBlankCell(rawEnd)) {
      skipped.push({ id, index, reason: 'missing-end' });
      return;
    }
    const endHit = toGanttDate(rawEnd);
    if (!endHit) {
      skipped.push({ id, index, reason: 'invalid-end' });
      return;
    }

    const startMoment = dayjs(startHit.text);
    const endMoment = dayjs(endHit.text);
    // 工期为 0（同日 / 同刻）是合法里程碑，允许相等；只在结束严格早于开始时丢弃
    if (endMoment.valueOf() < startMoment.valueOf()) {
      skipped.push({ id, index, reason: 'end-before-start' });
      return;
    }
    // 超过十年 frappe 自己会当异常丢掉，这里提前挡并给出原因；恰好十年留在合法侧
    if (endMoment.diff(startMoment, 'year') > MAX_SPAN_YEARS) {
      skipped.push({ id, index, reason: 'span-too-long' });
      return;
    }

    survived.push({
      dependencies: splitDependencies(
        fieldMap.dependencies === undefined
          ? undefined
          : row[fieldMap.dependencies],
      ),
      end: endHit.text,
      group: groupOf(row, fieldMap),
      id,
      name: taskNameOf(row, fieldMap, id),
      progress: toGanttProgress(
        fieldMap.progress === undefined ? undefined : row[fieldMap.progress],
      ),
      start: startHit.text,
    });
  });

  // 第二趟：依赖只能指向"真正会画出来的任务"（existing），自引用同样剔掉
  const existing = new Set(survived.map((item) => item.id));
  const tasks: GanttTask[] = survived.map((item) => {
    const task: GanttTask = {
      dependencies: item.dependencies.filter(
        (dep) => dep !== item.id && existing.has(dep),
      ),
      end: item.end,
      id: item.id,
      name: item.name,
      progress: item.progress,
      start: item.start,
    };
    if (item.group !== undefined) task.group = item.group;
    return task;
  });

  return { skipped, tasks };
}

/* ============================ 二、视图配置 → frappe 的 options ============================ */

/**
 * 库预定义的 7 个档位名（`src/defaults.js` 的 `DEFAULT_VIEW_MODES`）。
 * **顺序按步长从小到大**，与库的内置名单一致；它同时是工具条的按钮顺序，
 * 所以这里不能按字母序排（字母序会把 Quarter Day 排在 Day 前面，看着像"粒度变粗了却跳档"）。
 */
export const GANTT_VIEW_MODES: readonly GanttViewMode[] = [
  'Hour',
  'Quarter Day',
  'Half Day',
  'Day',
  'Week',
  'Month',
  'Year',
];

/** 缺省档位：与 `core/types.ts` 里 `ganttViewMode` 的注释、DSL 的初值同一口径 */
export const DEFAULT_GANTT_VIEW_MODE: GanttViewMode = 'Day';

/** 着色列用的两个 CSS 变量：值一律走变量，本包与组件层都不出现裸色值（声明见 `ReportGantt.vue` 样式块） */
export const GANTT_HOLIDAY_FILL = 'var(--g-holiday-highlight)';
export const GANTT_WEEKEND_FILL = 'var(--g-weekend-highlight-color)';

/** 库的 `holidays` 形状：`{ 填充色: 'weekend' | 日期串数组 }` */
export type GanttHolidayFill = Record<string, 'weekend' | string[]>;

/**
 * 视图配置（本包用驼峰，落到库才转 snake_case）。
 * 只放"库真有对应选项、且报表场景真会调"的键：`upper_header_height` 这类留给出事时宿主
 * 用 `options` 透传，本层不预先铺一堆没人用的开关。
 */
export interface GanttViewConfig {
  /** 任务条高度（px）→ 库的 `bar_height` */
  barHeight?: number;
  /** 一列（一个步长）宽度（px）；不传则用档位自带的 `column_width` → 库的 `column_width` */
  columnWidth?: number;
  /** 额外着色日（节假日）：任意能被 dayjs 认出的写法，最终截成 `YYYY-MM-DD` */
  holidays?: readonly unknown[];
  /** 周末是否着色，缺省 true（与库自身的默认一致） */
  highlightWeekend?: boolean;
  /** 月份/日期名的本地化标签 → 库的 `language`（库内部走 `Intl.DateTimeFormat`） */
  language?: string;
  /** 行间距（px）→ 库的 `padding` */
  padding?: number;
  /** 是否只读（禁掉拖拽与进度手柄）→ 库的 `readonly` */
  readonly?: boolean;
  /** 首屏滚动位置：`'today'` / `'start'` / `'end'` / 具体日期 → 库的 `scroll_to` */
  scrollTo?: string;
  /** 当前档位 */
  viewMode?: GanttViewMode;
  /** 允许切换的档位白名单，顺序即工具条顺序；不传或全非法时用库的 7 档 */
  viewModes?: readonly unknown[];
}

/** 归一化查找表：`'quarter_day'` / `'QUARTER-DAY'` / `'QuarterDay'` 都落到 `'Quarter Day'` */
const VIEW_MODE_LOOKUP = new Map<string, GanttViewMode>(
  GANTT_VIEW_MODES.map((mode) => [
    mode.toLowerCase().replaceAll(/[\s_-]+/gu, ''),
    mode,
  ]),
);

/**
 * 任意写法 → 合法档位名；认不出来回落 `fallback` 而不是 `undefined`。
 * 工具条必须始终有一个选中项，而库里 `change_view_mode(undefined)` 会读 `mode.name` 直接抛。
 */
export function resolveGanttViewMode(
  value: unknown,
  fallback: GanttViewMode = DEFAULT_GANTT_VIEW_MODE,
): GanttViewMode {
  if (typeof value !== 'string') return fallback;
  return (
    VIEW_MODE_LOOKUP.get(value.toLowerCase().replaceAll(/[\s_-]+/gu, '')) ??
    fallback
  );
}

/**
 * 档位白名单 → 库认的 `view_modes`（保序去重）。
 * 非法名在这里剔除，而不是传到运行时让库塞一个 `undefined` 进数组（那会让工具条炸在第 8 个按钮上）。
 * 全非法时退回 7 档：配置写错不该导致"一个档位都切不了"。
 */
export function toGanttViewModes(values?: readonly unknown[]): GanttViewMode[] {
  const picked = (values ?? GANTT_VIEW_MODES)
    .map((value) =>
      VIEW_MODE_LOOKUP.get(
        typeof value === 'string'
          ? value.toLowerCase().replaceAll(/[\s_-]+/gu, '')
          : '',
      ),
    )
    .filter((mode): mode is GanttViewMode => mode !== undefined);
  const unique = [...new Set(picked)];
  return unique.length > 0 ? [...unique] : [...GANTT_VIEW_MODES];
}

/**
 * 节假日列表 → 库的 `holidays`。
 *
 * 每一项先过 `toGanttDate`（与起止同一套合法性判定），再截到日粒度：库按"本地零点"逐日比时间戳，
 * 带时分的串一根都命中不了（口径 8）。去重保序，空的节假日数组不进对象 —— 留一个空数组键
 * 会让库白跑一遍逐日循环。
 * 带 `name` 的对象写法（库会给它画小标签）**故意不支持**：那条分支读的是 `options.holidays.name`
 * —— 要在 holidays 顶层再挂一个 `name` 键才进得去，是上游的形状问题，要标签请由工具条给。
 */
export function toGanttHolidays(
  dates?: readonly unknown[],
  options: { highlightWeekend?: boolean } = {},
): GanttHolidayFill {
  const fills: GanttHolidayFill = {};
  if (options.highlightWeekend ?? true) fills[GANTT_WEEKEND_FILL] = 'weekend';
  const dayTexts = [
    ...new Set(
      (dates ?? [])
        .map((date) => toGanttDate(date)?.text.slice(0, 10))
        .filter((text): text is string => text !== undefined),
    ),
  ];
  if (dayTexts.length > 0) fills[GANTT_HOLIDAY_FILL] = dayTexts;
  return fills;
}

/**
 * 视图配置 → 库的 `options`（snake_case，可直接 `new Gantt(el, tasks, options)`）。
 *
 * 三个不跟配置走的常量都是"外壳归 shadcn、画布归库"的必然结果：
 * - `today_button: false` / `view_mode_select: false`：库自带的两个控件长在画布右上角的
 *   `.side-header` 里，位置与样式由库的 CSS 定，而工具条必须由组件用 shadcn 画，两套并排就是重复按钮；
 * - `container_height: 'auto'`：格子多高是 DSL 栅格的事，库自己去写内联高度会和 `grid-row: span n` 打架。
 *
 * `view_mode` 这里只是"我们想要的那一档"，真正到位靠组件随后再调 `change_view_mode()`（口径 7）。
 */
export function toGanttOptions(
  config: GanttViewConfig = {},
): Record<string, unknown> {
  const viewModes = toGanttViewModes(config.viewModes);
  const options: Record<string, unknown> = {
    bar_height: config.barHeight ?? 24,
    container_height: 'auto',
    holidays: toGanttHolidays(config.holidays, {
      highlightWeekend: config.highlightWeekend,
    }),
    language: config.language ?? 'zh-CN',
    padding: config.padding ?? 12,
    readonly: config.readonly ?? false,
    scroll_to: config.scrollTo ?? 'today',
    today_button: false,
    view_mode: resolveGanttViewMode(config.viewMode, viewModes[0]),
    view_modes: viewModes,
    view_mode_select: false,
  };
  if (config.columnWidth !== undefined)
    options.column_width = config.columnWidth;
  return options;
}

/** 一次改动回抛给宿主的载荷：id + 新旧值，宿主据此写回 DSL / 事实表 */
export interface GanttChangePayload {
  end: string;
  id: string;
  name: string;
  /** 0~100，与库同量纲 */
  progress: number;
  start: string;
}

/**
 * 库回抛的 `task`（+ 回调里的新值）→ 本包的载荷。
 *
 * 新值必须从回调参数取而不是从 task 取：`Bar.date_changed()` 把新值写进 `task._start` / `task._end`
 * （Date），而 `task.start` / `task.end` 这两个字符串**不会更新**；且参数里的 `end` 是"减一秒"的
 * 结束时刻，按 `YYYY-MM-DD` 格式化后恰好是含当天的最后一天，与入口口径对称，宿主写回事实表不会漂一天。
 * 参数缺省时才回落去读 task（`on_click` 这种只给 task 的场合）。
 */
export function toGanttChange(
  task: unknown,
  dates: { end?: unknown; progress?: unknown; start?: unknown } = {},
): GanttChangePayload | undefined {
  if (typeof task !== 'object' || task === null) return undefined;
  const raw = task as Record<string, unknown>;
  if (typeof raw.id !== 'string') return undefined;
  const start = toGanttDate(dates.start ?? raw.start);
  const end = toGanttDate(dates.end ?? raw.end);
  if (!start || !end) return undefined;
  return {
    end: end.text,
    id: raw.id,
    name: typeof raw.name === 'string' ? raw.name : '',
    // 参数里没有新进度时回落去读 task：`on_progress_change` 两个都给，`on_click` 只给 task
    progress: toGanttProgress(dates.progress ?? raw.progress),
    start: start.text,
  };
}

/** 时间窗（工具条旁边那行「2024-01-01 → 2024-01-06」）：只吃 `GanttTask`，空集给 undefined */
export function ganttDateWindow(
  tasks: readonly GanttTask[],
): undefined | { days: number; end: string; start: string } {
  const first = tasks[0];
  if (!first) return undefined;
  let start = first.start;
  let end = first.end;
  for (const task of tasks) {
    if (task.start < start) start = task.start;
    if (task.end > end) end = task.end;
  }
  return { days: dayjs(end).diff(dayjs(start), 'day') + 1, end, start };
}

/** DSL 甘特槽位的键名，`validateReportSpec` 与本包共用，避免两处各写一套字符串 */
export const GANTT_FIELD_MAP_KEYS = [
  'dependencies',
  'end',
  'group',
  'id',
  'name',
  'progress',
  'start',
] as const satisfies readonly (keyof GanttFieldMap)[];

/** 必填槽位：缺任何一个都画不出一条像样的条 */
export const GANTT_REQUIRED_MAP_KEYS = [
  'end',
  'start',
] as const satisfies readonly (keyof GanttFieldMap)[];

function textOf(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * widget 的 `options` → 字段映射 + 视图配置（组件层的唯一入口）。
 *
 * `options.gantt` 缺失时给一个空壳（`start`/`end` 为空串）而不是 `undefined`：
 * 下游一律走 `toGanttTasks`，空串列名会让每一行落到 `missing-start`，
 * 组件据此走空态 —— 比在每个调用点各写一套 null 判断省事，也不会"配置没填就整页报错"。
 */
export function ganttConfigFromWidget(options: WidgetOptions = {}): {
  config: GanttViewConfig;
  fieldMap: GanttFieldMap;
} {
  const raw = options.gantt;
  const fieldMap: GanttFieldMap =
    typeof raw === 'object' && raw !== null
      ? {
          end: textOf((raw as GanttFieldMap).end) ?? '',
          start: textOf((raw as GanttFieldMap).start) ?? '',
        }
      : { end: '', start: '' };
  for (const key of [
    'dependencies',
    'group',
    'id',
    'name',
    'progress',
  ] as const) {
    const value =
      typeof raw === 'object' && raw !== null ? textOf(raw[key]) : undefined;
    if (value !== undefined) fieldMap[key] = value;
  }
  const modes = Array.isArray(options.ganttViewModes)
    ? options.ganttViewModes
    : undefined;
  return {
    config: {
      barHeight:
        typeof options.ganttBarHeight === 'number'
          ? options.ganttBarHeight
          : undefined,
      holidays: Array.isArray(options.ganttHolidays)
        ? options.ganttHolidays
        : undefined,
      language: textOf(options.ganttLanguage),
      readonly:
        typeof options.ganttReadonly === 'boolean'
          ? options.ganttReadonly
          : true,
      viewMode: resolveGanttViewMode(options.ganttViewMode),
      viewModes: modes && modes.length > 0 ? modes : undefined,
    },
    fieldMap,
  };
}

/** 字段映射是否够画：DSL 校验与组件空态判据共用这一个口径 */
export function isGanttFieldMapComplete(
  fieldMap: Partial<GanttFieldMap> | undefined,
): boolean {
  if (!fieldMap) return false;
  return GANTT_REQUIRED_MAP_KEYS.every(
    (key) => typeof fieldMap[key] === 'string' && fieldMap[key] !== '',
  );
}
