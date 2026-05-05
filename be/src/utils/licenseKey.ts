import crypto from 'node:crypto'
import { env } from '../config/env'

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomChunk(len: number): string {
  const bytes = crypto.randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i += 1) {
    out += alphabet[bytes[i] % alphabet.length]
  }
  return out
}

export function generateLicenseKey(prefix = 'KANG'): string {
  return `${prefix}-${randomChunk(4)}-${randomChunk(4)}-${randomChunk(4)}`
}

export function licenseKeyPreview(key: string): string {
  const parts = key.split('-')
  if (parts.length < 4) return `${key.slice(0, 4)}-****-${key.slice(-4)}`
  return `${parts[0]}-****-${parts[3]}`
}

export function licenseKeyHash(key: string): string {
  return crypto.createHmac('sha256', env.licenseKeyPepper).update(key).digest('hex')
}

