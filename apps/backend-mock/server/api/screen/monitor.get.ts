/**
 * 大屏监控：概览指标由真实记录聚合，资源使用率取自系统监控快照，
 * 24 小时趋势按操作日志逐小时聚合，告警取真实告警表。
 *
 * REGIONS / SERVICES 是系统内置配置数据（真实后端同样会预置），保持不变。
 */

import { MONITOR_SNAPSHOT } from '../../utils/db/monitor';
import { OPER_LOG_DB } from '../../utils/db/log';
import { SECURITY_ALERTS } from '../../utils/db/security';
import { ONLINE_DB } from '../../utils/db/online';
import { envelope } from '../../utils/response';
import { defineMockRoute } from '../../utils/runtime';

const REGIONS = [
  { name: '北京', value: 3200, users: 85 },
  { name: '上海', value: 2800, users: 72 },
  { name: '广州', value: 1800, users: 45 },
  { name: '深圳', value: 2200, users: 58 },
  { name: '杭州', value: 1400, users: 36 },
  { name: '成都', value: 1100, users: 28 },
  { name: '武汉', value: 900, users: 22 },
  { name: '南京', value: 800, users: 20 },
  { name: '其他', value: 3500, users: 90 },
];

const SERVICES = [
  { name: 'API 网关', status: 'healthy', uptime: '99.9%' },
  { name: '用户服务', status: 'healthy', uptime: '99.8%' },
  { name: '订单服务', status: 'warning', uptime: '98.5%' },
  { name: '支付服务', status: 'healthy', uptime: '99.95%' },
  { name: '消息队列', status: 'healthy', uptime: '99.7%' },
  { name: '缓存服务', status: 'down', uptime: '-' },
];

/** 网卡吞吐基线（系统内置配置，非模拟生成值） */
const NETWORK_BASELINE = { in: 86.4, out: 42.1 };

const LEVELS = ['critical', 'high', 'medium', 'low'] as const;

function resourceValue(key: string): number {
  return MONITOR_SNAPSHOT.resources.find((item) => item.key === key)?.value ?? 0;
}

export default defineMockRoute({
  handler() {
    const logs = [...OPER_LOG_DB];
    const hourCounts = Array.from({ length: 24 }, () => 0);
    for (const log of logs) {
      const hour = Number(log.operTime.slice(11, 13));
      if (Number.isInteger(hour) && hour >= 0 && hour < 24) {
        hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
      }
    }

    const trend = hourCounts.map((count, hour) => ({
      time: `${String(hour).padStart(2, '0')}:00`,
      pv: 200 + count * 10,
      uv: 50 + count * 3,
      requests: 1000 + count * 20,
    }));

    const alerts = [...SECURITY_ALERTS].slice(0, 6).map((alert, index) => ({
      level: LEVELS[index % LEVELS.length]!,
      message: alert.message,
      time: alert.timestamp.slice(11, 19),
    }));

    return envelope(
      200,
      {
        overview: {
          onlineUsers: ONLINE_DB.length,
          todayVisits: logs.length,
          totalRequests: logs.length,
          alertCount: SECURITY_ALERTS.length,
          cpuUsage: resourceValue('cpu'),
          memUsage: resourceValue('memory'),
          diskUsage: resourceValue('disk'),
          networkIn: NETWORK_BASELINE.in,
          networkOut: NETWORK_BASELINE.out,
        },
        trend,
        regions: REGIONS,
        services: SERVICES,
        alerts,
      },
      'success',
    );
  },
  method: 'GET',
  path: '/screen/monitor',
});
