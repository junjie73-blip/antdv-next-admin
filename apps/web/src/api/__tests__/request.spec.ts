import type { R } from '../request';

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `api/request.ts` 是把业务接口语义（`{ code, data, message }`）套到底层
 * `http.Get/Post/...` 上的薄封装。这里钉住一条踩过的位置参数契约：
 *
 * 底层 `request.get(url, params, opts)` 的**第二个实参就是查询串本身**。
 * 曾经写成 `http.Get(url, { params })`，于是发出去的是
 * `?params=[object Object]` —— 全站列表页的筛选与分页条件整批静默丢失，
 * 页面看起来"能打开、永远返回第一页全量数据"，极难从 UI 上发现。
 */

const h = vi.hoisted(() => ({
  calls: [] as { args: unknown[]; method: string }[],
  envelope: { code: 200, data: null as unknown, message: 'ok' } as R<unknown>,
}));

function stub(method: 'Delete' | 'Get' | 'Post' | 'Put') {
  return vi.fn((...args: unknown[]) => {
    h.calls.push({ args, method });
    return Promise.resolve({ data: h.envelope });
  });
}

vi.mock('~/composables', () => ({
  http: {
    Delete: stub('Delete'),
    Get: stub('Get'),
    Post: stub('Post'),
    Put: stub('Put'),
  },
}));

const { del, get, post, put } = await import('../request');

function lastArgs(): unknown[] {
  const call = h.calls.at(-1);
  if (!call) throw new Error('断言失败：没有任何请求发出');
  return call.args;
}

beforeEach(() => {
  h.calls.length = 0;
});

describe('api/request —— 查询串按位置参数透传', () => {
  it('get 把 params 直接作为第二个实参，不再包一层 { params }', async () => {
    await get('/user/list', { page: 2, keyword: '张三' });

    expect(lastArgs()).toEqual(['/user/list', { page: 2, keyword: '张三' }]);
  });

  it('get 不传 params 时保持单参调用，不会拼出空对象', async () => {
    await get('/user/list');

    expect(lastArgs()).toEqual(['/user/list', undefined]);
  });

  it('del 同样按位置参数带查询串', async () => {
    await del('/user/1', { hard: true });

    expect(lastArgs()).toEqual(['/user/1', { hard: true }]);
  });

  /** post/put 第二个位置参数是请求体，查询串只能走 opts.params —— 两者都要活着 */
  it('post 带查询串时把 body 与 opts.params 分开传', async () => {
    await post('/file/folder', { name: '报表' }, { parentId: 7 });

    expect(lastArgs()).toEqual([
      '/file/folder',
      { name: '报表' },
      { params: { parentId: 7 } },
    ]);
  });

  it('post 不带查询串时不多传第三个实参', async () => {
    await post('/user', { name: '李四' });

    expect(lastArgs()).toEqual(['/user', { name: '李四' }, undefined]);
  });

  it('put 带查询串走同一条规则', async () => {
    await put('/user/1', { name: '王五' }, { silent: true });

    expect(lastArgs()).toEqual([
      '/user/1',
      { name: '王五' },
      { params: { silent: true } },
    ]);
  });

  it('封装会解掉外层响应壳，直接给出 envelope', async () => {
    const prev = h.envelope;
    h.envelope = { code: 200, data: { list: [1] }, message: 'ok' };

    await expect(get<number[]>('/x')).resolves.toEqual(h.envelope);

    h.envelope = prev;
  });
});
