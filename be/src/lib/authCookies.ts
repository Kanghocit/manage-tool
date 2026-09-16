import type { Request, Response } from 'express'

import { env } from '../config/env'
import { parseDurationToMs } from '../utils/duration'

export const ACCESS_TOKEN_COOKIE = 'access_token'
export const REFRESH_TOKEN_COOKIE = 'refresh_token'

const REFRESH_COOKIE_PATH = '/api/auth'

type AuthTokens = {
  accessToken: string
  refreshToken: string
}

function cookieBaseOptions() {
  return {
    httpOnly: true,
    secure: env.authCookies.secure,
    sameSite: env.authCookies.sameSite,
    ...(env.authCookies.domain ? { domain: env.authCookies.domain } : {}),
  }
}

export function setAuthCookies(res: Response, tokens: AuthTokens) {
  const base = cookieBaseOptions()
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...base,
    path: '/',
    maxAge: parseDurationToMs(env.jwt.accessTtl),
  })
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...base,
    path: REFRESH_COOKIE_PATH,
    maxAge: parseDurationToMs(env.jwt.refreshTtl),
  })
}

export function clearAuthCookies(res: Response) {
  const base = cookieBaseOptions()
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...base, path: '/' })
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...base, path: REFRESH_COOKIE_PATH })
}

export function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) return {}
  const out: Record<string, string> = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx <= 0) continue
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (key) out[key] = decodeURIComponent(value)
  }
  return out
}

export function getAccessToken(req: Request): string | null {
  const fromCookie = req.cookies?.[ACCESS_TOKEN_COOKIE]
  if (typeof fromCookie === 'string' && fromCookie.trim()) {
    return fromCookie.trim()
  }

  const header = req.header('authorization') ?? req.header('Authorization')
  if (header?.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim()
    if (token) return token
  }

  return null
}

export function getRefreshToken(req: Request): string | null {
  const fromCookie = req.cookies?.[REFRESH_TOKEN_COOKIE]
  if (typeof fromCookie === 'string' && fromCookie.trim()) {
    return fromCookie.trim()
  }

  const bodyToken = req.body?.refreshToken
  if (typeof bodyToken === 'string' && bodyToken.trim()) {
    return bodyToken.trim()
  }

  return null
}

export function getAccessTokenFromCookieHeader(header: string | undefined): string | null {
  const cookies = parseCookieHeader(header)
  const token = cookies[ACCESS_TOKEN_COOKIE]
  return typeof token === 'string' && token.trim() ? token.trim() : null
}
