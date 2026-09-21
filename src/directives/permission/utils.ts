import type { DirectiveBinding } from "vue";
import type { PermissionDirectiveBinding } from "./types";

/**
 * 根据 binding 计算是否有权限
 *
 * 优先级：
 *  1. arg === "role"  → hasRole / hasAnyRole / hasAllRoles
 *  2. arg === "admin" → isAdmin
 *  3. value 为字符串  → hasPermission
 *  4. value 为数组    → hasAnyPermission / hasAllPermissions
 *  5. value 为对象    → 按 mode 决定
 *  6. 未配置          → 默认有权限
 */
export function resolveAccess(
  binding: DirectiveBinding<PermissionDirectiveBinding>,
  helpers: {
    hasPermission: (p: string) => boolean;
    hasAnyPermission: (ps: string[]) => boolean;
    hasAllPermissions: (ps: string[]) => boolean;
    hasRole: (r: string) => boolean;
    hasAnyRole: (rs: string[]) => boolean;
    hasAllRoles: (rs: string[]) => boolean;
    isAdmin: () => boolean;
  },
): boolean {
  const { value, arg, modifiers = {} } = binding;

  /* ---------- 1. arg 优先 ---------- */
  if (arg === "role") {
    if (Array.isArray(value)) {
      if (value.length === 0) return true;
      return modifiers.all ? helpers.hasAllRoles(value) : helpers.hasAnyRole(value);
    }
    return helpers.hasRole(String(value ?? ""));
  }

  if (arg === "admin") {
    return helpers.isAdmin();
  }

  /* ---------- 2. 无值时默认通过 ---------- */
  if (value === undefined || value === null || value === "") {
    return true;
  }

  /* ---------- 3. 字符串 ---------- */
  if (typeof value === "string") {
    return helpers.hasPermission(value);
  }

  /* ---------- 4. 数组 ---------- */
  if (Array.isArray(value)) {
    if (value.length === 0) return true;
    return modifiers.all ? helpers.hasAllPermissions(value) : helpers.hasAnyPermission(value);
  }

  /* ---------- 5. 对象 ---------- */
  if (typeof value === "object") {
    const permission = Array.isArray(value.permission) ? value.permission : [value.permission];
    return value.mode === "all"
      ? helpers.hasAllPermissions(permission)
      : helpers.hasAnyPermission(permission);
  }

  return true;
}

/**
 * 判断 binding 是否需要重新计算
 * 只在 value / arg 真正变化时才重跑
 */
export function isBindingChanged(
  prev: DirectiveBinding<PermissionDirectiveBinding> | null,
  next: DirectiveBinding<PermissionDirectiveBinding>,
): boolean {
  if (!prev) return true;
  if (prev.arg !== next.arg) return true;
  return !isSameValue(prev.value, next.value);
}

function isSameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  if (typeof a === "object" && typeof b === "object" && a && b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}
