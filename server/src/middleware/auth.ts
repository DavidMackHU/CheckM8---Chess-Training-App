import type { NextFunction, Request, Response } from 'express'
import { AUTH_COOKIE, verifyToken } from '../lib/jwt.js'

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string
  }
}

/** Sets req.userId when a valid session cookie is present. Never rejects. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const userId = verifyToken(req.cookies?.[AUTH_COOKIE])
  if (userId) req.userId = userId
  next()
}

/** Rejects with 401 unless a valid session cookie is present. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = verifyToken(req.cookies?.[AUTH_COOKIE])
  if (!userId) {
    res.status(401).json({ error: 'Not signed in.' })
    return
  }
  req.userId = userId
  next()
}
