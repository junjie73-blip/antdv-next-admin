export interface HashOptions {
  algorithm?: 'md5' | 'sha256'
}

export interface AesOptions {
  key: string
  iv?: string
}

export interface JwtPayload {
  [key: string]: unknown
  exp?: number
  iat?: number
}

export interface JwtOptions {
  secret: string
  expiresIn?: string | number
}
