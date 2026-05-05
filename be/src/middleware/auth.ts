import type { NextFunction, Request, Response } from 'express'
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
    const header = req.header('authorization') ?? req.header('Authorization')
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Missing bearer token.' })
    }

    const token = header.slice('Bearer '.length).trim()
    const payload = verifyAccessToken(token)
    req.auth = { userId: payload.sub, role: payload.role }
    return next()
  } catch {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Invalid token.' })
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

