import { formatScore, parseInfo, whiteShare } from '../src/lib/chess/engine.ts'
import { readPgn, sanFor, squaresFor, START_FEN, toPgn } from '../src/lib/chess/game.ts'
import { formatMoves } from '../src/lib/courses.ts'
import { courseReplies, type HumanStats, pickReply } from '../src/lib/human.ts'
import { addMove, type EditorLine, findNode, linesToTree, mergeLines, patchNode, removeMove, treeToLines } from '../src/lib/moveTree.ts'

const line = (moves: string, extra: Partial<EditorLine> = {}): EditorLine => ({
  name: '',
  moves: moves.split(' '),
  comments: {},
  ...extra,
})
const moveLists = (lines: EditorLine[]) => lines.map((l) => l.moves.join(' '))

describe('move tree', () => {
  const lines = [
    line('d4 d5 Bf4 Nf6 e3', { name: 'Main', comments: { '3': 'The bishop.' } }),
    line('d4 d5 Bf4 c5 e3', { name: 'With c5' }),
    line('d4 d5 Bf4 c5 c3'),
  ]

  it('round-trips lines through the tree', () => {
    const back = treeToLines(linesToTree(lines))
    expect(moveLists(back)).toEqual(moveLists(lines))
    expect(back[0]).toMatchObject({ name: 'Main', comments: { '3': 'The bishop.' } })
    // A comment on a shared move belongs to every line through it.
    expect(back[1].comments).toEqual({ '3': 'The bishop.' })
    expect(back[1].name).toBe('With c5')
  })

  it('adds a move as a new branch, and ignores one that already exists', () => {
    const tree = linesToTree(lines)
    const added = addMove(tree, ['d4', 'd5'], 'c4')
    expect(moveLists(treeToLines(added))).toContain('d4 d5 c4')
    expect(treeToLines(addMove(added, ['d4', 'd5'], 'c4'))).toHaveLength(4)
    expect(treeToLines(tree)).toHaveLength(3) // the original is untouched
  })

  it('removes a move together with everything after it', () => {
    const pruned = removeMove(linesToTree(lines), ['d4', 'd5', 'Bf4', 'c5'])
    expect(moveLists(treeToLines(pruned))).toEqual(['d4 d5 Bf4 Nf6 e3'])
    expect(removeMove(linesToTree(lines), [])).toHaveLength(1)
  })

  it('edits comments and line names in place', () => {
    const tree = patchNode(linesToTree(lines), ['d4'], { comment: 'Centre.' })
    expect(findNode(tree, ['d4'])?.comment).toBe('Centre.')
    expect(treeToLines(tree).every((l) => l.comments['1'] === 'Centre.')).toBe(true)
    const named = patchNode(tree, ['d4', 'd5', 'Bf4', 'c5', 'c3'], { lineName: 'Slav style' })
    expect(treeToLines(named)[2].name).toBe('Slav style')
    expect(findNode(tree, ['e4'])).toBeNull()
  })

  it('merges imported lines without duplicating shared moves', () => {
    const merged = mergeLines(linesToTree(lines), [line('d4 d5 Bf4 Nf6 e3'), line('e4 e5 Nf3')])
    expect(moveLists(treeToLines(merged))).toEqual([...moveLists(lines), 'e4 e5 Nf3'])
  })
})

describe('human moves', () => {
  const course = [{ moves: ['d4', 'd5', 'Bf4', 'Nf6', 'e3'] }, { moves: ['d4', 'd5', 'Bf4', 'c5', 'e3'] }, { moves: ['d4', 'd5', 'Bf4', 'c5', 'c3'] }, { moves: ['d4', 'Nf6', 'Bf4'] }]
  const stats: HumanStats = {
    total: 1000,
    moves: [
      { san: 'Nf6', uci: '', games: 600 },
      { san: 'c5', uci: '', games: 100 },
      { san: 'e6', uci: '', games: 300 },
    ],
  }
  /** A fixed pseudo-random sequence, so the distribution checks are repeatable. */
  function seeded() {
    let seed = 42
    return () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
  }
  function tally(mayLeave: boolean, data: HumanStats | null, runs = 6000) {
    const random = seeded()
    const counts: Record<string, number> = {}
    let outOfBook = 0
    for (let i = 0; i < runs; i++) {
      const reply = pickReply(['Nf6', 'c5'], data, mayLeave, random)
      counts[reply.san] = (counts[reply.san] ?? 0) + 1
      if (!reply.inBook) outOfBook++
    }
    return { counts, outOfBook, runs }
  }

  it('lists the course moves available after a given start', () => {
    expect(courseReplies(course, [])).toEqual(['d4'])
    expect(courseReplies(course, ['d4'])).toEqual(['d5', 'Nf6'])
    expect(courseReplies(course, ['d4', 'd5', 'Bf4', 'c5'])).toEqual(['e3', 'c3'])
    expect(courseReplies(course, ['d4', 'Nf6', 'Bf4'])).toEqual([])
    expect(courseReplies(course, ['e4'])).toEqual([])
  })

  it('stays in the course and follows real frequencies by default', () => {
    const { counts, outOfBook, runs } = tally(false, stats)
    expect(counts.e6).toBeUndefined()
    expect(outOfBook).toBe(0)
    expect(counts.Nf6 / runs).toBeCloseTo(6 / 7, 1)
  })

  it('can leave the course when allowed, in proportion to real play', () => {
    const { counts, outOfBook, runs } = tally(true, stats)
    expect(counts.Nf6 / runs).toBeCloseTo(0.6, 1)
    expect(outOfBook / runs).toBeCloseTo(0.3, 1)
  })

  it('picks evenly when there is no data', () => {
    const { counts, runs } = tally(false, null)
    expect(counts.Nf6 / runs).toBeCloseTo(0.5, 1)
    expect(pickReply(['Nf6'], null, false).share).toBeNull()
  })

  it('still plays a course move nobody plays, but rarely', () => {
    const { counts, runs } = tally(false, { total: 1000, moves: [{ san: 'Nf6', uci: '', games: 1000 }] })
    expect(counts.c5).toBeGreaterThan(0)
    expect(counts.c5 / runs).toBeLessThan(0.03)
  })

  it('reports the true share of the chosen move', () => {
    expect(pickReply(['c5'], stats, false).share).toBe(0.1)
  })
})

