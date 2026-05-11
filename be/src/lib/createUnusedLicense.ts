import type { Prisma } from '@prisma/client'

import { prisma } from './prisma'
import { generateLicenseKey, licenseKeyHash, licenseKeyPreview } from '../utils/licenseKey'

type DbClient = Prisma.TransactionClient | typeof prisma

type CreateUnusedLicenseInput = {
  durationDays: number | null
  notes?: string | null
  createdById?: string | null
  maxDevices?: number
}

/**
 * Creates a single unused license with a unique key hash (same algorithm as admin bulk create).
 */
export async function createUnusedLicense(db: DbClient, input: CreateUnusedLicenseInput) {
  const maxDevices = input.maxDevices ?? 1
  let plain = generateLicenseKey()
  let hash = licenseKeyHash(plain)
  let tries = 0
  while (tries < 20) {
    const exists = await db.license.findUnique({ where: { licenseKeyHash: hash } })
    if (!exists) break
    plain = generateLicenseKey()
    hash = licenseKeyHash(plain)
    tries += 1
  }
  if (tries >= 20) {
    throw new Error('Could not generate unique license key')
  }

  const license = await db.license.create({
    data: {
      licenseKeyHash: hash,
      licenseKeyPlain: plain,
      licenseKeyPreview: licenseKeyPreview(plain),
      status: 'unused',
      durationDays: input.durationDays ?? null,
      maxDevices,
      notes: input.notes ?? null,
      createdById: input.createdById ?? null,
    },
  })

  return license
}
