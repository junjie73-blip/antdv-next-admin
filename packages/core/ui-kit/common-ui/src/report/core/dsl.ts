/**
 * 报表 DSL 的体检、迁移与布局工具：`core/`，纯函数。
 *
 * 为什么校验要单独一层而不是散在渲染里：报表 JSON 多半来自后端存储或用户导入，
 * 引用了不存在的字段/数据集时，渲染层能做的只是"少画一根柱子"——用户看到的是图对不上，
 * 而不是"哪里错了"。这里把问题一次列全（**不是遇错即停**），设计器和宿主页面共用同一份诊断。
 *
 * 返回的是问题数组而不是抛错：一份有 3 处毛病的报表应该一次报 3 条，
 * 否则用户改一条、刷新、再看到下一条。
 *
 * 不做的事：不校验表达式语法（交给 `@antdv/graph` 求值器在真正用到时报错）、
 * 不做像素级布局（栅格只有列/行单位，像素由渲染层决定）。
 */

import type {
  AggKind,
  DatasetSpec,
  FieldKind,
  ReportSpec,
  WidgetSpec,
  WidgetType,
} from './types';

/** 当前 DSL 版本；加迁移函数时同步改这里，并在 `MIGRATIONS` 补一条 */
export const CURRENT_SPEC_VERSION = 2;
/** 栅格默认列数，与主流 BI 的 12 列口径一致 */
export const DEFAULT_GRID_COLUMNS = 12;

export type DslIssueCode =
  | 'dataset-unknown'
  | 'field-unknown'
  | 'filter-field-unknown'
  | 'layout-out-of-bounds'
  | 'layout-overlap'
  | 'measure-as-dimension'
  | 'query-missing-measures'
  | 'unsupported-version'
  | 'widget-id-duplicate'
  | 'widget-query-missing'
  | (string & {});

export interface DslIssue {
  code: DslIssueCode;
  /** 出问题的数据集 id（若与 widget 无关） */
  datasetId?: string;
  /** 出问题的字段 key */
  field?: string;
  level: 'error' | 'warning';
  message: string;
  /** 定位到的 widget id：设计器据此高亮那一格，缺省表示报表级问题 */
  widgetId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(
  code: DslIssueCode,
  message: string,
  extra: Partial<DslIssue> = {},
): DslIssue {
  return { code, level: 'error', message, ...extra };
}

/** 一次跑完全部规则。顺序稳定，设计器可以直接按数组下标渲染 */
export function validateReportSpec(
  spec: ReportSpec,
  options: { columns?: number } = {},
): DslIssue[] {
  const columns = options.columns ?? DEFAULT_GRID_COLUMNS;
  const issues: DslIssue[] = [];
  const datasets = new Map<string, DatasetSpec>();
  for (const dataset of spec.datasets ?? []) datasets.set(dataset.id, dataset);

  // 1) widget id 重复：id 是 React/Vue 的 key，也是缓存键，重复会让两格共用一份数据
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const widget of spec.widgets ?? []) {
    if (seen.has(widget.id)) duplicated.add(widget.id);
    seen.add(widget.id);
  }
  for (const id of duplicated) {
    issues.push(
      issue(
        'widget-id-duplicate',
        `widget id「${id}」重复，后面的会覆盖前面的`,
        { widgetId: id },
      ),
    );
  }

  // 2) 栅格越界与重叠
  issues.push(...validateLayout(spec.widgets ?? [], columns));

