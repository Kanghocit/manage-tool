import crypto from 'crypto'
import os from 'os'

import type { ZaloApi } from './zcaClient'
import { loadZcaSync } from './zcaClient'
import type { ZaloAppSession } from './zaloCredentialCrypto'

const AUTH_DOMAIN = 'https://wpa.zaloapp.com'
const GROUP_DOMAIN = 'https://group-wpa.zaloapp.com'
const PROFILE_DOMAIN = 'https://profile-wpa.zaloapp.com'
export const PC_APP_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ZaloPC/23.12.1 Chrome/102.0.5005.167 Electron/19.1.9 Safari/537.36'
const API_TYPE = 30
const API_VERSION = 671

export type AppGroupData = {
  name?: string
  avt?: string
  memVerList?: string[]
  currentMems?: Array<{ id: string; dName?: string; zaloName?: string }>
  totalMember?: number
  hasMoreMember?: number
  lockViewMember?: number
}

type JarCookie = {
  name: string
  value: string
  domain: string
  path: string
  secure: boolean
  httpOnly: boolean
  maxAge?: number
  sameSite: string
  creation: string
  lastAccessed: string
}

class CookieJar {
  private store = new Map<string, JarCookie>()

  ingest(setCookieHeaders: string[], originUrl: string) {
    const originHost = new URL(originUrl).hostname
    for (const raw of setCookieHeaders) {
      const parts = raw.split(';').map((s) => s.trim())
      const firstEq = parts[0]!.indexOf('=')
      if (firstEq < 0) continue
      const name = parts[0]!.slice(0, firstEq).trim()
      const value = parts[0]!.slice(firstEq + 1).trim()
      let domain = originHost
      let cookPath = '/'
      let secure = false
      let httpOnly = false
      let maxAge: number | undefined
      let sameSite = 'lax'
      for (const attr of parts.slice(1)) {
        const lower = attr.toLowerCase()
        if (lower.startsWith('domain=')) domain = attr.slice(7).replace(/^\./, '')
        else if (lower.startsWith('path=')) cookPath = attr.slice(5)
        else if (lower.startsWith('max-age=')) maxAge = parseInt(attr.slice(8), 10) || undefined
        else if (lower.startsWith('samesite=')) sameSite = attr.slice(9).toLowerCase()
        else if (lower === 'secure') secure = true
        else if (lower === 'httponly') httpOnly = true
      }
      const now = new Date().toISOString()
      this.store.set(`${domain}::${name}`, {
        name,
        value,
        domain,
        path: cookPath,
        secure,
        httpOnly,
        maxAge,
        sameSite,
        creation: now,
        lastAccessed: now,
      })
    }
  }

  headerFor(url: string): string {
    const { hostname, protocol } = new URL(url)
    const isSecure = protocol === 'https:'
    const parts: string[] = []
    for (const c of this.store.values()) {
      if (!hostname.endsWith(c.domain) && hostname !== c.domain) continue
      if (c.secure && !isSecure) continue
      parts.push(`${c.name}=${c.value}`)
    }
    return parts.join('; ')
  }

  toZcaFormat(): Record<string, unknown>[] {
    return Array.from(this.store.values()).map((c) => ({
      key: c.name,
      value: c.value,
      domain: c.domain.includes('zaloapp.com') ? 'chat.zalo.me' : c.domain,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      hostOnly: false,
      creation: c.creation,
      lastAccessed: c.lastAccessed,
      ...(c.maxAge !== undefined ? { maxAge: c.maxAge } : {}),
      sameSite: c.sameSite,
    }))
  }

  toRawPairs(): Array<{ name: string; value: string; domain: string }> {
    return Array.from(this.store.values()).map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
    }))
  }
}

function aesCipher(keyBuf: Buffer): string {
  const bits = keyBuf.length * 8
  if (bits === 128) return 'aes-128-cbc'
  if (bits === 192) return 'aes-192-cbc'
  return 'aes-256-cbc'
}

function encodeAes(plaintext: string, zpwEnk: string): string {
  const key = Buffer.from(zpwEnk, 'base64')
  const iv = Buffer.alloc(16, 0)
  const cipher = crypto.createCipheriv(aesCipher(key), key, iv)
  return Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]).toString('base64')
}

function decodeAes(ciphertext: string, zpwEnk: string): string {
  const key = Buffer.from(zpwEnk, 'base64')
  const iv = Buffer.alloc(16, 0)
  const decipher = crypto.createDecipheriv(aesCipher(key), key, iv)
  const ct = Buffer.from(decodeURIComponent(ciphertext), 'base64')
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}

function signKey(endpointName: string, params: Record<string, unknown>): string {
  const sorted = Object.keys(params).sort()
  const seed = 'zsecure' + endpointName + sorted.map((k) => String(params[k])).join('')
  return crypto.createHash('md5').update(seed, 'utf8').digest('hex')
}

