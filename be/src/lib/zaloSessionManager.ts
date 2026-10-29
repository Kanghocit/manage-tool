import { randomUUID } from 'crypto'

import { env } from '../config/env'
import { loadZcaSync, type ZaloApi } from './zcaClient'
import {
  decryptZaloCredentials,
  encryptZaloCredentials,
  type ZaloStoredCredentials,
} from './zaloCredentialCrypto'
import { prisma } from './prisma'
import { broadcastToUser } from './zaloWs'

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0'

export type QrLoginStatus =
  | 'pending'
  | 'waiting_scan'
  | 'scanned'
  | 'success'
  | 'expired'
  | 'declined'
  | 'error'

export type QrLoginSnapshot = {
  loginId: string
  status: QrLoginStatus
  qrImage?: string
  scannedDisplayName?: string
  scannedAvatar?: string
  accountId?: string
  errorMessage?: string
  updatedAt: number
}

type QrLoginSession = QrLoginSnapshot & {
  ownerUserId: string
  abort?: () => void
}

const accountApis = new Map<string, ZaloApi>()
const qrSessions = new Map<string, QrLoginSession>()

function publishQr(userId: string, snapshot: QrLoginSnapshot) {
  broadcastToUser(userId, { type: 'zalo:qr', ...snapshot })
}

function publishLoggedIn(userId: string, account: { id: string; displayName: string; avatar?: string | null }) {
  broadcastToUser(userId, {
    type: 'zalo:loggedIn',
    accountId: account.id,
    displayName: account.displayName,
    avatar: account.avatar ?? undefined,
  })
}

export function getQrLoginSnapshot(loginId: string, ownerUserId: string): QrLoginSnapshot | null {
  const session = qrSessions.get(loginId)
  if (!session || session.ownerUserId !== ownerUserId) return null
  const { ownerUserId: _o, abort: _a, ...rest } = session
  return rest
}

export async function listAccountsForUser(ownerUserId: string) {
  return prisma.zaloAccount.findMany({
    where: { ownerUserId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      zaloUid: true,
      displayName: true,
      avatar: true,
      status: true,
      lastActiveAt: true,
      createdAt: true,
    },
  })
}

async function countAccounts(ownerUserId: string) {
  return prisma.zaloAccount.count({ where: { ownerUserId } })
}

async function persistAccountFromApi(
  ownerUserId: string,
  api: ZaloApi,
  meta?: { displayName?: string; avatar?: string },
) {
  const zaloUid = String(await api.getOwnId())
  let displayName = meta?.displayName ?? zaloUid
  let avatar = meta?.avatar ?? null

  try {
    const info = await api.fetchAccountInfo()
    const profile = info as { data?: { display_name?: string; avatar?: string } }
    displayName = profile?.data?.display_name ?? displayName
    avatar = profile?.data?.avatar ?? avatar
  } catch {
    // keep meta fallback
  }

  const ctx = api.getContext()
  const cookieJar = ctx.cookie as { toJSON?: () => { cookies: unknown } } | null
  const credentials: ZaloStoredCredentials = {
    cookie: cookieJar?.toJSON?.()?.cookies ?? ctx.cookie,
    imei: ctx.imei,
    userAgent: ctx.userAgent,
  }
  const credentialsEnc = encryptZaloCredentials(credentials)

  const account = await prisma.zaloAccount.upsert({
    where: { ownerUserId_zaloUid: { ownerUserId, zaloUid } },
    create: {
      ownerUserId,
      zaloUid,
      displayName,
      avatar,
      credentialsEnc,
      status: 'active',
      lastActiveAt: new Date(),
    },
    update: {
      displayName,
      avatar,
      credentialsEnc,
      status: 'active',
      lastActiveAt: new Date(),
    },
  })

  accountApis.set(account.id, api)
  return account
}

export async function getApiForAccount(accountId: string, ownerUserId: string): Promise<ZaloApi> {
  const cached = accountApis.get(accountId)
  if (cached) return cached

  const row = await prisma.zaloAccount.findFirst({
    where: { id: accountId, ownerUserId },
  })
  if (!row) {
    throw new Error('ACCOUNT_NOT_FOUND')
  }

  const creds = decryptZaloCredentials(row.credentialsEnc)
  const { Zalo } = loadZcaSync()
  const zalo = new Zalo({ selfListen: false, logging: false })
  const api = await zalo.login({
    imei: creds.imei,
    userAgent: creds.userAgent,
    cookie: creds.cookie as never,
    language: 'vi',
  })
  accountApis.set(accountId, api)
  await prisma.zaloAccount.update({
    where: { id: accountId },
    data: { lastActiveAt: new Date(), status: 'active' },
  })
  return api
}

