import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { type CleanLine, cleanLines, keyPosition, START_FEN } from '../content/lines.js'
import { parsePgn } from '../content/pgn.js'
import { prisma } from '../db.js'
import type { Prisma } from '../generated/prisma/client.js'
import { requireAuth } from '../middleware/auth.js'

export const creatorRouter = Router()
creatorRouter.use(requireAuth)

const SIDES = ['WHITE', 'BLACK'] as const
const DIFFICULTIES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const
type Side = (typeof SIDES)[number]

/** A course needs this much before it can be shown to everyone. */
const MIN_LINES_TO_PUBLISH = 3
const MIN_PITCH_TO_PUBLISH = 10

const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const pick = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined => allowed.find((a) => a === value)
const message = (err: unknown): string => (err instanceof Error ? err.message : 'Invalid input.')

function makeSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `${base || 'course'}-${randomBytes(3).toString('hex')}`
}

/** Loads a course only if the signed-in user wrote it. */
function findOwned(id: string, userId: string) {
  return prisma.course.findFirst({ where: { id, authorId: userId, isOfficial: false } })
}

/**
 * Replaces a course's lines. A line whose moves are unchanged keeps its row,
 * so review cards for it survive an edit. Removed lines take their cards with them.
 */
async function saveLines(tx: Prisma.TransactionClient, courseId: string, lines: CleanLine[]) {
  const existing = await tx.line.findMany({ where: { courseId }, select: { id: true, moves: true } })
  const idByMoves = new Map(existing.map((l) => [l.moves.join(' '), l.id]))
  const keptIds = new Set(lines.map((l) => idByMoves.get(l.moves.join(' '))).filter((id): id is string => !!id))

  await tx.line.deleteMany({ where: { courseId, id: { notIn: [...keptIds] } } })
  // Move kept lines out of the way first: (courseId, order) is unique.
  for (const [i, id] of [...keptIds].entries()) await tx.line.update({ where: { id }, data: { order: -(i + 1) } })

  for (const [i, line] of lines.entries()) {
    const data = { order: i + 1, name: line.name, moves: line.moves, comments: line.comments, finalFen: line.finalFen }
    const id = idByMoves.get(line.moves.join(' '))
    if (id) await tx.line.update({ where: { id }, data })
    else await tx.line.create({ data: { courseId, ...data } })
  }
}

// GET /api/creator/courses  -> the signed-in user's own courses
creatorRouter.get('/courses', async (req, res) => {
  const courses = await prisma.course.findMany({
    where: { authorId: req.userId!, isOfficial: false },
    orderBy: { createdAt: 'desc' },
    select: { id: true, slug: true, title: true, side: true, isPublic: true, createdAt: true, _count: { select: { lines: true } } },
  })
  res.json({ courses: courses.map(({ _count, ...c }) => ({ ...c, lineCount: _count.lines })) })
})

// POST /api/creator/parse-pgn { pgn, side }  -> lines found in the PGN, nothing is saved
creatorRouter.post('/parse-pgn', (req, res) => {
  const side = pick(req.body?.side, SIDES)
  if (!side || typeof req.body?.pgn !== 'string') {
    res.status(400).json({ error: 'pgn and side (WHITE or BLACK) are required.' })
    return
  }
  try {
    res.json(cleanLines(parsePgn(req.body.pgn), side))
  } catch (err) {
    res.status(400).json({ error: message(err) })
  }
})

// POST /api/creator/courses { title, side, pgn? }  -> creates a private course
creatorRouter.post('/courses', async (req, res) => {
  const title = text(req.body?.title, 80)
  const side = pick(req.body?.side, SIDES)
  if (title.length < 3 || !side) {
    res.status(400).json({ error: 'A title (3 or more characters) and a side are required.' })
    return
  }

  let lines: CleanLine[] = []
  let warnings: string[] = []
  const pgn = typeof req.body?.pgn === 'string' ? req.body.pgn.trim() : ''
  if (pgn) {
    try {
      ;({ lines, warnings } = cleanLines(parsePgn(pgn), side))
    } catch (err) {
      res.status(400).json({ error: message(err) })
      return
    }
  }

  const course = await prisma.$transaction(async (tx) => {
    const created = await tx.course.create({
      data: {
        slug: makeSlug(title),
        title,
        side,
        startFen: START_FEN,
        ...keyPosition(lines),
        source: pgn ? 'PGN' : 'MANUAL',
        authorId: req.userId!,
        isOfficial: false,
        isPublic: false,
      },
      select: { id: true, slug: true },
    })
    await saveLines(tx, created.id, lines)
    return created
  })
  res.status(201).json({ course, lineCount: lines.length, warnings })
})

