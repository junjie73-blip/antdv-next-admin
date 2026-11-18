/**
 * 安全评分：由真实事件的处置率、告警数、高危事件数计算得出。
 * 维度名称与 status 档位保持不变，分数不再随机。
 */

import { SECURITY_ALERTS, SECURITY_EVENTS } from '../../utils/db/security';
import { clampScore, countByDay, lastNDays } from '../../utils/derive';
import { envelope } from '../../utils/response';
import { defineMockRoute } from '../../utils/runtime';

export default defineMockRoute({
  handler: () => {
    const events = [...SECURITY_EVENTS];
    const pending = events.filter((event) => event.status === 'pending').length;
    const critical = events.filter((event) => event.level === 'critical').length;
    const handledRatio = events.length > 0 ? 1 - pending / events.length : 1;

    const dimensions = [
      { name: '身份认证', score: clampScore(98 - pending), status: 'excellent' },
      { name: '数据安全', score: clampScore(90 - SECURITY_ALERTS.length * 2), status: 'good' },
      { name: '访问控制', score: clampScore(88 - pending * 2), status: 'good' },
      { name: '审计合规', score: clampScore(85 - critical * 3), status: 'warning' },
    ];

    const days = lastNDays(30);
    const daily = countByDay(days, events.map((event) => event.createdAt));
    const trend = days.map((_, i) => ({
      date: `${i + 1}日`,
      score: clampScore(92 - daily[i]! * 2),
    }));

    return envelope(
      200,
      {
        totalScore: clampScore(60 + handledRatio * 35),
        dimensions,
        trend,
      },
      'ok',
    );
  },
  method: 'GET',
  path: '/security/score',
});
