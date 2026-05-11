import { z } from 'zod'

export const PACKAGE_CODES = ['PKG_1D', 'PKG_3M', 'PKG_6M', 'PKG_12M', 'PKG_24M'] as const
export type PackageCode = (typeof PACKAGE_CODES)[number]

export type LicensePackageDef = {
  code: PackageCode
  durationDays: number
  amountVnd: number
  labelKey: string
  /** If true, only admin users may purchase this package. */
  adminOnly?: boolean
}

/** Single source of truth for purchase packages (amount + duration). */
export const LICENSE_PACKAGES: LicensePackageDef[] = [
  { code: 'PKG_1D', durationDays: 1, amountVnd: 10_000, labelKey: 'PKG_1D', adminOnly: true },
  { code: 'PKG_3M', durationDays: 90, amountVnd: 1_500_000, labelKey: 'PKG_3M' },
  { code: 'PKG_6M', durationDays: 180, amountVnd: 2_400_000, labelKey: 'PKG_6M' },
  { code: 'PKG_12M', durationDays: 365, amountVnd: 4_000_000, labelKey: 'PKG_12M' },
  { code: 'PKG_24M', durationDays: 730, amountVnd: 6_000_000, labelKey: 'PKG_24M' },
]

const map = new Map<PackageCode, LicensePackageDef>(
  LICENSE_PACKAGES.map((p) => [p.code, p]),
)

export function getPackageByCode(code: string): LicensePackageDef | undefined {
  return map.get(code as PackageCode)
}

export const packageCodeSchema = z.enum(PACKAGE_CODES)