  // 3) 查询引用
  for (const widget of spec.widgets ?? []) {
    const query = widget.query;
    if (!query) {
      if (widget.type !== 'text') {
        issues.push(
          issue('widget-query-missing', `widget「${widget.id}」没有配置查询`, {
            widgetId: widget.id,
          }),
        );
      }
      continue;
    }
    const dataset = datasets.get(query.datasetId);
    if (!dataset) {
      issues.push(
        issue(
          'dataset-unknown',
          `widget「${widget.id}」引用了不存在的数据集「${query.datasetId}」`,
          {
            datasetId: query.datasetId,
            widgetId: widget.id,
          },
        ),
      );
      continue;
    }
    const fields = new Map(dataset.fields.map((field) => [field.key, field]));

    // gantt 是"一行一任务"的时间轴，读的是原始事实行 + options.gantt 里的字段映射，
    // 不靠聚合度量；因此它没有 measures 是正常配置，不该报「只会是一串分组」。
    if ((query.measures ?? []).length === 0 && widget.type !== 'gantt') {
      issues.push(
        issue(
          'query-missing-measures',
          `widget「${widget.id}」没有选择度量，结果只会是一串分组`,
          {
            widgetId: widget.id,
          },
        ),
      );
    }

    for (const dimension of query.dimensions ?? []) {
      const field = fields.get(dimension);
      if (!field) {
        issues.push(
          issue(
            'field-unknown',
            `维度「${dimension}」不在数据集「${dataset.id}」里`,
            {
              field: dimension,
              widgetId: widget.id,
            },
          ),
        );
        continue;
      }
      // 4) 度量当维度用：会让基数极高的字段（订单号）把分组炸开
      if (field.kind === 'measure') {
        issues.push(
          issue(
            'measure-as-dimension',
            `「${dimension}」是度量，不该作为维度分组`,
            {
              field: dimension,
              widgetId: widget.id,
            },
          ),
        );
      }
    }

    for (const measure of query.measures ?? []) {
      if (!fields.has(measure.field)) {
        issues.push(
          issue(
            'field-unknown',
            `度量字段「${measure.field}」不在数据集「${dataset.id}」里`,
            {
              field: measure.field,
              widgetId: widget.id,
            },
          ),
        );
      }
    }
  }

  // 5) 过滤器字段
  for (const filter of spec.filters ?? []) {
    const datasetId = filter.datasetId ?? spec.datasets?.[0]?.id;
    const dataset =
      datasetId === undefined ? undefined : datasets.get(datasetId);
    if (!dataset) {
      issues.push(
        issue(
          'filter-field-unknown',
          `过滤器「${filter.field}」找不到可校验的数据集`,
          {
            field: filter.field,
          },
        ),
      );
      continue;
    }
    if (!dataset.fields.some((field) => field.key === filter.field)) {
      issues.push(
        issue(
          'filter-field-unknown',
          `过滤器字段「${filter.field}」不在数据集「${dataset.id}」里`,
          {
            datasetId: dataset.id,
            field: filter.field,
          },
        ),
      );
    }
  }

  return issues;
}

/** 栅格体检：负坐标 / 零宽高 / 超出列数 / 两格重叠 */
function validateLayout(widgets: WidgetSpec[], columns: number): DslIssue[] {
  const issues: DslIssue[] = [];
  const placed: Array<{
    id: string;
    x1: number;
    x2: number;
    y1: number;
    y2: number;
  }> = [];

  for (const widget of widgets) {
    const { h, w, x, y } = widget.layout ?? { h: 0, w: 0, x: 0, y: 0 };
    if (x < 0 || y < 0 || w <= 0 || h <= 0) {
      issues.push(
        issue(
          'layout-out-of-bounds',
          `widget「${widget.id}」的栅格不合法（x=${x}, y=${y}, w=${w}, h=${h}）`,
          { widgetId: widget.id },
        ),
      );
      continue;
    }
    if (x + w > columns) {
      issues.push(
        issue(
          'layout-out-of-bounds',
          `widget「${widget.id}」宽 ${w} 从第 ${x} 列起，超出 ${columns} 列栅格`,
          { widgetId: widget.id },
        ),
      );
    }
    placed.push({ id: widget.id, x1: x, x2: x + w, y1: y, y2: y + h });
  }

  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      const a = placed[i]!;
      const b = placed[j]!;
      if (a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2) {
        issues.push(
          issue(
            'layout-overlap',
            `widget「${a.id}」与「${b.id}」在栅格上重叠`,
            {
              widgetId: a.id,
            },
          ),
        );
      }
    }
  }
  return issues;
}

