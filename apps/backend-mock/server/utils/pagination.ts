/**
 * 列表端点的统一分页口径。
 *
 * `BasicTable` 在 `useDataSource.buildFetchParams` 里固定发 `pageNum` / `pageSize`
 * （见 `packages/core/ui-kit/table-ui/src/hooks/useDataSource.ts`），表格在配了 `:api`
 * 时**不做客户端切片**（`useTableRows.pageRows` 明确把服务端模式短路掉）。
 * 所以任何返回 `{ list, total }` 却不按这两个参数切片的端点，都会让「10 条/页」
 * 变成「整库全量」—— 岗位管理曾经就是这样：选 10 条却渲染 21 行。
 *
 * 两条约定：
 * 1. **没带任何分页参数就返回全量**：部门树、下拉选项、总览统计这类消费者只发
 *    一个筛选条件（甚至什么都不发），它们要的就是完整列表，不能被默认切成 10 条。
 * 2. `total` 永远是**筛选后**的总量，不是当前页条数，否则分页器算不出页数。
 */

export interface PaginationQuery {
  page?: unknown;
  pageNum?: unknown;
  pageSize?: unknown;
  [key: string]: unknown;
}

export interface PagedResult<T> {
  list: T[];
  total: number;
}

const MAX_PAGE_SIZE = 200;

function positiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function paginateList<T>(
  items: T[],
  query: PaginationQuery = {},
): PagedResult<T> {
  const total = items.length;
  const hasPaging =
    query.pageNum !== undefined ||
    query.page !== undefined ||
    query.pageSize !== undefined;

  if (!hasPaging) return { list: items, total };

  const page = positiveInt(query.pageNum ?? query.page, 1);
  const size = Math.min(positiveInt(query.pageSize, 10), MAX_PAGE_SIZE);
  const start = (page - 1) * size;
  return { list: items.slice(start, start + size), total };
}
