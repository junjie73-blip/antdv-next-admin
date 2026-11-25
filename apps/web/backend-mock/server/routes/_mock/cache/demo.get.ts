/**
 * GET /_mock/cache/demo — 缓存能力示例（字典列表的缓存视图）
 *
 * 演示如何用 createMockCache 给高频只读接口加缓存：
 * - TTL / SWR / key 模板由 KV 中的 `config/cache-policies` 动态控制；
 * - `getKey` 把 keyword + 分页参数拼成缓存键，不同查询互不串数据。
 *
 * 该端点放在 routes 下，不进 mock 清单与快照；要在真实业务接口启用，只需把
 * handler 里的读取逻辑包一层 createMockCache（见 docs/RUNTIME_CAPABILITIES.md）。
 */
import { defineHandler } from 'nitro';
import { getQuery } from 'nitro/h3';

import { createMockCache } from '../../../utils/cache/policies';
import { DICT_TYPE_DB } from '../../../utils/db/dict';
import { success } from '../../../utils/response';

interface DictQuery {
  keyword: string;
  pageNum: number;
  pageSize: number;
}

const cachedDictPage = createMockCache(
  'dict:list',
  async ({ keyword, pageNum, pageSize }: DictQuery) => {
    const kw = keyword.toLowerCase();
    const filtered = kw
      ? DICT_TYPE_DB.filter(
          (item) =>
            item.typeName.toLowerCase().includes(kw) ||
            item.typeCode.toLowerCase().includes(kw),
        )
      : [...DICT_TYPE_DB];
    const start = (pageNum - 1) * pageSize;
    return { list: filtered.slice(start, start + pageSize), total: filtered.length };
  },
  {
    getKey: ({ keyword, pageNum, pageSize }) =>
      `${keyword || '*'}:${pageNum}:${pageSize}`,
  },
);

export default defineHandler(async (event) => {
  const query = getQuery(event) as Record<string, string | string[] | undefined>;
  const q: DictQuery = {
    keyword: String(query.keyword ?? ''),
    pageNum: Number(query.pageNum ?? query.page ?? 1) || 1,
    pageSize: Number(query.pageSize ?? 10) || 10,
  };
  return success(await cachedDictPage(q));
});
