/**
 * 聚合引擎：把 `Row[]` 按 `QuerySpec` 折成结果集。
 *
 * 分层位置：`core/`，纯函数，不 import vue、不 import UI、不碰 DOM，也不自己解释表达式 ——
 * 过滤/聚合后条件的求值全部交给 `@antdv/graph` 的受限求值器（本包**不许**出现 `eval` / `new Function`）。
 *
 * 口径都写在这里，改行为等于改口径，要连带改 aggregate 的测试：
 *
 * 1. **数值解析失败按「跳过」而不是「按 0」**：判定表见 `core/number.ts`（`'-'`、`'N/A'`、布尔、Date 都不算数值）。
 *    理由：报表里"没数"的写法千奇百怪，当 0 会把 avg 的分母和增长率悄悄算错，
 *    而跳过让 `avg` 与「样本数」自洽。代价是 `sum` 会漏掉脏数据 —— 脏数据该在上游修。
 * 2. **`count` 数的是「填过的单元格」**：`null` / `undefined` / 空串不计，`'N/A'`、`0`、`false` 都计。
 *    取这条而不是 SQL 的 `COUNT(col)`（空串也算），是因为前端拿到的脏数据里空串通常就是"这行没填"。
 * 3. **null / undefined / 空串维度值归到同一个桶**，桶的展示值是 `UNGROUPED_LABEL`。
 *    代价：源数据里真有一个字面量 `'未分类'` 时两者会合并 —— 这是 BI 的通行做法，
 *    比在结果里塞一个不可见哨兵更容易被下游（导出、透视）正确渲染。
 * 4. **排序永远有兜底**：`sort` 比完仍并列时按维度字典序升序，无 `sort` 时直接按维度字典序升序。
 *    字典序是 **UTF-16 码元序**（中文按 Unicode 码位，不是拼音：`丙` < `乙` < `甲`、`渠道` < `直营`），
 *    不这么做的话，两次刷新之间分组顺序会随 Map 插入顺序变化，用户看到的是"图自己抖了"。
 * 5. **合计是全集合计**：不受 `limit` 影响。`limit` 只是"这张图只画前 N 条"，
 *    底部合计行如果跟着变，用户会以为总数变了。
 */

import type { ExpressionEvaluator } from '@antdv/graph';

import type {
  AggKind,
  DatasetSpec,
  FieldMeta,
  FilterSpec,
  FilterValues,
  HavingSpec,
  MeasureSpec,
  QueryResult,
  QuerySpec,
  ResultColumn,
  Row,
  SortSpec,
} from './types';

import { createExpressionEvaluator } from '@antdv/graph';

// 数值判定与"没填"判定统一取自 core/number.ts，见该文件头：两处口径不一致会算出对不上账的数
import { isBlankCell as isBlank, toNumberValue } from './number';

/** 维度值为空时的展示桶名 */
export const UNGROUPED_LABEL = '未分类';
/** 合计行的行首标签 */
export const TOTAL_LABEL = '合计';

/**
 * 分组键的分隔符。用 `\u0000` 是因为它不会出现在正常业务文本里；
 * 更彻底的防串键做法（长度前缀编码）见 `pivot.ts` 的 `encodeKey()`，
 * 这里的键只做 Map 内部索引、不对外暴露，所以简单分隔符够用。
 */
const GROUP_SEPARATOR = '\u0000';

const evaluator: ExpressionEvaluator = createExpressionEvaluator();

const NUMERIC_AGGREGATIONS = new Set<AggKind>([
  'avg',
  'max',
  'median',
  'min',
  'sum',
]);

/** 聚合后过滤里能引用的合法标识符；不在集合内的字符折成 `_`，让表达式仍然可解析 */
export function toIdentifier(raw: string): string {
  const safe = raw.replaceAll(/[^\p{L}\p{N}_$]/gu, '_');
  return /^[\p{N}]/u.test(safe) ? `_${safe}` : safe || '_';
}

/** 给求值器构造上下文：原始键与消毒后的键都能取到，写表达式时不必记两套名字 */
function evaluationScope(row: Row): Row {
  const scope: Row = { ...row };
  for (const [key, value] of Object.entries(row)) {
    const identifier = toIdentifier(key);
    if (!(identifier in scope)) scope[identifier] = value;
  }
  return scope;
}

/**
 * 度量列在结果集里的 key。
 *
 * 有别名用别名（用户会拿它当 `sort.field` / `having.field` 写），
 * 否则用 `agg_field`，保证同字段不同聚合（`sum_sales` 与 `avg_sales`）不撞车。
 */
export function measureColumnKey(measure: MeasureSpec): string {
  return measure.alias?.trim() || `${measure.agg}_${measure.field}`;
}

