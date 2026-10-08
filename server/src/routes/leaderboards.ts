import { Router } from 'express'
import { prisma } from '../db.js'
import { optionalAuth } from '../middleware/auth.js'
import { liveStreak, startOfWeek } from '../srs/progress.js'

export const leaderboardsRouter = Router()

const TOP = 50

type Entry = { rank: number; username: string; xp: number; streak: number }

// GET /api/leaderboards?period=week|all  -> top players, plus the viewer's own place
leaderboardsRouter.get('/', optionalAuth, async (req, res) => {
  const period = req.query.period === 'all' ? 'all' : 'week'
  const userId = req.userId
  const now = new Date()
  let entries: Entry[] = []
  let me: { rank: number; xp: number } | null = null

  if (period === 'all') {
    const users = await prisma.user.findMany({
      where: { xp: { gt: 0 } },
      orderBy: [{ xp: 'desc' }, { createdAt: 'asc' }],
      take: TOP,
      select: { id: true, username: true, xp: true, streak: true, lastActiveDate: true },
    })
    entries = users.map((u, i) => ({
      rank: i + 1,
      username: u.username,
      xp: u.xp,
      streak: liveStreak(u.streak, u.lastActiveDate, now),
    }))
    if (userId) {
      const self = await prisma.user.findUnique({ where: { id: userId }, select: { xp: true } })
      if (self && self.xp > 0) {
        const ahead = await prisma.user.count({ where: { xp: { gt: self.xp } } })
        me = { rank: ahead + 1, xp: self.xp }
      }
    }
  } else {
    const since = startOfWeek(now)
    const totals = await prisma.reviewLog.groupBy({
      by: ['userId'],
      where: { reviewedAt: { gte: since }, xpEarned: { gt: 0 } },
      _sum: { xpEarned: true },
      orderBy: { _sum: { xpEarned: 'desc' } },
    })
    const top = totals.slice(0, TOP)
    const users = await prisma.user.findMany({
      where: { id: { in: top.map((t) => t.userId) } },
      select: { id: true, username: true, streak: true, lastActiveDate: true },
    })
    const byId = new Map(users.map((u) => [u.id, u]))
    entries = top.flatMap((t, i) => {
      const u = byId.get(t.userId)
      return u
        ? [{ rank: i + 1, username: u.username, xp: t._sum.xpEarned ?? 0, streak: liveStreak(u.streak, u.lastActiveDate, now) }]
        : []
    })
    if (userId) {
      const index = totals.findIndex((t) => t.userId === userId)
      if (index >= 0) me = { rank: index + 1, xp: totals[index]._sum.xpEarned ?? 0 }
    }
  }

  const self = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { username: true } }) : null
  res.json({ period, weekStart: startOfWeek(now), entries, me: me && self ? { ...me, username: self.username } : null })
})
