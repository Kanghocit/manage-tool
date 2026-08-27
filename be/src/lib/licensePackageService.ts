import type { LicensePackage, LicensePackagePromotion, Prisma } from '@prisma/client'

import { prisma } from './prisma'

export type PackageWithPromotions = LicensePackage & {
  promotions: LicensePackagePromotion[]
}

export type ResolvedPackagePrice = {
  amountVnd: number
  originalAmountVnd: number
  promotion: {
    id: string
    promoAmountVnd: number
    label: string | null
    startsAt: Date
    endsAt: Date
  } | null
}

type CacheEntry = {
  expiresAt: number
  packages: PackageWithPromotions[]
}

let cache: CacheEntry | null = null
const CACHE_TTL_MS = 30_000

export function invalidateLicensePackageCache(): void {
  cache = null
}

async function loadPackages(includeInactive = false): Promise<PackageWithPromotions[]> {
  const now = Date.now()
  if (cache && cache.expiresAt > now && !includeInactive) {
    return cache.packages
  }

  const packages = await prisma.licensePackage.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      promotions: {
        where: { isEnabled: true },
        orderBy: { startsAt: 'desc' },
      },
    },
  })

  if (!includeInactive) {
    cache = { packages, expiresAt: now + CACHE_TTL_MS }
  }

  return packages
}

export function resolvePackagePrice(
  pkg: PackageWithPromotions,
  now = new Date(),
): ResolvedPackagePrice {
  const activePromo = pkg.promotions.find(
    (p) => p.isEnabled && p.startsAt <= now && p.endsAt >= now,
  )

  if (activePromo) {
    return {
      amountVnd: activePromo.promoAmountVnd,
      originalAmountVnd: pkg.baseAmountVnd,
      promotion: {
        id: activePromo.id,
        promoAmountVnd: activePromo.promoAmountVnd,
        label: activePromo.label,
        startsAt: activePromo.startsAt,
        endsAt: activePromo.endsAt,
      },
    }
  }

  return {
    amountVnd: pkg.baseAmountVnd,
    originalAmountVnd: pkg.baseAmountVnd,
    promotion: null,
  }
}

export async function listActivePackagesResolved(now = new Date()) {
  const packages = await loadPackages(false)
  return packages.map((pkg) => ({
    code: pkg.code,
    durationDays: pkg.durationDays,
    labelKey: pkg.labelKey,
    baseAmountVnd: pkg.baseAmountVnd,
    ...resolvePackagePrice(pkg, now),
  }))
}

export async function listAllPackagesAdmin() {
  return prisma.licensePackage.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      promotions: { orderBy: { startsAt: 'desc' } },
    },
  })
}

export async function getPackageByCode(
  code: string,
  options?: { includeInactive?: boolean },
): Promise<PackageWithPromotions | null> {
  const includeInactive = options?.includeInactive ?? false
  const packages = await loadPackages(includeInactive)
  const found = packages.find((p) => p.code === code)
  if (found) return found

  if (!includeInactive) {
    return prisma.licensePackage.findUnique({
      where: { code },
      include: {
        promotions: {
          where: { isEnabled: true },
          orderBy: { startsAt: 'desc' },
        },
      },
    })
  }

  return prisma.licensePackage.findUnique({
    where: { code },
    include: { promotions: { orderBy: { startsAt: 'desc' } } },
  })
}

export async function getResolvedPackageByCode(code: string, now = new Date()) {
  const pkg = await getPackageByCode(code)
  if (!pkg) return null
  return {
    package: pkg,
    price: resolvePackagePrice(pkg, now),
  }
}

export function promotionOverlaps(
  promotions: Pick<LicensePackagePromotion, 'id' | 'startsAt' | 'endsAt' | 'isEnabled'>[],
  startsAt: Date,
  endsAt: Date,
  excludeId?: string,
): boolean {
  return promotions.some((p) => {
    if (!p.isEnabled) return false
    if (excludeId && p.id === excludeId) return false
    return p.startsAt < endsAt && p.endsAt > startsAt
  })
}

export async function auditPackageChange(
  actorUserId: string,
  action: string,
  targetId: string,
  metadata?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      actorUserId,
      action,
      targetType: 'license_package',
      targetId,
      metadataJson:
        metadata === undefined ? undefined : (metadata as Prisma.InputJsonValue),
    },
  })
}
