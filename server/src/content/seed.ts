import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { PrismaClient } from '../generated/prisma/client.js'
import { type ParsedCourse, parseCourseFile } from './courseFile.js'

export type SeedResult = { slug: string; title: string; lines: number; removedLines: number }

/** Reads and validates every *.json in `contentDir`. Throws on the first invalid file. */
export async function loadCourses(contentDir: string): Promise<ParsedCourse[]> {
  const files = (await readdir(contentDir)).filter((f) => f.endsWith('.json')).sort()
  const courses: ParsedCourse[] = []
  for (const file of files) {
    try {
      const raw: unknown = JSON.parse(await readFile(path.join(contentDir, file), 'utf8'))
      courses.push(parseCourseFile(raw, path.basename(file, '.json')))
    } catch (err) {
      throw new Error(`${file}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  const slugs = new Set<string>()
  for (const course of courses) {
    if (slugs.has(course.slug)) throw new Error(`Two files use the slug "${course.slug}"`)
    slugs.add(course.slug)
  }
  return courses
}

/**
 * Upserts official courses by slug. Safe to re-run: lines are matched on their
 * order, so existing line ids (and users' review cards) survive a re-seed.
 * All files are validated before anything is written.
 */
export async function seedCourses(prisma: PrismaClient, contentDir: string): Promise<SeedResult[]> {
  const courses = await loadCourses(contentDir)
  const results: SeedResult[] = []

  for (const course of courses) {
    const { lines, slug, ...fields } = course
    const data = { ...fields, source: 'GENERATED' as const, isOfficial: true, isPublic: true }

    const removedLines = await prisma.$transaction(async (tx) => {
      const saved = await tx.course.upsert({ where: { slug }, create: { slug, ...data }, update: data })
      for (const line of lines) {
        const lineData = { name: line.name, moves: line.moves, comments: line.comments, finalFen: line.finalFen }
        await tx.line.upsert({
          where: { courseId_order: { courseId: saved.id, order: line.order } },
          create: { courseId: saved.id, order: line.order, ...lineData },
          update: lineData,
        })
      }
      const removed = await tx.line.deleteMany({ where: { courseId: saved.id, order: { gt: lines.length } } })
      return removed.count
    })

    results.push({ slug, title: course.title, lines: lines.length, removedLines })
  }
  return results
}
