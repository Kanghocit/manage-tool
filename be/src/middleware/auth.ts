import type { NextFunction, Request, Response } from 'express'
import { getAccessToken } from '../lib/authCookies'
import { verifyAccessToken } from '../lib/jwt'

export type AuthContext = {
  userId: string
  role: 'admin' | 'user'
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = getAccessToken(req)
    if (!token) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid token.',
      })
    }

    const payload = verifyAccessToken(token)
    req.auth = { userId: payload.sub, role: payload.role }
    return next()
  } catch {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid token.',
    })
  }
}

export function requireRole(role: 'admin' | 'user') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Unauthorized.' })
    }
    if (req.auth.role !== role) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Forbidden.' })
    }
    return next()
  }
}
