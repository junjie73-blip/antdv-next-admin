/**
 * 安全中心数据层。
 *
 * 旧实现每次请求都重新生成事件与告警（刷新即变、处置结果不保留）；
 * 现在改为一次性写入真实存储的确定性内置数据，接口做真实查询/分页/状态更新。
 */

import { builtin } from '../builtin-data';
import { defineCollection } from './sqlite';


export type SecurityEventLevel = 'critical' | 'high' | 'low' | 'medium';
export type SecurityEventStatus = 'dismissed' | 'handled' | 'pending';
export type SecurityEventType =
  | 'attack_attempt'
  | 'login_anomaly'
  | 'permission_change'
  | 'sensitive_operation';

export interface SecurityEvent {
  createdAt: string;
  description: string;
  id: string;
  level: SecurityEventLevel;
  location: string;
  sourceIp: string;
  status: SecurityEventStatus;
  title: string;
  type: SecurityEventType;
}

export interface AlertItem {
  actions: string[];
  id: string;
  level: SecurityEventLevel;
  message: string;
  source: string;
  timestamp: string;
}

const eventTypes: SecurityEventType[] = [
  'login_anomaly',
  'permission_change',
  'sensitive_operation',
  'attack_attempt',
];
const eventTitles: Record<SecurityEventType, string[]> = {
  login_anomaly: [
    '异地登录检测',
    '频繁登录失败',
    '异常时间登录',
    '可疑设备登录',
  ],
  permission_change: [
    '管理员权限变更',
    '角色分配变更',
    '菜单权限修改',
    'API权限调整',
  ],
  sensitive_operation: [
    '批量数据导出',
    '敏感配置修改',
    '用户密码重置',
    '数据库备份操作',
  ],
  attack_attempt: [
    'XSS攻击尝试',
    'SQL注入检测',
    'CSRF攻击拦截',
    '暴力破解检测',
  ],
};
const levels: SecurityEventLevel[] = ['critical', 'high', 'medium', 'low'];
const locations = [
  '北京',
  '上海',
  '广州',
  '深圳',
  '杭州',
  '成都',
  '武汉',
  '南京',
];
const alertMessages = [
  '检测到来自异常IP的多次登录失败',
  '管理员账号权限被修改',
  '检测到敏感数据批量导出操作',
  '发现XSS攻击尝试已被拦截',
  '新设备首次登录需要验证',
  'API调用频率超过阈值',
  '发现未授权的配置文件访问',
  '检测到可能的CSRF攻击',
];

/** 内置初始事件（确定性常量表取值，只在表为空时写入一次） */
function initialEvents(count: number): SecurityEvent[] {
  return Array.from({ length: count }, (_, i) => {
    const type = eventTypes[i % eventTypes.length]!;
    const level = levels[i % levels.length]!;
    const titles = eventTitles[type];
    return {
      id: `evt-${builtin.string.uuid()}`,
      type,
      level,
      title: titles[i % titles.length]!,
      description: builtin.lorem.sentence(),
      sourceIp: `${builtin.number.int({ min: 1, max: 255 })}.${builtin.number.int({ min: 0, max: 255 })}.${builtin.number.int({ min: 0, max: 255 })}.${builtin.number.int({ min: 1, max: 254 })}`,
      location: locations[i % locations.length]!,
      createdAt: builtin.date.recent().toISOString(),
      status: (i % 3 === 0 ? 'pending' : 'handled') as SecurityEventStatus,
    };
  });
}

/** 内置初始告警（确定性常量表取值，只在表为空时写入一次） */
function initialAlerts(count: number): AlertItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `alert-${builtin.string.uuid()}`,
    level: levels[i % levels.length]!,
    message: alertMessages[i % alertMessages.length]!,
    source: `192.168.${builtin.number.int({ min: 1, max: 254 })}.${builtin.number.int({ min: 1, max: 254 })}`,
    timestamp: builtin.date.recent({ days: 0.5 }).toISOString(),
      actions: i < 2 ? ['封禁IP', '强制下线'] : ['查看详情', '忽略'],
  }));
}

/** 安全事件实体：真实存储，CRUD 与分页都落在这一份数据上 */
export const SECURITY_EVENTS: SecurityEvent[] = defineCollection<SecurityEvent>({
  seed: () => initialEvents(56),
  table: 'tb_security_event',
});

/** 告警实体：真实存储，处置后状态可持久化 */
export const SECURITY_ALERTS: AlertItem[] = defineCollection<AlertItem>({
  seed: () => initialAlerts(8),
  table: 'tb_security_alert',
});
