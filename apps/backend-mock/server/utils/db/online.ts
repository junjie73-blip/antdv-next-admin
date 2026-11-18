/**
 * 在线用户内存库（legacy mock/online.fake.ts 的数据层）
 */

import { BUILTIN_NOW, builtin } from '../builtin-data';
import { defineCollection } from './sqlite';
import dayjs from 'dayjs';


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

export const ONLINE_DB: OnlineUser[] = defineCollection<OnlineUser>({ seed: () => [], table: 'tb_online' });

function initOnlineDB() {
  if (ONLINE_DB.length > 0) return;
  const baseDate = dayjs(BUILTIN_NOW).subtract(2, 'hour');
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
      tokenId: builtin.string.uuid(),
      sessionId: builtin.string.alphanumeric({ length: 32 }),
      username: user.username,
      nickname: user.nickname,
      ip: builtin.internet.ipv4(),
      location: `${builtin.location.city()}${builtin.location.state()}`,
      browser: builtin.helpers.arrayElement(BROWSERS),
      os: builtin.helpers.arrayElement(OS_LIST),
      loginTime: baseDate
        .add(builtin.number.int({ min: 0, max: 120 }), 'minute')
        .format('YYYY-MM-DD HH:mm:ss'),
      status: builtin.datatype.boolean(0.9) ? 0 : 1,
    });
  }
}
initOnlineDB();
