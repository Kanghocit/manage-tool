import 'dotenv/config'
import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'

import { DEFAULT_PACKAGE_SEED } from '../src/config/licensePackages'

const prisma = new PrismaClient()

async function seedPackages() {
  for (const pkg of DEFAULT_PACKAGE_SEED) {
    await prisma.licensePackage.upsert({
      where: { code: pkg.code },
      create: {
        code: pkg.code,
        durationDays: pkg.durationDays,
        baseAmountVnd: pkg.baseAmountVnd,
        labelKey: pkg.labelKey,
        sortOrder: pkg.sortOrder,
        isActive: true,
      },
      update: {},
    })
  }
  console.log('[seed] license packages ensured')
}

const main = async () => {
  await seedPackages()

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com'
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123'
  const fullName = process.env.SEED_ADMIN_NAME ?? 'System Admin'

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`[seed] admin ${email} already exists, skipping`)
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const admin = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      role: 'admin',
      status: 'active',
    },
  })

  console.log(`[seed] created admin ${admin.email} (id=${admin.id})`)
  console.log(`[seed] password: ${password} (đổi ngay khi deploy production)`)
}

main()
  .catch((err) => {
    console.error('[seed] failed', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
