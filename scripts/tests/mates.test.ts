import type { Explorer, ExplorerResponse } from '../lib/explorer.ts'
import { type MateLine, matesFrom, opponentNodes, pickMateLines } from '../lib/mates.ts'
import type { Engine } from '../lib/stockfish.ts'

const lines = [
  { name: 'Italian Game: Main', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3'] },
  { name: 'Italian Game: Two Knights', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3'] },
]

describe('opponentNodes', () => {
  it('lists each opponent-to-move position once, with the replies the course covers', () => {
    const nodes = opponentNodes(lines, 5, 'WHITE')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].moves).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'])
    expect([...nodes[0].covered].sort()).toEqual(['Bc5', 'Nf6'])
    expect(nodes[0].lineName).toBe('Italian Game')
  })

  it('finds White to move for a Black course', () => {
    const nodes = opponentNodes([{ name: 'Caro-Kann', moves: ['e4', 'c6', 'd4', 'd5'] }], 2, 'BLACK')
    expect(nodes.map((n) => n.moves.join(' '))).toEqual(['e4 c6'])
  })
})

// Scholar's mate setup: after 1.e4 e5 2.Bc4 Nc6 3.Qh5, the reply 3...Nf6?? allows 4.Qxf7#.
const scholar = { moves: ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5'], covered: new Set(['g6']), lineName: 'Scholar' }
const reply = (san: string, uci: string, games: number) => ({ san, uci, white: games, draws: 0, black: 0 })
const explorer: Explorer = {
  async query(): Promise<ExplorerResponse> {
    return {
      white: 0,
      draws: 0,
      black: 0,
      opening: null,
      moves: [reply('g6', 'g7g6', 500), reply('Nf6', 'g8f6', 300), reply('Qe7', 'd8e7', 150), reply('a6', 'a7a6', 5)],
    }
  },
}
const engine: Engine = {
  async analyse(fen) {
    // Only the position after ...Nf6 has a mate; the stand-in returns Qxf7#.
    return fen.startsWith('r1bqkb1r/pppp1ppp/2n2n2/') ? { mate: 1, pv: ['h5f7'] } : { mate: null, pv: [] }
  },
  quit() {},
}
const options = { maxMate: 5, minGames: 20, minShare: 0.01, depth: 10, db: 'club' as const }

describe('matesFrom', () => {
  it('turns a common mistake that allows mate into a line ending in checkmate', async () => {
    const found = await matesFrom(scholar, explorer, engine, options)
    expect(found).toHaveLength(1)
    const [line] = found
    expect(line.moves).toEqual(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'])
    expect(line.name).toBe('Checkmate: Scholar: 3... Nf6 (mate in 1)')
    expect(line.mistakePly).toBe(6)
    expect(line.share).toBeCloseTo(300 / 955)
    expect(line.comments['6']).toMatch(/31% of games.*forced mate in 1/)
    expect(line.comments['7']).toBe('Checkmate.')
  })

  it('skips replies the course covers, rare replies, and engine lines that are not really mate', async () => {
    const liar: Engine = { analyse: async () => ({ mate: 2, pv: ['h5h4'] }), quit() {} }
    expect(await matesFrom(scholar, explorer, liar, options)).toEqual([])
    expect(await matesFrom(scholar, explorer, engine, { ...options, minGames: 1000 })).toEqual([])
  })
})

describe('pickMateLines', () => {
  const line = (prefix: string, games: number, mateIn: number): MateLine => ({
    name: `${prefix}-${games}-${mateIn}`,
    moves: [...prefix.split(' '), 'x', 'y'],
    mistakePly: prefix.split(' ').length + 1,
    mateIn,
    games,
    share: 0.1,
    comments: {},
  })

  it('keeps one per position, most played first, shorter mates breaking ties', () => {
    const picked = pickMateLines([line('a b', 50, 3), line('a b', 50, 2), line('c d', 80, 4), line('e f', 10, 1)], 2)
    expect(picked.map((p) => p.name)).toEqual(['c d-80-4', 'a b-50-2'])
  })
})
