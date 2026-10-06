/**
 * 登录日志内存库（legacy mock/login-log.fake.ts 的数据层）
 *
 * 注意：与 legacy 一致，这里混合使用 Math.random()（用户/城市/成败）与 faker（版本/时间），
 * 所以每次进程启动数据不同 —— 保留该行为，面板与页面本来就按"演示数据"消费它。
 */

import { faker } from '@faker-js/faker/locale/zh_CN';
import dayjs from 'dayjs';

faker.seed(300);

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
  let random = Math.random() * totalWeight;
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item.name;
  }
  return items[0]!.name;
}

function generateLoginLogs(count = 35): LoginLogRecord[] {
  const records: LoginLogRecord[] = [];
  const now = dayjs();
  for (let i = 0; i < count; i++) {
    const user = SYSTEM_USERS[Math.floor(Math.random() * SYSTEM_USERS.length)]!;
    const browserName = weightedRandom(BROWSER_CONFIG);
    const osName = weightedRandom(OS_CONFIG);
    const browserVersionMap: Record<string, string> = {
      Chrome: `${faker.number.int({ min: 120, max: 130 })}.0`,
      Firefox: `${faker.number.int({ min: 125, max: 135 })}.0`,
      Safari: `${faker.number.int({ min: 17, max: 18 })}.${faker.number.int({ min: 0, max: 9 })}`,
      Edge: `${faker.number.int({ min: 120, max: 130 })}.0`,
      Opera: `${faker.number.int({ min: 110, max: 115 })}.0`,
    };
    const osVersionMap: Record<string, string> = {
      Windows: `Windows ${faker.helpers.arrayElement(['10', '11'])}`,
      macOS: `macOS ${faker.helpers.arrayElement(['Sonoma', 'Ventura', 'Monterey'])}`,
      Linux: faker.helpers.arrayElement([
        'Ubuntu 22.04',
        'Debian 12',
        'CentOS 9',
      ]),
      iOS: `iOS ${faker.number.int({ min: 16, max: 18 })}.${faker.number.int({ min: 0, max: 5 })}`,
      Android: `Android ${faker.number.int({ min: 13, max: 15 })}`,
    };
    const browser = `${browserName} ${browserVersionMap[browserName]}`;
    const os = osVersionMap[osName]!;
    const isSuccess = Math.random() < 0.9;
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
    const daysAgo = faker.number.int({ min: 0, max: 29 });
    const hoursAgo = faker.number.int({ min: 0, max: 23 });
    const minutesAgo = faker.number.int({ min: 0, max: 59 });
    const secondsAgo = faker.number.int({ min: 0, max: 59 });
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
      ip: faker.internet.ipv4(),
      location:
        CHINESE_CITIES[Math.floor(Math.random() * CHINESE_CITIES.length)]!,
      browser,
      os,
      status,
      message: isSuccess
        ? '登录成功'
        : FAIL_MESSAGES[Math.floor(Math.random() * FAIL_MESSAGES.length)]!,
      loginTime,
      duration: faker.number.int({ min: 45, max: 2500 }),
      userAgent,
    });
  }
  return records;
}

export const LOGIN_LOG_DB = generateLoginLogs();
