/**
 * 行维 × 列维交叉表（透视）。
 *
 * 分层位置：`core/`，纯函数；聚合口径完全复用 `aggregate.applyAgg`，
 * 这里只负责"怎么切格子"，不再实现一遍聚合，避免两处中位数算法走偏。
 *
 * 两个关键口径：
 *
 * 1. **边缘合计按原始事实算，不按格子值相加**。
 *    `sum` 两种算法一致，但 `avg` / `median` 把格子值再平均会得到错误结论
 *    （各格子样本数不同）。所以每个格子/边缘各自持有一份值集合，分别从事实行聚合。
 * 2. **空单元格补 0**。交叉表里"这个组合一条都没有"在业务上就是 0 单、0 元；
 *    需要区分"没有"与"0"的场景请改读 `PivotRow.counts`（每格的样本数）。
 *
 * 列键编码：见 `encodeKey()` —— 用长度前缀而不是分隔符，
 * 字段值里出现任何字符（含分隔符本身）都不会让两个不同的组合拼成同一个键。
 */

import type { DatasetSpec, MeasureSpec, Row } from './types';

import {
  applyAgg,
  buildColumns,
  measureColumnKey,
  normalizeDimension,
} from './aggregate';

/** 交叉表的一列 = 一个列维组合 × 一个度量 */
export interface PivotColumn {
  /** 度量对应的原始字段 key，渲染层据此回查字段格式 */
  field: string;
  /** 在 `PivotRow.values` 里的取值键 */
  key: string;
  /** 列维组合的可读标签，多度量时带中度量名 */
  label: string;
  metricKey: string;
  /** 该列对应的列维取值，供表头做两级合并 */
  parts: string[];
}

export interface PivotRow {
  /** 列键 -> 样本数，用于区分"0"与"没数据" */
  counts: Record<string, number>;
  key: string;
  label: string;
  parts: string[];
  /** 行边缘合计：度量 key -> 值 */
  totals: Record<string, unknown>;
  /** 列键 -> 单元格值（`applyAgg` 的产物，空值已按口径补 0） */
  values: Record<string, unknown>;
}

export interface PivotResult {
  columns: PivotColumn[];
  /** 列维字段 key，按表头从左到右 */
  columnFields: string[];
  /** 列维组合键 -> 度量 key -> 值（列边缘合计） */
  columnTotals: Record<string, Record<string, unknown>>;
  /** 度量 key -> 全表合计 */
  grandTotals: Record<string, unknown>;
  metrics: Array<{ field: string; key: string; label: string }>;
  rows: PivotRow[];
  /** 行维字段 key */
  rowFields: string[];
}

export interface PivotSpec {
  /** 数据集，用于取字段 label 与缺省聚合 */
  dataset?: DatasetSpec;
  /** 参与交叉的度量 */
  measures: MeasureSpec[];
  /** 交叉列维度 */
  pivotColumns: string[];
  /** 行维度；空数组表示只有一行"总计" */
  rowDimensions: string[];
}

function partText(value: unknown): string {
  return String(normalizeDimension(value));
}

/**
 * 长度前缀编码：`['华东','A']` → `"2~华东1~A"`（长度按 UTF-16 码元计）。
 *
 * 为什么不用 `join('|')`：字段值里出现 `|` 时 `['a|b']` 与 `['a','b']` 会撞键，
 * 表现为"两列串成一列"，是透视表最难查也最容易被打到的 bug。
 */
export function encodeKey(parts: readonly unknown[]): string {
  return parts
    .map((part) => {
      const text = partText(part);
      return `${text.length}~${text}`;
    })
    .join('');
}

/** 从行上取维度组合的编码键 */
function keyOf(row: Row, fields: string[]): string {
  return encodeKey(fields.map((field) => row[field]));
}

/** 反过来给 UI 用：从 parts 直接生成表头标签，不必解析编码串 */
function labelOfParts(parts: string[]): string {
  return parts.length === 0 ? '总计' : parts.join(' / ');
}

function lexCompare(a: string[], b: string[]): number {
  const len = Math.max(a.length, b.length);
  for (let index = 0; index < len; index += 1) {
    const x = a[index] ?? '';
    const y = b[index] ?? '';
    if (x === y) continue;
    return x < y ? -1 : 1;
  }
  return 0;
}

/**
 * 主入口。
 *
 * 不做的事：不做排序参数（行列一律按维度字典序升序，保证刷新不抖）、
 * 不做小计（多级行维的小计是明确的扩展点，见文件头口径 1 的取舍）。
 */
