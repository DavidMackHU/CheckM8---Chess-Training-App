/**
 * Adds lines that end in checkmate to a course: positions in the course where
 * real players sometimes make a mistake that allows a
 * forced mate. Stockfish finds the mate; the line follows the course's own
 * moves up to the mistake, then the fastest mate against the best defence.
 *
 *   npm run find-mates -- --course london-system            (report only)
 *   npm run find-mates -- --course london-system --write    (add them to content/)
 *
 * Re-running replaces the lines it added before ("Checkmate: ..."), so it is
 * safe to repeat. Then run `npm run db:seed`.
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { Chess } from 'chess.js'
import { createLichessExplorer } from './lib/explorer.ts'
import { type MateLine, matesFrom, opponentNodes, pickMateLines } from './lib/mates.ts'
import { type CourseFile, toPgn } from './lib/output.ts'
import { startStockfish } from './lib/stockfish.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const { values } = parseArgs({
  options: {
    course: { type: 'string' },
    count: { type: 'string', default: '3' },
    'max-mate': { type: 'string', default: '5' },
    'min-games': { type: 'string', default: '20' },
    'min-share': { type: 'string', default: '0.01' },
    depth: { type: 'string', default: '18' },
    // club: Lichess 1400-2000. casual: 1000-1200, where these mistakes are far more common.
    ratings: { type: 'string', default: 'club' },
    write: { type: 'boolean', default: false },
  },
})
if (!values.course) {
  console.error('Usage: npm run find-mates -- --course <slug> [--count 3] [--max-mate 5] [--write]')
  process.exit(1)
}

try {
  process.loadEnvFile(path.join(ROOT, 'server', '.env'))
} catch {
  // No env file: LICHESS_TOKEN must be set some other way (cached answers still work).
}

type StoredLine = CourseFile['lines'][number] & { comments?: Record<string, string> }
type StoredCourse = Omit<CourseFile, 'lines'> & { lines: StoredLine[] } & Record<string, unknown>

const MARK = 'Checkmate: '
const jsonPath = path.join(ROOT, 'content', `${values.course}.json`)
const course = JSON.parse(await readFile(jsonPath, 'utf8')) as StoredCourse
const ordinary = course.lines.filter((l) => !l.name.startsWith(MARK))

const explorer = createLichessExplorer({
  token: process.env.LICHESS_TOKEN || undefined,
  cacheDir: path.join(ROOT, '.explorer-cache'),
  log: (m) => console.log(m),
})
const engine = await startStockfish(ROOT)
const options = {
  maxMate: Number(values['max-mate']),
  minGames: Number(values['min-games']),
  minShare: Number(values['min-share']),
  depth: Number(values.depth),
  db: values.ratings === 'casual' ? ('casual' as const) : ('club' as const),
}

const nodes = opponentNodes(ordinary, course.keyMoves.length, course.side)
console.log(`${course.title}: checking ${nodes.length} positions where the opponent moves...`)
const candidates: MateLine[] = []
for (const [i, node] of nodes.entries()) {
  candidates.push(...(await matesFrom(node, explorer, engine, options)))
  if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${nodes.length} positions, ${candidates.length} mates so far`)
}
engine.quit()

const picked = pickMateLines(candidates, Number(values.count))
console.log(`\nFound ${candidates.length} mating mistakes; keeping ${picked.length}:`)
for (const line of picked) {
  console.log(`  ${line.name}  [${line.games} games, ${(line.share * 100).toFixed(1)}%]`)
  console.log(`    ${line.moves.join(' ')}`)
}

if (!values.write) {
  console.log('\nReport only. Add --write to put these lines in the course.')
  process.exit(0)
}

const finalFen = (moves: string[]) => {
  const chess = new Chess()
  for (const san of moves) chess.move(san)
  return chess.fen()
}
const lines: StoredLine[] = [
  ...ordinary,
  ...picked.map((m) => ({ order: 0, name: m.name, moves: m.moves, finalFen: finalFen(m.moves), frequency: m.share, comments: m.comments })),
].map((line, i) => ({ ...line, order: i + 1 }))

const updated: StoredCourse = { ...course, lineCount: lines.length, lines }
await writeFile(jsonPath, `${JSON.stringify(updated, null, 2)}\n`)
await writeFile(path.join(ROOT, 'content', `${values.course}.pgn`), toPgn(updated))
console.log(`\nWrote ${picked.length} checkmate lines to content/${values.course}.json and .pgn. Now run: npm run db:seed`)
