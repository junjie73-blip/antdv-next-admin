import type { JwtOptions, JwtPayload } from './types'
import * as jose from 'jose'

export async function signJwt(payload: JwtPayload, options: JwtOptions): Promise<string> {
  const { secret, expiresIn } = options
  const secretKey = new TextEncoder().encode(secret)

  let jwt: jose.SignJWT = new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()

  if (expiresIn) {
    if (typeof expiresIn === 'number') {
      jwt = jwt.setExpirationTime(`${expiresIn}s`)
    }
    else {
      jwt = jwt.setExpirationTime(expiresIn)
    }
  }

  return await jwt.sign(secretKey)
}

export async function verifyJwt<T = JwtPayload>(token: string, secret: string): Promise<T | null> {
  try {
    const secretKey = new TextEncoder().encode(secret)
    const { payload } = await jose.jwtVerify(token, secretKey)
    return payload as T
  }
  catch {
    return null
  }
}

export function decodeJwt<T = JwtPayload>(token: string): T | null {
  try {
    const payload = jose.decodeJwt(token)
    return payload as T
  }
  catch {
    return null
  }
}

export function isJwtExpired(token: string): boolean {
  const payload = decodeJwt(token)
  if (!payload?.exp)
    return true
  return Date.now() >= payload.exp * 1000
}
