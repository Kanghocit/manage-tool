import type { NextFunction, Request, Response } from 'express'

import { prisma } from '../lib/prisma'

/** Ensures JWT userId still exists in DB (avoids FK 500 after DB reset / stale session). */
export async function requireExistingUser(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.userId) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Unauthorized.' })
  }

  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { id: true, status: true },
  })

  if (!user) {
    return res.status(401).json({
      success: false,
      code: 'USER_NOT_FOUND',
      message: 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.',
    })
  }

  if (user.status === 'blocked') {
    return res.status(403).json({
      success: false,
      code: 'USER_BLOCKED',
      message: 'Tài khoản đã bị khoá.',
    })
  }

  return next()
}
