import { randomBytes, timingSafeEqual } from 'node:crypto'
import { type Response, Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { prisma } from '../db.js'
import type { User } from '../generated/prisma/client.js'
import { env } from '../env.js'
import { exchangeCode, googleAuthUrl, googleConfig, type GoogleProfile, publicUrl, usernameCandidates } from '../lib/google.js'
import { AUTH_COOKIE, cookieOptions, signToken } from '../lib/jwt.js'

export const googleRouter = Router()

const STATE_COOKIE = 'od_oauth'
const TEN_MINUTES_MS = 10 * 60 * 1000
const stateCookie = { httpOnly: true, sameSite: 'lax', secure: env.cookieSecure, path: '/api/auth/google' } as const

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT) || 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
})

/** Lets the sign-in page decide whether to show the Google button. */
googleRouter.get('/providers', (_req, res) => {
  res.json({ google: googleConfig() !== null })
})

function fail(res: Response, reason: 'unavailable' | 'failed') {
  res.clearCookie(STATE_COOKIE, stateCookie)
  res.redirect(`${publicUrl()}/login?error=google_${reason}`)
}

googleRouter.get('/google', limiter, (_req, res) => {
  const config = googleConfig()
  if (!config) return fail(res, 'unavailable')
  // Sent to Google and back, and checked against this cookie, so the reply
  // can only complete a sign-in that this same browser started.
  const state = randomBytes(24).toString('base64url')
  res.cookie(STATE_COOKIE, state, { ...stateCookie, maxAge: TEN_MINUTES_MS })
  res.redirect(googleAuthUrl(config, state))
})

function sameState(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/** Finds the account for a Google profile, linking or creating one as needed. */
async function userFor(profile: GoogleProfile): Promise<User | null> {
  const linked = await prisma.user.findUnique({ where: { googleId: profile.sub } })
  if (linked) return linked

  const sameEmail = await prisma.user.findUnique({ where: { email: profile.email } })
  if (sameEmail) {
    // Google has verified this email; our own sign-up never did. Clearing the
    // password means someone who registered this address first cannot keep a way in.
    return prisma.user.update({ where: { id: sameEmail.id }, data: { googleId: profile.sub, passwordHash: null } })
  }

  for (const username of usernameCandidates(profile)) {
    const taken = await prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' } } })
    if (taken) continue
    try {
      return await prisma.user.create({ data: { email: profile.email, username, googleId: profile.sub } })
    } catch {
      // Lost a race for this name: try the next one.
    }
  }
  return null
}

googleRouter.get('/google/callback', limiter, async (req, res) => {
  const config = googleConfig()
  if (!config) return fail(res, 'unavailable')
  const { code, state } = req.query
  if (typeof code !== 'string' || !sameState(state, req.cookies[STATE_COOKIE])) return fail(res, 'failed')

  const profile = await exchangeCode(config, code)
  const user = profile ? await userFor(profile) : null
  if (!user) return fail(res, 'failed')

  res.clearCookie(STATE_COOKIE, stateCookie)
  res.cookie(AUTH_COOKIE, signToken(user.id), cookieOptions())
  res.redirect(`${config.publicUrl}/`)
})
