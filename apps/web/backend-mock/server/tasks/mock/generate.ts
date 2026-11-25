/**
 * Nitro Task: mock:generate
 *
 * 生成样例 Mock 数据写入 KV，并通过 WebSocket 推送 `mock:data-generated` 事件。
 * 定时触发默认跳过（见 contracts/tasks.ts）；手动触发：
 *   POST /_mock/tasks/mock:generate  body: { "count": 5 }
 */
import { defineTask } from 'nitro/task';

import { REALTIME_CHANNELS } from '../../contracts/realtime';
import { setGeneratedSnapshot } from '../../utils/kv/mock-kv';
import { publishRealtime } from '../../utils/realtime/hub';
import { executeMockTask } from '../../utils/tasks/helpers';

interface GeneratedItem {
  id: number;
  title: string;
  status: 'active' | 'pending' | 'done';
  createdAt: string;
}

export default defineTask({
  meta: {
    name: 'mock:generate',
    description: '生成样例数据写入 KV 并通过 WebSocket 广播变更',
  },
  async run({ payload }) {
    const wrapped = await executeMockTask('mock:generate', payload, async () => {
      const requested = Number(payload.count ?? 5);
      const count = Number.isFinite(requested)
        ? Math.min(Math.max(Math.trunc(requested), 1), 100)
        : 5;
      const now = Date.now();
      const statuses: readonly GeneratedItem['status'][] = [
        'active',
        'pending',
        'done',
      ];
      const items: GeneratedItem[] = Array.from({ length: count }, (_, index) => ({
        id: index + 1,
        title: `Mock 记录 ${index + 1}`,
        status: statuses[index % statuses.length] ?? 'active',
        createdAt: new Date(now).toISOString(),
      }));
      await setGeneratedSnapshot(items);
      const { delivered } = publishRealtime(
        'mock:data-generated',
        { count, sample: items.slice(0, 3) },
        REALTIME_CHANNELS.DATA,
      );
      return { generated: count, delivered, at: new Date(now).toISOString() };
    });
    return { result: wrapped };
  },
});
