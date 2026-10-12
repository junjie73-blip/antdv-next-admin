import type { TaskRecord } from '../server/utils/db/task';
import type { TestEvent } from './fixtures/nitro-imports';

import { afterEach, describe, expect, it } from 'vitest';

import taskDeleteRoute from '../server/api/demo/task/[id].delete';
import taskDetailRoute from '../server/api/demo/task/[id].get';
import taskUpdateRoute from '../server/api/demo/task/[id].put';
import taskCreateRoute from '../server/api/demo/task/index.post';
import taskListRoute from '../server/api/demo/task/list.get';
import taskOptionsRoute from '../server/api/demo/task/options.get';
import { TASK_DB } from '../server/utils/db/task';
import { createTestEvent } from './fixtures/nitro-imports';

/**
 * 「表格增删改查」示例的数据层：`views/components/table/crud` 把 `useCRUD` 接到这 6 条接口上，
 * 所以示例页能不能跑通"新增 → 查得到 → 编辑 → 删除"这条闭环，全看这里。
 *
 * 两条最容易静默失效的性质，用例围着它们写：
 * 1. **状态化** —— mock 的库是模块级数组（`db/task.ts`），写接口改的就是 handler 随后
 *    要读的那一份。若某次改动把它换成"每次请求现造随机数据"，表现是新增成功但列表里
 *    找不到、删完刷新又回来，而单条响应看起来全都正常。
 * 2. **`total` 是筛选后的条数** —— 写成库总数的话分页器按全量算页数，筛完只剩两条
 *    也能翻出第五页的空表；这是"搜索完翻页就坏"的经典成因。
 *
 * 这批用例共享进程内的那份 `TASK_DB`，所以每条都在 `afterEach` 里还原快照，
 * 免得用例顺序一变就互相看见对方留下的行。
 */

type Handler = (event: TestEvent) => Promise<{
  code: number;
  data: unknown;
  message: string;
}>;

/** defineMockRoute 在测试替身下原样返回处理函数；h3 事件与 TestEvent 不同源，收口一次 */
const asHandler = (route: unknown) => route as Handler;

const list = asHandler(taskListRoute);
const detail = asHandler(taskDetailRoute);
const create = asHandler(taskCreateRoute);
const update = asHandler(taskUpdateRoute);
const remove = asHandler(taskDeleteRoute);
const options = asHandler(taskOptionsRoute);

/** 进用例前先拍一份快照，afterEach 按它还原 */
const SEED = TASK_DB.map((record) => ({ ...record }));

afterEach(() => {
  TASK_DB.length = 0;
  TASK_DB.push(...SEED.map((record) => ({ ...record })));
});

function envelopeData<T>(res: { code: number; data: unknown }): T {
  expect(res.code).toBe(200);
  return res.data as T;
}

/** list 的返回形状：`{ list, total }`，与前端 `RL<T>` 契约一致 */
async function queryList(
  init: Record<string, string> = {},
): Promise<{ list: TaskRecord[]; total: number }> {
  const res = await list(createTestEvent({ query: init }));
  return envelopeData<{ list: TaskRecord[]; total: number }>(res);
}

describe('/demo/task 的状态化读写', () => {
  it('新增的行对随后的 list 立即可见，id 由服务端自增', async () => {
    const before = await queryList({ pageNum: '1', pageSize: '200' });
    const created = envelopeData<TaskRecord>(
      await create(
        createTestEvent({
          body: { owner: '测试负责人', title: '闭环验证任务' },
        }),
      ),
    );
    expect(created.id).toBeGreaterThan(100);

    const after = await queryList({ pageNum: '1', pageSize: '200' });
    expect(after.total).toBe(before.total + 1);
    expect(after.list.map((row) => row.id)).toContain(created.id);
    // 新增时没给的字段由服务端补默认值，页面不必知道这套默认
    expect(created).toMatchObject({
      priority: 'middle',
      progress: 0,
      status: 'pending',
    });
  });

  it('编辑只覆盖请求体里出现的字段，其余保持原值', async () => {
    const target = TASK_DB.find((row) => row.remark !== '')!;
    const res = await update(
      createTestEvent({
        body: { status: 'running' },
        params: { id: String(target.id) },
      }),
    );
    const updated = envelopeData<TaskRecord>(res);

    // 「改个状态，备注没了」就是部分更新写成了整体替换
    expect(updated.status).toBe('running');
    expect(updated.remark).toBe(target.remark);
    expect(updated.title).toBe(target.title);

    const reread = envelopeData<TaskRecord>(
      await detail(createTestEvent({ params: { id: String(target.id) } })),
    );
    expect(reread.status).toBe('running');
  });

  it('删除是硬删：行从库里消失，list 与 detail 都拿不到', async () => {
    const victim = TASK_DB[0]!;
    const res = await remove(
      createTestEvent({ params: { id: String(victim.id) } }),
    );
    expect(res.code).toBe(200);

    const rows = await queryList({ pageNum: '1', pageSize: '200' });
    expect(rows.list.map((row) => row.id)).not.toContain(victim.id);

    const gone = await detail(
      createTestEvent({ params: { id: String(victim.id) } }),
    );
    expect(gone.code).toBe(404);
    expect(gone.data).toBeNull();
  });

  it('写接口不接受客户端塞来的服务端字段', async () => {
    const created = envelopeData<TaskRecord>(
      await create(
        createTestEvent({
          body: {
            createdAt: '1999-01-01 00:00:00',
            id: 7,
            title: '白名单校验',
          },
        }),
      ),
    );
    // id 走自增、createdAt 由服务端打时间戳：表单值能覆盖这两个字段的话，
    // 前端一改 id 就会撞到别人的行上
    expect(created.id).not.toBe(7);
    expect(created.createdAt).not.toBe('1999-01-01 00:00:00');

    const missing = await update(
      createTestEvent({ params: { id: '999999' }, body: { title: 'x' } }),
    );
    expect(missing.code).toBe(404);
  });
});

