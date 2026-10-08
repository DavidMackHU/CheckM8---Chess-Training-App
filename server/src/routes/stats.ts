import { Router } from 'express'
import { prisma } from '../db.js'
import { visibleTo } from '../lib/access.js'
import { requireAuth } from '../middleware/auth.js'
import { MASTERED_STABILITY_DAYS } from '../srs/scheduler.js'
import { currentStreak, dayKey, lastDays } from '../srs/activity.js'

export const statsRouter = Router()
statsRouter.use(requireAuth)

const HEATMAP_DAYS = 12 * 7

type DayCount = { day: string; count: bigint }
type CourseCardStats = { courseId: string; learned: bigint; mastered: bigint; due: bigint }

// GET /api/stats/me  -> everything the dashboard shows
statsRouter.get('/me', async (req, res) => {
  const userId = req.userId!
  const now = new Date()

  const [user, enrollments, cardStats, reviewDays, learnDays] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { dailyNewLimit: true, xp: true } }),
    prisma.enrollment.findMany({
      where: { userId, course: visibleTo(userId) },
      orderBy: { createdAt: 'asc' },
      select: { course: { select: { id: true, slug: true, title: true, side: true, _count: { select: { lines: true } } } } },
    }),
    prisma.$queryRaw<CourseCardStats[]>`
      SELECT l."courseId",
             count(*) AS learned,
             count(*) FILTER (WHERE c.stability >= ${MASTERED_STABILITY_DAYS}) AS mastered,
             count(*) FILTER (WHERE c.due <= ${now}) AS due
      FROM "Card" c JOIN "Line" l ON l.id = c."lineId"
      WHERE c."userId" = ${userId}
      GROUP BY l."courseId"`,
    // Activity per UTC day (timestamps are stored in UTC). Rating 0 rows mark learned
    // lines; those are counted from the cards instead. All dates ever, so the
    // streak is not cut off at the heatmap's edge.
    prisma.$queryRaw<DayCount[]>`
      SELECT to_char("reviewedAt", 'YYYY-MM-DD') AS day, count(*) AS count
      FROM "ReviewLog" WHERE "userId" = ${userId} AND rating > 0 GROUP BY 1`,
    prisma.$queryRaw<DayCount[]>`
      SELECT to_char("createdAt", 'YYYY-MM-DD') AS day, count(*) AS count
      FROM "Card" WHERE "userId" = ${userId} GROUP BY 1`,
  ])

  // A day's activity is its reviews plus the new lines learned that day.
  const activity = new Map<string, { reviews: number; learned: number }>()
  const bump = (rows: DayCount[], field: 'reviews' | 'learned') => {
    for (const row of rows) {
      const key = row.day
      const entry = activity.get(key) ?? { reviews: 0, learned: 0 }
      entry[field] += Number(row.count)
      activity.set(key, entry)
    }
  }
  bump(reviewDays, 'reviews')
  bump(learnDays, 'learned')

  const statsByCourse = new Map(cardStats.map((s) => [s.courseId, s]))
  const courses = enrollments.map(({ course }) => {
    const s = statsByCourse.get(course.id)
    const total = course._count.lines
    const learned = Number(s?.learned ?? 0)
    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      side: course.side,
      total,
      learned,
      mastered: Number(s?.mastered ?? 0),
      due: Number(s?.due ?? 0),
      new: Math.max(0, total - learned),
    }
  })

  const sum = (field: 'total' | 'learned' | 'mastered' | 'due' | 'new') => courses.reduce((n, c) => n + c[field], 0)
  const total = sum('total')
  const today = activity.get(dayKey(now))
  const dailyNewLimit = user?.dailyNewLimit ?? 5
  const newLeftToday = Math.max(0, dailyNewLimit - (today?.learned ?? 0))

  res.json({
    due: sum('due'),
    newAvailable: sum('new'),
    newLeftToday: Math.min(newLeftToday, sum('new')),
    dailyNewLimit,
    learned: sum('learned'),
    mastered: sum('mastered'),
    totalLines: total,
    masteredPercent: total > 0 ? Math.round((sum('mastered') / total) * 100) : 0,
    streak: currentStreak(new Set(activity.keys()), now),
    xp: user?.xp ?? 0,
    heatmap: lastDays(HEATMAP_DAYS, now).map((date) => ({
      date,
      reviews: activity.get(date)?.reviews ?? 0,
      learned: activity.get(date)?.learned ?? 0,
    })),
    courses,
  })
})
