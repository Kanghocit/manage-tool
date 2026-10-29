/* eslint-disable @typescript-eslint/no-require-imports */
/** zca-js is ESM; use CJS build from Node (CommonJS backend). */

export type ZaloApi = {
  getOwnId: () => Promise<string>
  getContext: () => {
    cookie: { toJSON?: () => { cookies: unknown } } | unknown
    imei: string
    userAgent: string
  }
  fetchAccountInfo: () => Promise<unknown>
  getAllGroups: () => Promise<{ gridVerMap: Record<string, string> }>
  getGroupInfo: (
    groupId: string | string[],
  ) => Promise<{
    gridInfoMap: Record<
      string,
      { name?: string; totalMember?: number; memVerList?: string[]; avatar?: string }
    >
  }>
  getGroupMembersInfo: (
    memberId: string | string[],
  ) => Promise<{
    profiles: Record<
      string,
      { displayName?: string; zaloName?: string; avatar?: string; type?: number }
    >
  }>
}

type ZcaRuntime = {
  Zalo: new (options?: Record<string, unknown>) => {
    login: (credentials: Record<string, unknown>) => Promise<ZaloApi>
    loginQR: (
      options?: Record<string, unknown>,
      callback?: (event: { type: number; data: Record<string, unknown>; actions?: { abort?: () => void } }) => void,
    ) => Promise<ZaloApi>
  }
  LoginQRCallbackEventType: {
    QRCodeGenerated: number
    QRCodeExpired: number
    QRCodeScanned: number
    QRCodeDeclined: number
    GotLoginInfo: number
  }
}

let cached: ZcaRuntime | null = null

export function loadZcaSync(): ZcaRuntime {
  if (!cached) {
    cached = require('zca-js') as ZcaRuntime
  }
  return cached
}

export async function loadZca(): Promise<ZcaRuntime> {
  return loadZcaSync()
}
