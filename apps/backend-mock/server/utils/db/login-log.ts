/**
 * 登录日志内存库（legacy mock/login-log.fake.ts 的数据层）
 *
 * 数据来自确定性内置表（builtin-data），无随机数、跨重启一致；
 * 等价于真实后端的初始日志数据，后续由真实登录行为累积。
 */

import { BUILTIN_NOW, builtin } from '../builtin-data';
import { defineCollection } from './sqlite';
import dayjs from 'dayjs';


export interface LoginLogRecord {
  browser: string;
  duration: number;
  id: number;
  ip: string;
  location: string;
  loginAccount: string;
  loginTime: string;
  message: string;
  os: string;
  status: 'fail' | 'success';
  userAgent: string;
  username: string;
}

const CHINESE_CITIES = [
  '北京市朝阳区',
  '北京市海淀区',
  '上海市浦东新区',
  '广州市天河区',
  '深圳市南山区',
  '杭州市西湖区',
  '成都市武侯区',
  '武汉市洪山区',
  '南京市鼓楼区',
  '西安市雁塔区',
  '重庆市渝中区',
  '郑州市金水区',
  '长沙市岳麓区',
  '沈阳市和平区',
  '青岛市市南区',
  '苏州市姑苏区',
  '天津市和平区',
  '厦门市思明区',
  '宁波市鄞州区',
  '无锡市梁溪区',
];
const BROWSER_CONFIG = [
  { name: 'Chrome', weight: 60 },
  { name: 'Firefox', weight: 10 },
  { name: 'Safari', weight: 15 },
  { name: 'Edge', weight: 10 },
  { name: 'Opera', weight: 5 },
];
const OS_CONFIG = [
  { name: 'Windows', weight: 65 },
  { name: 'macOS', weight: 18 },
  { name: 'Linux', weight: 7 },
  { name: 'iOS', weight: 5 },
  { name: 'Android', weight: 5 },
];
const SYSTEM_USERS = [
  { username: 'admin', nickname: '超级管理员' },
  { username: 'zhangsan', nickname: '张三' },
  { username: 'lisi', nickname: '李四' },
  { username: 'wangwu', nickname: '王五' },
  { username: 'zhaoliu', nickname: '赵六' },
  { username: 'sunqi', nickname: '孙七' },
  { username: 'zhouba', nickname: '周八' },
  { username: 'wujiu', nickname: '吴九' },
  { username: 'zhengshi', nickname: '郑十' },
  { username: 'chenyi', nickname: '陈一' },
];
const FAIL_MESSAGES = [
  '密码错误，请重新输入',
  '验证码错误或已过期',
  '账号已被锁定，请联系管理员',
  '账号不存在，请检查输入',
  '登录次数过多，请稍后再试',
  'Token 已失效，请重新登录',
  'IP 地址不在白名单内',
  '账号已过期，请联系管理员',
];

function weightedRandom<T extends { name: string; weight: number }>(
  items: T[],
): string {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = builtin.number.float({ min: 0, max: totalWeight, fractionDigits: 4 });
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item.name;
  }
  return items[0]!.name;
}

