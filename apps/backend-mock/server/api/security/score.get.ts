import { faker } from '@faker-js/faker/locale/zh_CN';

import { envelope } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler: () =>
    envelope(
      200,
      {
        totalScore: faker.number.int({ min: 72, max: 95 }),
        dimensions: [
          {
            name: '身份认证',
            score: faker.number.int({ min: 80, max: 98 }),
            status: 'excellent',
          },
          {
            name: '数据安全',
            score: faker.number.int({ min: 65, max: 90 }),
            status: 'good',
          },
          {
            name: '访问控制',
            score: faker.number.int({ min: 70, max: 95 }),
            status: 'good',
          },
          {
            name: '审计合规',
            score: faker.number.int({ min: 55, max: 85 }),
            status: 'warning',
          },
        ],
        trend: Array.from({ length: 30 }, (_, i) => ({
          date: `${i + 1}日`,
          score: faker.number.int({ min: 70, max: 95 }),
        })),
      },
      'ok',
    ),
  method: 'GET',
  path: '/security/score',
});