export function pivot(rows: Row[], spec: PivotSpec): PivotResult {
  const rowFields = spec.rowDimensions;
  const columnFields = spec.pivotColumns;
  const metrics = spec.measures.map((measure) => ({
    field: measure.field,
    key: measureColumnKey(measure),
    label: metricLabel(measure, spec.dataset),
  }));
  const aggOf = new Map(
    metrics.map((metric) => [
      metric.key,
      spec.measures.find((item) => measureColumnKey(item) === metric.key)!.agg,
    ]),
  );

  const valuesOf = (subset: Row[], field: string, metricKey: string): unknown =>
    applyAgg(
      aggOf.get(metricKey) ?? 'sum',
      subset.map((row) => row[field]),
    );

  const rowGroups = new Map<string, { parts: string[]; rows: Row[] }>();
  const columnGroups = new Map<string, { parts: string[]; rows: Row[] }>();

  for (const row of rows) {
    const rParts = rowFields.map((field) => partText(row[field]));
    const cParts = columnFields.map((field) => partText(row[field]));
    const rKey = encodeKey(rParts);
    const cKey = encodeKey(cParts);
    const column = columnGroups.get(cKey);
    if (column) column.rows.push(row);
    else columnGroups.set(cKey, { parts: cParts, rows: [row] });
    const group = rowGroups.get(rKey);
    if (group) group.rows.push(row);
    else rowGroups.set(rKey, { parts: rParts, rows: [row] });
  }

  const orderedColumns = [...columnGroups.entries()].sort((a, b) =>
    lexCompare(a[1].parts, b[1].parts),
  );
  const cross: PivotColumn[] = [];
  for (const [, column] of orderedColumns) {
    for (const metric of metrics) {
      cross.push({
        field: metric.field,
        key: encodeKey([...column.parts, metric.key]),
        label:
          metrics.length === 1
            ? labelOfParts(column.parts)
            : `${labelOfParts(column.parts)}·${metric.label}`,
        metricKey: metric.key,
        parts: column.parts,
      });
    }
  }
  // 没有列维度时仍然出一列"总计"，否则整张表会是空的
  if (cross.length === 0) {
    for (const metric of metrics) {
      cross.push({
        field: metric.field,
        key: encodeKey([metric.key]),
        label: '总计',
        metricKey: metric.key,
        parts: [],
      });
    }
  }

  const orderedRows = [...rowGroups.entries()].sort((a, b) =>
    lexCompare(a[1].parts, b[1].parts),
  );
  const resultRows: PivotRow[] = orderedRows.map(([key, group]) => {
    const cellBuckets = new Map<string, Row[]>();
    for (const row of group.rows) {
      const cKey = keyOf(row, columnFields);
      const bucket = cellBuckets.get(cKey);
      if (bucket) bucket.push(row);
      else cellBuckets.set(cKey, [row]);
    }

    const cellValues: Record<string, unknown> = {};
    const counts: Record<string, number> = {};
    for (const column of cross) {
      const bucket = cellBuckets.get(encodeKey(column.parts)) ?? [];
      counts[column.key] = bucket.length;
      cellValues[column.key] =
        valuesOf(bucket, column.field, column.metricKey) ?? 0;
    }

    return {
      counts,
      key,
      label: labelOfParts(group.parts),
      parts: group.parts,
      totals: Object.fromEntries(
        metrics.map((metric) => [
          metric.key,
          valuesOf(group.rows, metric.field, metric.key),
        ]),
      ),
      values: cellValues,
    };
  });

  const columnTotals: Record<string, Record<string, unknown>> = {};
  for (const [cKey, column] of orderedColumns) {
    columnTotals[cKey] = Object.fromEntries(
      metrics.map((metric) => [
        metric.key,
        valuesOf(column.rows, metric.field, metric.key),
      ]),
    );
  }

  const grandTotals = Object.fromEntries(
    metrics.map((metric) => [
      metric.key,
      valuesOf(rows, metric.field, metric.key),
    ]),
  );

  return {
    columns: cross,
    columnFields,
    columnTotals,
    grandTotals,
    metrics,
    rows: resultRows,
    rowFields,
  };
}

/** 度量展示名：与 `buildColumns` 保持同一套 label 规则 */
export function metricLabel(
  measure: MeasureSpec,
  dataset?: DatasetSpec,
): string {
  const [column] = buildColumns(
    { dimensions: [], measures: [measure] },
    dataset,
  );
  return column?.label ?? measureColumnKey(measure);
}
