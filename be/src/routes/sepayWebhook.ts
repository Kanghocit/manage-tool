import express from 'express'

import { env } from '../config/env'
import { getPackageByCode } from '../config/licensePackages'
import { createUnusedLicense } from '../lib/createUnusedLicense'
import { prisma } from '../lib/prisma'

export const sepayWebhookRouter = express.Router()

type SepayPayload = {
  id?: number
  gateway?: string
  transactionDate?: string
  accountNumber?: string
  code?: string | null
  content?: string
  transferType?: string
  description?: string
  transferAmount?: number
  accumulated?: number
  referenceCode?: string
}

function verifySepayApiKey(req: express.Request): boolean {
  if (!env.sepayWebhookApiKey) return false
  const auth = (req.header('authorization') ?? req.header('Authorization') ?? '').trim()
  return auth === `Apikey ${env.sepayWebhookApiKey}`
}

function normalizeMemo(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Bank memo can differ slightly in spacing/case; SePay also sends `description`. */
function matchesOrder(
  content: string,
  description: string,
  code: string | null | undefined,
  transferContent: string,
): boolean {
  if (!transferContent) return false
  if (code && String(code).trim() === transferContent) return true
  const needle = normalizeMemo(transferContent)
  if (!needle) return false
  const hay = `${normalizeMemo(content)} ${normalizeMemo(description)}`
  if (hay.includes(needle)) return true
  // Some banks truncate or prefix the memo — try DH token substring
  const m = transferContent.match(/^(DH[A-F0-9]+)/i)
  if (m?.[1] && hay.includes(normalizeMemo(m[1]))) return true
  return false
}

sepayWebhookRouter.post('/', async (req, res) => {
  if (!verifySepayApiKey(req)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' })
  }

  const body = req.body as SepayPayload

  try {
    if (body.transferType && body.transferType !== 'in') {
      return res.status(200).json({ success: true })
    }

    const sepayId = typeof body.id === 'number' ? body.id : undefined
    if (sepayId !== undefined) {
      const already = await prisma.purchaseOrder.findFirst({
        where: { sepayTransactionId: sepayId, status: 'paid' },
      })
      if (already) {
        return res.status(200).json({ success: true })
      }
    }

    const content = String(body.content ?? '')
    const description = String(body.description ?? '')
    const code = body.code
    const transferAmount = typeof body.transferAmount === 'number' ? body.transferAmount : NaN
    if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
      return res.status(200).json({ success: true })
    }

    const candidates = await prisma.purchaseOrder.findMany({
      where: {
        status: 'pending',
        amountVnd: transferAmount,
      },
    })

    const order = candidates.find((o) => matchesOrder(content, description, code, o.transferContent))
    if (!order) {
      return res.status(200).json({ success: true })
    }

    await prisma.$transaction(async (tx) => {
      if (sepayId !== undefined) {
        const paidSame = await tx.purchaseOrder.findFirst({
          where: { sepayTransactionId: sepayId, status: 'paid' },
        })
        if (paidSame) return
      }

      const locked = await tx.purchaseOrder.findFirst({
        where: { id: order.id, status: 'pending' },
      })
      if (!locked) return

      const pkg = getPackageByCode(locked.packageCode)
      const durationDays = pkg?.durationDays ?? null

      const license = await createUnusedLicense(tx, {
        durationDays,
        maxDevices: 1,
        notes: `purchase:${locked.id}`,
        createdById: null,
      })

      await tx.purchaseOrder.update({
        where: { id: locked.id },
        data: {
          status: 'paid',
          sepayTransactionId: sepayId ?? null,
          fulfilledLicenseId: license.id,
          webhookPayload: body as object,
        },
      })
    })

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[sepay webhook]', err)
    return res.status(500).json({ success: false })
  }
})
