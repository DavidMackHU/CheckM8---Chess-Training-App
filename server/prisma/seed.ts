/**
 * Loads every content/*.json course into the database. Idempotent.
 *
 *   npm run db:seed            (from the repo root)
 *   npx tsx server/prisma/seed.ts
 */
import path from 'node:path'

const serverDir = path.resolve(import.meta.dirname, '..')
try {
  process.loadEnvFile(path.join(serverDir, '.env'))
} catch {
  // No .env file: rely on real environment variables.
}

// Imported after the env file is loaded, because db.ts reads DATABASE_URL on import.
const { prisma } = await import('../src/db.js')
const { seedCourses } = await import('../src/content/seed.js')

// Optional argument: a different content folder (used for testing).
const contentDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(serverDir, '..', 'content')

try {
  const results = await seedCourses(prisma, contentDir)
  if (results.length === 0) {
    console.log(`No course files found in ${contentDir}. Generate one first (see content/README.md).`)
  }
  for (const r of results) {
    const removed = r.removedLines ? `, ${r.removedLines} old lines removed` : ''
    console.log(`Seeded ${r.title} (${r.slug}): ${r.lines} lines${removed}`)
  }
} catch (err) {
  console.error(`Seed failed: ${err instanceof Error ? err.message : String(err)}`)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
