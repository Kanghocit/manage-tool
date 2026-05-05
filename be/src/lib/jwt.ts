import jwt, { type Secret } from 'jsonwebtoken'
import { env } from '../config/env'

export type JwtRole = 'admin' | 'user'

export type AccessTokenPayload = {
  sub: string
  role: JwtRole
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwt.accessSecret as Secret, { expiresIn: env.jwt.accessTtl as never })
}

export function signRefreshToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwt.refreshSecret as Secret, { expiresIn: env.jwt.refreshTtl as never })
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.jwt.accessSecret as Secret)
  if (typeof decoded !== 'object' || !decoded) {
    throw new Error('Invalid access token')
  }
  const { sub, role } = decoded as { sub?: unknown; role?: unknown }
  if (typeof sub !== 'string' || (role !== 'admin' && role !== 'user')) {
    throw new Error('Invalid access token payload')
  }
  return { sub, role }
}

export function verifyRefreshToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.jwt.refreshSecret as Secret)
  if (typeof decoded !== 'object' || !decoded) {
    throw new Error('Invalid refresh token')
  }
  const { sub, role } = decoded as { sub?: unknown; role?: unknown }
  if (typeof sub !== 'string' || (role !== 'admin' && role !== 'user')) {
    throw new Error('Invalid refresh token payload')
  }
  return { sub, role }
}

