import 'dotenv/config'
import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const main = async () => {
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
