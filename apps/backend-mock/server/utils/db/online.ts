/**
 * 在线用户内存库（legacy mock/online.fake.ts 的数据层）
 */

import { faker } from '@faker-js/faker/locale/zh_CN';
import dayjs from 'dayjs';

faker.seed(500);

const BROWSERS = ['Chrome', 'Firefox', 'Safari', 'Edge'] as const;
const OS_LIST = [
  'Windows 11',
  'Windows 10',
  'macOS Sonoma',
  'Ubuntu 22.04',
  'iOS 17',
  'Android 14',
] as const;

export interface OnlineUser {
  browser: string;
  ip: string;
  location: string;
  loginTime: string;
  nickname: string;
  os: string;
  sessionId: string;
  status: 0 | 1;
  tokenId: string;
  username: string;
}

export const ONLINE_DB: OnlineUser[] = [];

function initOnlineDB() {
  if (ONLINE_DB.length > 0) return;
  const baseDate = dayjs().subtract(2, 'hour');
  const nicknames = [
    { username: 'admin', nickname: '超级管理员' },
    { username: 'zhangsan', nickname: '张三' },
    { username: 'lisi', nickname: '李四' },
    { username: 'wangwu', nickname: '王五' },
    { username: 'zhaoliu', nickname: '赵六' },
    { username: 'qianqi', nickname: '钱七' },
    { username: 'sunba', nickname: '孙八' },
    { username: 'zhoujiu', nickname: '周九' },
    { username: 'wushi', nickname: '吴十' },
    { username: 'zhengshiyi', nickname: '郑十一' },
  ];
  for (let i = 0; i < 10; i++) {
    const user = nicknames[i]!;
    ONLINE_DB.push({
      tokenId: faker.string.uuid(),
      sessionId: faker.string.alphanumeric({ length: 32 }),
      username: user.username,
      nickname: user.nickname,
      ip: faker.internet.ipv4(),
      location: `${faker.location.city()}${faker.location.state()}`,
      browser: faker.helpers.arrayElement(BROWSERS),
      os: faker.helpers.arrayElement(OS_LIST),
      loginTime: baseDate
        .add(faker.number.int({ min: 0, max: 120 }), 'minute')
        .format('YYYY-MM-DD HH:mm:ss'),
      status: faker.datatype.boolean(0.9) ? 0 : 1,
    });
  }
}
initOnlineDB();
