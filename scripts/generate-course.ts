/**
 * Generates a course from public opening data (Lichess opening explorer).
 *
 *   npx tsx scripts/generate-course.ts --name "London System" --side white \
 *       --moves "d4 d5 Bf4" --out content/london-system
 *
 * Writes <out>.json (read by the seed) and <out>.pgn (for review in a chess GUI).
 * See content/README.md for the full pipeline.
 */
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { buildLines } from './lib/buildLines.ts'
import { createLichessExplorer } from './lib/explorer.ts'
import { toCourseFile, toPgn } from './lib/output.ts'

const ROOT = path.resolve(import.meta.dirname, '..')

function fail(message: string): never {
  console.error(`Error: ${message}`)
  process.exit(1)
}

const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    side: { type: 'string' },
    moves: { type: 'string' },
    out: { type: 'string' },
    'max-ply': { type: 'string', default: '20' },
    'max-lines': { type: 'string', default: '60' },
    'min-share': { type: 'string', default: '0.05' },
    'min-games': { type: 'string', default: '100' },
    'min-master-games': { type: 'string', default: '20' },
    force: { type: 'boolean', default: false },
  },
})

if (!values.name || !values.side || !values.moves || !values.out) {
  fail('Required: --name, --side white|black, --moves "e4 e5 ...", --out content/<slug>')
}
if (values.side !== 'white' && values.side !== 'black') fail('--side must be white or black')

const num = (flag: 'max-ply' | 'max-lines' | 'min-share' | 'min-games' | 'min-master-games') => {
  const n = Number(values[flag])
  if (!Number.isFinite(n) || n <= 0) fail(`--${flag} must be a positive number`)
  return n
}

const outBase = path.resolve(ROOT, values.out)
const slug = path.basename(outBase)
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) fail(`"${slug}" is not a valid slug. Use lowercase-words-with-dashes.`)

// The JSON also holds hand-written comments and pitch, so never overwrite it by accident.
if (existsSync(`${outBase}.json`) && !values.force) {
  fail(`${values.out}.json already exists and may contain your annotations. Pass --force to overwrite it.`)
}

// Pick up LICHESS_TOKEN from server/.env if it is not already in the environment.
try {
  process.loadEnvFile(path.join(ROOT, 'server', '.env'))
} catch {
  // No server/.env. Fine if the variable is set another way.
}

const explorer = createLichessExplorer({
  token: process.env.LICHESS_TOKEN || undefined,
  cacheDir: path.join(ROOT, '.explorer-cache'),
  log: console.log,
})

try {
  const keyMoves = values.moves.trim().split(/\s+/)
  const lines = await buildLines(explorer, {
    side: values.side,
    keyMoves,
    maxPly: num('max-ply'),
    maxLines: num('max-lines'),
    minShare: num('min-share'),
    minGames: num('min-games'),
    minMasterGames: num('min-master-games'),
    log: console.log,
  })

  const course = toCourseFile({ title: values.name, slug, side: values.side, keyMoves, lines })
  await mkdir(path.dirname(outBase), { recursive: true })
  await writeFile(`${outBase}.json`, `${JSON.stringify(course, null, 2)}\n`)
  await writeFile(`${outBase}.pgn`, toPgn(course))

  const { cached, fetched } = explorer.stats
  console.log(`\n${course.title}: ${course.lineCount} lines`)
  console.log(`Wrote ${values.out}.json and ${values.out}.pgn  (${fetched} requests, ${cached} from cache)`)
} catch (err) {
  fail(err instanceof Error ? err.message : String(err))
}
