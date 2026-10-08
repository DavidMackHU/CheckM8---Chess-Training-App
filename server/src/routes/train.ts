import { Router } from 'express'
import { prisma } from '../db.js'
import { visibleTo } from '../lib/access.js'
import { requireAuth } from '../middleware/auth.js'
import { RATING_LEARNED, recordActivity, XP_LEARNED, XP_REVIEW } from '../srs/progress.js'
import { gradeDrill, gradeToNumber, scheduleLearned, scheduleReview } from '../srs/scheduler.js'

export const trainRouter = Router()
trainRouter.use(requireAuth)

/** Most lines served in one review session. More stay queued for the next one. */
const REVIEW_BATCH = 30

function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/** How many more new lines the user may learn today, across all courses. */
async function newLinesLeftToday(userId: string): Promise<{ left: number; learnedToday: number; limit: number }> {
  const [user, learnedToday] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { dailyNewLimit: true } }),
    prisma.card.count({ where: { userId, createdAt: { gte: startOfUtcDay() } } }),
  ])
  const limit = user?.dailyNewLimit ?? 5
  return { left: Math.max(0, limit - learnedToday), learnedToday, limit }
}

// GET /api/train/learn/:courseId  -> the next new lines for this course, up to today's allowance
trainRouter.get('/learn/:courseId', async (req, res) => {
  const userId = req.userId!
  const courseId = String(req.params.courseId)

  const course = await prisma.course.findFirst({
    where: { id: courseId, ...visibleTo(userId) },
    select: { id: true, slug: true, title: true, side: true, startFen: true },
  })
  if (!course) {
    res.status(404).json({ error: 'Course not found.' })
    return
  }
  const enrolled = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { userId: true },
  })
  if (!enrolled) {
    res.status(403).json({ error: 'Enroll in this course first.' })
    return
  }

  const allowance = await newLinesLeftToday(userId)
  const unlearned = { courseId, cards: { none: { userId } } }
  const [lines, newInCourse, totalInCourse] = await Promise.all([
    prisma.line.findMany({
      where: unlearned,
      orderBy: { order: 'asc' },
      take: allowance.left,
      select: { id: true, order: true, name: true, moves: true, comments: true, finalFen: true },
    }),
    prisma.line.count({ where: unlearned }),
    prisma.line.count({ where: { courseId } }),
  ])

  res.json({
    course,
    lines,
    newInCourse,
    totalInCourse,
    learnedToday: allowance.learnedToday,
    dailyNewLimit: allowance.limit,
  })
})

// GET /api/train/human/:courseId  -> every line of a course, for Human moves mode (nothing is graded)
trainRouter.get('/human/:courseId', async (req, res) => {
  const course = await prisma.course.findFirst({
    where: { id: String(req.params.courseId), ...visibleTo(req.userId) },
    select: {
      id: true,
      slug: true,
      title: true,
      side: true,
      startFen: true,
      lines: { orderBy: { order: 'asc' }, select: { id: true, order: true, name: true, moves: true } },
    },
  })
  if (!course) {
    res.status(404).json({ error: 'Course not found.' })
    return
  }
  const { lines, ...rest } = course
  res.json({ course: rest, lines })
})

// GET /api/train/review  -> lines due now across all courses, most overdue first
trainRouter.get('/review', async (req, res) => {
  const userId = req.userId!
  const due = { userId, due: { lte: new Date() }, line: { course: visibleTo(userId) } }
  const [cards, dueCount] = await Promise.all([
    prisma.card.findMany({
      where: due,
      orderBy: { due: 'asc' },
      take: REVIEW_BATCH,
      select: {
        due: true,
        line: {
          select: {
            id: true,
            order: true,
            name: true,
            moves: true,
            comments: true,
            finalFen: true,
            course: { select: { id: true, slug: true, title: true, side: true, startFen: true } },
          },
        },
      },
    }),
    prisma.card.count({ where: due }),
  ])

  const items = cards.map(({ due: dueAt, line: { course, ...line } }) => ({ line, course, due: dueAt }))
  res.json({ items, dueCount })
})

// POST /api/train/learned { lineId }  -> marks a line as learned by creating its review card
trainRouter.post('/learned', async (req, res) => {
  const userId = req.userId!
  const lineId = typeof req.body?.lineId === 'string' ? req.body.lineId : ''
  if (!lineId) {
    res.status(400).json({ error: 'lineId is required.' })
    return
  }

  const line = await prisma.line.findFirst({
    where: { id: lineId, course: { ...visibleTo(userId), enrollments: { some: { userId } } } },
    select: { id: true },
  })
  if (!line) {
    res.status(404).json({ error: 'Line not found in a course you are enrolled in.' })
    return
  }

  // Learning a line again changes nothing: the card keeps its history and no XP is awarded twice.
  const key = { userId, lineId }
  const select = { id: true, due: true }
  const existing = await prisma.card.findUnique({ where: { userId_lineId: key }, select })
  if (existing) {
    res.json({ card: existing, xpEarned: 0 })
    return
  }

  const [card, user] = await prisma.$transaction(async (tx) => {
    const created = await tx.card.create({ data: { ...key, ...scheduleLearned() }, select })
    await tx.reviewLog.create({
      data: { userId, lineId, rating: RATING_LEARNED, mistakes: 0, avgMs: 0, xpEarned: XP_LEARNED },
    })
    return [created, await recordActivity(tx, userId, XP_LEARNED)] as const
  })
  res.status(201).json({ card, xpEarned: XP_LEARNED, totalXp: user.xp, streak: user.streak })
})

/** A non-negative number from a request body, capped, or null if it is not one. */
function count(value: unknown, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(value, max) : null
}

// POST /api/train/result { lineId, mistakes, avgMs, maxMs? }  -> grades the review and reschedules the card
trainRouter.post('/result', async (req, res) => {
  const userId = req.userId!
  const body = (req.body ?? {}) as Record<string, unknown>
  const lineId = typeof body.lineId === 'string' ? body.lineId : ''
  const mistakes = count(body.mistakes, 999)
  const avgMs = count(body.avgMs, 600_000)
  // maxMs is optional; without it the slowest move is assumed to be the average.
  const maxMs = count(body.maxMs, 600_000) ?? avgMs
  if (!lineId || mistakes === null || avgMs === null || maxMs === null || !Number.isInteger(mistakes)) {
    res.status(400).json({ error: 'lineId, mistakes (whole number) and avgMs are required.' })
    return
  }

  const card = await prisma.card.findUnique({ where: { userId_lineId: { userId, lineId } } })
  if (!card) {
    res.status(404).json({ error: 'You have not learned this line yet.' })
    return
  }

  const grade = gradeDrill({ mistakes, avgMs, maxMs })
  const next = scheduleReview(card, grade)
  const xpEarned = XP_REVIEW[grade]
  const [updated, user] = await prisma.$transaction(async (tx) => {
    const saved = await tx.card.update({
      where: { id: card.id },
      data: next,
      select: { due: true, scheduledDays: true, lapses: true },
    })
    await tx.reviewLog.create({
      data: { userId, lineId, rating: gradeToNumber(grade), mistakes, avgMs: Math.round(avgMs), xpEarned },
    })
    return [saved, await recordActivity(tx, userId, xpEarned)] as const
  })

  res.json({
    grade,
    due: updated.due,
    scheduledDays: updated.scheduledDays,
    lapses: updated.lapses,
    xpEarned,
    totalXp: user.xp,
    streak: user.streak,
  })
})
