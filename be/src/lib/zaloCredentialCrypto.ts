import crypto from 'crypto'

import { env } from '../config/env'

export type ZaloAppSession = {
  zpwEnk: string
  imei: string
  cookies: Array<{ name: string; value: string; domain: string }>
}

export type ZaloStoredCredentials = {
  cookie: unknown
  imei: string
  userAgent: string
  appSession?: ZaloAppSession
}

function resolveKey(): Buffer {
  const raw = env.zaloCredKey.trim()
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex')
  }
  const b64 = Buffer.from(raw, 'base64')
  if (b64.length === 32) return b64
  return crypto.createHash('sha256').update(raw).digest()
}

export function encryptZaloCredentials(credentials: ZaloStoredCredentials): string {
  const key = resolveKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const plaintext = JSON.stringify(credentials)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return JSON.stringify({
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  })
}

export function decryptZaloCredentials(payload: string): ZaloStoredCredentials {
  const parsed = JSON.parse(payload) as {
    iv: string
    tag: string
    data: string
  }
  const key = resolveKey()
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(parsed.iv, 'base64'),
  )
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parsed.data, 'base64')),
    decipher.final(),
  ])
  return JSON.parse(decrypted.toString('utf8')) as ZaloStoredCredentials
}
