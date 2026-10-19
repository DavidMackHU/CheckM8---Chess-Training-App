/**
 * Adds lines that punish common opponent mistakes to a course. At every
 * position in the course where the opponent moves, it looks up the replies
 * real players make (Lichess) and asks Stockfish about each one the course
 * does not already cover:
 *  - "Checkmate: ..." when the mistake allows a forced mate (played out to mate)
 *  - "Punish: ..."    when the mistake loses a lot (the user's best follow-up)
 *
 *   npm run find-traps -- --course london-system            (report only)
 *   npm run find-traps -- --course london-system --write    (add them to content/)
 *
 * Re-running replaces the lines it added before, so it is safe to repeat.
 * Then run `npm run db:seed`.
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { Chess } from 'chess.js'
import { createLichessExplorer } from './lib/explorer.ts'
import { type CourseFile, toPgn } from './lib/output.ts'
import { startStockfish } from './lib/stockfish.ts'
import { opponentNodes, pickTraps, type TrapLine, trapsFrom } from './lib/traps.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const { values } = parseArgs({
  options: {
    course: { type: 'string' },
    mates: { type: 'string', default: '4' },
    punish: { type: 'string', default: '6' },
    'max-mate': { type: 'string', default: '8' },
    'min-advantage': { type: 'string', default: '200' },
    'min-swing': { type: 'string', default: '150' },
    'punish-moves': { type: 'string', default: '3' },
    'min-games': { type: 'string', default: '10' },
    'min-share': { type: 'string', default: '0.005' },
    depth: { type: 'string', default: '14' },
    // club: Lichess 1400-2000. casual: 1000-1200, where these mistakes are far more common.
    ratings: { type: 'string', default: 'casual' },
    write: { type: 'boolean', default: false },
  },
})
if (!values.course) {
  console.error('Usage: npm run find-traps -- --course <slug> [--mates 4] [--punish 6] [--ratings casual|club] [--write]')
  process.exit(1)
}

try {
  process.loadEnvFile(path.join(ROOT, 'server', '.env'))
} catch {
  // No env file: LICHESS_TOKEN must be set some other way (cached answers still work).
}

type StoredLine = CourseFile['lines'][number] & { comments?: Record<string, string> }
type StoredCourse = Omit<CourseFile, 'lines'> & { lines: StoredLine[] } & Record<string, unknown>

const ADDED = /^(Checkmate|Punish): /
const jsonPath = path.join(ROOT, 'content', `${values.course}.json`)
const course = JSON.parse(await readFile(jsonPath, 'utf8')) as StoredCourse
const ordinary = course.lines.filter((l) => !ADDED.test(l.name))

const explorer = createLichessExplorer({
  token: process.env.LICHESS_TOKEN || undefined,
  cacheDir: path.join(ROOT, '.explorer-cache'),
  log: (m) => console.log(m),
})
const engine = await startStockfish(ROOT)
const num = (key: keyof typeof values) => Number(values[key])
const options = {
  maxMate: num('max-mate'),
  minAdvantage: num('min-advantage'),
  minSwing: num('min-swing'),
  punishMoves: num('punish-moves'),
  minGames: num('min-games'),
  minShare: num('min-share'),
  depth: num('depth'),
  db: values.ratings === 'club' ? ('club' as const) : ('casual' as const),
}

const nodes = opponentNodes(ordinary, course.keyMoves.length, course.side)
console.log(`${course.title}: checking ${nodes.length} positions where the opponent moves (${options.db} games)...`)
const candidates: TrapLine[] = []
for (const [i, node] of nodes.entries()) {
  candidates.push(...(await trapsFrom(node, explorer, engine, options)))
  if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${nodes.length} positions, ${candidates.length} mistakes found so far`)
}
engine.quit()

const picked = [...pickTraps(candidates, 'mate', num('mates')), ...pickTraps(candidates, 'punish', num('punish'))]
const count = (kind: TrapLine['kind']) => candidates.filter((c) => c.kind === kind).length
console.log(`\nFound ${count('mate')} mating and ${count('punish')} losing mistakes; keeping ${picked.length}:`)
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
  ...picked.map((t) => ({ order: 0, name: t.name, moves: t.moves, finalFen: finalFen(t.moves), frequency: t.share, comments: t.comments })),
].map((line, i) => ({ ...line, order: i + 1 }))

const updated: StoredCourse = { ...course, lineCount: lines.length, lines }
await writeFile(jsonPath, `${JSON.stringify(updated, null, 2)}\n`)
await writeFile(path.join(ROOT, 'content', `${values.course}.pgn`), toPgn(updated))
console.log(`\nWrote ${picked.length} lines to content/${values.course}.json and .pgn. Now run: npm run db:seed`)
