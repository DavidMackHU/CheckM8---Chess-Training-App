import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { prisma } from '../db.js'
import type { User } from '../generated/prisma/client.js'
import { type FirebaseProfile, firebaseProjectId, verifyFirebaseToken } from '../lib/firebase.js'
import { AUTH_COOKIE, cookieOptions, signToken, verifyToken } from '../lib/jwt.js'
import { USERNAME_RE, usernameCandidates } from '../lib/usernames.js'
import { publicUser } from './auth.js'

export const firebaseRouter = Router()

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT) || 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
})

/** Lets the sign-in page check that the server can accept Firebase sign-ins. */
firebaseRouter.get('/providers', (_req, res) => {
  res.json({ firebase: firebaseProjectId() !== null })
})

const nameTaken = async (username: string) =>
  (await prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' } }, select: { id: true } })) !== null

/** Checked before a Firebase account is created, so sign-up does not fail half way. */
firebaseRouter.get('/username-available', limiter, async (req, res) => {
  const username = typeof req.query.username === 'string' ? req.query.username.trim() : ''
  if (!USERNAME_RE.test(username)) {
    res.status(400).json({ error: 'Username must be 3-20 letters, numbers or underscores.' })
    return
  }
  res.json({ available: !(await nameTaken(username)) })
})

type Outcome = { user: User } | { status: number; error: string }

/** Which account a verified Firebase sign-in belongs to, linking or creating one as needed. */
async function resolveUser(profile: FirebaseProfile, sessionUserId: string | null, wanted: string | null): Promise<Outcome> {
  const linked = await prisma.user.findUnique({ where: { firebaseUid: profile.uid } })
  if (linked) return { user: linked }

  const sameEmail = await prisma.user.findUnique({ where: { email: profile.email } })
  if (sameEmail) {
    // Joining an older account needs proof of owning it: a verified email, or
    // having just logged in to it with its old password (sessionUserId).
    if (sameEmail.firebaseUid) return { status: 409, error: 'That email is already used by another account.' }
    if (!profile.emailVerified && sessionUserId !== sameEmail.id) {
      return { status: 409, error: 'An account with this email already exists. Log in to it instead.' }
    }
    const user = await prisma.user.update({
      where: { id: sameEmail.id },
      // Firebase holds the password from now on.
      data: { firebaseUid: profile.uid, passwordHash: null },
    })
    return { user }
  }

  if (wanted !== null) {
    if (!USERNAME_RE.test(wanted)) return { status: 400, error: 'Username must be 3-20 letters, numbers or underscores.' }
    if (await nameTaken(wanted)) return { status: 409, error: 'That username is already taken.' }
  }
  const names = wanted !== null ? [wanted] : usernameCandidates(profile)
  for (const username of names) {
    if (wanted === null && (await nameTaken(username))) continue
    try {
      const user = await prisma.user.create({ data: { email: profile.email, username, firebaseUid: profile.uid } })
      return { user }
    } catch {
      // Lost a race for this name or email: try the next name.
    }
  }
  return { status: 409, error: 'Could not create the account. Try again.' }
}

/**
 * Trades a Firebase ID token for the app's own login cookie. The browser signs
 * in with Firebase, then calls this once; everything after uses the cookie.
 */
firebaseRouter.post('/firebase', limiter, async (req, res) => {
  const body = (req.body ?? {}) as { idToken?: unknown; username?: unknown }
  const profile = typeof body.idToken === 'string' ? await verifyFirebaseToken(body.idToken) : null
  if (!profile) {
    res.status(401).json({ error: 'Sign-in could not be verified. Try again.' })
    return
  }
  const wanted = typeof body.username === 'string' && body.username.trim() ? body.username.trim() : null
  const sessionUserId = verifyToken(req.cookies?.[AUTH_COOKIE])
  const outcome = await resolveUser(profile, sessionUserId, wanted)
  if ('error' in outcome) {
    res.status(outcome.status).json({ error: outcome.error })
    return
  }
  res.cookie(AUTH_COOKIE, signToken(outcome.user.id), cookieOptions())
  res.json({ user: publicUser(outcome.user) })
})
