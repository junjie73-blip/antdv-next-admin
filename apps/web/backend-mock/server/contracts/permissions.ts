/**
 * 权限码与服务侧鉴权助手
 *
 * 权限码沿用菜单派生规则：`模块:资源:动作`，例如 `/system/user` → `system:user:list`。
 * 前端据此控制按钮可见性，服务端用同一个码做二次校验 —— 这是真实后端的标准做法
 * （前端隐藏按钮只是体验，不能替代服务端鉴权）。
 *
 * mock 兼容策略：未带 Authorization 时 `resolveAccount` 回落 admin，
 * 因此直接调用 handler 的单测、快照生成脚本都不需要登录；线上迁移时把
 * `resolveAccount` 换成验签后的身份来源即可，本文件的判定逻辑无需改动。
 */

import { resolveAccount, type MockAccount } from '../utils/accounts';
import type { MockRouteInput } from '../utils/runtime';

import { ApiCode } from './codes';
import { ApiError } from './errors';

export const PermissionCode = {
  USER_LIST: 'system:user:list',
  USER_QUERY: 'system:user:query',
  USER_ADD: 'system:user:add',
  USER_EDIT: 'system:user:edit',
  USER_REMOVE: 'system:user:remove',
  ROLE_LIST: 'system:role:list',
  ROLE_ADD: 'system:role:add',
  ROLE_REMOVE: 'system:role:remove',
  TASK_LIST: 'demo:task:list',
  TASK_ADD: 'demo:task:add',
  TASK_EDIT: 'demo:task:edit',
  TASK_REMOVE: 'demo:task:remove',
  AUDIT_LIST: 'security:audit:list',
  APPROVAL_LIST: 'approval:mine:list',
  APPROVAL_SAVE: 'approval:mine:save',
  APPROVAL_ACTION: 'approval:mine:action',
  /** 超级管理员通配 */
  ALL: '*',
} as const;

export type PermissionCodeValue =
  (typeof PermissionCode)[keyof typeof PermissionCode];

/** 按资源与动作拼权限码，避免各处手写字符串拼错 */
export function permissionOf(resource: string, action: string): string {
  return `${resource.replace(/^\/+/, '').split('/').join(':')}:${action}`;
}

export function hasPermission(account: MockAccount, code: string): boolean {
  return account.permissions.includes(PermissionCode.ALL) || account.permissions.includes(code);
}

/**
 * 服务端权限校验：任一权限码命中即放行，否则抛 403 ApiError。
 * 返回已解析的账号，handler 可直接拿它写操作日志的 actor。
 */
export function requirePermission(
  context: Pick<MockRouteInput, 'headers'>,
  ...codes: readonly string[]
): MockAccount {
  const account = resolveAccount(context.headers);
  if (codes.length === 0 || codes.some((code) => hasPermission(account, code))) {
    return account;
  }
  throw new ApiError(
    ApiCode.FORBIDDEN,
    `没有操作权限：需要 ${codes.join(' 或 ')}`,
    codes.map((code) => ({ field: 'authorization', message: `缺少权限码 ${code}`, code: 'forbidden' })),
  );
}
