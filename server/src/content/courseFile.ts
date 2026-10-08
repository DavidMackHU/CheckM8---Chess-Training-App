import { Chess } from 'chess.js'

/** A course ready to be written to the database, after validation. */
export type ParsedCourse = {
  slug: string
  title: string
  pitch: string
  description: string
  side: 'WHITE' | 'BLACK'
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  startFen: string
  keyMoves: string[]
  firstMove: string
  keyFen: string
  lines: ParsedLine[]
}

export type ParsedLine = {
  order: number
  name: string
  moves: string[]
  comments: Record<string, string>
  finalFen: string
}

const DIFFICULTIES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Replays SAN moves from a FEN. Throws a readable error at the first illegal move. */
function replay(startFen: string, moves: string[], label: string): Chess {
  const chess = new Chess(startFen)
  moves.forEach((san, i) => {
    try {
      chess.move(san)
    } catch {
      throw new Error(`${label}: move ${i + 1} ("${san}") is not legal`)
    }
  })
  return chess
}

/**
 * Validates one content/<slug>.json file. Every move of every line is replayed,
 * so a typo made while hand-editing is caught here instead of in a user's drill.
 * `fallbackSlug` (the file name) is used when the file has no slug field.
 */
export function parseCourseFile(raw: unknown, fallbackSlug: string): ParsedCourse {
  if (!isRecord(raw)) throw new Error('file is not a JSON object')

  const slug = text(raw.slug) || fallbackSlug
  if (!SLUG_RE.test(slug)) throw new Error(`slug "${slug}" must be lowercase-words-with-dashes`)

  const title = text(raw.title)
  if (!title) throw new Error('missing "title"')
  if (raw.side !== 'WHITE' && raw.side !== 'BLACK') throw new Error('"side" must be WHITE or BLACK')
  const side = raw.side

  const difficulty = raw.difficulty === undefined ? 'BEGINNER' : raw.difficulty
  if (!DIFFICULTIES.includes(difficulty as (typeof DIFFICULTIES)[number])) {
    throw new Error(`"difficulty" must be one of ${DIFFICULTIES.join(', ')}`)
  }

  const startFen = text(raw.startFen)
  if (!startFen) throw new Error('missing "startFen"')
  if (!isStringArray(raw.keyMoves) || raw.keyMoves.length === 0) throw new Error('"keyMoves" must be a list of moves')
  const keyMoves = raw.keyMoves
  const keyFen = replay(startFen, keyMoves, 'keyMoves').fen()

  if (!Array.isArray(raw.lines) || raw.lines.length === 0) throw new Error('"lines" must be a non-empty list')
  const userColor = side === 'WHITE' ? 'w' : 'b'
  const seenMoves = new Set<string>()

  const lines = raw.lines.map((item: unknown, index): ParsedLine => {
    const label = `line ${index + 1}`
    if (!isRecord(item)) throw new Error(`${label}: not an object`)
    const name = text(item.name)
    if (!name) throw new Error(`${label}: missing "name"`)
    if (!isStringArray(item.moves) || item.moves.length === 0) throw new Error(`${label}: "moves" must be a list of moves`)
    const moves = item.moves

    if (!keyMoves.every((san, i) => moves[i] === san)) {
      throw new Error(`${label}: does not start with the course key moves (${keyMoves.join(' ')})`)
    }
    const chess = replay(startFen, moves, label)
    // After the user's last move it is the opponent's turn.
    if (chess.turn() === userColor) throw new Error(`${label}: must end on a ${side.toLowerCase()} move`)

    const key = moves.join(' ')
    if (seenMoves.has(key)) throw new Error(`${label}: duplicates an earlier line`)
    seenMoves.add(key)

    const comments: Record<string, string> = {}
    if (item.comments !== undefined) {
      if (!isRecord(item.comments)) throw new Error(`${label}: "comments" must be an object of { ply: text }`)
      for (const [ply, value] of Object.entries(item.comments)) {
        const n = Number(ply)
        if (!Number.isInteger(n) || n < 1 || n > moves.length) {
          throw new Error(`${label}: comment key "${ply}" is not a ply between 1 and ${moves.length}`)
        }
        if (typeof value !== 'string') throw new Error(`${label}: comment at ply ${ply} must be text`)
        if (value.trim()) comments[String(n)] = value.trim()
      }
    }

    // Order follows the file, so reordering or pruning lines by hand just works.
    return { order: index + 1, name, moves, comments, finalFen: chess.fen() }
  })

  return {
    slug,
    title,
    pitch: text(raw.pitch),
    description: text(raw.description),
    side,
    difficulty: difficulty as ParsedCourse['difficulty'],
    startFen,
    keyMoves,
    firstMove: keyMoves[0],
    keyFen,
    lines,
  }
}
