import { Chess } from 'chess.js'

/** One root-to-leaf path through a PGN, with any comments keyed by ply (1-based). */
export type PgnLine = { moves: string[]; comments: Record<string, string> }

type Node = { san: string; children: Map<string, Node>; comment?: string }

// Order matters: results and headers must be tried before the catch-all move pattern.
const TOKEN =
  /\{([^}]*)\}|;[^\n]*|\[[^\]]*\]|1-0|0-1|1\/2-1\/2|\*|\(|\)|\$\d+|\d+\.+|[^\s(){};]+/g

export const MAX_PGN_CHARS = 200_000
const MAX_LEAVES = 500

function replay(path: string[]): Chess {
  const chess = new Chess()
  for (const san of path) chess.move(san)
  return chess
}

function nodeAt(root: Node, path: string[]): Node {
  let node = root
  for (const san of path) node = node.children.get(san)!
  return node
}

/**
 * Reads PGN text (one or more games, with nested variations and comments) into
 * a list of lines: every leaf of the move tree becomes one line. Games must
 * start from the normal starting position. Throws a readable error on the
 * first illegal move.
 */
export function parsePgn(pgn: string): PgnLine[] {
  if (pgn.length > MAX_PGN_CHARS) throw new Error('That PGN is too large. Split it into smaller files.')

  const root: Node = { san: '', children: new Map() }
  let path: string[] = []
  const stack: string[][] = []
  let game = 1
  let movesInGame = 0

  const endGame = () => {
    if (movesInGame > 0) game++
    movesInGame = 0
    path = []
    stack.length = 0
  }

  for (const match of pgn.matchAll(TOKEN)) {
    const token = match[0]
    if (token.startsWith('{')) {
      const text = match[1].replace(/\s+/g, ' ').trim()
      if (text && path.length > 0) {
        const node = nodeAt(root, path)
        node.comment = node.comment ? `${node.comment} ${text}` : text
      }
    } else if (token.startsWith(';') || token.startsWith('$') || /^\d+\.+$/.test(token)) {
      // Line comment, annotation glyph or move number: nothing to do.
    } else if (token.startsWith('[')) {
      if (movesInGame > 0) endGame() // A header after moves starts the next game.
    } else if (token === '1-0' || token === '0-1' || token === '1/2-1/2' || token === '*') {
      endGame()
    } else if (token === '(') {
      if (path.length === 0) throw new Error(`Game ${game}: a variation starts before any move.`)
      stack.push(path)
      path = path.slice(0, -1) // A variation replaces the move just played.
    } else if (token === ')') {
      const outer = stack.pop()
      if (!outer) throw new Error(`Game ${game}: unmatched ")".`)
      path = outer
    } else {
      // A move. Drop annotation marks and accept castling written with zeros.
      const written = token.replace(/[!?]+$/, '').replace(/^0-0-0/, 'O-O-O').replace(/^0-0/, 'O-O')
      let san: string
      try {
        san = replay(path).move(written).san
      } catch {
        const where = path.length > 0 ? `after ${path.join(' ')}` : 'as the first move'
        throw new Error(`Game ${game}: "${token}" is not a legal move ${where}.`)
      }
      const parent = nodeAt(root, path)
      if (!parent.children.has(san)) parent.children.set(san, { san, children: new Map() })
      path = [...path, san]
      movesInGame++
    }
  }
  if (stack.length > 0) throw new Error(`Game ${game}: a "(" is never closed.`)

  const lines: PgnLine[] = []
  const walk = (node: Node, moves: string[], comments: Record<string, string>) => {
    if (node.children.size === 0) {
      if (moves.length > 0) lines.push({ moves, comments })
      return
    }
    for (const child of node.children.values()) {
      const nextMoves = [...moves, child.san]
      walk(child, nextMoves, child.comment ? { ...comments, [nextMoves.length]: child.comment } : comments)
      if (lines.length > MAX_LEAVES) throw new Error(`That PGN has more than ${MAX_LEAVES} lines. Trim it first.`)
    }
  }
  walk(root, [], {})
  if (lines.length === 0) throw new Error('No moves found in that PGN.')
  return lines
}
