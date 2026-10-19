import { Chess } from 'chess.js'
import type { Db, Explorer } from './explorer.ts'
import { gamesOf } from './explorer.ts'
import type { Engine } from './stockfish.ts'

// Finds opponent mistakes inside a course's own move tree that allow a forced
// checkmate, and turns each into a course line that ends in mate.

export type CourseLine = { name: string; moves: string[] }

/** A position where it is the opponent's turn, reached by following the course. */
export type OpponentNode = {
  moves: string[]
  /** Replies the course already prepares for here. */
  covered: Set<string>
  /** Name of a course line through this position, for naming the new line. */
  lineName: string
}

export type MateLine = {
  name: string
  moves: string[]
  /** 1-based index of the opponent's mistake in `moves`. */
  mistakePly: number
  mateIn: number
  games: number
  share: number
  comments: Record<string, string>
}

export type Options = {
  /** Longest mate to accept, in the user's moves. */
  maxMate: number
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

function toUci(moves: string[]): { ucis: string[]; chess: Chess } {
  const chess = new Chess()
  const ucis = moves.map((san) => {
    const m = chess.move(san)
    return m.from + m.to + (m.promotion ?? '')
  })
  return { ucis, chess }
}

const numbered = (ply: number, san: string) => (ply % 2 === 0 ? `${ply / 2 + 1}. ${san}` : `${Math.floor(ply / 2) + 1}... ${san}`)

/** Checks one opponent position for replies people play that lose to a forced mate. */
export async function matesFrom(node: OpponentNode, explorer: Explorer, engine: Engine, options: Options): Promise<MateLine[]> {
  const { ucis } = toUci(node.moves)
  const stats = await explorer.query(options.db, ucis)
  const total = stats.moves.reduce((n, m) => n + gamesOf(m), 0)
  const found: MateLine[] = []

  for (const reply of stats.moves) {
    const games = gamesOf(reply)
    const share = total > 0 ? games / total : 0
    if (node.covered.has(reply.san) || games < options.minGames || share < options.minShare) continue

    const chess = new Chess()
    for (const san of node.moves) chess.move(san)
    chess.move(reply.san)
    const { mate, pv } = await engine.analyse(chess.fen(), options.depth)
    if (mate === null || mate <= 0 || mate > options.maxMate) continue

    // Play the engine's line (the user's fastest mate against the best defence) and confirm it really is mate.
    const moves = [...node.moves, reply.san]
    try {
      for (const uci of pv) {
        const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
        moves.push(m.san)
        if (chess.isCheckmate()) break
      }
    } catch {
      continue
    }
    if (!chess.isCheckmate()) continue

    const mistakePly = node.moves.length + 1
    const label = numbered(node.moves.length, reply.san)
    found.push({
      name: `Checkmate: ${node.lineName}: ${label} (mate in ${mate})`,
      moves,
      mistakePly,
      mateIn: mate,
      games,
      share,
      comments: {
        [String(mistakePly)]: `A mistake played in ${Math.max(1, Math.round(share * 100))}% of games here. You have a forced mate in ${mate}.`,
        [String(moves.length)]: 'Checkmate.',
      },
    })
  }
  return found
}

/**
 * Picks the lines to add: most often reached first (games), shorter mates
 * breaking ties, at most one per mistake position so the set is varied.
 */
export function pickMateLines(candidates: MateLine[], count: number): MateLine[] {
  const byPosition = new Map<string, MateLine>()
  for (const c of candidates) {
    const key = c.moves.slice(0, c.mistakePly - 1).join(' ')
    const best = byPosition.get(key)
    if (!best || c.games > best.games || (c.games === best.games && c.mateIn < best.mateIn)) byPosition.set(key, c)
  }
  return [...byPosition.values()].sort((a, b) => b.games - a.games || a.mateIn - b.mateIn).slice(0, count)
}
