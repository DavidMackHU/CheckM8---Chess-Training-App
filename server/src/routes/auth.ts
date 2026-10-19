import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { prisma } from '../db.js'
import type { User } from '../generated/prisma/client.js'
import { AUTH_COOKIE, cookieOptions, signToken } from '../lib/jwt.js'
import { parseLogin } from '../lib/validation.js'
import { requireAuth } from '../middleware/auth.js'

export const authRouter = Router()

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Raised by the end-to-end tests, which sign in many times in a short time.
  limit: Number(process.env.AUTH_RATE_LIMIT) || 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
})

export function publicUser(user: User) {
  const { id, email, username, xp, streak, dailyNewLimit, createdAt } = user
  return { id, email, username, xp, streak, dailyNewLimit, createdAt }
}

/**
 * Password login for accounts made before Firebase. The sign-in page only calls
 * it when Firebase does not know the email, and then moves the account onto
 * Firebase (see routes/firebase.ts). Accounts already moved have no password here.
 */
authRouter.post('/login', limiter, async (req, res) => {
  const parsed = parseLogin(req.body)
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error })
    return
  }
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  // Google-only accounts have no password, so they can never match here.
  const valid = user?.passwordHash ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false
  if (!user || !valid) {
    res.status(401).json({ error: 'Wrong email or password.' })
    return
  }
  res.cookie(AUTH_COOKIE, signToken(user.id), cookieOptions())
  res.json({ user: publicUser(user) })
})

authRouter.post('/logout', (_req, res) => {
  const { maxAge: _maxAge, ...options } = cookieOptions()
  res.clearCookie(AUTH_COOKIE, options)
  res.status(204).end()
})

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!user) {
    res.status(401).json({ error: 'Not signed in.' })
    return
  }
  res.json({ user: publicUser(user) })
})