/** 字段元信息索引；数据集里重复 key 时后写的赢，与设计器「改一个字段」的直觉一致 */
export function fieldMapOf(
  dataset: DatasetSpec | undefined,
): Map<string, FieldMeta> {
  const map = new Map<string, FieldMeta>();
  for (const field of dataset?.fields ?? []) map.set(field.key, field);
  return map;
}

/** 结果列定义：维度在前、度量在后，占比列紧跟它所属的度量列 */
export function buildColumns(
  query: QuerySpecLike,
  dataset?: DatasetSpec,
  options: { percentOfTotal?: boolean } = {},
): ResultColumn[] {
  const fields = fieldMapOf(dataset);
  const columns: ResultColumn[] = [];
  for (const key of query.dimensions) {
    const field = fields.get(key);
    columns.push({
      field: key,
      format: field?.format,
      key,
      kind: 'dimension',
      label: field?.label ?? key,
    });
  }
  for (const measure of query.measures) {
    const field = fields.get(measure.field);
    const column: ResultColumn = {
      agg: measure.agg,
      format: field?.format,
      key: measureColumnKey(measure),
      kind: 'measure',
      label:
        measure.alias ??
        `${aggLabel(measure.agg)}(${field?.label ?? measure.field})`,
    };
    columns.push(column);
    if (options.percentOfTotal && NUMERIC_AGGREGATIONS.has(measure.agg)) {
      columns.push({
        format: { decimals: 2, kind: 'percent' },
        key: `${column.key}_pct`,
        kind: 'measure',
        label: `${column.label}占比`,
      });
    }
  }
  return columns;
}

/** `buildColumns` 只用到这几个字段，单独抽出来方便透视那边复用 */
export interface QuerySpecLike {
  dimensions: string[];
  measures: MeasureSpec[];
}

const AGG_LABELS: Record<AggKind, string> = {
  avg: '平均',
  count: '计数',
  countDistinct: '去重计数',
  first: '首值',
  last: '末值',
  max: '最大',
  median: '中位数',
  min: '最小',
  sum: '求和',
};

export function aggLabel(kind: AggKind): string {
  return AGG_LABELS[kind] ?? kind;
}

