import express from 'express'

import { prisma } from '../lib/prisma'
import { requireAuth, requireRole } from '../middleware/auth'

export const adminDashboardRouter = express.Router()

adminDashboardRouter.get('/', requireAuth, requireRole('admin'), async (_req, res, next) => {
  try {
    const [
      usersTotal,
      usersActive,
      licensesTotal,
      licensesUnused,
      licensesActive,
      licensesExpired,
      licensesBlocked,
      activationsActive,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'active' } }),
      prisma.license.count(),
      prisma.license.count({ where: { status: 'unused' } }),
      prisma.license.count({ where: { status: 'active' } }),
      prisma.license.count({ where: { status: 'expired' } }),
      prisma.license.count({ where: { status: 'blocked' } }),
      prisma.licenseActivation.count({ where: { revokedAt: null } }),
    ])

    return res.json({
      success: true,
      stats: {
        users: { total: usersTotal, active: usersActive },
        licenses: {
          total: licensesTotal,
          unused: licensesUnused,
          active: licensesActive,
          expired: licensesExpired,
          blocked: licensesBlocked,
        },
        activationsActive,
      },
    })
  } catch (err) {
    next(err)
  }
})
