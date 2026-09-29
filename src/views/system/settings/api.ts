import { http } from '~/utils'

/* ============================================================
 * 密码策略
 * ============================================================ */
export interface PasswordPolicy {
  minLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumber: boolean
  requireSpecial: boolean
  historyCount: number
  expireDays: number
}

export function getPasswordPolicy() {
  return http.Get<{ data: PasswordPolicy }>('/settings/password-policy').send(true)
}
export function updatePasswordPolicy(data: PasswordPolicy) {
  return http.Put('/settings/password-policy', data).send(true)
}

/* ============================================================
 * 网站信息
 * ============================================================ */
export interface SiteInfo {
  name: string
  logo: string
  favicon: string
  icp: string
  copyright: string
  description: string
  keywords: string
}

export function getSiteInfo() {
  return http.Get<{ data: SiteInfo }>('/settings/site-info').send(true)
}
export function updateSiteInfo(data: SiteInfo) {
  return http.Put('/settings/site-info', data).send(true)
}

/* ============================================================
 * 上传配置
 * ============================================================ */
export interface UploadConfig {
  storage: 'local' | 'minio' | 'oss' | 'cos' | 's3'
  maxSize: number
  allowedTypes: string

  localPath: string
  localUrl: string

  minioEndpoint?: string
  minioPort?: number
  minioUseSSL?: boolean
  minioRegion?: string
  minioBucket?: string
  minioPublicUrl?: string
  minioAccessKey?: string
  minioSecretKey?: string

  ossRegion?: string
  ossBucket?: string
  ossEndpoint?: string
  ossCustomDomain?: string
  ossAccessKeyId?: string
  ossAccessKeySecret?: string

  cosRegion?: string
  cosBucket?: string
  cosCustomDomain?: string
  cosSecretId?: string
  cosSecretKey?: string

  s3Region?: string
  s3Bucket?: string
  s3CustomDomain?: string
  s3AccessKeyId?: string
  s3AccessKeySecret?: string
}

export function getUploadConfig() {
  return http.Get<{ data: UploadConfig }>('/settings/upload-config').send(true)
}
export function updateUploadConfig(data: UploadConfig) {
  return http.Put('/settings/upload-config', data).send(true)
}