/** Log in with the browser's live Zalo Web session so server and chat.zalo.me share one session. */
export async function importBrowserSession(
  ownerUserId: string,
  input: { cookie: unknown; imei: string; userAgent: string },
) {
  const { Zalo } = loadZcaSync()
  const zalo = new Zalo({ selfListen: false, logging: false })
  let api: ZaloApi
  try {
    api = await zalo.login({
      imei: input.imei,
      userAgent: input.userAgent,
      cookie: input.cookie as never,
      language: 'vi',
    })
  } catch (err) {
    throw new Error(`SESSION_INVALID: ${err instanceof Error ? err.message : String(err)}`)
  }

  const zaloUid = String(await api.getOwnId())
  const existing = await prisma.zaloAccount.findFirst({ where: { ownerUserId, zaloUid } })
  if (!existing && (await countAccounts(ownerUserId)) >= env.zaloMaxAccountsPerUser) {
    throw new Error('ACCOUNT_LIMIT')
  }

  const account = await persistAccountFromApi(ownerUserId, api)
  publishLoggedIn(ownerUserId, account)
  return account
}

export function evictAccountApi(accountId: string) {
  accountApis.delete(accountId)
}

export async function deleteAccount(accountId: string, ownerUserId: string) {
  const row = await prisma.zaloAccount.findFirst({
    where: { id: accountId, ownerUserId },
  })
  if (!row) throw new Error('ACCOUNT_NOT_FOUND')
  accountApis.delete(accountId)
  await prisma.zaloAccount.delete({ where: { id: accountId } })
}

export async function startQrLogin(ownerUserId: string): Promise<{ loginId: string }> {
  const total = await countAccounts(ownerUserId)
  if (total >= env.zaloMaxAccountsPerUser) {
    throw new Error('ACCOUNT_LIMIT')
  }

  const loginId = randomUUID()
  const now = Date.now()
  const session: QrLoginSession = {
    loginId,
    ownerUserId,
    status: 'pending',
    updatedAt: now,
  }
  qrSessions.set(loginId, session)

  void (async () => {
    const { Zalo, LoginQRCallbackEventType } = loadZcaSync()
    const zalo = new Zalo({ selfListen: false, logging: false })

    return zalo.loginQR({ userAgent: DEFAULT_UA, language: 'vi' }, (event) => {
      const current = qrSessions.get(loginId)
      if (!current || current.ownerUserId !== ownerUserId) return

      if (event.type === LoginQRCallbackEventType.QRCodeGenerated) {
        current.status = 'waiting_scan'
        current.qrImage = String(event.data.image ?? '')
        current.updatedAt = Date.now()
        const abortFn = event.actions?.abort
        if (abortFn) current.abort = () => abortFn()
        publishQr(ownerUserId, { ...current })
        return
      }

      if (event.type === LoginQRCallbackEventType.QRCodeScanned) {
        current.status = 'scanned'
        current.scannedDisplayName = String(event.data.display_name ?? '')
        current.scannedAvatar = String(event.data.avatar ?? '')
        current.updatedAt = Date.now()
        publishQr(ownerUserId, { ...current })
        return
      }

      if (event.type === LoginQRCallbackEventType.QRCodeExpired) {
        current.status = 'expired'
        current.updatedAt = Date.now()
        publishQr(ownerUserId, { ...current })
        return
      }

      if (event.type === LoginQRCallbackEventType.QRCodeDeclined) {
        current.status = 'declined'
        current.updatedAt = Date.now()
        publishQr(ownerUserId, { ...current })
        return
      }
    })
      .then(async (api) => {
        const current = qrSessions.get(loginId)
        if (!current) return

        try {
          const account = await persistAccountFromApi(ownerUserId, api, {
            displayName: current.scannedDisplayName,
            avatar: current.scannedAvatar,
          })
          current.status = 'success'
          current.accountId = account.id
          current.updatedAt = Date.now()
          publishQr(ownerUserId, { ...current })
          publishLoggedIn(ownerUserId, account)
        } catch (err: unknown) {
          current.status = 'error'
          current.errorMessage = err instanceof Error ? err.message : 'Login failed'
          current.updatedAt = Date.now()
          publishQr(ownerUserId, { ...current })
        }
      })
      .catch((err: unknown) => {
        const current = qrSessions.get(loginId)
        if (!current) return
        current.status = 'error'
        current.errorMessage = err instanceof Error ? err.message : 'QR login failed'
        current.updatedAt = Date.now()
        publishQr(ownerUserId, { ...current })
      })
  })()

  return { loginId }
}

export function cancelQrLogin(loginId: string, ownerUserId: string) {
  const session = qrSessions.get(loginId)
  if (!session || session.ownerUserId !== ownerUserId) return
  try {
    session.abort?.()
  } catch {
    // ignore
  }
  qrSessions.delete(loginId)
}

export function publishScanProgress(
  ownerUserId: string,
  payload: { scanId: string; progress: number; memberCount?: number; status?: string },
) {
  broadcastToUser(ownerUserId, { type: 'zalo:scanProgress', ...payload })
}
