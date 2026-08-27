import bcrypt from 'bcrypt'
import express from 'express'
import { z } from 'zod'
import type { Prisma, RoleName, UserStatus } from '@prisma/client'

import { prisma } from '../lib/prisma'
import { requireAuth, requireRole } from '../middleware/auth'
import { createUnusedLicense } from '../lib/createUnusedLicense'
import { sendWelcomeTrialEmail, SmtpNotConfiguredError } from '../lib/email'
import { cellNumber, cellString, rowsToXlsxBuffer, sendXlsxDownload, xlsxBufferToRows } from '../lib/excel'
import { excelUpload } from '../middleware/upload'

const admin = [requireAuth, requireRole('admin')]

const MAX_IMPORT_ROWS = 500
const MAX_EXPORT_ROWS = 10_000

const USER_EXPORT_HEADERS = [
  'email',
  'fullName',
  'role',
  'status',
  'registrationSource',
  'createdByAdminEmail',
  'welcomeEmailSentAt',
  'registeredDeviceId',
  'createdAt',
] as const

const USER_IMPORT_HEADERS = ['email', 'fullName', 'password', 'role', 'registrationSource'] as const

const LICENSE_EXPORT_HEADERS = [
  'licenseKey',
  'licenseKeyPreview',
  'status',
  'durationDays',
  'maxDevices',
  'expiresAt',
  'activatedByEmail',
  'activatedAt',
  'notes',
  'createdAt',
] as const

const LICENSE_IMPORT_HEADERS = ['durationDays', 'maxDevices', 'notes', 'licenseKey'] as const

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

const changeRegistrationSourceSchema = z.object({
  registrationSource: z.enum(['self', 'admin']),
})

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
  createdByAdmin: { id: string; fullName: string; email: string } | null
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
    createdByAdmin: user.createdByAdmin
      ? {
          id: user.createdByAdmin.id,
          fullName: user.createdByAdmin.fullName,
          email: user.createdByAdmin.email,
        }
      : null,
  }
}

export const adminUsersRouter = express.Router()
adminUsersRouter.use(...admin)

adminUsersRouter.get('/export/template', (_req, res) => {
  const buffer = rowsToXlsxBuffer(
    'Users',
    [
      {
        email: 'user@example.com',
        fullName: 'Nguyen Van A',
        password: 'Password@123',
        role: 'user',
        registrationSource: 'admin',
      },
    ],
    [...USER_IMPORT_HEADERS],
  )
  sendXlsxDownload(res, 'users-import-template.xlsx', buffer)
})

adminUsersRouter.get('/export', async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: 'INVALID_PAYLOAD', message: 'Invalid export query.' })
    }

    const { status, role, keyword, registrationSource, welcomeEmailPending } = parsed.data
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

    const rows = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
      select: {
        email: true,
        fullName: true,
        role: true,
        status: true,
        registrationSource: true,
        welcomeEmailSentAt: true,
        registeredDeviceId: true,
        createdAt: true,
        createdByAdmin: { select: { email: true } },
      },
    })

    const data = rows.map((u) => ({
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      status: u.status,
      registrationSource: u.registrationSource,
      createdByAdminEmail: u.createdByAdmin?.email ?? '',
      welcomeEmailSentAt: u.welcomeEmailSentAt?.toISOString() ?? '',
      registeredDeviceId: u.registeredDeviceId ?? '',
      createdAt: u.createdAt.toISOString(),
    }))

    const buffer = rowsToXlsxBuffer('Users', data, [...USER_EXPORT_HEADERS])
    sendXlsxDownload(res, `users-${new Date().toISOString().slice(0, 10)}.xlsx`, buffer)
  } catch (err) {
    next(err)
  }
})

