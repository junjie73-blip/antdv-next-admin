import type {
  PermissionBindingLike,
  PermissionCheckers,
  PermissionDirectiveValue,
  PermissionMode,
} from './types';

/** 元素上缓存的状态：原始 display、上一次的 binding 快照、订阅取消函数 */
export interface PermissionElementState {
  /** 判定所依据的 binding（订阅回调用的永远是最新一份） */
  binding: PermissionBindingLike;
  /** 上一次判定用的 binding 快照，用于变化比较 */
  prev: null | { arg?: string; value: unknown };
  /** 取消权限数据源订阅 */
  stop: (() => void) | null;
  /** mounted 时记录的 inline display，恢复时写回 */
  originalDisplay: string;
  /** `.disabled` 修饰符：禁用而不是隐藏 */
  disabledMode: boolean;
}

/** 无权限时叠加的 class，可由应用覆盖 */
export const DEFAULT_PERMISSION_CLASS = 'permission-disabled';

function toList(value: string | string[]): string[] {
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

/**
 * 把 binding.value 归一化成 { permissions, roles, mode }。
 *
 * `arg="role"` 时字符串/数组按角色解释，否则按权限码解释；
 * 对象写法自带字段，`arg` 不再参与解释。
 */
function extract(
  value: Exclude<PermissionDirectiveValue, null | undefined>,
  arg: string | undefined,
): { mode?: PermissionMode; permissions: string[]; roles: string[] } {
  if (typeof value === 'string' || Array.isArray(value)) {
    const list = toList(value);
    return arg === 'role'
      ? { permissions: [], roles: list }
      : { permissions: list, roles: [] };
  }

  return {
    mode: value.mode,
    permissions: value.permission === undefined ? [] : toList(value.permission),
    roles: value.role === undefined ? [] : toList(value.role),
  };
}

function matchGroup(
  list: string[],
  mode: PermissionMode,
  checkers: PermissionCheckers,
  kind: 'permission' | 'role',
): boolean {
  if (list.length === 0) return true;
  if (kind === 'role') {
    return mode === 'all'
      ? checkers.hasAllRoles(list)
      : checkers.hasAnyRole(list);
  }
  return mode === 'all'
    ? checkers.hasAllPermissions(list)
    : checkers.hasAnyPermission(list);
}

/**
 * 根据 binding 计算是否有权限。
 *
 * 优先级：
 *  1. `arg === "admin"` → `isAdmin()`
 *  2. 空值（`undefined` / `null` / `''` / `[]`）→ 放行
 *  3. `arg === "role"` → 字符串/数组按角色解释
 *  4. 字符串 / 字符串数组 → 按权限码解释
 *  5. 对象写法 → `role` 与 `permission` 都声明时两者都要满足
 *
 * `mode` 取值优先级：对象的 `mode` > `.all` 修饰符 > 默认 `any`。
 */
export function resolveAccess(
  binding: PermissionBindingLike,
  checkers: PermissionCheckers,
): boolean {
  const { arg, modifiers = {}, value } = binding;

  if (arg === 'admin') return checkers.isAdmin();

  if (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return true;
  }

  const { mode, permissions, roles } = extract(value, arg);
  const effectiveMode: PermissionMode =
    mode ?? (modifiers.all ? 'all' : 'any');

  if (roles.length === 0 && permissions.length === 0) return true;

  return (
    matchGroup(roles, effectiveMode, checkers, 'role') &&
    matchGroup(permissions, effectiveMode, checkers, 'permission')
  );
}

/**
 * 判断 binding 是否需要重新计算：只看 value / arg。
 *
 * 数组按浅比较，对象按 JSON 快照 —— 权限指令的值本来就是声明式常量，
 * 不必上深比较库。引用变了但内容没变时不应该重跑 DOM。
 */
export function isBindingChanged(
  prev: null | { arg?: string; value: unknown },
  next: PermissionBindingLike,
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
  if (
    typeof a === 'object' &&
    typeof b === 'object' &&
    a !== null &&
    b !== null
  ) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

/**
 * DOM 是否已经反映了判定结果。
 *
 * 存在的意义：`updated` 每次组件重渲染都会跑，如果每次无条件写 style/class，
 * 就是在和 Vue 自己的 diff 抢活；先比对再写，能让稳态渲染零副作用。
 */
export function isDomInSync(
  el: HTMLElement,
  hasAccess: boolean,
  state: Pick<PermissionElementState, 'disabledMode' | 'originalDisplay'>,
  className: string = DEFAULT_PERMISSION_CLASS,
): boolean {
  if (state.disabledMode) {
    const flagged = el.classList.contains(className);
    const disabled = el.hasAttribute('disabled');
    return hasAccess ? !flagged && !disabled : flagged && disabled;
  }

  const hidden = el.style.display === 'none';
  return hasAccess
    ? !hidden && !el.classList.contains(className)
    : hidden && el.classList.contains(className);
}

/**
 * 把判定结果落到 DOM。
 *
 * 两种模式：
 *  - 默认隐藏：`display: none` + `disabled` + `aria-disabled` + class
 *  - `.disabled` 修饰符：只禁用，保留可见（按钮灰掉比消失更易理解）
 *
 * 为什么不「移出 DOM」：指令删节点会让 Vue 的 patch 找不到锚点，
 * 兄弟节点 diff 直接错乱。Vben 也只在特定容器上这么做。
 */
export function applyPermissionState(
  el: HTMLElement,
  hasAccess: boolean,
  state: Pick<PermissionElementState, 'disabledMode' | 'originalDisplay'>,
  className: string = DEFAULT_PERMISSION_CLASS,
): void {
  if (state.disabledMode) {
    if (hasAccess) {
      el.removeAttribute('disabled');
      el.removeAttribute('aria-disabled');
      el.classList.remove(className);
      if ('disabled' in el) (el as HTMLButtonElement).disabled = false;
    } else {
      el.setAttribute('disabled', 'disabled');
      el.setAttribute('aria-disabled', 'true');
      el.classList.add(className);
      // 只有原生可禁用元素才有 disabled 属性，div 上赋值是无效写入
      if ('disabled' in el) (el as HTMLButtonElement).disabled = true;
    }
    return;
  }

  if (hasAccess) {
    el.style.display = state.originalDisplay;
    el.removeAttribute('disabled');
    el.removeAttribute('aria-disabled');
    el.classList.remove(className);
  } else {
    el.style.display = 'none';
    el.setAttribute('disabled', 'disabled');
    el.setAttribute('aria-disabled', 'true');
    el.classList.add(className);
  }
}
