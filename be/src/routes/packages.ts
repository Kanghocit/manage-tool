import express from 'express'

import { listActivePackagesResolved } from '../lib/licensePackageService'

export const packagesRouter = express.Router()

packagesRouter.get('/', async (_req, res, next) => {
  try {
    const items = await listActivePackagesResolved()
    return res.json({ success: true, items })
  } catch (err) {
    next(err)
  }
})
