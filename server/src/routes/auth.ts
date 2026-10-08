import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { prisma } from '../db.js'
import type { User } from '../generated/prisma/client.js'
import { AUTH_COOKIE, cookieOptions, signToken } from '../lib/jwt.js'
import { parseLogin, parseRegister } from '../lib/validation.js'
import { requireAuth } from '../middleware/auth.js'

export const authRouter = Router()

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Raised by the end-to-end tests, which create many accounts in a short time.
  limit: Number(process.env.AUTH_RATE_LIMIT) || 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
})

function publicUser(user: User) {
  const { id, email, username, xp, streak, dailyNewLimit, createdAt } = user
  return { id, email, username, xp, streak, dailyNewLimit, createdAt }
}

authRouter.post('/register', limiter, async (req, res) => {
  const parsed = parseRegister(req.body)
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error })
    return
  }
  const { email, username, password } = parsed.data

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username: { equals: username, mode: 'insensitive' } }] },
  })
  if (existing) {
    const field = existing.email === email ? 'email' : 'username'
    res.status(409).json({ error: `That ${field} is already taken.` })
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({ data: { email, username, passwordHash } })
  res.cookie(AUTH_COOKIE, signToken(user.id), cookieOptions())
  res.status(201).json({ user: publicUser(user) })
})

authRouter.post('/login', limiter, async (req, res) => {
  const parsed = parseLogin(req.body)
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error })
    return
  }
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  const valid = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false
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
