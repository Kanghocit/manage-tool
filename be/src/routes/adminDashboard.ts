import express from 'express'

import { prisma } from '../lib/prisma'
import { requireAuth, requireRole } from '../middleware/auth'

export const adminDashboardRouter = express.Router()

adminDashboardRouter.get('/', requireAuth, requireRole('admin'), async (_req, res, next) => {
  try {
    const [
      usersTotal,
      usersActive,
      usersBlocked,
      licensesTotal,
      licensesUnused,
      licensesActive,
      licensesExpired,
      licensesBlocked,
      licensesDeleted,
      activationsActive,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'active' } }),
      prisma.user.count({ where: { status: 'blocked' } }),
      prisma.license.count({ where: { deletedAt: null } }),
      prisma.license.count({ where: { status: 'unused', deletedAt: null } }),
      prisma.license.count({ where: { status: 'active', deletedAt: null } }),
      prisma.license.count({ where: { status: 'expired', deletedAt: null } }),
      prisma.license.count({ where: { status: 'blocked', deletedAt: null } }),
      prisma.license.count({ where: { deletedAt: { not: null } } }),
      prisma.licenseActivation.count({ where: { revokedAt: null } }),
    ])

    return res.json({
      success: true,
      stats: {
        users: { total: usersTotal, active: usersActive, blocked: usersBlocked },
        licenses: {
          total: licensesTotal,
          unused: licensesUnused,
          active: licensesActive,
          expired: licensesExpired,
          blocked: licensesBlocked,
          deleted: licensesDeleted,
        },
        activationsActive,
      },
    })
  } catch (err) {
    next(err)
  }
})