// GET /api/creator/courses/:id  -> everything the editor needs
creatorRouter.get('/courses/:id', async (req, res) => {
  const course = await findOwned(String(req.params.id), req.userId!)
  if (!course) {
    res.status(404).json({ error: 'Course not found.' })
    return
  }
  const lines = await prisma.line.findMany({
    where: { courseId: course.id },
    orderBy: { order: 'asc' },
    select: { id: true, order: true, name: true, moves: true, comments: true },
  })
  const { id, slug, title, pitch, description, side, difficulty, isPublic } = course
  res.json({ course: { id, slug, title, pitch, description, side, difficulty, isPublic }, lines })
})

// PUT /api/creator/courses/:id { title, pitch, description, side, difficulty, lines }
creatorRouter.put('/courses/:id', async (req, res) => {
  const course = await findOwned(String(req.params.id), req.userId!)
  if (!course) {
    res.status(404).json({ error: 'Course not found.' })
    return
  }
  const body = (req.body ?? {}) as Record<string, unknown>
  const title = body.title === undefined ? course.title : text(body.title, 80)
  const side: Side = pick(body.side, SIDES) ?? course.side
  if (title.length < 3) {
    res.status(400).json({ error: 'The title needs 3 or more characters.' })
    return
  }

  let cleaned: { lines: CleanLine[]; warnings: string[] } | null = null
  if (body.lines !== undefined) {
    try {
      cleaned = cleanLines(body.lines, side)
    } catch (err) {
      res.status(400).json({ error: message(err) })
      return
    }
  } else if (side !== course.side) {
    res.status(400).json({ error: 'Changing the side needs the lines sent again.' })
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.course.update({
      where: { id: course.id },
      data: {
        title,
        side,
        pitch: body.pitch === undefined ? undefined : text(body.pitch, 160),
        description: body.description === undefined ? undefined : text(body.description, 1000),
        difficulty: pick(body.difficulty, DIFFICULTIES),
        ...(cleaned ? keyPosition(cleaned.lines) : {}),
      },
    })
    if (cleaned) await saveLines(tx, course.id, cleaned.lines)
  })
  res.json({ saved: true, lineCount: cleaned?.lines.length, warnings: cleaned?.warnings ?? [] })
})

// POST /api/creator/courses/:id/publish  and  .../unpublish
creatorRouter.post('/courses/:id/publish', async (req, res) => {
  const course = await findOwned(String(req.params.id), req.userId!)
  if (!course) {
    res.status(404).json({ error: 'Course not found.' })
    return
  }
  const lineCount = await prisma.line.count({ where: { courseId: course.id } })
  const missing: string[] = []
  if (lineCount < MIN_LINES_TO_PUBLISH) missing.push(`at least ${MIN_LINES_TO_PUBLISH} lines (it has ${lineCount})`)
  if (course.pitch.length < MIN_PITCH_TO_PUBLISH) missing.push('a one-sentence pitch')
  if (missing.length > 0) {
    res.status(400).json({ error: `Before publishing, this course needs ${missing.join(' and ')}. Save your changes first.` })
    return
  }
  await prisma.course.update({
    where: { id: course.id },
    data: { isPublic: true, publishedAt: course.publishedAt ?? new Date() },
  })
  res.json({ isPublic: true })
})

creatorRouter.post('/courses/:id/unpublish', async (req, res) => {
  const course = await findOwned(String(req.params.id), req.userId!)
  if (!course) {
    res.status(404).json({ error: 'Course not found.' })
    return
  }
  await prisma.course.update({ where: { id: course.id }, data: { isPublic: false } })
  res.json({ isPublic: false })
})

// DELETE /api/creator/courses/:id
creatorRouter.delete('/courses/:id', async (req, res) => {
  const course = await findOwned(String(req.params.id), req.userId!)
  if (!course) {
    res.status(404).json({ error: 'Course not found.' })
    return
  }
  await prisma.course.delete({ where: { id: course.id } })
  res.status(204).end()
})
