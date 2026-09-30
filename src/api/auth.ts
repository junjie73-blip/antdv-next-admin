import type { UserInfo } from '#/user'

import { get, post, put } from '~/api/request'
import { http } from '~/utils'

// ============================================================
// 类型
// ============================================================
export interface LoginParams {
  tenantCode: string
  username: string
  password: string
  deviceId?: string
  captchaId?: string
  captchaCode?: string
}
export interface LoginResponse {
  user: {
    id: string
    username: string
    token: string
    role: string
    permissions: string[]
    roles?: string[]
  }
}
export interface ProfileResponse {
  id: string
  username: string
  realName?: string
  email?: string
  phone?: string
  avatar?: string
  gender?: number
  role?: string
  permissions: string[]
  roles?: string[]
  tenantId?: string
}
export interface PasswordPolicy {
  minLength: number
  maxLength: number
  requireUppercase?: boolean
  requireLowercase?: boolean
  requireNumber?: boolean
  requireSymbol?: boolean
}
export interface CaptchaData {
  captchaId: string
  svg: string
}
export interface AccessibleTenant {
  tenantId: string
  tenantCode: string
  tenantName: string
}
export interface ForgotPasswordParams {
  tenantCode: string
  username: string
  oldPassword: string
  newPassword: string
}
export interface ForgotPasswordResult {
  success: boolean
  message?: string
}
export interface CancelStatus {
  pending: boolean
  cancelledAt?: string
  effectiveAt?: string
  reason?: string
  remainingDays?: number
}
export interface LoginLogItem {
  logId: string
  ipAddress: string
  userAgent: string | null
  browser: string
  os: string
  status: '0' | '1'
  message: string | null
  createdAt: string
}

export interface MyLoginLogParams {
  pageNum?: number
  pageSize?: number
  status?: '0' | '1'
  startTime?: string
  endTime?: string
}
export interface SendEmailCodeParams {
  email: string
  scene?: 'email_bind' | 'email_change'
}

export interface VerifyEmailParams {
  email: string
  code: string
}
export interface DeviceItem {
  deviceId: string
  current: boolean
  lastActiveAt: number | null
  ip: string | null
  userAgent: string | null
  ttl: number
}
/** 查询我的登录日志 */
export function getMyLoginLogs(params: MyLoginLogParams = {}) {
  return http
    .Get<{
      data: { list: LoginLogItem[]; total: number; pageNum: number; pageSize: number }
    }>('/auth/my/login-logs', { params })
    .send(true)
}
/** 查询注销状态 */
export function getCancelStatus() {
  return http.Get<{ data: CancelStatus }>('/auth/cancel-account/status').send(true)
}

/** 提交注销申请 */
export function submitCancelAccount(data: { password: string; reason?: string }) {
  return http.Post<{ data: { effectiveAt: string; bufferDays: number } }>('/auth/cancel-account', data).send(true)
}
// ============================================================
// 登录 / 登出 / 注册
// ============================================================
export function login(params: LoginParams): Promise<LoginResponse> {
  return post<LoginResponse>('/auth/login', params as unknown as Record<string, unknown>)
}

export function logout(): Promise<null> {
  return http.Post('/auth/logout', {}, { meta: { token: true, silent: true } })
}

export function register(data: {
  tenantCode: string
  tenantName: string
  username: string
  password: string
  email?: string
  phone?: string
}) {
  return http.Post('/auth/register', data)
}

export function refreshToken(refreshToken: string) {
  return post<{ token: string; refreshToken?: string }>('/auth/refresh', {
    refreshToken,
  })
}

// ============================================================
// 用户信息
// ============================================================
/** ✅ 修正：/auth/profile（原为 /auth/user-info） */
export function getProfile(): Promise<UserInfo> {
  return get<UserInfo>('/auth/profile')
}
/** 兼容旧名 */
export const getUserInfo = getProfile

export function updateProfile(data: { realName?: string; email?: string; phone?: string; avatar?: string }) {
  return http.Post('/auth/profile', data)
}

/** ✅ 修正：PUT（原为 POST） */
export function changePassword(data: { oldPassword: string; newPassword: string }) {
  return http.Put('/auth/password', data)
}

/** 忘记密码（重置） */
export function forgotPassword(data: ForgotPasswordParams) {
  return http.Post<ForgotPasswordResult>('/auth/forgot-password', data)
}

// ============================================================
// 菜单 / 权限
// ============================================================
export function getMenus(): Promise<any> {
  return get<any>('/auth/menus')
}

export function getPermissions(): Promise<string[]> {
  return get<string[]>('/auth/permissions')
}

export function getPasswordPolicy(): Promise<PasswordPolicy> {
  return get<PasswordPolicy>('/auth/password-policy')
}

export function getCaptcha(): Promise<CaptchaData> {
  return get<CaptchaData>('/auth/captcha')
}

// ============================================================
// 租户切换
// ============================================================
/** 获取当前用户可访问的租户列表（登录页 / 切换租户） */
export function getMyTenants(): Promise<AccessibleTenant[]> {
  return get<AccessibleTenant[]>('/auth/tenants')
}

export function switchTenant(tenantId: string) {
  return http.Post('/auth/switch-tenant', { tenantId })
}

// 租户列表
export function getAuthTenantList(): Promise<AccessibleTenant[]> {
  return get<AccessibleTenant[]>('/tenant/options')
}
/** 发送邮箱验证码 */
export function sendEmailCode(data: SendEmailCodeParams) {
  return http.Post<{ data: { expiresIn: number } }>('/auth/email/send-code', data).send(true)
}

/** 验证并绑定邮箱 */
export function verifyEmail(data: VerifyEmailParams) {
  return http.Post<{ data: null }>('/auth/email/verify', data).send(true)
}

export function getMyDevices() {
  return http.Get<DeviceItem[]>('/auth/my-devices')
}

export function kickMyDevice(deviceId: string) {
  return http.Delete(`/auth/my-devices/${deviceId}`)
}
