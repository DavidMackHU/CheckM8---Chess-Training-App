import { Chess } from 'chess.js'
import type { Db, Explorer } from './explorer.ts'
import { gamesOf } from './explorer.ts'
import type { Analysis, Engine } from './stockfish.ts'

// Finds common opponent mistakes inside a course's own move tree and turns
// each into a course line that shows how to punish it:
//  - mate:   the mistake allows a forced checkmate; the line plays it out.
//  - punish: the mistake loses a lot (by Stockfish); the line shows the user's
//            best follow-up for a few moves, ending on the user's move.

export type CourseLine = { name: string; moves: string[] }

/** A position where it is the opponent's turn, reached by following the course. */
export type OpponentNode = {
  moves: string[]
  /** Replies the course already prepares for here. */
  covered: Set<string>
  /** Name of a course line through this position, for naming the new line. */
  lineName: string
}

export type TrapLine = {
  kind: 'mate' | 'punish'
  name: string
  moves: string[]
  /** 1-based index of the opponent's mistake in `moves`. */
  mistakePly: number
  /** The position the mistake was made in (no move counters), so the same mistake reached by another move order counts once. */
  position: string
  /** Mate: moves to mate. Punish: the user's advantage after the mistake, in pawns. */
  mateIn: number | null
  gainPawns: number
  games: number
  share: number
  comments: Record<string, string>
}

export type Options = {
  /** Longest mate to accept, in the user's moves. */
  maxMate: number
  /** A punishing line needs the user at least this far ahead after the mistake, and this much better off than before it (centipawns). */
  minAdvantage: number
  minSwing: number
  /** How many of the user's moves a punishing line shows after the mistake. */
  punishMoves: number
  /** The mistake must appear in at least this many games, and this share of games, in the position. */
  minGames: number
  minShare: number
  depth: number
  /** Which games to take the opponent's mistakes from. */
  db: Db
}

/** Every opponent-to-move position in the course, after the key moves. */
export function opponentNodes(lines: CourseLine[], keyMoves: number, side: 'WHITE' | 'BLACK'): OpponentNode[] {
  const opponentMovesOnEvenPly = side === 'BLACK' // ply 0 is White's first move
  const nodes = new Map<string, OpponentNode>()
  for (const line of lines) {
    for (let ply = keyMoves; ply < line.moves.length; ply++) {
      if ((ply % 2 === 0) !== opponentMovesOnEvenPly) continue
      const prefix = line.moves.slice(0, ply)
      const key = prefix.join(' ')
      const node = nodes.get(key) ?? { moves: prefix, covered: new Set<string>(), lineName: line.name.split(':')[0] }
      node.covered.add(line.moves[ply])
      nodes.set(key, node)
    }
  }
  return [...nodes.values()]
}

const numbered = (ply: number, san: string) => (ply % 2 === 0 ? `${ply / 2 + 1}. ${san}` : `${Math.floor(ply / 2) + 1}... ${san}`)

/** A score for the side to move, in centipawns, with mates counted as huge. */
const scoreOf = (a: Analysis) => (a.mate !== null ? Math.sign(a.mate) * 100_000 : (a.cp ?? 0))

/** Plays UCI moves onto `chess`, adding SAN to `moves`. Stops early at mate, or after `limit` moves. False if a move is illegal. */
function playPv(chess: Chess, moves: string[], pv: string[], limit = Infinity): boolean {
  try {
    for (const uci of pv.slice(0, limit)) {
      moves.push(chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san)
      if (chess.isCheckmate()) break
    }
    return true
  } catch {
    return false
  }
}

/** Checks one opponent position for replies people play that lose to mate, or lose badly. */
export async function trapsFrom(node: OpponentNode, explorer: Explorer, engine: Engine, options: Options): Promise<TrapLine[]> {
  const chess = new Chess()
  const ucis = node.moves.map((san) => {
    const m = chess.move(san)
    return m.from + m.to + (m.promotion ?? '')
  })
  const stats = await explorer.query(options.db, ucis)
  const total = stats.moves.reduce((n, m) => n + gamesOf(m), 0)
  const replies = stats.moves.filter((r) => {
    const games = gamesOf(r)
    return !node.covered.has(r.san) && games >= options.minGames && total > 0 && games / total >= options.minShare
  })
  if (replies.length === 0) return []

  // The opponent's best here, seen from the user's side: how good things were before the mistake.
  const before = -scoreOf(await engine.analyse(chess.fen(), options.depth))
  const found: TrapLine[] = []

  for (const reply of replies) {
    const games = gamesOf(reply)
    const share = games / total
    const board = new Chess(chess.fen())
    board.move(reply.san)
    const after = await engine.analyse(board.fen(), options.depth)
    const mistakePly = node.moves.length + 1
    const position = chess.fen().split(' ').slice(0, 4).join(' ')
    const label = numbered(node.moves.length, reply.san)
    const percent = Math.max(1, Math.round(share * 100))
    const moves = [...node.moves, reply.san]

    if (after.mate !== null && after.mate > 0 && after.mate <= options.maxMate) {
      // The user's fastest mate against the best defence, checked to really be mate.
      if (!playPv(board, moves, after.pv) || !board.isCheckmate()) continue
      found.push({
        kind: 'mate',
        name: `Checkmate: ${node.lineName}: ${label} (mate in ${after.mate})`,
        moves,
        mistakePly,
        position,
        mateIn: after.mate,
        gainPawns: 0,
        games,
        share,
        comments: {
          [String(mistakePly)]: `A mistake played in ${percent}% of games here. You have a forced mate in ${after.mate}.`,
          [String(moves.length)]: 'Checkmate.',
        },
      })
      continue
    }

    const score = scoreOf(after)
    if (after.mate !== null || score < options.minAdvantage || score - before < options.minSwing) continue
    // Show the user's best follow-up: user, opponent, user... ending on the user's move.
    if (!playPv(board, moves, after.pv, options.punishMoves * 2 - 1)) continue
    if ((moves.length - mistakePly) % 2 === 0) moves.pop()
    if (moves.length === mistakePly) continue
    const pawns = Math.round(score / 10) / 10
    found.push({
      kind: 'punish',
      name: `Punish: ${node.lineName}: ${label} (+${pawns.toFixed(1)})`,
      moves,
      mistakePly,
      position,
      mateIn: null,
      gainPawns: pawns,
      games,
      share,
      comments: {
        [String(mistakePly)]: `A common mistake, played in ${percent}% of games here. Find the move that punishes it.`,
        [String(moves.length)]: `You are clearly better now: about +${pawns.toFixed(1)} by the engine.`,
      },
    })
  }
  return found
}

/**
 * Picks the lines to add, of one kind: most often reached first (games),
 * then shorter mates or bigger advantages, at most one per position (however it was reached).
 */
export function pickTraps(candidates: TrapLine[], kind: TrapLine['kind'], count: number): TrapLine[] {
  const better = (a: TrapLine, b: TrapLine) =>
    b.games - a.games || (kind === 'mate' ? (a.mateIn ?? 0) - (b.mateIn ?? 0) : b.gainPawns - a.gainPawns)
  const byPosition = new Map<string, TrapLine>()
  for (const c of candidates.filter((t) => t.kind === kind)) {
    const key = c.position
    const best = byPosition.get(key)
    if (!best || better(c, best) < 0) byPosition.set(key, c)
  }
  return [...byPosition.values()].sort(better).slice(0, count)
}
