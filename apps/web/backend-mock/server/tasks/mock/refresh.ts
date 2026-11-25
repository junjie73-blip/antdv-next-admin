/**
 * Nitro Task: mock:refresh
 *
 * 刷新热点只读数据的缓存快照：让缓存实例重建、把统计写入 KV、广播变更通知。
 * 不触碰种子数据库，因此快照/一致性验证不会被后台任务污染。
 */
import { defineTask } from 'nitro/task';

import { REALTIME_CHANNELS } from '../../contracts/realtime';
import {
  cacheRegistryStats,
  invalidateMockCaches,
  listCachePolicies,
} from '../../utils/cache/policies';
import { setRefreshedSnapshot } from '../../utils/kv/mock-kv';
import { publishRealtime } from '../../utils/realtime/hub';
import { executeMockTask } from '../../utils/tasks/helpers';

export default defineTask({
  meta: {
    name: 'mock:refresh',
    description: '刷新热点缓存快照并推送数据变更通知',
  },
  async run({ payload }) {
    const wrapped = await executeMockTask('mock:refresh', payload, async () => {
      const cleared = invalidateMockCaches();
      const policies = await listCachePolicies();
      const stats = cacheRegistryStats();
      const snapshot = {
        at: new Date().toISOString(),
        policies: policies.map(({ name, maxAge, swr }) => ({ name, maxAge, swr })),
        activeCacheInstances: stats,
      };
      await setRefreshedSnapshot(snapshot);
      const { delivered } = publishRealtime(
        'mock:data-refreshed',
        snapshot,
        REALTIME_CHANNELS.DATA,
      );
      return { ...snapshot, cleared, delivered };
    });
    return { result: wrapped };
  },
});