/** 顺序流式布局：按声明序从左到右、从上到下填，落点取当前最矮的位置 */
export function autoLayout(
  widgets: Array<Pick<WidgetSpec, 'layout'>>,
  columns = DEFAULT_GRID_COLUMNS,
): WidgetSpec['layout'][] {
  const height = Math.max(columns, 1);
  const columnHeights = Array.from({ length: height }, () => 0);
  return widgets.map((widget) => {
    const w = Math.min(Math.max(Math.round(widget.layout.w || 1), 1), height);
    const h = Math.max(Math.round(widget.layout.h || 1), 1);
    let bestX = 0;
    let bestY = Number.POSITIVE_INFINITY;
    for (let x = 0; x + w <= height; x += 1) {
      let y = 0;
      for (let k = x; k < x + w; k += 1) y = Math.max(y, columnHeights[k]!);
      if (y < bestY) {
        bestY = y;
        bestX = x;
      }
    }
    for (let k = bestX; k < bestX + w; k += 1) columnHeights[k] = bestY + h;
    return { h, w, x: bestX, y: bestY };
  });
}

/** 重算并写回布局：新增 widget 时用它把整张报表压紧凑 */
export function relayout(
  spec: ReportSpec,
  columns = DEFAULT_GRID_COLUMNS,
): ReportSpec {
  const layouts = autoLayout(spec.widgets, columns);
  return {
    ...spec,
    widgets: spec.widgets.map((widget, index) => ({
      ...widget,
      layout: layouts[index]!,
    })),
  };
}

const WIDGET_DEFAULT_SIZE: Record<WidgetType, { h: number; w: number }> = {
  chart: { h: 8, w: 6 },
  gantt: { h: 10, w: 12 },
  kpi: { h: 4, w: 3 },
  pivot: { h: 8, w: 12 },
  table: { h: 8, w: 12 },
  text: { h: 2, w: 12 },
};

/** 新 widget 的形状：设计器只填 id/type，其余给 BI 常用初值 */
export function createWidget(
  id: string,
  type: WidgetType,
  options: {
    datasetId?: string;
    dimensions?: string[];
    measures?: Array<{ agg: AggKind; field: string }>;
    title?: string;
  } = {},
): WidgetSpec {
  const size = WIDGET_DEFAULT_SIZE[type] ?? { h: 6, w: 6 };
  const widget: WidgetSpec = {
    id,
    layout: { h: size.h, w: size.w, x: 0, y: 0 },
    type,
  };
  if (options.title !== undefined) widget.title = options.title;
  if (type !== 'text') {
    widget.query = {
      datasetId: options.datasetId ?? '',
      dimensions: options.dimensions ?? [],
      measures: options.measures ?? [],
    };
  }
  if (type === 'text') widget.options = { text: options.title ?? '说明' };
  if (type === 'chart') widget.options = { chartType: 'bar' };
  // gantt 的字段映射必须由用户/宿主指定（哪列是起止、哪列是名称），这里只给视图初值，不猜字段
  if (type === 'gantt') widget.options = { ganttViewMode: 'Day' };
  return widget;
}

let sequence = 0;