adminUsersRouter.post('/import', excelUpload.single('file'), async (req, res, next) => {
  try {
    const actorId = req.auth!.userId
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, code: 'NO_FILE', message: 'Excel file is required.' })
    }

    const rawRows = xlsxBufferToRows(req.file.buffer)
    if (rawRows.length === 0) {
      return res.status(400).json({ success: false, code: 'EMPTY_FILE', message: 'Excel file has no data rows.' })
    }
    if (rawRows.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({
        success: false,
        code: 'TOO_MANY_ROWS',
        message: `Maximum ${MAX_IMPORT_ROWS} rows per import.`,
      })
    }

    const created: string[] = []
    const skipped: { row: number; email: string; reason: string }[] = []

    for (let i = 0; i < rawRows.length; i += 1) {
      const rowNum = i + 2
      const row = rawRows[i]
      const email = cellString(row, 'email').toLowerCase()
      const fullName = cellString(row, 'fullName')
      const password = cellString(row, 'password')
      const roleRaw = cellString(row, 'role').toLowerCase()
      const sourceRaw = cellString(row, 'registrationSource').toLowerCase()

      if (!email || !fullName || !password) {
        skipped.push({ row: rowNum, email: email || `row-${rowNum}`, reason: 'Missing email, fullName, or password.' })
        continue
      }
      if (password.length < 6) {
        skipped.push({ row: rowNum, email, reason: 'Password must be at least 6 characters.' })
        continue
      }

      const role: RoleName = roleRaw === 'admin' ? 'admin' : 'user'
      const registrationSource: 'self' | 'admin' =
        sourceRaw === 'self' ? 'self' : 'admin'

      const exists = await prisma.user.findUnique({ where: { email } })
      if (exists) {
        skipped.push({ row: rowNum, email, reason: 'Email already exists.' })
        continue
      }

      const passwordHash = await bcrypt.hash(password, 10)
      const user = await prisma.user.create({
        data: {
          email,
          fullName,
          passwordHash,
          role,
          status: 'active',
          registrationSource,
          createdByAdminId: registrationSource === 'admin' ? actorId : null,
        },
        select: { id: true, email: true },
      })
      created.push(user.email)
    }

    await audit(actorId, 'admin.user.import', 'user', 'bulk', {
      created: created.length,
      skipped: skipped.length,
    })

    return res.json({
      success: true,
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
    })
  } catch (err) {
    next(err)
  }
})

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
          createdByAdmin: {
            select: { id: true, fullName: true, email: true },
          },
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

    let licenseKey = user.welcomeTrialLicense?.licenseKeyPlain ?? null
    let trialLicenseCreated = false

    if (!licenseKey || user.welcomeTrialLicense?.deletedAt) {
      const trialLicense = await prisma.$transaction(async (tx) => {
        const created = await createUnusedLicense(tx, {
          durationDays: 1,
          maxDevices: 1,
          notes: 'Welcome trial',
          createdById: actorId,
        })
        await tx.user.update({
          where: { id },
          data: { welcomeTrialLicenseId: created.id },
        })
        return created
      })
      licenseKey = trialLicense.licenseKeyPlain
      trialLicenseCreated = true
    }

    if (!licenseKey) {
      return res.status(500).json({
        success: false,
        code: 'NO_TRIAL_LICENSE',
        message: 'Could not resolve welcome trial license key.',
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
      trialLicenseCreated,
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

adminUsersRouter.patch('/:id/registration-source', async (req, res, next) => {
  try {
    const { id } = req.params
    const actorId = req.auth!.userId
    const parsed = changeRegistrationSourceSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: 'INVALID_PAYLOAD', message: 'Invalid payload.' })
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, registrationSource: true, createdByAdminId: true },
    })
    if (!user) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'User not found.' })
    }

    const nextSource = parsed.data.registrationSource
    if (user.registrationSource === nextSource) {
      return res.json({
        success: true,
        registrationSource: nextSource,
        message: 'Registration source unchanged.',
      })
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        registrationSource: nextSource,
        createdByAdminId: nextSource === 'admin' ? actorId : null,
      },
      select: {
        id: true,
        registrationSource: true,
        createdByAdmin: { select: { id: true, fullName: true, email: true } },
      },
    })

    await audit(actorId, 'admin.user.change_registration_source', 'user', id, {
      previousSource: user.registrationSource,
      newSource: nextSource,
      previousCreatedByAdminId: user.createdByAdminId,
      newCreatedByAdminId: updated.registrationSource === 'admin' ? actorId : null,
    })

    return res.json({
      success: true,
      registrationSource: updated.registrationSource,
      createdByAdmin: updated.createdByAdmin,
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
