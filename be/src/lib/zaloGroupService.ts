import { rowsToXlsxBuffer } from './excel'
import { prisma } from './prisma'
import type { ZaloApi } from './zcaClient'
import { evictAccountApi, getApiForAccount, publishScanProgress } from './zaloSessionManager'

const MEMBER_BATCH = 50
const BATCH_DELAY_MS = 800

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

type GroupInfoMap = Record<
  string,
  { name?: string; totalMember?: number; memVerList?: string[]; avatar?: string }
>

const GROUP_INFO_BATCH = 20

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Zalo rejects large getGroupInfo payloads ("Tham số không hợp lệ"), and a single
 * bad group ID fails the whole batch — split down to single IDs and skip failures.
 */
async function fetchGroupInfoBatch(api: ZaloApi, ids: string[], map: GroupInfoMap) {
  try {
    const info = await api.getGroupInfo(ids)
    Object.assign(map, info.gridInfoMap ?? {})
  } catch (err) {
    if (ids.length === 1) {
      console.warn(`[zalo] getGroupInfo skipped group ${ids[0]}: ${errorMessage(err)}`)
      return
    }
    const mid = Math.ceil(ids.length / 2)
    await fetchGroupInfoBatch(api, ids.slice(0, mid), map)
    await fetchGroupInfoBatch(api, ids.slice(mid), map)
  }
}

async function fetchGroupInfoMap(api: ZaloApi, groupIds: string[]) {
  const map: GroupInfoMap = {}
  for (const batch of chunk(groupIds, GROUP_INFO_BATCH)) {
    await fetchGroupInfoBatch(api, batch, map)
  }
  return map
}

export function humanizeZaloClientError(message: string): string {
  const m = message.trim()
  if (/^GET_ALL_GROUPS:/.test(m)) {
    return `Zalo từ chối lấy danh sách nhóm (getAllGroups): ${m.replace(/^GET_ALL_GROUPS:\s*/, '')}. Thử gỡ tài khoản và đăng nhập QR lại.`
  }
  if (/^LOGIN:/.test(m)) {
    return `Không khôi phục được phiên Zalo trên server: ${m.replace(/^LOGIN:\s*/, '')}. Gỡ tài khoản và đăng nhập QR lại.`
  }
  return m || 'Không lấy được dữ liệu từ Zalo.'
}

export async function listGroupsForAccount(accountId: string, ownerUserId: string) {
  let api: ZaloApi
  try {
    api = await getApiForAccount(accountId, ownerUserId)
  } catch (err) {
    const msg = errorMessage(err)
    if (msg === 'ACCOUNT_NOT_FOUND') throw err
    throw new Error(`LOGIN: ${msg}`)
  }

  let all: { gridVerMap: Record<string, string> }
  try {
    all = await api.getAllGroups()
  } catch (firstErr) {
    console.warn(`[zalo] getAllGroups failed, re-login once: ${errorMessage(firstErr)}`)
    evictAccountApi(accountId)
    try {
      api = await getApiForAccount(accountId, ownerUserId)
      all = await api.getAllGroups()
    } catch (err) {
      throw new Error(`GET_ALL_GROUPS: ${errorMessage(err)}`)
    }
  }
  const groupIds = Object.keys(all.gridVerMap ?? {})
  if (groupIds.length === 0) return []

  const map = await fetchGroupInfoMap(api, groupIds)
  return groupIds.map((id) => {
    const g = map[id]
    return {
      groupId: id,
      name: g?.name ?? id,
      memberCount: g?.totalMember ?? g?.memVerList?.length ?? 0,
      avatar: g?.avatar ?? null,
    }
  })
}

export async function startGroupMemberScan(
  accountId: string,
  ownerUserId: string,
  groupId: string,
): Promise<{ scanId: string }> {
  const account = await prisma.zaloAccount.findFirst({
    where: { id: accountId, ownerUserId },
  })
  if (!account) throw new Error('ACCOUNT_NOT_FOUND')

  const scan = await prisma.zaloGroupScan.create({
    data: {
      accountId,
      ownerUserId,
      groupId,
      status: 'running',
      progress: 0,
    },
  })

  void runScanJob(scan.id, accountId, ownerUserId, groupId)
  return { scanId: scan.id }
}