function authParams(body: Record<string, unknown>, endpoint: string): Record<string, string> {
  const p: Record<string, unknown> = { ...body, type: API_TYPE, client_version: API_VERSION }
  p.signkey = signKey(endpoint, p)
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)]))
}

function commonParams(imei: string): Record<string, string> {
  return { zpw_type: String(API_TYPE), zpw_ver: String(API_VERSION), imei }
}

function buildCookieHeader(
  cookies: Array<{ name: string; value: string; domain: string }>,
  url: string,
): string {
  const { hostname } = new URL(url)
  return cookies
    .filter((c) => hostname.endsWith(c.domain) || hostname === c.domain)
    .map((c) => `${c.name}=${c.value}`)
    .join('; ')
}

function collectSetCookies(res: Response): string[] {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] }
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie()
  }
  const single = res.headers.get('set-cookie')
  return single ? [single] : []
}

async function jarFetch(jar: CookieJar, url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (!headers.has('User-Agent')) headers.set('User-Agent', PC_APP_UA)
  const cookieHeader = jar.headerFor(url)
  if (cookieHeader) headers.set('Cookie', cookieHeader)
  const res = await fetch(url, { ...init, headers })
  const setCookies = collectSetCookies(res)
  if (setCookies.length) jar.ingest(setCookies, url)
  return res
}

export type PcAppQrLoginHooks = {
  onQrImage?: (base64Png: string) => void
  onScanned?: (displayName: string) => void
}

export type PcAppQrLoginResult = {
  api: ZaloApi
  appSession: ZaloAppSession
  imei: string
  cookie: unknown
  userAgent: string
  displayName: string
  avatar?: string
}

function displayNameFromLoginData(loginData: Record<string, unknown>, uid: string): string {
  const n = loginData.send2me_name ?? loginData.name ?? loginData.zaloName ?? uid
  if (typeof n === 'object' && n !== null) {
    const obj = n as Record<string, string>
    return obj.VI ?? obj.EN ?? uid
  }
  return String(n)
}

/**
 * QR login via Zalo PC App API (wpa.zaloapp.com). Separate device from Zalo Web.
 */
export async function loginWithPcAppQr(
  hooks: PcAppQrLoginHooks,
  abortSignal?: AbortSignal,
): Promise<PcAppQrLoginResult> {
  const jar = new CookieJar()
  const imei = crypto.randomUUID() + '-' + crypto.createHash('md5').update(PC_APP_UA).digest('hex')
  const host = os.hostname() || 'ZaloPCClient'

  const reqParams = authParams(
    {
      language: 'vi',
      client_time: String(Math.floor(Date.now() / 1000)),
      imei,
      computer_name: host,
      logged_uids: '[]',
    },
    'reqqr',
  )

  const fullUrl = `${AUTH_DOMAIN}/api/login/reqqr?${new URLSearchParams(reqParams).toString()}`
  const r1Res = await fetch(fullUrl, {
    headers: { 'User-Agent': PC_APP_UA, Accept: 'application/json' },
    signal: abortSignal,
  })
  if (!r1Res.ok) throw new Error(`PC_APP_REQQR_HTTP_${r1Res.status}`)
  const set1 = collectSetCookies(r1Res)
  if (set1.length) jar.ingest(set1, fullUrl)

  const r1Body = (await r1Res.json()) as {
    error_code?: number
    error_message?: string
    data?: Record<string, unknown>
  }
  if (r1Body.error_code !== 0) {
    throw new Error(
      `PC_APP_REQQR: ${r1Body.error_message ?? String(r1Body.error_code ?? 'unknown')}`,
    )
  }

  const inner = r1Body.data ?? {}
  const base64Qr = String(inner.base64_qr ?? '')
  const pollUrl = String(inner.chk_wait_cfirm ?? '')
  if (!base64Qr && !pollUrl) throw new Error('PC_APP_REQQR: no QR data')

  hooks.onQrImage?.(base64Qr)

  if (!pollUrl) throw new Error('PC_APP_REQQR: no poll URL')

  let confirmed = false
  for (let i = 0; i < 90 && !confirmed; i++) {
    if (abortSignal?.aborted) throw new Error('PC_APP_QR_CANCELLED')
    await new Promise((r) => setTimeout(r, 2000))
    try {
      const pr = await jarFetch(jar, pollUrl, { signal: abortSignal })
      const prData = (await pr.json()) as { error_code?: number; errorCode?: number }
      const ec = prData.error_code ?? prData.errorCode ?? -1
      if (ec === 0) {
        confirmed = true
        break
      }
    } catch (err) {
      if (abortSignal?.aborted) throw new Error('PC_APP_QR_CANCELLED')
      if (err instanceof Error && err.name === 'AbortError') throw new Error('PC_APP_QR_CANCELLED')
    }
  }
  if (!confirmed) throw new Error('PC_APP_QR_EXPIRED')

  const loginInfoUrl = `${AUTH_DOMAIN}/api/login/getLoginInfo?${new URLSearchParams(
    authParams(
      {
        imei,
        computer_name: host,
        language: 'vi',
        ts: String(Date.now()),
      },
      'getlogininfo',
    ),
  ).toString()}`

  const r4 = await jarFetch(jar, loginInfoUrl, { signal: abortSignal })
  const r4Data = (await r4.json()) as {
    error_code: number
    error_message?: string
    data?: Record<string, unknown>
  }
  if (r4Data.error_code !== 0) {
    throw new Error(
      `PC_APP_LOGIN_INFO: ${r4Data.error_message ?? String(r4Data.error_code)}`,
    )
  }

  const loginData = r4Data.data ?? {}
  const uid = String(loginData.uid ?? '')
  const displayName = displayNameFromLoginData(loginData, uid)
  const avatar = typeof loginData.avatar === 'string' ? loginData.avatar : undefined
  hooks.onScanned?.(displayName)

  const zpwEnk = String(loginData.zpw_enk ?? '')
  if (!zpwEnk) throw new Error('PC_APP_LOGIN_INFO: missing zpw_enk')

  const appSession: ZaloAppSession = {
    zpwEnk,
    imei,
    cookies: jar.toRawPairs(),
  }

  const cookies = jar.toZcaFormat()
  const { Zalo } = loadZcaSync()
  const zalo = new Zalo({ selfListen: false, logging: false })
  const api = await zalo.login({
    imei,
    userAgent: PC_APP_UA,
    cookie: cookies as never,
    language: 'vi',
  })

  return {
    api,
    appSession,
    imei,
    cookie: cookies,
    userAgent: PC_APP_UA,
    displayName,
    avatar,
  }
}

