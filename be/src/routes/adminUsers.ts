import express from 'express'
import { z } from 'zod'
import type { Prisma, RoleName, UserStatus } from '@prisma/client'

import { prisma } from '../lib/prisma'
import { requireAuth, requireRole } from '../middleware/auth'

const admin = [requireAuth, requireRole('admin')]

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'blocked']).optional(),
  role: z.enum(['admin', 'user']).optional(),
  keyword: z.string().max(100).optional(),
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

export const adminUsersRouter = express.Router()
adminUsersRouter.use(...admin)

adminUsersRouter.get('/', async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: 'INVALID_PAYLOAD', message: 'Invalid list query.' })
    }

    const { page, limit, status, role, keyword } = parsed.data
    const where: Prisma.UserWhereInput = {}

    if (status) where.status = status
    if (role) where.role = role
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
        },
      }),
      prisma.user.count({ where }),
    ])

    return res.json({
      success: true,
      items: rows,
      total,
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
