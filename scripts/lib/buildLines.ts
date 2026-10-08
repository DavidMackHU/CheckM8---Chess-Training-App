import { Chess } from 'chess.js'
import { type Explorer, type ExplorerResponse, gamesOf } from './explorer.ts'

export type BuildOptions = {
  side: 'white' | 'black'
  /** Moves (SAN) from the starting position that define the opening. */
  keyMoves: string[]
  /** Lines never exceed this many plies and always end on the user's move. */
  maxPly: number
  /** Stop deepening once the course has this many lines. */
  maxLines: number
  /** An opponent reply needs at least this share of games... */
  minShare: number
  /** ...and at least this many games to be included. */
  minGames: number
  /** Below this many master games, fall back to strong Lichess players. */
  minMasterGames: number
  log?: (message: string) => void
}

export type BuiltLine = {
  name: string
  moves: string[]
  finalFen: string
  /** Rough share of club games that follow this line from the key position. */
  frequency: number
  /** Ply up to which the line was chosen by branching. Moves after it follow the most common replies. */
  branchPly: number
}

type Node = { sans: string[]; ucis: string[]; prob: number; name: string; done: boolean }

function replay(sans: string[]): Chess {
  const chess = new Chess()
  for (const san of sans) chess.move(san)
  return chess
}

/** Plays one SAN move and returns it in UCI. Throws if the move is illegal. */
function sanToUci(sans: string[], san: string): string {
  const move = replay(sans).move(san)
  return move.from + move.to + (move.promotion ?? '')
}

function topMove(res: ExplorerResponse) {
  return res.moves.reduce<ExplorerResponse['moves'][number] | null>(
    (best, m) => (!best || gamesOf(m) > gamesOf(best) ? m : best),
    null,
  )
}

/**
 * Builds a repertoire tree.
 *  - User's side: the most-played master move (strong Lichess players as fallback).
 *  - Opponent's side: every reply that club players actually play often enough.
 * Positions are expanded most-common-first until `maxLines` is reached. Each
 * line is then deepened along the opponent's most common replies up to `maxPly`.
 */
export async function buildLines(explorer: Explorer, opts: BuildOptions): Promise<BuiltLine[]> {
  const log = opts.log ?? (() => {})
  const userColor = opts.side === 'white' ? 'w' : 'b'

  /**
   * `skipMasters` avoids a wasted request once a line has left master practice:
   * positions further down the same line will not have master games either.
   */
  async function pickUserMove(ucis: string[], skipMasters = false) {
    const masters = skipMasters ? null : await explorer.query('masters', ucis)
    if (masters && gamesOf(masters) >= opts.minMasterGames) {
      const move = topMove(masters)
      if (move) return { move, opening: masters.opening, fromMasters: true }
    }
    const strong = await explorer.query('strong', ucis)
    const move = topMove(strong)
    return move ? { move, opening: strong.opening ?? masters?.opening ?? null, fromMasters: false } : null
  }

  // Root: the key moves, plus the user's reply if the key moves end on the opponent's move.
  const rootSans: string[] = []
  const rootUcis: string[] = []
  for (const san of opts.keyMoves) {
    rootUcis.push(sanToUci(rootSans, san))
    rootSans.push(san)
  }
  let rootName = opts.keyMoves.join(' ')
  if (replay(rootSans).turn() === userColor) {
    const picked = await pickUserMove(rootUcis)
    if (!picked) throw new Error('No games found after the key moves. Check --moves.')
    rootSans.push(picked.move.san)
    rootUcis.push(picked.move.uci)
    rootName = picked.opening?.name ?? rootName
  }

  const nodes: Node[] = [{ sans: rootSans, ucis: rootUcis, prob: 1, name: rootName, done: false }]

  for (;;) {
    // Most common unfinished line first.
    const node = nodes.filter((n) => !n.done).sort((a, b) => b.prob - a.prob)[0]
    if (!node) break
    node.done = true
    if (node.sans.length + 2 > opts.maxPly) continue

    const club = await explorer.query('club', node.ucis)
    if (club.opening) node.name = club.opening.name
    const total = gamesOf(club)
    const replies = club.moves.filter((m) => gamesOf(m) >= opts.minGames && gamesOf(m) / total >= opts.minShare)

    if (replies.length === 0) continue
    // Check the cap before looking up answers, so no requests are spent on branches we would discard.
    if (nodes.length - 1 + replies.length > opts.maxLines) continue

    const children: Node[] = []
    for (const reply of replies) {
      const ucis = [...node.ucis, reply.uci]
      const picked = await pickUserMove(ucis)
      if (!picked) continue // Nobody has played on from here; cannot end on the user's move.
      children.push({
        sans: [...node.sans, reply.san, picked.move.san],
        ucis: [...ucis, picked.move.uci],
        prob: (node.prob * gamesOf(reply)) / total,
        name: picked.opening?.name ?? node.name,
        done: false,
      })
    }
    if (children.length === 0) continue

    nodes.splice(nodes.indexOf(node), 1, ...children)
    log(`${nodes.length} lines  (expanded: ${node.sans.join(' ')})`)
  }

  // Phase 2: the line budget is spent, but lines may still be short. Carry each
  // one on down the opponent's single most common reply until it reaches full
  // depth or the game data runs out. No new lines are created here.
  const branchPly = new Map<Node, number>()
  let extended = 0
  for (const node of nodes) {
    branchPly.set(node, node.sans.length)
    let mastersDry = false
    while (node.sans.length + 2 <= opts.maxPly) {
      const club = await explorer.query('club', node.ucis)
      const replies = club.moves
        .filter((m) => gamesOf(m) >= opts.minGames)
        .sort((x, y) => gamesOf(y) - gamesOf(x))
        .slice(0, 2)
      let next: { reply: (typeof replies)[number]; picked: NonNullable<Awaited<ReturnType<typeof pickUserMove>>> } | null = null
      for (const reply of replies) {
        const picked = await pickUserMove([...node.ucis, reply.uci], mastersDry)
        if (picked) {
          next = { reply, picked }
          break
        }
      }
      if (!next) break
      node.sans.push(next.reply.san, next.picked.move.san)
      node.ucis.push(next.reply.uci, next.picked.move.uci)
      if (next.picked.opening) node.name = next.picked.opening.name
      if (!next.picked.fromMasters) mastersDry = true
    }
    extended++
    if (extended % 10 === 0) log(`Deepened ${extended} of ${nodes.length} lines`)
  }

  return nodes
    .sort((a, b) => b.prob - a.prob)
    .map((n) => ({
      name: n.name,
      moves: n.sans,
      finalFen: replay(n.sans).fen(),
      frequency: Number(n.prob.toFixed(4)),
      branchPly: branchPly.get(n) ?? n.sans.length,
    }))
}