describe('/demo/task/list 的分页与筛选', () => {
  it('total 跟着筛选条件走，不是库的总数', async () => {
    const all = await queryList({ pageNum: '1', pageSize: '200' });
    const filtered = await queryList({
      pageNum: '1',
      pageSize: '200',
      status: 'done',
    });

    expect(filtered.total).toBe(
      all.list.filter((row) => row.status === 'done').length,
    );
    expect(filtered.list.every((row) => row.status === 'done')).toBe(true);
    // 筛完只有一页的量，第二页就必须是空表：total 写成库总数时这里会翻出货
    expect(
      (await queryList({ pageNum: '2', pageSize: '200', status: 'done' })).list,
    ).toEqual([]);
  });

  it('关键词命中标题、负责人与备注三个字段', async () => {
    const seeded = TASK_DB[0]!;
    for (const value of [seeded.title, seeded.owner, seeded.remark].filter(
      Boolean,
    )) {
      const rows = await queryList({ keyword: String(value).slice(0, 4) });
      expect(rows.total).toBeGreaterThan(0);
    }
    expect((await queryList({ keyword: '这条关键词不存在zzz' })).total).toBe(0);
  });

  it('`page` 与 `pageNum` 都认，且翻到第二页确实是另一批行', async () => {
    const first = await queryList({ pageNum: '1', pageSize: '5' });
    const legacy = await queryList({ page: '1', pageSize: '5' });
    const second = await queryList({ pageNum: '2', pageSize: '5' });

    expect(legacy.list.map((row) => row.id)).toEqual(
      first.list.map((row) => row.id),
    );
    expect(second.list.map((row) => row.id)).not.toEqual(
      first.list.map((row) => row.id),
    );
    expect(first.list).toHaveLength(5);
  });

  it('状态与优先级可以叠加筛选', async () => {
    const rows = await queryList({
      pageNum: '1',
      pageSize: '200',
      priority: 'high',
      status: 'pending',
    });
    expect(
      rows.list.every(
        (row) => row.priority === 'high' && row.status === 'pending',
      ),
    ).toBe(true);
    // 一页装得下全部命中行时，total 就等于这一页的行数
    expect(rows.total).toBe(rows.list.length);
  });
});

/**
 * 枚举只有一个来源：`options` 接口。示例页的筛选控件与编辑表单都从这里取 options，
 * 而库里的值是 `db/task.ts` 用 faker 播种的 —— 两边一旦漂移，
 * 表现是"筛选下拉里没有『被阻塞』，但那批数据永远筛不出来"。
 */
describe('/demo/task 的枚举一致性', () => {
  it('选项集合覆盖库里的全部取值', async () => {
    const data = envelopeData<{
      priority: Array<{ label: string; value: string }>;
      status: Array<{ label: string; value: string }>;
    }>(await options(createTestEvent()));

    const statusValues = new Set(data.status.map((item) => item.value));
    const priorityValues = new Set(data.priority.map((item) => item.value));
    for (const row of TASK_DB) {
      expect(statusValues.has(row.status)).toBe(true);
      expect(priorityValues.has(row.priority)).toBe(true);
    }
    expect(data.status.map((item) => item.label)).toContain('被阻塞');
  });

  it('已完成的行进度钉在 100，不出现「完成 37%」', () => {
    for (const row of TASK_DB.filter((item) => item.status === 'done')) {
      expect(row.progress).toBe(100);
    }
  });
});
