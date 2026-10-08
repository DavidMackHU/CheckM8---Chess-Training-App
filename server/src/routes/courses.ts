import { Router } from 'express'
import { prisma } from '../db.js'
import type { Prisma } from '../generated/prisma/client.js'
import { visibleTo } from '../lib/access.js'
import { optionalAuth, requireAuth } from '../middleware/auth.js'

export const coursesRouter = Router()

const SIDES = ['WHITE', 'BLACK'] as const
const DIFFICULTIES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const
const OFFICIAL_AUTHOR = 'OpeningDrill'

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  const upper = typeof value === 'string' ? value.toUpperCase() : ''
  return allowed.find((a) => a === upper)
}

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  pitch: true,
  side: true,
  difficulty: true,
  keyMoves: true,
  keyFen: true,
  isOfficial: true,
  upvotes: true,
  author: { select: { username: true } },
  _count: { select: { lines: true } },
} satisfies Prisma.CourseSelect

type CardRow = Prisma.CourseGetPayload<{ select: typeof cardSelect }>

/** Shape shared by catalog cards and the course header. */
function toCard(course: CardRow) {
  const { author, _count, ...rest } = course
  return { ...rest, author: course.isOfficial ? OFFICIAL_AUTHOR : (author?.username ?? 'Unknown'), lineCount: _count.lines }
}

// GET /api/courses?side=&first=&difficulty=&q=&community=
coursesRouter.get('/', async (req, res) => {
  const where: Prisma.CourseWhereInput = { isPublic: true }

  const side = oneOf(req.query.side, SIDES)
  if (side) where.side = side

  const difficulty = oneOf(req.query.difficulty, DIFFICULTIES)
  if (difficulty) where.difficulty = difficulty

  // first=e4 | d4 | other  (White's first move, for courses of either side)
  const first = typeof req.query.first === 'string' ? req.query.first : ''
  if (first === 'e4' || first === 'd4') where.firstMove = first
  else if (first === 'other') where.firstMove = { notIn: ['e4', 'd4'] }

  if (req.query.community === 'true') where.isOfficial = false
  else if (req.query.community === 'false') where.isOfficial = true

  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : ''
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { pitch: { contains: q, mode: 'insensitive' } },
    ]
  }

  const courses = await prisma.course.findMany({
    where,
    select: cardSelect,
    // sort=new lists the most recently published first; the default is official courses, then most upvoted.
    orderBy:
      req.query.sort === 'new'
        ? [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }]
        : [{ isOfficial: 'desc' }, { upvotes: 'desc' }, { title: 'asc' }],
    take: 100,
  })
  res.json({ courses: courses.map(toCard) })
})

// GET /api/courses/:slug  -> course, its lines, and whether the viewer is enrolled
coursesRouter.get('/:slug', optionalAuth, async (req, res) => {
  const course = await prisma.course.findFirst({
    where: { slug: String(req.params.slug), ...visibleTo(req.userId) },
    select: {
      ...cardSelect,
      description: true,
      startFen: true,
      isPublic: true,
      authorId: true,
      lines: {
        orderBy: { order: 'asc' },
        select: { id: true, order: true, name: true, moves: true, finalFen: true },
      },
    },
  })
  if (!course) {
    res.status(404).json({ error: 'Course not found.' })
    return
  }

  const enrolled = req.userId
    ? (await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: req.userId, courseId: course.id } },
        select: { userId: true },
      })) !== null
    : false

  const upvoted = req.userId
    ? (await prisma.courseUpvote.findUnique({
        where: { userId_courseId: { userId: req.userId, courseId: course.id } },
        select: { userId: true },
      })) !== null
    : false

  const { lines, description, startFen, isPublic, authorId, ...card } = course
  const isOwner = !!req.userId && authorId === req.userId
  res.json({ course: { ...toCard(card), description, startFen, enrolled, upvoted, isPublic, isOwner }, lines })
})

// GET /api/courses/:slug/first-line  -> guest preview: line 1 with its comments
coursesRouter.get('/:slug/first-line', optionalAuth, async (req, res) => {
  const course = await prisma.course.findFirst({
    where: { slug: String(req.params.slug), ...visibleTo(req.userId) },
    select: {
      id: true,
      slug: true,
      title: true,
      side: true,
      startFen: true,
      lines: {
        orderBy: { order: 'asc' },
        take: 1,
        select: { id: true, order: true, name: true, moves: true, comments: true, finalFen: true },
      },
    },
  })
  const line = course?.lines[0]
  if (!course || !line) {
    res.status(404).json({ error: 'Course not found.' })
    return
  }
  const { lines: _lines, ...rest } = course
  res.json({ course: rest, line })
})

// POST /api/courses/:id/enroll
coursesRouter.post('/:id/enroll', requireAuth, async (req, res) => {
  const course = await prisma.course.findFirst({
    where: { id: String(req.params.id), ...visibleTo(req.userId) },
    select: { id: true },
  })
  if (!course) {
    res.status(404).json({ error: 'Course not found.' })
    return
  }
  const key = { userId: req.userId!, courseId: course.id }
  await prisma.enrollment.upsert({ where: { userId_courseId: key }, create: key, update: {} })
  res.json({ enrolled: true })
})

/** Adds or removes the viewer's upvote and returns the new total. */
async function setUpvote(courseId: string, userId: string, on: boolean): Promise<number | 'not-found' | 'own'> {
  const course = await prisma.course.findFirst({ where: { id: courseId, isPublic: true }, select: { authorId: true } })
  if (!course) return 'not-found'
  if (course.authorId === userId) return 'own'

  const key = { userId, courseId }
  return prisma.$transaction(async (tx) => {
    const existing = await tx.courseUpvote.findUnique({ where: { userId_courseId: key } })
    if (on && !existing) await tx.courseUpvote.create({ data: key })
    if (!on && existing) await tx.courseUpvote.delete({ where: { userId_courseId: key } })
    // Recount instead of incrementing, so the cached total can never drift.
    const upvotes = await tx.courseUpvote.count({ where: { courseId } })
    await tx.course.update({ where: { id: courseId }, data: { upvotes } })
    return upvotes
  })
}

// POST /api/courses/:id/upvote  and  DELETE /api/courses/:id/upvote
for (const [method, on] of [['post', true], ['delete', false]] as const) {
  coursesRouter[method]('/:id/upvote', requireAuth, async (req, res) => {
    const result = await setUpvote(String(req.params.id), req.userId!, on)
    if (result === 'not-found') {
      res.status(404).json({ error: 'Course not found.' })
      return
    }
    if (result === 'own') {
      res.status(403).json({ error: 'You cannot upvote your own course.' })
      return
    }
    res.json({ upvotes: result, upvoted: on })
  })
}
