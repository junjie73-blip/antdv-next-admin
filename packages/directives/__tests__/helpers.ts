import type { DirectiveBinding } from 'vue';

import type {
  PermissionCheckers,
  PermissionDirectiveValue,
} from '../src/permission';

/** 造一个最小 DirectiveBinding：指令只用到 value / arg / modifiers */
export function fakeBinding(
  value?: PermissionDirectiveValue,
  extra: { arg?: string; modifiers?: Record<string, boolean> } = {},
): DirectiveBinding<PermissionDirectiveValue> {
  return {
    arg: extra.arg,
    instance: null,
    modifiers: extra.modifiers ?? {},
    oldValue: undefined,
    value,
  } as unknown as DirectiveBinding<PermissionDirectiveValue>;
}

export interface CheckerSeed {
  admin?: boolean;
  permissions?: string[];
  roles?: string[];
}

/**
 * 用「集合 + 管理员标记」拼出判定函数，
 * 语义和 app 里的 `usePermission()` 对齐（严格模式下空集合不放行）。
 */
export function makeCheckers(seed: CheckerSeed = {}): PermissionCheckers {
  const perms = new Set(seed.permissions ?? []);
  const userRoles = new Set(seed.roles ?? []);

  return {
    hasAllPermissions: (list) => list.every((p) => perms.has(p)),
    hasAllRoles: (list) => list.every((r) => userRoles.has(r)),
    hasAnyPermission: (list) => list.some((p) => perms.has(p)),
    hasAnyRole: (list) => list.some((r) => userRoles.has(r)),
    hasPermission: (p) => perms.has(p),
    hasRole: (r) => userRoles.has(r),
    isAdmin: () => seed.admin === true,
  };
}

/** 挂到 body 上的真实元素，测完记得 unmount */
export function createElement(tag = 'div'): HTMLElement {
  const el = document.createElement(tag);
  document.body.append(el);
  return el;
}

export function createImage(): HTMLImageElement {
  const el = document.createElement('img');
  document.body.append(el);
  return el;
}

export function clearBody(): void {
  document.body.innerHTML = '';
}
