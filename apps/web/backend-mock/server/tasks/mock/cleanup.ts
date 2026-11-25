/**
 * Nitro Task: mock:cleanup
 *
 * 过期资源清理：删除带 expiresAt 的临时 KV 键、截断任务历史、失效过期缓存实例。
 * 只动 KV 与缓存，不删种子数据。
 */
import { defineTask } from 'nitro/task';

import { REALTIME_CHANNELS } from '../../contracts/realtime';
import { invalidateMockCaches } from '../../utils/cache/policies';
import {
  removeExpiredKeys,
  trimTaskHistory,
} from '../../utils/kv/mock-kv';
import { publishRealtime } from '../../utils/realtime/hub';
import { executeMockTask } from '../../utils/tasks/helpers';

export default defineTask({
  meta: {
    name: 'mock:cleanup',
    description: '清理过期 KV 键、截断任务历史并回收缓存',
  },
  async run({ payload }) {
    const wrapped = await executeMockTask('mock:cleanup', payload, async () => {
      const keep = Number(payload.keep ?? 50);
      const [expiredKeys, trimmedHistory] = await Promise.all([
        removeExpiredKeys(),
        trimTaskHistory(Number.isFinite(keep) ? Math.max(1, keep) : 50),
      ]);
      const caches = invalidateMockCaches();
      const { delivered } = publishRealtime(
        'mock:cleanup-done',
        { expiredKeys, trimmedHistory, caches },
        REALTIME_CHANNELS.SYSTEM,
      );
      return { expiredKeys, trimmedHistory, caches, delivered };
    });
    return { result: wrapped };
  },
});
