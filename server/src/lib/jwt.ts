import type { CookieOptions } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../env.js'

export const AUTH_COOKIE = 'od_session'
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: '7d' })
}

/** Returns the user id, or null if the token is missing, invalid or expired. */
export function verifyToken(token: string | undefined): string | null {
  if (!token) return null
  try {
    const payload = jwt.verify(token, env.jwtSecret)
    return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

export function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    path: '/',
    maxAge: SEVEN_DAYS_MS,
  }
}
