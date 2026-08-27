import express from 'express'
import { z } from 'zod'

import { prisma } from '../lib/prisma'
import {
  auditPackageChange,
  invalidateLicensePackageCache,
  listAllPackagesAdmin,
  promotionOverlaps,
  resolvePackagePrice,
} from '../lib/licensePackageService'
import { requireAuth, requireRole } from '../middleware/auth'

const admin = [requireAuth, requireRole('admin')]

const packageCodeParamSchema = z.string().regex(/^[A-Z0-9_]{2,32}$/)

const createPackageSchema = z.object({
  code: packageCodeParamSchema,
  durationDays: z.number().int().min(1),
  baseAmountVnd: z.number().int().min(1),
  labelKey: z.string().min(1).max(100),
  sortOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
})

const patchPackageSchema = z.object({
  durationDays: z.number().int().min(1).optional(),
  baseAmountVnd: z.number().int().min(1).optional(),
  labelKey: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

const promotionBodySchema = z.object({
  promoAmountVnd: z.number().int().min(1),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  label: z.string().max(200).optional(),
  isEnabled: z.boolean().optional(),
})

export const adminLicensePackagesRouter = express.Router()
adminLicensePackagesRouter.use(...admin)

adminLicensePackagesRouter.get('/', async (_req, res, next) => {
  try {
    const packages = await listAllPackagesAdmin()
    const now = new Date()
    const items = packages.map((pkg) => ({
      id: pkg.id,
      code: pkg.code,
      durationDays: pkg.durationDays,
      baseAmountVnd: pkg.baseAmountVnd,
      labelKey: pkg.labelKey,
      sortOrder: pkg.sortOrder,
      isActive: pkg.isActive,
      currentPrice: resolvePackagePrice(pkg, now),
      promotions: pkg.promotions.map((p) => ({
        id: p.id,
        promoAmountVnd: p.promoAmountVnd,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        label: p.label,
        isEnabled: p.isEnabled,
        createdAt: p.createdAt,
      })),
    }))
    return res.json({ success: true, items })
  } catch (err) {
    next(err)
  }
})

adminLicensePackagesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = createPackageSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: 'INVALID_PAYLOAD', message: 'Invalid payload.' })
    }

    const existing = await prisma.licensePackage.findUnique({ where: { code: parsed.data.code } })
    if (existing) {
      return res.status(409).json({ success: false, code: 'CODE_EXISTS', message: 'Package code already exists.' })
    }

    const created = await prisma.licensePackage.create({ data: parsed.data })

    invalidateLicensePackageCache()
    await auditPackageChange(req.auth!.userId, 'admin.license_package.create', created.id, {
      code: created.code,
      durationDays: created.durationDays,
      baseAmountVnd: created.baseAmountVnd,
      labelKey: created.labelKey,
      sortOrder: created.sortOrder,
      isActive: created.isActive,
    })

    return res.status(201).json({ success: true, package: created })
  } catch (err) {
    next(err)
  }
})

adminLicensePackagesRouter.patch('/:code', async (req, res, next) => {
  try {
    const code = req.params.code
    const parsed = patchPackageSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: 'INVALID_PAYLOAD', message: 'Invalid payload.' })
    }
    if (Object.keys(parsed.data).length === 0) {
      return res.status(400).json({ success: false, code: 'INVALID_PAYLOAD', message: 'Nothing to update.' })
    }

    const existing = await prisma.licensePackage.findUnique({ where: { code } })
    if (!existing) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Package not found.' })
    }

    const updated = await prisma.licensePackage.update({
      where: { code },
      data: parsed.data,
    })

    invalidateLicensePackageCache()

    let auditAction = 'admin.license_package.update'
    if (parsed.data.isActive === false && existing.isActive) {
      auditAction = 'admin.license_package.deactivate'
    } else if (parsed.data.isActive === true && !existing.isActive) {
      auditAction = 'admin.license_package.activate'
    }

    await auditPackageChange(req.auth!.userId, auditAction, updated.id, {
      code,
      ...parsed.data,
    })

    return res.json({ success: true, package: updated })
  } catch (err) {
    next(err)
  }
})

