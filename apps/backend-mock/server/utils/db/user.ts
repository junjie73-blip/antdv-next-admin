/**
 * 用户内存库（legacy mock/user.fake.ts 的数据层）
 *
 * legacy 里 fake-server 把相对依赖内联进每个 mock 文件，模块级数组天然是"每文件私有"；
 * Nitro 下多个 handler 共享同一份数据，抽成独立模块反而修正了 legacy 的副本隔离缺陷
 * （同一进程内新增/更新/删除对所有接口可见，行为与面板预期一致）。
 */

import { faker } from '@faker-js/faker/locale/zh_CN';
import dayjs from 'dayjs';

export interface UserRecord {
  avatar: string;
  createdAt: string;
  deptId: number;
  deptName: string;
  email: string;
  gender: number;
  id: number;
  nickname: string;
  phone: string;
  remark: string;
  roles: string[];
  status: 0 | 1;
  updatedAt: string;
  username: string;
}

// 固定种子保证每次生成的数据一致
faker.seed(100);
// 部门固定集合 — 与页面保持一致
export const DEPT_LIST = [
  { id: 1, name: '总公司' },
  { id: 2, name: '技术部' },
  { id: 3, name: '产品部' },
  { id: 4, name: '市场部' },
  { id: 5, name: '运营部' },
  { id: 6, name: '财务部' },
  { id: 7, name: '人事部' },
  { id: 8, name: '行政部' },
];
// 角色选项集合
export const ROLE_OPTIONS = [
  { label: '超级管理员', value: 1 },
  { label: '管理员', value: 2 },
  { label: '普通用户', value: 3 },
  { label: '运维人员', value: 4 },
];
// 预生成 50 条用户数据，确保分页和筛选一致性
export const USER_DB: UserRecord[] = [];
let autoIncrementId = 51;

// 初始化用户数据库
function initUserDB() {
  if (USER_DB.length > 0) return;
  // 第一条是内置管理员
  USER_DB.push({
    id: 1,
    username: 'admin',
    nickname: '超级管理员',
    email: 'admin@example.com',
    phone: '13800000001',
    gender: 1,
    avatar: faker.image.avatar(),
    status: 1,
    deptId: 1,
    deptName: '总公司',
    roles: ['超级管理员'],
    remark: '系统内置管理员',
    createdAt: '2024-01-01 10:00:00',
    updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  });
  // 生成 49 条 faker 数据
  for (let i = 2; i <= 50; i++) {
    const dept =
      DEPT_LIST[faker.number.int({ min: 0, max: DEPT_LIST.length - 1 })]!;
    const role =
      ROLE_OPTIONS[faker.number.int({ min: 0, max: ROLE_OPTIONS.length - 1 })]!;
    const baseDate = dayjs('2024-01-01');
    USER_DB.push({
      id: i,
      username: faker.internet.username().toLowerCase(),
      nickname: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      phone: faker.phone.number('1##########'),
      gender: faker.helpers.arrayElement([0, 1, 2]),
      avatar: faker.image.avatar(),
      status: faker.datatype.boolean(0.85) ? 1 : 0,
      deptId: dept.id,
      deptName: dept.name,
      roles: [role.label],
      remark: faker.datatype.boolean(0.3) ? faker.company.catchPhrase() : '',
      createdAt: baseDate
        .add(faker.number.int({ min: 0, max: 365 }), 'day')
        .format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    });
  }
}
initUserDB();

/** 新增用户自增 id（legacy 中 POST handler 直接自增模块变量） */
export function nextUserId(): number {
  return autoIncrementId++;
}
