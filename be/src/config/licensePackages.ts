import { z } from 'zod'

export const PACKAGE_CODES = [
  'PKG_1D',
  'PKG_3M',
  'PKG_6M',
  'PKG_12M',
  'PKG_24M',
] as const
export type PackageCode = (typeof PACKAGE_CODES)[number]

export const packageCodeSchema = z.enum(PACKAGE_CODES)

/** Default seed values — runtime prices come from DB via licensePackageService. */
export const DEFAULT_PACKAGE_SEED = [
  { code: 'PKG_1D', durationDays: 1, baseAmountVnd: 25_000, labelKey: 'PKG_1D', sortOrder: 1 },
  { code: 'PKG_3M', durationDays: 90, baseAmountVnd: 1_500_000, labelKey: 'PKG_3M', sortOrder: 2 },
  { code: 'PKG_6M', durationDays: 180, baseAmountVnd: 2_400_000, labelKey: 'PKG_6M', sortOrder: 3 },
  { code: 'PKG_12M', durationDays: 365, baseAmountVnd: 4_000_000, labelKey: 'PKG_12M', sortOrder: 4 },
  { code: 'PKG_24M', durationDays: 730, baseAmountVnd: 6_000_000, labelKey: 'PKG_24M', sortOrder: 5 },
] as const
