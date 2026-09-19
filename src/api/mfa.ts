import { get, post } from "~/api/request";

export interface MFASetupResult {
  qrCode: string;
  manualEntryKey: string;
}
export interface MFAStatus {
  enabled: boolean;
  hasBackupCodes: boolean;
}

/** 初始化 MFA（生成 TOTP 密钥与二维码） */
export function setupMFA() {
  return post<MFASetupResult>("/mfa/setup");
}

/** 首次验证 TOTP 并启用 MFA */
export function enableMFA(token: string) {
  return post<{ backupCodes: string[] }>("/mfa/enable", { token });
}

/** 验证 TOTP 或备份码 */
export function verifyMFA(userId: string, token: string) {
  return post<{ valid: boolean; remainingBackupCodes?: number }>("/mfa/verify", {
    userId,
    token,
  });
}

/** 禁用 MFA（需当前有效 TOTP） */
export function disableMFA(token: string) {
  return post<void>("/mfa/disable", { token });
}

/** 获取 MFA 状态 */
export function getMFAStatus() {
  return get<MFAStatus>("/mfa/status");
}

/** 重新生成备份码 */
export function regenerateBackupCodes(token: string) {
  return post<{ backupCodes: string[] }>("/mfa/backup-codes/regenerate", { token });
}