function generateLoginLogs(count = 35): LoginLogRecord[] {
  const records: LoginLogRecord[] = [];
  const now = dayjs(BUILTIN_NOW);
  for (let i = 0; i < count; i++) {
    const user = builtin.helpers.arrayElement(SYSTEM_USERS);
    const browserName = weightedRandom(BROWSER_CONFIG);
    const osName = weightedRandom(OS_CONFIG);
    const browserVersionMap: Record<string, string> = {
      Chrome: `${builtin.number.int({ min: 120, max: 130 })}.0`,
      Firefox: `${builtin.number.int({ min: 125, max: 135 })}.0`,
      Safari: `${builtin.number.int({ min: 17, max: 18 })}.${builtin.number.int({ min: 0, max: 9 })}`,
      Edge: `${builtin.number.int({ min: 120, max: 130 })}.0`,
      Opera: `${builtin.number.int({ min: 110, max: 115 })}.0`,
    };
    const osVersionMap: Record<string, string> = {
      Windows: `Windows ${builtin.helpers.arrayElement(['10', '11'])}`,
      macOS: `macOS ${builtin.helpers.arrayElement(['Sonoma', 'Ventura', 'Monterey'])}`,
      Linux: builtin.helpers.arrayElement([
        'Ubuntu 22.04',
        'Debian 12',
        'CentOS 9',
      ]),
      iOS: `iOS ${builtin.number.int({ min: 16, max: 18 })}.${builtin.number.int({ min: 0, max: 5 })}`,
      Android: `Android ${builtin.number.int({ min: 13, max: 15 })}`,
    };
    const browser = `${browserName} ${browserVersionMap[browserName]}`;
    const os = osVersionMap[osName]!;
    const isSuccess = builtin.datatype.boolean(0.9);
    const status: 'fail' | 'success' = isSuccess ? 'success' : 'fail';
    const userAgentTemplates: Record<string, (b: string, o: string) => string> =
      {
        Chrome: (b, o) => {
          const platform = o.includes('Windows')
            ? 'Windows NT 10.0; Win64; x64'
            : o.includes('Mac')
              ? 'Macintosh; Intel Mac OS X 10_15_7'
              : 'X11; Linux x86_64';
          return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${b.split(' ')[1]} Safari/537.36`;
        },
        Firefox: (b, o) => {
          const platform = o.includes('Windows')
            ? 'Windows NT 10.0; Win64; x64'
            : o.includes('Mac')
              ? 'Macintosh; Intel Mac OS X 10.15'
              : 'X11; Linux x86_64';
          return `Mozilla/5.0 (${platform}) Gecko/20100101 Firefox/${b.split(' ')[1]}`;
        },
        Safari: (_b) =>
          `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${_b.split(' ')[1]} Safari/605.1.15`,
        Edge: (b, o) => {
          const platform = o.includes('Windows')
            ? 'Windows NT 10.0; Win64; x64'
            : 'Macintosh; Intel Mac OS X 10_15_7';
          return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${b.split(' ')[1]} Safari/537.36 Edg/${b.split(' ')[1]}`;
        },
        Opera: (b, o) => {
          const platform = o.includes('Windows')
            ? 'Windows NT 10.0; Win64; x64'
            : 'X11; Linux x86_64';
          return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${b.split(' ')[1]} Safari/537.36 OPR/${b.split(' ')[1]}`;
        },
      };
    const userAgentFn =
      userAgentTemplates[browserName] || userAgentTemplates.Chrome!;
    const userAgent = userAgentFn(browser, os);
    const daysAgo = builtin.number.int({ min: 0, max: 29 });
    const hoursAgo = builtin.number.int({ min: 0, max: 23 });
    const minutesAgo = builtin.number.int({ min: 0, max: 59 });
    const secondsAgo = builtin.number.int({ min: 0, max: 59 });
    const loginTime = now
      .subtract(daysAgo, 'day')
      .subtract(hoursAgo, 'hour')
      .subtract(minutesAgo, 'minute')
      .subtract(secondsAgo, 'second')
      .format('YYYY-MM-DD HH:mm:ss');
    records.push({
      id: i + 1,
      username: user.username,
      loginAccount: user.username,
      ip: builtin.internet.ipv4(),
      location:
        builtin.helpers.arrayElement(CHINESE_CITIES),
      browser,
      os,
      status,
      message: isSuccess
        ? '登录成功'
        : builtin.helpers.arrayElement(FAIL_MESSAGES),
      loginTime,
      duration: builtin.number.int({ min: 45, max: 2500 }),
      userAgent,
    });
  }
  return records;
}

export const LOGIN_LOG_DB = defineCollection({ seed: generateLoginLogs, table: 'tb_login_log' });
