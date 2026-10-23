import type { FormSchema } from '../schema';

import { GRID_TOTAL } from './grid';

/**
 * 一行字段。
 *
 * `span` 是这一行**已经占用**的栅格数，动作区靠它决定自己还能占多少（见 `pickActionsSpan`）。
 */
export interface FormRow {
  isDivider: boolean;
  schemas: FormSchema[];
  span: number;
}

/**
 * 按 24 栅格把 schema 切成行。
 *
 * 规则与原实现逐条对应，任何一条改动都会让行分组漂移：
 *
 * - 既没有 `field` 又不是 `Divider` 的 schema 直接跳过（空行不配占一格）。
 * - `Divider` 先 `flush()` 再独占一行：分隔线不能和字段挤在同一行里。
 * - 单个 schema 的 `colProps.span` 超过一整行剩余空间时换行，而不是把它截断。
 *   注意这里**不判断 span 本身是否 > 24**：一个超宽字段独占一行时 `currentSpan`
 *   会大于 24，动作区因此退回整行（见 `pickActionsSpan` 的 `remaining > 0`）。
 */
export function groupSchemasIntoRows(
  schemas: FormSchema[],
  defaultSpan: number,
): FormRow[] {
  const rows: FormRow[] = [];
  let currentRow: FormSchema[] = [];
  let currentSpan = 0;

  const flush = () => {
    if (currentRow.length === 0) return;
    rows.push({ isDivider: false, schemas: currentRow, span: currentSpan });
    currentRow = [];
    currentSpan = 0;
  };

  for (const schema of schemas) {
    if (!schema) continue;
    if (!schema.field && schema.component !== 'Divider') continue;

    if (schema.component === 'Divider') {
      flush();
      rows.push({ isDivider: true, schemas: [schema], span: GRID_TOTAL });
      continue;
    }

    const span = (schema.colProps?.span ?? defaultSpan) as number;
    if (currentSpan + span > GRID_TOTAL) {
      flush();
      currentRow = [schema];
      currentSpan = span;
    } else {
      currentRow.push(schema);
      currentSpan += span;
    }
  }
  flush();
  return rows;
}

/**
 * 动作区能占的栅格数：优先填满**最后一个可见行**的剩余空间，
 * 只剩 Divider 行、或该行已被字段占满（24）时才退回独占一行。
 *
 * 折叠与展开走的是同一个计算（都读同一个"渲染行"数组），切换时动作区只是换宿主行，
 * 不会因为两套规则而抖动。
 */
export function pickActionsSpan(rows: FormRow[]): number {
  const last = rows[rows.length - 1];
  if (!last || last.isDivider) return GRID_TOTAL;
  const remaining = GRID_TOTAL - last.span;
  return remaining > 0 ? remaining : GRID_TOTAL;
}