/** 维度值归一：空值进同一个展示桶（透视表也用它，保证两处口径一致） */
export function normalizeDimension(value: unknown): boolean | number | string {
  if (value === null || value === undefined) return UNGROUPED_LABEL;
  if (typeof value === 'object')
    return JSON.stringify(value) ?? UNGROUPED_LABEL;
  if (typeof value === 'string')
    return value.trim() === '' ? UNGROUPED_LABEL : value;
  // `number` / `boolean` 原样留给下游（比大小要的是真数值）；`symbol` / `bigint` / 函数
  // 不会出现在取数结果里，兜底转文本只为不往返回类型里塞 `unknown`。
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

/** 非数值类型转成可比较、可去重的字符串表示 */
function comparableKey(value: unknown): string {
  if (typeof value === 'number')
    return Number.isInteger(value) ? String(value) : value.toFixed(10);
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof Date) return String(value.getTime());
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * 对一列值施加一种聚合。
 *
 * 返回类型刻意是 `unknown`：`sum`/`avg` 一定是 `number | null`，
 * 但 `first`/`last` 保留原始单元格类型（日期列的"末值"应该还是日期，不是数字）。
 * 空集合的返回值是各聚合的"中性元"：`sum`/`count` 为 0，其余为 `null`（渲染成 `—`）。
 */
export function applyAgg(kind: AggKind, values: unknown[]): unknown {
  if (kind === 'count') return values.filter((value) => !isBlank(value)).length;
  if (kind === 'countDistinct') {
    const set = new Set<string>();
    for (const value of values)
      if (!isBlank(value)) set.add(comparableKey(value));
    return set.size;
  }
  if (kind === 'first') return values.find((value) => !isBlank(value)) ?? null;
  if (kind === 'last') {
    for (let index = values.length - 1; index >= 0; index -= 1) {
      const value = values[index];
      if (!isBlank(value)) return value;
    }
    return null;
  }

  const numbers = values
    .map((value) => toNumberValue(value))
    .filter((value): value is number => value !== null);

  if (kind === 'sum') return numbers.reduce((acc, n) => acc + n, 0);
  if (kind === 'avg') {
    if (numbers.length === 0) return null;
    return numbers.reduce((acc, n) => acc + n, 0) / numbers.length;
  }
  if (kind === 'max') {
    if (numbers.length === 0) return null;
    return numbers.reduce(
      (acc, n) => Math.max(acc, n),
      Number.NEGATIVE_INFINITY,
    );
  }
  if (kind === 'min') {
    if (numbers.length === 0) return null;
    return numbers.reduce(
      (acc, n) => Math.min(acc, n),
      Number.POSITIVE_INFINITY,
    );
  }
  // median：先排序再取中位；偶数个取中间两个的算术平均（不是"靠右那个"）
  if (kind === 'median') {
    if (numbers.length === 0) return null;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1
      ? sorted[mid]!
      : (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return null;
}

/** 把 `having` 的两种写法统一编译成一个表达式串 */
export function compileHaving(
  having: HavingSpec | undefined,
): string | undefined {
  if (!having) return undefined;
  if ('expr' in having) return having.expr;
  const literal =
    typeof having.value === 'number'
      ? String(having.value)
      : `'${String(having.value)
          .replaceAll('\\', String.raw`\\`)
          .replaceAll("'", String.raw`\'`)}'`;
  return `${toIdentifier(having.field)} ${having.op} ${literal}`;
}

/** 并列时的兜底比较：按维度字典序升序，保证同一份数据两次渲染顺序一致 */
function compareByDimensions(
  left: Row,
  right: Row,
  dimensions: string[],
): number {
  for (const key of dimensions) {
    const a = String(normalizeDimension(left[key]));
    const b = String(normalizeDimension(right[key]));
    if (a !== b) return a < b ? -1 : 1;
  }
  return 0;
}

/**
 * 单列比较。空值一律排在最后（与升/降序无关）：
 * 报表里"没有数"的行不该抢走榜首，用户点一次排序表头内容就换一批是最难排查的反馈。
 */
function compareSortValues(
  left: unknown,
  right: unknown,
  dir: 'asc' | 'desc',
): number {
  const leftBlank = isBlank(left);
  const rightBlank = isBlank(right);
  if (leftBlank && rightBlank) return 0;
  if (leftBlank) return 1;
  if (rightBlank) return -1;

  const a = toNumberValue(left);
  const b = toNumberValue(right);
  const sign = dir === 'desc' ? -1 : 1;
  if (a !== null && b !== null) {
    if (a === b) return 0;
    return a < b ? -sign : sign;
  }
  const x = String(left);
  const y = String(right);
  if (x === y) return 0;
  return (x < y ? -1 : 1) * sign;
}

function compareRows(
  left: Row,
  right: Row,
  sort: SortSpec[],
  keys: Set<string>,
): number {
  for (const item of sort) {
    if (!keys.has(item.field)) continue;
    const result = compareSortValues(
      left[item.field],
      right[item.field],
      item.dir,
    );
    if (result !== 0) return result;
  }
  return 0;
}

/** 行级过滤：表达式求值为真才保留。表达式语法错会抛 `GraphExpressionError`，由上层落到 widget 的错误态 */
function filterRows(rows: Row[], expressions: string[]): Row[] {
  if (expressions.length === 0) return rows;
  return rows.filter((row) => {
    const scope = evaluationScope(row);
    return expressions.every((expr) => evaluator.test(expr, scope));
  });
}

export interface AggregateOptions {
  /** 追加「占总计百分比」列（仅数值型度量） */
  percentOfTotal?: boolean;
  /** 关掉 rollup 合计；默认计算 */
  totals?: boolean;
}

/**
 * 主入口：分组聚合 + 过滤 + having + 排序 + limit + 合计 + 可选占比列。
 *
 * 不做的事：不取数（行由 `datasource` 给）、不格式化（见 `format.ts`）、
 * 不感知 widget 类型（同一份结果既喂表格也喂图表）。
 */
export function aggregate(
  rows: Row[],
  query: QuerySpec,
  dataset: DatasetSpec | undefined,
  options: AggregateOptions = {},
): QueryResult {
  const dimensions = query.dimensions ?? [];
  const measures = query.measures ?? [];
  const percentOfTotal = options.percentOfTotal ?? false;
  const columns = buildColumns(query, dataset, { percentOfTotal });
  const filtered = filterRows(
    rows,
    (query.filters ?? []).map((item) => item.expr),
  );

  // 分组：Map 保序只为「同值时不额外抖动」，最终顺序仍由 sort + 维度兜底决定
  const groups = new Map<string, Row[]>();
  for (const row of filtered) {
    const key = dimensions
      .map((dimension) => String(normalizeDimension(row[dimension])))
      .join(GROUP_SEPARATOR);
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  const outRows: Row[] = [];
  for (const bucket of groups.values()) {
    const result: Row = {};
    for (const dimension of dimensions) {
      result[dimension] = normalizeDimension(bucket[0]?.[dimension]);
    }
    for (const measure of measures) {
      result[measureColumnKey(measure)] = applyAgg(
        measure.agg,
        bucket.map((row) => row[measure.field]),
      );
    }
    outRows.push(result);
  }

  const totals: Row | undefined =
    options.totals === false
      ? undefined
      : Object.fromEntries(
          measures.map((measure) => [
            measureColumnKey(measure),
            applyAgg(
              measure.agg,
              filtered.map((row) => row[measure.field]),
            ),
          ]),
        );

  if (percentOfTotal && totals) {
    for (const row of outRows) {
      for (const measure of measures) {
        if (!NUMERIC_AGGREGATIONS.has(measure.agg)) continue;
        const key = measureColumnKey(measure);
        row[`${key}_pct`] = ratio(row[key], totals[key]);
      }
    }
  }

  const havingExpr = compileHaving(query.having);
  const kept = havingExpr
    ? outRows.filter((row) => evaluator.test(havingExpr, evaluationScope(row)))
    : outRows;

  const sort = query.sort ?? [];
  const sortableKeys = new Set(columns.map((column) => column.key));
  const dimensionKeys = new Set(dimensions);
  // `Array.prototype.sort` 在各引擎里都稳定，但"稳定"只保证同键相对位置不变，
  // 不保证跨进程一致 —— 所以并列时再按维度显式比一次（文件头第 3 条）。
  const sorted = [...kept].sort((left, right) => {
    const bySort = compareRows(left, right, sort, sortableKeys);
    if (bySort !== 0) return bySort;
    return compareByDimensions(left, right, [...dimensionKeys]);
  });

  const limited =
    query.limit !== undefined && query.limit >= 0
      ? sorted.slice(0, query.limit)
      : sorted;

  return { columns, rows: limited, ...(totals ? { totals } : {}) };
}

/** 占比：分母为 0 / 非数值时给 `null`（渲染成 `—`）而不是 `NaN%` */
function ratio(value: unknown, total: unknown): null | number {
  const n = toNumberValue(value);
  const t = toNumberValue(total);
  if (n === null || t === null || t === 0) return null;
  return n / t;
}

/**
 * 报表级过滤器（`FilterSpec[]` + 面板回抛的取值）在内存里过一遍行。
 *
 * 为什么不编译成表达式串交给求值器：取值是运行时的数组/区间，把它拼成字符串
 * 等于把用户输入接回表达式里，转义一旦漏了就是注入面；这里每种 kind 各自比较，
 * 值永远不参与语法解析。
 *
 * 各 kind 的取值形状（空值视为「不启用该过滤器」）：
 * - `between`：`[from, to]`，两端可各为 `null`，按数值或 ISO 日期字符串闭区间比较；
 * - `in`：数组，行值命中其一即通过；
 * - `select`：标量或数组（数组等同 `in`）；
 * - `number`：`{ max?, min? }`，也可给标量当精确值；
 * - `text`：字符串，大小写不敏感的子串匹配。
 */
export function applyReportFilters(
  rows: Row[],
  filters: FilterSpec[] | undefined,
  values: FilterValues | undefined,
): Row[] {
  if (!filters?.length || !values) return rows;
  const active = filters.filter((filter) => !isBlank(values[filter.field]));
  if (active.length === 0) return rows;

  return rows.filter((row) =>
    active.every((filter) =>
      matchesFilter(row[filter.field], values[filter.field], filter.kind),
    ),
  );
}

function matchesFilter(
  cell: unknown,
  value: unknown,
  kind: FilterSpec['kind'],
): boolean {
  switch (kind) {
    case 'between': {
      if (!Array.isArray(value)) return true;
      return inRange(cell, value[0], value[1]);
    }
    case 'in': {
      if (!Array.isArray(value) || value.length === 0) return true;
      const target = comparableKey(cell);
      return value.some(
        (item) => !isBlank(item) && comparableKey(item) === target,
      );
    }
    case 'number': {
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const range = value as { max?: null | number; min?: null | number };
        return inRange(cell, range.min, range.max);
      }
      return inRange(cell, value as null | number, value as null | number);
    }
    case 'select': {
      if (Array.isArray(value)) {
        if (value.length === 0) return true;
        const target = comparableKey(cell);
        return value.some(
          (item) => !isBlank(item) && comparableKey(item) === target,
        );
      }
      return comparableKey(cell) === comparableKey(value);
    }
    case 'text': {
      if (typeof value !== 'string' || value.trim() === '') return true;
      return String(cell ?? '')
        .toLowerCase()
        .includes(value.trim().toLowerCase());
    }
    default: {
      return true;
    }
  }
}

/** 两端都允许缺界的闭区间；日期按 ISO 字符串比就是按时间比 */
function inRange(cell: unknown, min: unknown, max: unknown): boolean {
  const numeric = toNumberValue(cell);
  const raw = isBlank(cell) ? '' : String(cell);
  for (const bound of [min, max]) {
    if (isBlank(bound)) continue;
    if (numeric !== null) {
      const n = toNumberValue(bound);
      if (n === null) return true;
      if (bound === min && numeric < n) return false;
      if (bound === max && numeric > n) return false;
      continue;
    }
    if (bound === min && raw < String(bound)) return false;
    if (bound === max && raw > String(bound)) return false;
  }
  return true;
}
