import type { TestEvent } from './fixtures/nitro-imports';

import { describe, expect, it } from 'vitest';

import alertListRoute from '../server/api/security/alerts/list.get';
import deptListRoute from '../server/api/system/dept/list.get';
import postListRoute from '../server/api/system/post/list.get';
import roleListRoute from '../server/api/system/role/list.get';
import { paginateList } from '../server/utils/pagination';
import { createTestEvent } from './fixtures/nitro-imports';

/**
 * 回归「选 10 条/页却渲染全表」。
 *
 * BasicTable 配了 `:api` 之后完全信任后端分页（useTableRows 把服务端模式短路，
 * 不再客户端切片），所以每个返回 `{ list, total }` 的列表端点都必须按
 * `pageNum/pageSize` 切。岗位管理曾漏掉这一步，21 行数据整屏铺出来。
 */

type Envelope = { code: number; data: { list: unknown[]; total: number } };
type Handler = (event: TestEvent) => Promise<Envelope>;

const asHandler = (route: unknown) => route as Handler;

async function query(
  handler: Handler,
  q: Record<string, string> = {},
): Promise<{ list: unknown[]; total: number }> {
  const res = await handler(createTestEvent({ query: q }));
  expect(res.code).toBe(200);
  return res.data;
}

const ROUTES: Array<[string, Handler]> = [
  ['/system/post/list', asHandler(postListRoute)],
  ['/system/role/list', asHandler(roleListRoute)],
  ['/system/dept/list', asHandler(deptListRoute)],
  ['/security/alerts/list', asHandler(alertListRoute)],
];

describe('paginateList', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

  it('没有分页参数时返回全量（下拉 / 树 / 统计消费者要完整列表）', () => {
    const result = paginateList(items, {});
    expect(result.list).toHaveLength(25);
    expect(result.total).toBe(25);
  });

  it('按 pageSize 切片，total 仍是筛选后总量', () => {
    const result = paginateList(items, { pageNum: '1', pageSize: '10' });
    expect(result.list).toHaveLength(10);
    expect(result.total).toBe(25);
    expect(result.list[0]).toEqual({ id: 1 });
  });

  it('第二页是另一批数据，最后一页只返回剩余行', () => {
    const second = paginateList(items, { pageNum: '2', pageSize: '10' });
    expect(second.list[0]).toEqual({ id: 11 });
    expect(
      paginateList(items, { pageNum: '3', pageSize: '10' }).list,
    ).toHaveLength(5);
    expect(
      paginateList(items, { pageNum: '4', pageSize: '10' }).list,
    ).toHaveLength(0);
  });

  it('兼容 legacy `page` 别名，非法参数回落默认值，pageSize 有上限', () => {
    expect(paginateList(items, { page: '2', pageSize: '5' }).list[0]).toEqual({
      id: 6,
    });
    expect(
      paginateList(items, { pageNum: 'abc', pageSize: '-3' }).list,
    ).toHaveLength(10);
    expect(
      paginateList(items, { pageNum: '1', pageSize: '99999' }).list,
    ).toHaveLength(25);
  });
});

describe.each(ROUTES)('$0 遵守分页参数', (_path, handler) => {
  it('pageSize=10 时不超过 10 行，且不改变 total', async () => {
    const all = await query(handler);
    const first = await query(handler, { pageNum: '1', pageSize: '10' });
    expect(first.list.length).toBeLessThanOrEqual(10);
    expect(first.total).toBe(all.total);
  });

  it('翻页取到另一批数据，total 在两页之间保持一致', async () => {
    // 四个端点的数据量都大于 5，第二页必然有行，不需要条件断言
    const first = await query(handler, { pageNum: '1', pageSize: '5' });
    const second = await query(handler, { pageNum: '2', pageSize: '5' });
    expect(first.list).toHaveLength(5);
    expect(second.list.length).toBeGreaterThan(0);
    expect(second.total).toBe(first.total);
    expect(second.list.map((r: any) => r.id)).not.toEqual(
      first.list.map((r: any) => r.id),
    );
  });
});