export async function appGetGroupInfo(
  appSession: ZaloAppSession,
  groupId: string,
): Promise<AppGroupData | null> {
  const url = `${GROUP_DOMAIN}/api/group/getmg-v2`
  const body = { gridVerMap: JSON.stringify({ [groupId]: 0 }) }
  const encBody = encodeAes(JSON.stringify(body), appSession.zpwEnk)
  const qs = new URLSearchParams(commonParams(appSession.imei))

  try {
    const res = await fetch(`${url}?${qs.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': PC_APP_UA,
        Cookie: buildCookieHeader(appSession.cookies, url),
      },
      body: `params=${encodeURIComponent(encBody)}`,
    })
    const data = (await res.json()) as {
      error_code: number
      data?: string
      error_message?: string
    }
    if (data.error_code !== 0 || !data.data) {
      console.warn(
        `[zalo-pc] getmg-v2 [${data.error_code}] ${data.error_message ?? ''}`,
      )
      return null
    }
    const parsed = JSON.parse(decodeAes(data.data, appSession.zpwEnk)) as {
      data?: { gridInfoMap?: Record<string, AppGroupData> }
    }
    return parsed?.data?.gridInfoMap?.[groupId] ?? null
  } catch (err) {
    console.warn(`[zalo-pc] getmg-v2 failed: ${err instanceof Error ? err.message : err}`)
    return null
  }
}

export async function appGetGroupMembersInfo(
  appSession: ZaloAppSession,
  uids: string[],
): Promise<Map<string, { displayName?: string; zaloName?: string }>> {
  const result = new Map<string, { displayName?: string; zaloName?: string }>()
  const BATCH = 50
  const url = `${PROFILE_DOMAIN}/api/social/group/members`
  const qs = new URLSearchParams(commonParams(appSession.imei))

  for (let i = 0; i < uids.length; i += BATCH) {
    const batch = uids.slice(i, i + BATCH)
    const friendPversionMap = batch.map((u) => (u.endsWith('_0') ? u : `${u}_0`))
    const encBody = encodeAes(
      JSON.stringify({ friend_pversion_map: friendPversionMap }),
      appSession.zpwEnk,
    )

    try {
      const res = await fetch(`${url}?${qs.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': PC_APP_UA,
          Cookie: buildCookieHeader(appSession.cookies, url),
        },
        body: `params=${encodeURIComponent(encBody)}`,
      })
      const resp = (await res.json()) as {
        error_code: number
        data?: string
        error_message?: string
      }
      if (resp.error_code !== 0 || !resp.data) continue

      const decrypted = decodeAes(resp.data, appSession.zpwEnk)
      const parsed = JSON.parse(decrypted) as {
        data?: {
          profiles?: Record<string, { displayName?: string; zaloName?: string }>
        }
      }
      const profiles = parsed?.data?.profiles ?? {}
      for (const uid of batch) {
        const key = uid.endsWith('_0') ? uid : `${uid}_0`
        const p = profiles[key] ?? profiles[uid]
        if (p) result.set(uid, p)
      }
    } catch (err) {
      console.warn(
        `[zalo-pc] group/members failed: ${err instanceof Error ? err.message : err}`,
      )
      break
    }
  }

  return result
}
