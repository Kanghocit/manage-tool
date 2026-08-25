import bcrypt from 'bcrypt'
import express from 'express'
import { z } from 'zod'
import type { Prisma, RoleName, UserStatus } from '@prisma/client'

import { prisma } from '../lib/prisma'
import { requireAuth, requireRole } from '../middleware/auth'
import { createUnusedLicense } from '../lib/createUnusedLicense'
import { sendWelcomeTrialEmail, SmtpNotConfiguredError } from '../lib/email'

const admin = [requireAuth, requireRole('admin')]

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'blocked']).optional(),
  role: z.enum(['admin', 'user']).optional(),
  keyword: z.string().max(100).optional(),
  registrationSource: z.enum(['self', 'admin']).optional(),
  welcomeEmailPending: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
})

const createUserSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.email(),
  password: z.string().min(6).max(128),
  license: z
    .object({
      enabled: z.literal(true),
      durationDays: z.number().int().positive().nullable(),
      maxDevices: z.number().int().min(1).max(50).optional(),
    })
    .optional(),
})

async function audit(
  actorUserId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      actorUserId,
      action,
      targetType,
      targetId,
      metadataJson:
        metadata === undefined ? undefined : (metadata as Prisma.InputJsonValue),
    },
  })
}

async function ensureCanBlock(actorId: string, target: { id: string; role: RoleName; status: UserStatus }) {
  if (target.id === actorId) {
    return { ok: false as const, status: 400, code: 'CANNOT_BLOCK_SELF', message: 'You cannot block your own account.' }
  }

  if (target.role === 'admin' && target.status === 'active') {
    const activeAdmins = await prisma.user.count({ where: { role: 'admin', status: 'active' } })
    if (activeAdmins <= 1) {
      return {
        ok: false as const,
        status: 400,
        code: 'CANNOT_BLOCK_LAST_ADMIN',
        message: 'Cannot block the last active admin.',
      }
    }
  }

  return { ok: true as const }
}

function mapUserRow(user: {
  id: string
  email: string
  fullName: string
  role: RoleName
  status: UserStatus
  createdAt: Date
  registeredDeviceId: string | null
  registrationSource: 'self' | 'admin'
  welcomeEmailSentAt: Date | null
  welcomeTrialLicenseId: string | null
}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    registeredDeviceId: user.registeredDeviceId,
    registrationSource: user.registrationSource,
    welcomeEmailSentAt: user.welcomeEmailSentAt,
    hasWelcomeTrialLicense: Boolean(user.welcomeTrialLicenseId),
  }
}

export const adminUsersRouter = express.Router()
adminUsersRouter.use(...admin)

adminUsersRouter.get('/', async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: 'INVALID_PAYLOAD', message: 'Invalid list query.' })
    }

    const { page, limit, status, role, keyword, registrationSource, welcomeEmailPending } = parsed.data
    const where: Prisma.UserWhereInput = {}

    if (status) where.status = status
    if (role) where.role = role
    if (registrationSource) where.registrationSource = registrationSource
    if (welcomeEmailPending) {
      where.registrationSource = 'self'
      where.welcomeEmailSentAt = null
    }

    const kw = keyword?.trim()
    if (kw) {
      where.OR = [
        { email: { contains: kw, mode: 'insensitive' } },
        { fullName: { contains: kw, mode: 'insensitive' } },
      ]
    }

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          createdAt: true,
          registeredDeviceId: true,
          registrationSource: true,
          welcomeEmailSentAt: true,
          welcomeTrialLicenseId: true,
        },
      }),
      prisma.user.count({ where }),
    ])

    return res.json({
      success: true,
      items: rows.map(mapUserRow),
      total,
    })
  } catch (err) {
    next(err)
  }
})

adminUsersRouter.post('/', async (req, res, next) => {
  try {
    const parsed = createUserSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: 'INVALID_PAYLOAD', message: 'Invalid create payload.' })
    }

    const actorId = req.auth!.userId
    const { fullName, email, password, license } = parsed.data

    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) {
      return res.status(409).json({ success: false, code: 'EMAIL_EXISTS', message: 'Email already exists.' })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          fullName,
          role: 'user',
          status: 'active',
          registrationSource: 'admin',
          createdByAdminId: actorId,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          registrationSource: true,
        },
      })

      let licenseResult: { licenseKey: string; durationDays: number | null; maxDevices: number } | null = null

      if (license?.enabled) {
        const created = await createUnusedLicense(tx, {
          durationDays: license.durationDays,
          maxDevices: license.maxDevices ?? 1,
          createdById: actorId,
          notes: `Created with user ${email}`,
        })
        licenseResult = {
          licenseKey: created.licenseKeyPlain!,
          durationDays: created.durationDays,
          maxDevices: created.maxDevices,
        }
      }

      return { user, license: licenseResult }
    })

    await audit(actorId, 'admin.user.create', 'user', result.user.id, {
      email: result.user.email,
      withLicense: Boolean(result.license),
    })

    return res.status(201).json({
      success: true,
      user: result.user,
      license: result.license,
    })
  } catch (err) {
    next(err)
  }
})

