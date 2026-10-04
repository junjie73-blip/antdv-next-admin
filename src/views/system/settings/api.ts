import { request } from '~/composables'

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
  return request.get<{ data: PasswordPolicy }>('/settings/password-policy')
}
export function updatePasswordPolicy(data: PasswordPolicy) {
  return request.put('/settings/password-policy', data)
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
  return request.get<{ data: SiteInfo }>('/settings/site-info')
}
export function updateSiteInfo(data: SiteInfo) {
  return request.put('/settings/site-info', data)
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
  return request.get<{ data: UploadConfig }>('/settings/upload-config')
}
export function updateUploadConfig(data: UploadConfig) {
  return request.put('/settings/upload-config', data)
}
