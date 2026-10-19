import type { NextFunction, Request, Response } from 'express'
import { AUTH_COOKIE, verifyToken } from '../lib/jwt.js'
import { isTimeZone } from '../srs/activity.js'

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string
    /** From the X-Time-Zone header the client sends. UTC if missing or unknown. */
    timeZone: string
  }
}

/** Reads the browser's time zone so days are counted the way the player sees them. */
export function timeZone(req: Request, _res: Response, next: NextFunction) {
  const zone = req.get('x-time-zone')
  req.timeZone = isTimeZone(zone) ? zone : 'UTC'
  next()
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
