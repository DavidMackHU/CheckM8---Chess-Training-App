import type { Explorer, ExplorerResponse } from '../lib/explorer.ts'
import type { Analysis, Engine } from '../lib/stockfish.ts'
import { opponentNodes, pickTraps, type TrapLine, trapsFrom } from '../lib/traps.ts'

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

// After 1.e4 e5 2.Bc4 Nc6 3.Qh5 (White's course covers ...g6):
//  - 3...Nf6?? allows 4.Qxf7# (mate)
//  - 3...Qe7 is fine, 3...a6 is too rare
//  - 3...Nb4 loses: the stand-in engine says White is +3.
const node = { moves: ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5'], covered: new Set(['g6']), lineName: 'Scholar' }
const reply = (san: string, uci: string, games: number) => ({ san, uci, white: games, draws: 0, black: 0 })
const explorer: Explorer = {
  async query(): Promise<ExplorerResponse> {
    return {
      white: 0,
      draws: 0,
      black: 0,
      opening: null,
      moves: [reply('g6', 'g7g6', 500), reply('Nf6', 'g8f6', 300), reply('Qe7', 'd8e7', 150), reply('Nb4', 'c6b4', 50), reply('a6', 'a7a6', 5)],
    }
  },
}
const engine: Engine = {
  async analyse(fen): Promise<Analysis> {
    if (fen.startsWith('r1bqkb1r/pppp1ppp/2n2n2/')) return { mate: 1, cp: null, pv: ['h5f7'] }
    if (fen.includes('/1nB1P3/')) return { mate: null, cp: 300, pv: ['h5e5', 'd8e7', 'e5b5', 'b4c2', 'e1d1'] }
    if (fen.includes(' b ')) return { mate: null, cp: -30, pv: [] } // before the mistake: White slightly better
    return { mate: null, cp: 20, pv: ['g1f3'] }
  },
  quit() {},
}
const options = { maxMate: 5, minAdvantage: 200, minSwing: 150, punishMoves: 2, minGames: 20, minShare: 0.01, depth: 10, db: 'club' as const }

describe('trapsFrom', () => {
  it('turns a mistake that allows mate into a line ending in checkmate', async () => {
    const mate = (await trapsFrom(node, explorer, engine, options)).find((t) => t.kind === 'mate')!
    expect(mate.moves).toEqual(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'])
    expect(mate.name).toBe('Checkmate: Scholar: 3... Nf6 (mate in 1)')
    expect(mate.mistakePly).toBe(6)
    expect(mate.comments['6']).toMatch(/30% of games.*forced mate in 1/)
    expect(mate.comments['7']).toBe('Checkmate.')
  })

  it('turns a losing mistake into a line showing the punishment, ending on the user\'s move', async () => {
    const punish = (await trapsFrom(node, explorer, engine, options)).find((t) => t.kind === 'punish')!
    expect(punish.name).toBe('Punish: Scholar: 3... Nb4 (+3.0)')
    // Two of the user's moves (punishMoves: 2): Qxe5+ ... Qb5 ... and it stops on White's move.
    expect(punish.moves).toEqual(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nb4', 'Qxe5+', 'Qe7', 'Qb5'])
    expect(punish.comments['6']).toMatch(/5% of games/)
    expect(punish.comments['9']).toMatch(/\+3\.0/)
  })

  it('leaves out covered, rare and harmless replies, and fake mates', async () => {
    const found = await trapsFrom(node, explorer, engine, options)
    expect(found.map((t) => t.moves[5]).sort()).toEqual(['Nb4', 'Nf6'])
    const liar: Engine = { analyse: async () => ({ mate: 2, cp: null, pv: ['h5h4'] }), quit() {} }
    expect(await trapsFrom(node, explorer, liar, options)).toEqual([])
    expect(await trapsFrom(node, explorer, engine, { ...options, minGames: 1000 })).toEqual([])
  })
})

describe('pickTraps', () => {
  const trap = (kind: TrapLine['kind'], prefix: string, games: number, mateIn: number | null, gainPawns = 0): TrapLine => ({
    kind,
    name: `${prefix}-${games}-${mateIn ?? gainPawns}`,
    moves: [...prefix.split(' '), 'x', 'y'],
    mistakePly: prefix.split(' ').length + 1,
    position: prefix,
    mateIn,
    gainPawns,
    games,
    share: 0.1,
    comments: {},
  })

  it('keeps one per position, most played first, then shorter mates', () => {
    const picked = pickTraps([trap('mate', 'a b', 50, 3), trap('mate', 'a b', 50, 2), trap('mate', 'c d', 80, 4), trap('mate', 'e f', 10, 1)], 'mate', 2)
    expect(picked.map((p) => p.name)).toEqual(['c d-80-4', 'a b-50-2'])
  })

  it('picks punishing lines separately, bigger advantages breaking ties', () => {
    const all = [trap('mate', 'a b', 999, 1), trap('punish', 'c d', 40, null, 2.5), trap('punish', 'c d', 40, null, 4)]
    expect(pickTraps(all, 'punish', 5).map((p) => p.name)).toEqual(['c d-40-4'])
  })
})