describe('chess helpers', () => {
  it('names a move in a position without changing anything', () => {
    expect(sanFor(START_FEN, { from: 'g1', to: 'f3' })).toBe('Nf3')
    expect(sanFor(START_FEN, { from: 'e2', to: 'e5' })).toBeNull()
    expect(sanFor('8/P7/8/8/8/8/8/k6K w - - 0 1', { from: 'a7', to: 'a8', promotion: 'n' })).toBe('a8=N')
  })

  it('finds the squares of a move for drawing an arrow', () => {
    expect(squaresFor(START_FEN, 'Nf3')).toEqual({ from: 'g1', to: 'f3' })
    expect(squaresFor(START_FEN, 'Qh5')).toBeNull()
  })

  it('writes and reads PGN, including games from a custom position', () => {
    const pgn = toPgn(START_FEN, ['e4', 'e5', 'Nf3'])
    expect(pgn).toContain('1. e4 e5 2. Nf3')
    expect(readPgn(pgn)).toEqual({ startFen: START_FEN, moves: ['e4', 'e5', 'Nf3'] })

    const custom = '6k1/5ppp/8/8/8/8/8/R6K w - - 0 1'
    const customPgn = toPgn(custom, ['Ra7'])
    expect(customPgn).toContain(`[FEN "${custom}"]`)
    expect(readPgn(customPgn)).toEqual({ startFen: custom, moves: ['Ra7'] })
  })

  it('reads only the main line of a PGN and refuses nonsense', () => {
    expect(readPgn('1. e4 e5 2. Nf3 Nc6 (2... d6) 3. Bb5 {Ruy Lopez} a6 *')?.moves).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'])
    expect(readPgn('nonsense')).toBeNull()
    expect(toPgn(START_FEN, [])).toBe('')
  })

  it('numbers moves for display', () => {
    expect(formatMoves(['d4', 'd5', 'Bf4'])).toBe('1. d4 d5 2. Bf4')
  })
})

describe('engine output', () => {
  const blackToMove = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

  it('reads a score and turns the line into normal notation', () => {
    const info = parseInfo('info depth 12 seldepth 18 multipv 1 score cp 31 nodes 1 pv e2e4 e7e5 g1f3', START_FEN)
    expect(info).toMatchObject({ depth: 12, cp: 31, mate: null, line: ['e4', 'e5', 'Nf3'], best: { from: 'e2', to: 'e4' } })
  })

  it('always reports scores from the White side', () => {
    expect(parseInfo('info depth 10 score cp 50 pv e7e5', blackToMove)?.cp).toBe(-50)
    expect(parseInfo('info depth 10 score mate 2 pv e7e5', blackToMove)?.mate).toBe(-2)
  })

  it('ignores lines without a score or a move list, and stops at an impossible move', () => {
    expect(parseInfo('info depth 5 currmove e2e4 currmovenumber 1', START_FEN)).toBeNull()
    expect(parseInfo('info string NNUE evaluation enabled', START_FEN)).toBeNull()
    expect(parseInfo('info depth 3 score cp 10 pv e2e4 e2e4', START_FEN)?.line).toEqual(['e4'])
  })

  it('handles promotions in the engine line', () => {
    expect(parseInfo('info depth 4 score mate 3 pv a7a8q', '8/P7/8/8/8/8/8/k6K w - - 0 1')?.line).toEqual(['a8=Q+'])
  })

  it('formats scores and sizes the evaluation bar', () => {
    expect(formatScore({ cp: 34, mate: null })).toBe('+0.3')
    expect(formatScore({ cp: -120, mate: null })).toBe('-1.2')
    expect(formatScore({ cp: 0, mate: null })).toBe('0.0')
    expect(formatScore({ cp: null, mate: 5 })).toBe('M5')
    expect(formatScore({ cp: null, mate: -3 })).toBe('-M3')
    expect(whiteShare({ cp: 0, mate: null })).toBe(50)
    expect(whiteShare({ cp: null, mate: 1 })).toBe(100)
    expect(whiteShare({ cp: null, mate: -1 })).toBe(0)
    expect(whiteShare({ cp: 100, mate: null })).toBeGreaterThan(55)
    expect(whiteShare({ cp: 5000, mate: null })).toBe(97) // never quite full without a mate
  })
})
