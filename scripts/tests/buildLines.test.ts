import { Chess } from 'chess.js'
import { buildLines } from '../lib/buildLines.ts'
import type { Db, Explorer, ExplorerResponse } from '../lib/explorer.ts'
import { toCourseFile, toPgn } from '../lib/output.ts'

/**
 * A stand-in for the Lichess explorer. Every legal move gets a game count
 * derived from a hash, skewed so that a few moves dominate, as in real opening
 * data. Master games dry up after a few moves, which exercises the fallback.
 */
function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

const fakeExplorer: Explorer = {
  async query(db: Db, play: string[]): Promise<ExplorerResponse> {
    const chess = new Chess()
    for (const uci of play) chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    const scale = db === 'masters' ? (play.length > 9 ? 0 : 50) : 100000 / (play.length + 1) ** 2
    const moves = chess
      .moves({ verbose: true })
      .map((m) => {
        const games = Math.floor(scale * ((hash(play.join(',') + m.san) % 1000) / 1000) ** 6)
        return { uci: m.from + m.to + (m.promotion ?? ''), san: m.san, white: games, draws: 0, black: 0 }
      })
      .filter((m) => m.white > 0)
    const total = moves.reduce((n, m) => n + m.white, 0)
    return { white: total, draws: 0, black: 0, moves, opening: play.length < 7 ? { eco: 'A00', name: `Opening ${play.length}` } : null }
  },
}

const MAX_PLY = 14
const cases = [
  { side: 'white', key: 'd4 d5 Bf4', maxLines: 30 },
  { side: 'black', key: 'e4 c6', maxLines: 12 },
  { side: 'white', key: 'e4 e5', maxLines: 25 },
] as const

describe.each(cases)('course generator: $side after $key', ({ side, key, maxLines }) => {
  const keyMoves = key.split(' ')
  const build = () =>
    buildLines(fakeExplorer, { side, keyMoves, maxPly: MAX_PLY, maxLines, minShare: 0.05, minGames: 100, minMasterGames: 20 })

  it('produces legal, unique lines within the limits that end on the user move', async () => {
    const lines = await build()
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.length).toBeLessThanOrEqual(maxLines)

    const keys = lines.map((l) => l.moves.join(' '))
    expect(new Set(keys).size).toBe(lines.length)

    for (const line of lines) {
      expect(line.moves.length).toBeLessThanOrEqual(MAX_PLY)
      expect(line.moves.slice(0, keyMoves.length)).toEqual(keyMoves)
      // White's moves sit at even indexes, so a White line has odd length.
      expect(line.moves.length % 2 === 1).toBe(side === 'white')
      const chess = new Chess()
      for (const san of line.moves) chess.move(san) // throws if illegal
      expect(chess.fen()).toBe(line.finalFen)
      expect(line.branchPly).toBeLessThanOrEqual(line.moves.length)
    }
    // No line is merely the start of another.
    expect(keys.some((a) => keys.some((b) => a !== b && b.startsWith(`${a} `)))).toBe(false)
  })

  it('orders lines by how often they occur and gives one answer per position', async () => {
    const lines = await build()
    expect(lines.reduce((sum, l) => sum + l.frequency, 0)).toBeLessThanOrEqual(1.001)
    for (let i = 1; i < lines.length; i++) expect(lines[i - 1].frequency).toBeGreaterThanOrEqual(lines[i].frequency)

    const answers = new Map<string, string>()
    for (const line of lines) {
      for (let i = side === 'white' ? 0 : 1; i < line.moves.length; i += 2) {
        const position = line.moves.slice(0, i).join(' ')
        expect(answers.get(position) ?? line.moves[i]).toBe(line.moves[i])
        answers.set(position, line.moves[i])
      }
    }
  })
})

describe('course files', () => {
  it('names every line distinctly and writes a PGN that reads back', async () => {
    const keyMoves = ['d4', 'd5', 'Bf4']
    const lines = await buildLines(fakeExplorer, { side: 'white', keyMoves, maxPly: MAX_PLY, maxLines: 20, minShare: 0.05, minGames: 100, minMasterGames: 20 })
    const course = toCourseFile({ title: 'Test Course', slug: 'test-course', side: 'white', keyMoves, lines })

    expect(course.lineCount).toBe(lines.length)
    expect(course.lines.map((l) => l.order)).toEqual(lines.map((_, i) => i + 1))
    expect(new Set(course.lines.map((l) => l.name)).size).toBe(lines.length)
    expect(course.side).toBe('WHITE')
    expect(course.keyFen).toMatch(/^rnbqkbnr\/ppp1pppp\/8\/3p4\/3P1B2\//)
    expect(course.lines[0]).not.toHaveProperty('branchPly')

    const pgn = toPgn(course)
    expect(pgn.match(/\[Event /g)).toHaveLength(lines.length)
    const first = new Chess()
    first.loadPgn(pgn.split('\n\n[Event')[0])
    expect(first.history()).toEqual(course.lines[0].moves)
  })
})
