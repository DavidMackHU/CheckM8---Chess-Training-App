import { Chess } from 'chess.js'

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export type CleanLine = { name: string; moves: string[]; comments: Record<string, string>; finalFen: string }
export type CleanResult = { lines: CleanLine[]; warnings: string[] }

const MAX_LINES = 500
const MAX_PLY = 80
const MAX_NAME = 120
const MAX_COMMENT = 500
/** Thumbnails and the catalog filter use the shared opening moves, up to this many plies. */
const MAX_KEY_PLY = 6

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Checks and tidies lines sent by the course creator. Every move is replayed.
 * A line must end on the user's own move, so a trailing opponent move is
 * dropped (with a warning) and exact duplicates or lines fully contained in a
 * longer line are removed. Throws on anything that cannot be repaired.
 */
export function cleanLines(raw: unknown, side: 'WHITE' | 'BLACK'): CleanResult {
  if (!Array.isArray(raw)) throw new Error('"lines" must be a list.')
  if (raw.length > MAX_LINES) throw new Error(`A course can have at most ${MAX_LINES} lines.`)
  const userColor = side === 'WHITE' ? 'w' : 'b'
  const warnings: string[] = []
  const parsed: CleanLine[] = []

  raw.forEach((item, index) => {
    const label = `Line ${index + 1}`
    if (!isRecord(item)) throw new Error(`${label}: not an object.`)
    if (!Array.isArray(item.moves) || !item.moves.every((m) => typeof m === 'string')) {
      throw new Error(`${label}: "moves" must be a list of moves.`)
    }
    let moves = item.moves as string[]
    if (moves.length > MAX_PLY) throw new Error(`${label}: longer than ${MAX_PLY} half-moves.`)

    const chess = new Chess()
    const sans: string[] = []
    moves.forEach((written, i) => {
      try {
        sans.push(chess.move(written).san)
      } catch {
        throw new Error(`${label}: move ${i + 1} ("${written}") is not legal.`)
      }
    })
    moves = sans

    // After the user's last move it is the opponent's turn.
    if (moves.length > 0 && chess.turn() === userColor) {
      chess.undo()
      moves = moves.slice(0, -1)
      warnings.push(`${label}: the last move was the opponent's, so it was dropped.`)
    }
    if (moves.length === 0) {
      warnings.push(`${label}: has no move for ${side === 'WHITE' ? 'White' : 'Black'}, so it was skipped.`)
      return
    }

    const comments: Record<string, string> = {}
    if (isRecord(item.comments)) {
      for (const [ply, text] of Object.entries(item.comments)) {
        const n = Number(ply)
        if (!Number.isInteger(n) || n < 1 || n > moves.length || typeof text !== 'string') continue
        const trimmed = text.trim().slice(0, MAX_COMMENT)
        if (trimmed) comments[String(n)] = trimmed
      }
    }

    const name = typeof item.name === 'string' ? item.name.trim().slice(0, MAX_NAME) : ''
    parsed.push({ name, moves, comments, finalFen: chess.fen() })
  })

  // Drop duplicates and lines that are just the start of a longer line.
  const keys = parsed.map((l) => l.moves.join(' '))
  const kept = parsed.filter((_, i) => {
    const duplicate = keys.indexOf(keys[i]) !== i
    const contained = keys.some((other, j) => j !== i && other.startsWith(`${keys[i]} `))
    return !duplicate && !contained
  })
  if (kept.length < parsed.length) {
    warnings.push(`${parsed.length - kept.length} duplicate or shorter overlapping lines were merged.`)
  }

  const lines = kept.map((line, i) => ({ ...line, name: line.name || `Line ${i + 1}` }))
  return { lines, warnings }
}

/** The opening moves every line shares (capped), plus the position after them. */
export function keyPosition(lines: { moves: string[] }[]): { keyMoves: string[]; keyFen: string; firstMove: string } {
  const keyMoves: string[] = []
  if (lines.length > 0) {
    const first = lines[0].moves
    for (let i = 0; i < Math.min(first.length, MAX_KEY_PLY); i++) {
      if (!lines.every((l) => l.moves[i] === first[i])) break
      keyMoves.push(first[i])
    }
  }
  const chess = new Chess()
  for (const san of keyMoves) chess.move(san)
  return { keyMoves, keyFen: chess.fen(), firstMove: lines[0]?.moves[0] ?? '' }
}
