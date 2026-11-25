/**
 * GET /_mock/cache/policies — 查看缓存策略与活跃缓存实例
 */
import { defineHandler } from 'nitro';

import {
  cacheRegistryStats,
  listCachePolicies,
} from '../../../utils/cache/policies';
import { success } from '../../../utils/response';

export default defineHandler(async () => {
  const [list, instances] = await Promise.all([
    listCachePolicies(),
    Promise.resolve(cacheRegistryStats()),
  ]);
  return success({ list, instances });
});
