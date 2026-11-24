/**
 * 安全态势统计：按威胁类型、来源地区、日期对真实安全事件做聚合。
 * 原先每次请求即时取随机数，现在所有数值都来自持久化的事件记录。
 */

import { SECURITY_EVENTS } from '../../utils/db/security';
import { countByDay, lastNDays } from '../../utils/derive';
import { envelope } from '../../utils/response';
import { defineMockRoute } from '../../utils/runtime';

const THREAT_KEYWORDS = ['XSS', 'SQL注入', 'CSRF', '暴力破解'] as const;
const THREAT_NAMES = [
  'XSS攻击',
  'SQL注入',
  'CSRF攻击',
  '暴力破解',
  '扫描探测',
] as const;
const REGIONS = [
  '北京',
  '上海',
  '广州',
  '深圳',
  '杭州',
  '成都',
  '海外',
] as const;

/** 与旧 toLocaleDateString('zh-CN') 的展示格式一致 */
function formatCN(date: string): string {
  const [year, month, day] = date.split('-');
  return `${Number(year)}/${Number(month)}/${Number(day)}`;
}

export default defineMockRoute({
  handler: () => {
    const events = [...SECURITY_EVENTS];

    const threatDistribution = THREAT_NAMES.map((name, index) => ({
      name,
      value:
        index < THREAT_KEYWORDS.length
          ? events.filter((event) =>
              event.title.includes(THREAT_KEYWORDS[index]!),
            ).length
          : events.filter(
              (event) =>
                event.type === 'attack_attempt' &&
                !THREAT_KEYWORDS.some((keyword) =>
                  event.title.includes(keyword),
                ),
            ).length,
    }));

    const attackSources = REGIONS.map((region) => ({
      region,
      value: events.filter((event) => event.location === region).length,
    }));

    const days = lastNDays(14);
    const daily = countByDay(
      days,
      events.map((event) => event.createdAt),
    );
    const dailyEvents = days.map((date, i) => ({
      date: formatCN(date),
      count: daily[i]!,
    }));
    const responseTime = days.map((date, i) => ({
      date: formatCN(date),
      avgMs: 50 + daily[i]! * 20,
    }));

    return envelope(
      200,
      { threatDistribution, attackSources, dailyEvents, responseTime },
      'ok',
    );
  },
  method: 'GET',
  path: '/security/stats',
});
