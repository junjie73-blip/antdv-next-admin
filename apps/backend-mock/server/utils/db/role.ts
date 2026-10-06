/**
 * 角色内存库（legacy mock/role.fake.ts 的数据层）
 */

import { faker } from '@faker-js/faker/locale/zh_CN';

// 与 legacy 一致：seed 影响后续共享 faker 实例的生成
faker.seed(200);

export interface RoleItem {
  code: string;
  createdAt: string;
  description: string;
  id: number;
  menuIds: number[];
  name: string;
  sort: number;
  status: number;
}

export const ROLE_DB: RoleItem[] = [
  {
    id: 1,
    name: '超级管理员',
    code: 'super_admin',
    description: '拥有系统所有权限，不可删除',
    sort: 0,
    status: 1,
    menuIds: [1, 2, 3, 4, 5, 6, 7, 8],
    createdAt: '2024-01-01 10:00:00',
  },
  {
    id: 2,
    name: '管理员',
    code: 'admin',
    description: '拥有大部分管理权限',
    sort: 1,
    status: 1,
    menuIds: [1, 2, 3, 5, 6],
    createdAt: '2024-01-02 11:00:00',
  },
  {
    id: 3,
    name: '普通用户',
    code: 'user',
    description: '普通用户基础权限',
    sort: 2,
    status: 1,
    menuIds: [1, 7],
    createdAt: '2024-01-03 12:00:00',
  },
  {
    id: 4,
    name: '访客',
    code: 'guest',
    description: '只读权限，仅可浏览公开内容',
    sort: 3,
    status: 0,
    menuIds: [1],
    createdAt: '2024-01-05 14:00:00',
  },
  {
    id: 5,
    name: '运营人员',
    code: 'operator',
    description: '负责日常运营操作',
    sort: 4,
    status: 1,
    menuIds: [1, 2, 7, 8],
    createdAt: '2024-02-10 09:30:00',
  },
  {
    id: 6,
    name: '开发人员',
    code: 'developer',
    description: '拥有开发和调试相关权限',
    sort: 5,
    status: 1,
    menuIds: [1, 2, 3, 4, 9],
    createdAt: '2024-03-15 16:20:00',
  },
];
let autoIncrementId = 7;

/** 新增角色自增 id */
export function nextRoleId(): number {
  return autoIncrementId++;
}
