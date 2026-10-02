import { cn } from '~/utils'

export const containerClassName = cn('space-y-4')
export const cardClassName = cn(
  'shadow-sm rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900',
)

export const BACKEND_TYPE_MAP: Record<string, { label: string; color: string; icon: string }> = {
  local: { label: '本地存储', color: 'default', icon: 'lucide:hard-drive' },
  minio: { label: 'MinIO', color: 'purple', icon: 'lucide:database' },
  oss: { label: '阿里云 OSS', color: 'orange', icon: 'lucide:cloud' },
  cos: { label: '腾讯云 COS', color: 'blue', icon: 'lucide:cloud' },
  s3: { label: 'AWS S3', color: 'cyan', icon: 'lucide:cloud' },
}

export const BACKEND_TYPE_OPTIONS = Object.entries(BACKEND_TYPE_MAP).map(([value, meta]) => ({
  label: meta.label,
  value,
}))

/** 敏感字段：提交时 `******` 表示不修改 */
export const SENSITIVE_FIELDS = new Set([
  'accessKey',
  'accessKeyId',
  'accessKeySecret',
  'secretKey',
  'secretId',
  'secretAccessKey',
  'password',
])

export const MASK = '******'
