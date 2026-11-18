/**
 * 角色数据层（legacy mock/role.fake.ts 的后继）。
 *
 * SQLite 迁移示范（SQLITE_MIGRATION_PLAN.md P2 首个模块）：
 * - `ROLE_DB` 由 `defineCollection` 提供：内存实现下是普通数组（行为与改造前一致），
 *   SQLite 实现下是透明代理，`push` / `splice` / 索引赋值 / 行属性赋值都会落库，
 *   因此 `server/api/system/role/**` 四个 handler **一行都不用改**；
 * - 主键升级为 cuid 物理主键 `_pk`（库内），对外 `id` 仍是 number —— 前端契约不变；
 * - 删除改为软删除（deleted=1），`list` 自动过滤；
 * - `nextRoleId()` 在 SQLite 下改为读库取 max+1，重启不会撞号。
 *
 * 前端响应信封、分页字段（pageNum/pageSize）、`data.list/total` 形态完全不变。
 */


import { defineCollection, getStore, isSqliteEnabled, nextBizId } from './sqlite';

// 内置角色数据为确定性常量，不受装载顺序影响

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

const SEED_ROLES: RoleItem[] = [
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

/** 每次播种返回全新对象，避免嵌套 menuIds 被代理写回时污染常量 */
function cloneSeed(): RoleItem[] {
  return SEED_ROLES.map((role) => ({ ...role, menuIds: [...role.menuIds] }));
}

export const ROLE_DB: RoleItem[] = defineCollection<RoleItem>({
  seed: cloneSeed,
  table: 'tb_role',
});

let autoIncrementId = 7;

/**
 * 新增角色 id。内存实现沿用原自增变量（逐字兼容）；
 * SQLite 实现取库内 max+1 —— 不再有模块级自增状态，重启也不会撞号。
 */
export function nextRoleId(): number {
  return isSqliteEnabled() ? nextBizId('tb_role') : autoIncrementId++;
}

/**
 * 角色 ↔ 菜单关系写入中间表（无外键，软删除）。
 * 迁移期 `menuIds` 仍在业务行内保留以维持前端契约；关联表同步维护，
 * 待 P2 全量迁移完成后改为以关联表为唯一真源。
 */
export function syncRoleMenuLinks(roleId: number, menuIds: number[]): void {
  if (!isSqliteEnabled()) return;
  const store = getStore();
  const active = store.links('tb_role_menu', roleId).map((link) => String(link.menu_id));
  const wanted = menuIds.map(String);
  for (const id of active) {
    if (!wanted.includes(id)) store.unlink('tb_role_menu', roleId, id);
  }
  for (const id of wanted) {
    if (!active.includes(id)) store.link('tb_role_menu', roleId, id);
  }
}
