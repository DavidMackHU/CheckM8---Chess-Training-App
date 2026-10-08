import { validateFen } from 'chess.js'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { ExplorerUnavailable, fetchHumanStats, type HumanStats, isRatingBucket } from '../lib/lichess.js'
import { requireAuth } from '../middleware/auth.js'

export const explorerRouter = Router()

/** Opening statistics change slowly, so cached answers are good for a month. */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

// Signed-in users only, and not too fast: every cache miss spends our shared Lichess allowance.
const limiter = rateLimit({
  windowMs: 60_000,
  limit: 90,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.userId ?? 'anonymous',
  message: { error: 'Too many lookups. Slow down a little.' },
})

// GET /api/explorer?fen=&ratings=beginner|club|strong|expert
// -> how often humans play each move from this position. Cached in the database.
explorerRouter.get('/', requireAuth, limiter, async (req, res) => {
  const fen = typeof req.query.fen === 'string' ? req.query.fen.trim() : ''
  const bucket = req.query.ratings ?? 'club'
  if (!fen || !validateFen(fen).ok || !isRatingBucket(bucket)) {
    res.status(400).json({ error: 'A valid fen and ratings (beginner, club, strong or expert) are required.' })
    return
  }

  // The move counters do not change which moves are played, so leave them out of the cache key.
  const key = { fen: fen.split(' ').slice(0, 4).join(' '), ratingBucket: bucket }
  const cached = await prisma.explorerCache.findUnique({ where: { fen_ratingBucket: key } })
  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
    res.json({ ...(cached.json as HumanStats), cached: true })
    return
  }

  try {
    const stats = await fetchHumanStats(`${key.fen} 0 1`, bucket, env.lichessToken)
    await prisma.explorerCache.upsert({
      where: { fen_ratingBucket: key },
      create: { ...key, json: stats },
      update: { json: stats, fetchedAt: new Date() },
    })
    res.json({ ...stats, cached: false })
  } catch (err) {
    if (!(err instanceof ExplorerUnavailable)) throw err
    // A stale answer beats none.
    if (cached) {
      res.json({ ...(cached.json as HumanStats), cached: true })
      return
    }
    res.status(503).json({ error: err.message })
  }
})
