/**
 * 锁屏密码：持久化与校验的纯工具层。
 *
 * 边界声明：前端锁屏是**交互层防误触**，不是安全边界——真要防止别人读屏，
 * 必须靠操作系统锁屏或服务端鉴权。所以这里只做两件事：
 * 1. 把密码做一次不可逆散列后存起来，避免明文落在 localStorage 里被一眼看到；
 * 2. 把校验结果与失败原因（i18n key）返回给调用方，由 UI 决定怎么提示。
 *
 * 存储是**可替换的扩展点**：默认用 localStorage，宿主可以注入自己的实现
 * （例如把散列交给服务端托管、或按租户分 key），不改状态机与 UI 一行代码。
 */

/** 默认存储键：宿主若要按用户/租户隔离，注入自己的 storage 即可 */
export const LOCK_PASSWORD_STORAGE_KEY = 'antdv.lock.password';
/** 密码最短长度：过短容易误输，也给弱密码一个下限 */
export const LOCK_PASSWORD_MIN_LENGTH = 4;

export type LockPasswordMessageKey =
  | 'header.lockPasswordMismatch'
  | 'header.lockPasswordRequired'
  | 'header.lockPasswordTooShort'
  | 'header.lockPasswordWrong';

export interface LockPasswordCheck {
  messageKey?: LockPasswordMessageKey;
  ok: boolean;
}

/** 与浏览器 Storage 同形的最小接口，便于测试注入内存实现 */
export interface LockPasswordStorage {
  getItem(key: string): null | string;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

let injectedStorage: LockPasswordStorage | null = null;

/**
 * 注入存储实现；传 null 恢复默认（localStorage）。
 * 服务端渲染或测试环境没有 window 时，本模块一切读写都安全降级为「无密码」。
 */
export function configureLockPasswordStorage(
  next: LockPasswordStorage | null,
): void {
  injectedStorage = next;
}

function activeStorage(): LockPasswordStorage | null {
  if (injectedStorage) return injectedStorage;
  if (typeof window !== 'undefined' && window.localStorage)
    return window.localStorage;
  return null;
}

/**
 * 轻量散列（djb2 + 固定盐）。**不是密码学哈希**，这里的目的仅是「不存明文」，
 * 不要拿它做真正的口令保护；宿主需要强保护时注入服务端 storage。
 */
export function hashLockPassword(password: string): string {
  const salted = `antdv-lock::${password}`;
  let hash = 5381;
  for (let i = 0; i < salted.length; i += 1) {
    hash = ((hash << 5) + hash + salted.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

/** 是否已经设置过锁屏密码（决定首次锁屏进入「设置」还是「解锁」模式） */
export function hasLockPassword(): boolean {
  return Boolean(activeStorage()?.getItem(LOCK_PASSWORD_STORAGE_KEY));
}

/**
 * 首次设置：密码非空、两次一致、达到最短长度才允许保存。
 * 保存的是散列，任何情况下都不把原文写进存储。
 */
export function setLockPassword(
  password: string,
  confirm: string,
): LockPasswordCheck {
  const value = password.trim();
  if (!value) return { messageKey: 'header.lockPasswordRequired', ok: false };
  if (value !== confirm.trim())
    return { messageKey: 'header.lockPasswordMismatch', ok: false };
  if (value.length < LOCK_PASSWORD_MIN_LENGTH)
    return { messageKey: 'header.lockPasswordTooShort', ok: false };

  activeStorage()?.setItem(LOCK_PASSWORD_STORAGE_KEY, hashLockPassword(value));
  return { ok: true };
}

/** 解锁校验：空密码直接判失败，绝不因为「没输入」而放行 */
export function verifyLockPassword(password: string): boolean {
  const stored = activeStorage()?.getItem(LOCK_PASSWORD_STORAGE_KEY);
  if (!stored || !password.trim()) return false;
  return hashLockPassword(password.trim()) === stored;
}

/** 清除密码（「忘记密码」入口 / 测试隔离用） */
export function clearLockPassword(): void {
  activeStorage()?.removeItem(LOCK_PASSWORD_STORAGE_KEY);
}
