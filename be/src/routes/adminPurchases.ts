import express from 'express'
import { z } from 'zod'

import { getPackageByCode } from '../lib/licensePackageService'
import { createUnusedLicense } from '../lib/createUnusedLicense'
import { prisma } from '../lib/prisma'
import { requireAuth, requireRole } from '../middleware/auth'

const admin = [requireAuth, requireRole('admin')]

export const adminPurchasesRouter = express.Router()

/** List all purchase orders (admin) */
adminPurchasesRouter.get('/', ...admin, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
    const status = typeof req.query.status === 'string' ? req.query.status : undefined

    const where = status ? { status: status as never } : {}

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, email: true, fullName: true } } },
      }),
      prisma.purchaseOrder.count({ where }),
    ])

    return res.json({ success: true, orders, total, page, limit })
  } catch (err) {
    next(err)
  }
})

/** Manually confirm a pending order as paid (admin — for local dev without webhook) */
adminPurchasesRouter.post('/:id/confirm', ...admin, async (req, res, next) => {
  try {
    const id = z.string().uuid().safeParse(req.params.id)
    if (!id.success) {
      return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'Invalid order id.' })
    }

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findFirst({
        where: { id: id.data, status: 'pending' },
      })
      if (!order) return null

      const pkg = await getPackageByCode(order.packageCode)
      const license = await createUnusedLicense(tx, {
        durationDays: pkg?.durationDays ?? null,
        maxDevices: 1,
        notes: `purchase:${order.id}:admin-confirmed`,
        createdById: req.auth!.userId,
      })

      const updated = await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status: 'paid', fulfilledLicenseId: license.id },
      })
      return updated
    })

    if (!result) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND_OR_NOT_PENDING',
        message: 'Order not found or is not pending.',
      })
    }

    return res.json({ success: true, order: result })
  } catch (err) {
    next(err)
  }
})