async function runScanJob(
  scanId: string,
  accountId: string,
  ownerUserId: string,
  groupId: string,
) {
  try {
    const api = await getApiForAccount(accountId, ownerUserId)
    const infoRes = await api.getGroupInfo(groupId)
    const groupInfo = infoRes.gridInfoMap?.[groupId]
    const groupName = groupInfo?.name ?? groupId
    const memberIds = (groupInfo?.memVerList ?? []).map((entry: string) =>
      String(entry).split('_')[0],
    )

    await prisma.zaloGroupScan.update({
      where: { id: scanId },
      data: { groupName, progress: 5 },
    })
    publishScanProgress(ownerUserId, { scanId, progress: 5, status: 'running' })

    const batches = chunk(memberIds, MEMBER_BATCH)
    let done = 0
    const allProfiles: Array<{
      uid: string
      displayName: string | null
      zaloName: string | null
      avatar: string | null
      memberType: number | null
    }> = []

    for (const batch of batches) {
      if (batch.length === 0) continue
      const res = await api.getGroupMembersInfo(batch)
      const profiles = res.profiles ?? {}
      for (const uid of batch) {
        const uidKey = String(uid)
        const p = profiles[uidKey]
        allProfiles.push({
          uid: uidKey,
          displayName: p?.displayName ?? null,
          zaloName: p?.zaloName ?? null,
          avatar: p?.avatar ?? null,
          memberType: typeof p?.type === 'number' ? p.type : null,
        })
      }
      done += batch.length
      const progress = memberIds.length
        ? Math.min(95, Math.round(5 + (done / memberIds.length) * 90))
        : 100
      await prisma.zaloGroupScan.update({
        where: { id: scanId },
        data: { progress, memberCount: allProfiles.length },
      })
      publishScanProgress(ownerUserId, {
        scanId,
        progress,
        memberCount: allProfiles.length,
        status: 'running',
      })
      if (batches.length > 1) await sleep(BATCH_DELAY_MS)
    }

    await prisma.$transaction([
      prisma.zaloGroupMember.createMany({
        data: allProfiles.map((m) => ({
          scanId,
          uid: m.uid,
          displayName: m.displayName,
          zaloName: m.zaloName,
          avatar: m.avatar,
          memberType: m.memberType,
        })),
        skipDuplicates: true,
      }),
      prisma.zaloGroupScan.update({
        where: { id: scanId },
        data: {
          status: 'completed',
          progress: 100,
          memberCount: allProfiles.length,
        },
      }),
    ])

    publishScanProgress(ownerUserId, {
      scanId,
      progress: 100,
      memberCount: allProfiles.length,
      status: 'completed',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scan failed'
    await prisma.zaloGroupScan.update({
      where: { id: scanId },
      data: { status: 'failed', errorMessage: message },
    })
    publishScanProgress(ownerUserId, { scanId, progress: 0, status: 'failed' })
  }
}

export async function getScanForUser(scanId: string, ownerUserId: string) {
  const scan = await prisma.zaloGroupScan.findFirst({
    where: { id: scanId, ownerUserId },
    include: {
      members: { orderBy: { displayName: 'asc' } },
      account: { select: { id: true, displayName: true, zaloUid: true } },
    },
  })
  return scan
}

export async function listScansForUser(ownerUserId: string) {
  return prisma.zaloGroupScan.findMany({
    where: { ownerUserId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      groupId: true,
      groupName: true,
      memberCount: true,
      status: true,
      progress: true,
      createdAt: true,
      account: { select: { id: true, displayName: true } },
    },
  })
}

export function buildScanExportBuffer(
  scan: NonNullable<Awaited<ReturnType<typeof getScanForUser>>>,
): Buffer {
  const rows = scan.members.map((m: (typeof scan.members)[number]) => ({
    uid: m.uid,
    displayName: m.displayName ?? '',
    zaloName: m.zaloName ?? '',
    avatar: m.avatar ?? '',
    memberType: m.memberType ?? '',
  }))
  return rowsToXlsxBuffer('members', rows, ['uid', 'displayName', 'zaloName', 'avatar', 'memberType'])
}