adminUsersRouter.post('/:id/send-welcome-email', async (req, res, next) => {
  try {
    const { id } = req.params
    const actorId = req.auth!.userId

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        registrationSource: true,
        welcomeEmailSentAt: true,
        welcomeTrialLicense: {
          select: {
            id: true,
            licenseKeyPlain: true,
            deletedAt: true,
          },
        },
      },
    })

    if (!user) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'User not found.' })
    }

    if (user.registrationSource !== 'self') {
      return res.status(403).json({
        success: false,
        code: 'NOT_SELF_REGISTERED',
        message: 'Welcome email can only be sent to self-registered users.',
      })
    }

    if (user.welcomeEmailSentAt) {
      return res.status(400).json({
        success: false,
        code: 'ALREADY_SENT',
        message: 'Welcome email has already been sent to this user.',
      })
    }

    const licenseKey = user.welcomeTrialLicense?.licenseKeyPlain
    if (!licenseKey || user.welcomeTrialLicense?.deletedAt) {
      return res.status(400).json({
        success: false,
        code: 'NO_TRIAL_LICENSE',
        message: 'This user has no welcome trial license.',
      })
    }

    try {
      await sendWelcomeTrialEmail(user.email, user.fullName, licenseKey)
    } catch (err) {
      if (err instanceof SmtpNotConfiguredError) {
        return res.status(503).json({
          success: false,
          code: 'SMTP_NOT_CONFIGURED',
          message: 'SMTP is not configured. Set SMTP_* environment variables.',
        })
      }
      throw err
    }

    const sentAt = new Date()
    await prisma.user.update({
      where: { id },
      data: { welcomeEmailSentAt: sentAt },
    })

    await audit(actorId, 'admin.user.send_welcome_email', 'user', id, {
      email: user.email,
      sentAt: sentAt.toISOString(),
    })

    return res.json({
      success: true,
      message: 'Welcome email sent.',
      welcomeEmailSentAt: sentAt,
    })
  } catch (err) {
    next(err)
  }
})

adminUsersRouter.patch('/:id/block', async (req, res, next) => {
  try {
    const { id } = req.params
    const actorId = req.auth!.userId

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, status: true, role: true },
    })
    if (!user) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'User not found.' })
    }

    const guard = await ensureCanBlock(actorId, user)
    if (!guard.ok) {
      return res.status(guard.status).json({ success: false, code: guard.code, message: guard.message })
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { status: 'blocked' } })
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      })
    })

    await audit(actorId, 'admin.user.block', 'user', id, { previousStatus: user.status, newStatus: 'blocked' })

    return res.json({ success: true, message: 'User blocked.' })
  } catch (err) {
    next(err)
  }
})

adminUsersRouter.patch('/:id/reset-device', async (req, res, next) => {
  try {
    const { id } = req.params
    const actorId = req.auth!.userId

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, registeredDeviceId: true },
    })
    if (!user) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'User not found.' })
    }
    if (!user.registeredDeviceId) {
      return res.status(400).json({ success: false, code: 'NO_DEVICE_BOUND', message: 'This account has no registered device.' })
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { registeredDeviceId: null } })
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      })
    })

    await audit(actorId, 'admin.user.reset_device', 'user', id, {
      previousDeviceId: user.registeredDeviceId,
    })

    return res.json({ success: true, message: 'Device unbound.' })
  } catch (err) {
    next(err)
  }
})

adminUsersRouter.patch('/:id/unblock', async (req, res, next) => {
  try {
    const { id } = req.params
    const actorId = req.auth!.userId

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, status: true },
    })
    if (!user) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'User not found.' })
    }

    await prisma.user.update({ where: { id }, data: { status: 'active' } })
    await audit(actorId, 'admin.user.unblock', 'user', id, { previousStatus: user.status, newStatus: 'active' })

    return res.json({ success: true, message: 'User unblocked.' })
  } catch (err) {
    next(err)
  }
})