/** widget / 报表 id：带前缀便于在 DOM 与错误信息里一眼看出类型，不引 uuid 依赖 */
export function nextReportId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}`;
}

/** 新建一张空报表。数据集/过滤器请由宿主或设计器再填 */
export function createEmptyReport(
  options: { dataset?: DatasetSpec; id?: string; name?: string } = {},
): ReportSpec {
  const datasets = options.dataset ? [options.dataset] : [];
  return {
    datasets,
    filters: [],
    id: options.id ?? 'report-new',
    name: options.name ?? '未命名报表',
    version: CURRENT_SPEC_VERSION,
    widgets: [],
  };
}

/**
 * 深拷贝。
 *
 * 优先 `structuredClone`（设计器里的 spec 只会有 JSON 值，语义与 JSON 往返一致但更快），
 * 老运行时退回 JSON 往返；两条路都会丢掉函数与 undefined 字段 —— 这正是我们想要的，
 * spec 本来就该是可序列化的一段 JSON。
 */
export function cloneReport(spec: ReportSpec): ReportSpec {
  if (typeof structuredClone === 'function') return structuredClone(spec);
  return JSON.parse(JSON.stringify(spec)) as ReportSpec;
}

/* ------------------------------- 版本迁移 ------------------------------- */

type Migration = (input: unknown) => unknown;

/**
 * 迁移注册表：`from 版本 -> 升到 from+1 的函数`。
 *
 * 为什么每步只升一格而不是一步到位：报表会跳版本（v1 直接到 v4），
 * 链式复用中间步骤比写 3 个组合迁移便宜，也保证新增版本时老报表仍然走得通。
 */
const MIGRATIONS: Record<number, Migration> = {
  1: upgradeV1ToV2,
};

/**
 * v1 → v2（示例迁移，也是"以后加 v3 该长什么样"的样板）：
 * - `query.measures` 从 `'sum:sales'` 字符串数组变成 `{ agg, field }` 对象数组；
 * - `widget.type: 'graph'` 并入 `'chart'`，原 `options.graphType` 改名 `options.chartType`；
 * - `field.role: 'dim' | 'metric'` 统一成 `field.kind: 'dimension' | 'measure'`。
 */
function upgradeV1ToV2(input: unknown): unknown {
  if (!isRecord(input)) return input;
  const widgets = Array.isArray(input.widgets) ? input.widgets : [];
  return {
    ...input,
    datasets: Array.isArray(input.datasets)
      ? input.datasets.map((dataset: unknown) =>
          isRecord(dataset) && Array.isArray(dataset.fields)
            ? {
                ...dataset,
                fields: dataset.fields.map((field: unknown) => {
                  if (!isRecord(field) || field.kind !== undefined)
                    return field;
                  const kind: FieldKind =
                    field.role === 'metric' ? 'measure' : 'dimension';
                  const { role: _role, ...rest } = field;
                  return { ...rest, kind };
                }),
              }
            : dataset,
        )
      : [],
    version: 2,
    widgets: widgets.map((widget: unknown) => {
      if (!isRecord(widget)) return widget;
      const next = { ...widget };
      if (next.type === 'graph') {
        next.type = 'chart';
        const options = isRecord(next.options) ? next.options : {};
        const { graphType, ...rest } = options;
        next.options = { ...rest, chartType: graphType ?? 'bar' };
      }
      const query = isRecord(next.query) ? next.query : undefined;
      if (query && Array.isArray(query.measures)) {
        next.query = {
          ...query,
          measures: query.measures.map((measure: unknown) => {
            if (typeof measure === 'string') {
              const [agg = 'sum', field = ''] = measure.split(':');
              return { agg, field };
            }
            return measure;
          }),
        };
      }
      return next;
    }),
  };
}

/** 支持从任意历史版本升级到当前版本；版本未知时抛错而不是"猜着渲染" */
export function upgradeSpec(spec: unknown, fromVersion: number): ReportSpec {
  if (fromVersion > CURRENT_SPEC_VERSION) {
    throw new ReportDslError(
      'unsupported-version',
      `报表版本 ${fromVersion} 高于本包支持的 ${CURRENT_SPEC_VERSION}，请升级 @antdv/common-ui/report`,
    );
  }
  let current: unknown = spec;
  let version = fromVersion;
  while (version < CURRENT_SPEC_VERSION) {
    const migration = MIGRATIONS[version];
    if (!migration) {
      throw new ReportDslError(
        'unsupported-version',
        `缺少 v${version} → v${version + 1} 的迁移函数`,
      );
    }
    current = migration(current);
    version += 1;
  }
  return current as ReportSpec;
}

export class ReportDslError extends Error {
  constructor(
    readonly code: DslIssueCode,
    message: string,
  ) {
    super(message);
    this.name = 'ReportDslError';
  }
}

/** 读一份来历不明的 JSON：先迁移再校验，返回问题列表交给调用方决定是丢弃还是提示 */
export function isReportSpec(value: unknown): value is ReportSpec {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    Array.isArray(value.datasets) &&
    Array.isArray(value.widgets) &&
    typeof value.version === 'number'
  );
}