adminLicensePackagesRouter.post('/:code/promotions', async (req, res, next) => {
  try {
    const code = req.params.code
    const parsed = promotionBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: 'INVALID_PAYLOAD', message: 'Invalid payload.' })
    }
    const { promoAmountVnd, startsAt, endsAt, label } = parsed.data
    if (endsAt <= startsAt) {
      return res.status(400).json({ success: false, code: 'INVALID_DATES', message: 'endsAt must be after startsAt.' })
    }

    const pkg = await prisma.licensePackage.findUnique({
      where: { code },
      include: { promotions: true },
    })
    if (!pkg) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Package not found.' })
    }

    if (promotionOverlaps(pkg.promotions, startsAt, endsAt)) {
      return res.status(400).json({
        success: false,
        code: 'PROMOTION_OVERLAP',
        message: 'Another enabled promotion overlaps this date range.',
      })
    }

    const promotion = await prisma.licensePackagePromotion.create({
      data: {
        packageId: pkg.id,
        promoAmountVnd,
        startsAt,
        endsAt,
        label: label ?? null,
        createdById: req.auth!.userId,
      },
    })

    invalidateLicensePackageCache()
    await auditPackageChange(req.auth!.userId, 'admin.license_package.promotion.create', promotion.id, {
      packageCode: code,
      promoAmountVnd,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      label,
    })

    return res.status(201).json({ success: true, promotion })
  } catch (err) {
    next(err)
  }
})

adminLicensePackagesRouter.patch('/:code/promotions/:id', async (req, res, next) => {
  try {
    const { code, id } = req.params
    const parsed = promotionBodySchema.partial().safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: 'INVALID_PAYLOAD', message: 'Invalid payload.' })
    }

    const pkg = await prisma.licensePackage.findUnique({
      where: { code },
      include: { promotions: true },
    })
    if (!pkg) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Package not found.' })
    }

    const existing = pkg.promotions.find((p) => p.id === id)
    if (!existing) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Promotion not found.' })
    }

    const startsAt = parsed.data.startsAt ?? existing.startsAt
    const endsAt = parsed.data.endsAt ?? existing.endsAt
    const isEnabled = parsed.data.isEnabled ?? existing.isEnabled

    if (endsAt <= startsAt) {
      return res.status(400).json({ success: false, code: 'INVALID_DATES', message: 'endsAt must be after startsAt.' })
    }

    if (isEnabled && promotionOverlaps(pkg.promotions, startsAt, endsAt, id)) {
      return res.status(400).json({
        success: false,
        code: 'PROMOTION_OVERLAP',
        message: 'Another enabled promotion overlaps this date range.',
      })
    }

    const promotion = await prisma.licensePackagePromotion.update({
      where: { id },
      data: {
        promoAmountVnd: parsed.data.promoAmountVnd,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
        label: parsed.data.label,
        isEnabled: parsed.data.isEnabled,
      },
    })

    invalidateLicensePackageCache()
    await auditPackageChange(req.auth!.userId, 'admin.license_package.promotion.update', promotion.id, {
      packageCode: code,
      promoAmountVnd: parsed.data.promoAmountVnd,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      label: parsed.data.label,
      isEnabled: parsed.data.isEnabled,
    })

    return res.json({ success: true, promotion })
  } catch (err) {
    next(err)
  }
})

adminLicensePackagesRouter.delete('/:code/promotions/:id', async (req, res, next) => {
  try {
    const { code, id } = req.params

    const pkg = await prisma.licensePackage.findUnique({
      where: { code },
      include: { promotions: { where: { id } } },
    })
    if (!pkg || pkg.promotions.length === 0) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Promotion not found.' })
    }

    await prisma.licensePackagePromotion.delete({ where: { id } })
    invalidateLicensePackageCache()
    await auditPackageChange(req.auth!.userId, 'admin.license_package.promotion.delete', id, {
      packageCode: code,
    })

    return res.json({ success: true })
  } catch (err) {
    next(err)
  }
})
