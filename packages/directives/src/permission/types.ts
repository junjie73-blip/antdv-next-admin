/**
 * 权限指令的类型契约。
 *
 * 包只认「怎么判断有没有权限」这组函数，不认 pinia、不认 token、不认后端字段名：
 * 应用把 `usePermission()` 的结果注进来即可，换一套权限模型也不用改包。
 */

/** 应用侧必须提供的判定能力（全部同步函数，指令每次导航/渲染都可能调用） */
export interface PermissionCheckers {
  /** 需要全部权限 */
  hasAllPermissions: (permissions: string[]) => boolean;
  /** 需要全部角色 */
  hasAllRoles: (roles: string[]) => boolean;
  /** 需要任一权限 */
  hasAnyPermission: (permissions: string[]) => boolean;
  /** 需要任一角色 */
  hasAnyRole: (roles: string[]) => boolean;
  /** 单个权限码 */
  hasPermission: (permission: string) => boolean;
  /** 单个角色 */
  hasRole: (role: string) => boolean;
  /** 管理员放行 */
  isAdmin: () => boolean;
}

/**
 * 允许直接给对象，也给工厂函数。
 * 用 pinia 的应用应当传工厂：store 实例要在 setup / 导航期间现取，
 * 注册指令时取会踩到「pinia 还没安装」的时机问题。
 */
export type PermissionCheckerSource =
  | (() => PermissionCheckers)
  | PermissionCheckers;

/** `any`：命中其一即可（默认）；`all`：全部命中 */
export type PermissionMode = 'all' | 'any';

/** 对象写法：把「要什么」写清楚，避免靠修饰符猜 */
export interface PermissionRequirement {
  /** 权限码，字符串或数组 */
  mode?: PermissionMode;
  permission?: string | string[];
  role?: string | string[];
}

export type PermissionDirectiveValue =
  | PermissionRequirement
  | string
  | string[];

/** 指令结构最小集，方便单测（不必造完整 DirectiveBinding） */
export interface PermissionBindingLike {
  arg?: string;
  /** `noUncheckedIndexedAccess` 下取修饰符一定是 `boolean | undefined`，类型如实写 */
  modifiers?: Record<string, boolean | undefined>;
  value?: PermissionDirectiveValue;
}

/** 每次判定的现场，交给应用的日志 / 埋点 */
export interface PermissionCheckContext {
  arg?: string;
  hasAccess: boolean;
  modifiers: Record<string, boolean | undefined>;
  value: PermissionDirectiveValue | undefined;
}

export interface PermissionDirectiveOptions {
  /** 判定函数（或其工厂） */
  checkers: PermissionCheckerSource;
  /**
   * 无权限时叠加的 class，供样式层做视觉降级。
   * 默认 `permission-disabled`；样式规则归 `@antdv/styles` 提供，
   * 包只负责打标记。
   */
  className?: string;
  /** 判定结果回调：应用自己决定用 console、上报还是什么都不做 */
  onCheck?: (context: PermissionCheckContext) => void;
  /**
   * 权限数据源变化订阅（如登录态异步回填）。
   * 返回的取消函数会在指令 unmounted 时调用。
   * 不传则只在 `updated` 时重算 —— 数据后来才到位的场景就会一直停在错误状态。
   */
  subscribe?: (notify: () => void) => (() => void) | void;
}
