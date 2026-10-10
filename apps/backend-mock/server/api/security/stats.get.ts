import { faker } from '@faker-js/faker/locale/zh_CN';

import { envelope } from '../../utils/response';
import { defineMockRoute } from '../../utils/runtime';

/**
 * 安全态势统计：legacy 每次请求即时取值（种子在 security 数据层模块加载时固定），
 * 因此同一进程内多次请求会得到延续的随机序列，这里保持同样行为。
 */
export default defineMockRoute({
  handler: () =>
    envelope(
      200,
      {
        threatDistribution: [
          { name: 'XSS攻击', value: faker.number.int({ min: 20, max: 80 }) },
          { name: 'SQL注入', value: faker.number.int({ min: 10, max: 50 }) },
          { name: 'CSRF攻击', value: faker.number.int({ min: 15, max: 60 }) },
          { name: '暴力破解', value: faker.number.int({ min: 30, max: 90 }) },
          { name: '扫描探测', value: faker.number.int({ min: 40, max: 100 }) },
        ],
        attackSources: [
          { region: '北京', value: faker.number.int({ min: 100, max: 500 }) },
          { region: '上海', value: faker.number.int({ min: 80, max: 400 }) },
          { region: '广州', value: faker.number.int({ min: 50, max: 300 }) },
          { region: '深圳', value: faker.number.int({ min: 60, max: 350 }) },
          { region: '杭州', value: faker.number.int({ min: 40, max: 200 }) },
          { region: '成都', value: faker.number.int({ min: 30, max: 180 }) },
          { region: '海外', value: faker.number.int({ min: 200, max: 800 }) },
        ],
        dailyEvents: Array.from({ length: 14 }, (_, i) => ({
          date: faker.date.recent({ days: 14 - i }).toLocaleDateString('zh-CN'),
          count: faker.number.int({ min: 5, max: 50 }),
        })),
        responseTime: Array.from({ length: 14 }, (_, i) => ({
          date: faker.date.recent({ days: 14 - i }).toLocaleDateString('zh-CN'),
          avgMs: faker.number.int({ min: 50, max: 500 }),
        })),
      },
      'ok',
    ),
  method: 'GET',
  path: '/security/stats',
});
