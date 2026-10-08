import { parseCourseFile } from '../src/content/courseFile.js'
import { cleanLines, keyPosition, START_FEN } from '../src/content/lines.js'
import { parsePgn } from '../src/content/pgn.js'
import { parseLogin, parseRegister } from '../src/lib/validation.js'

const show = (lines: { moves: string[] }[]) => lines.map((l) => l.moves.join(' ')).join(' | ')

const NESTED = `[Event "Test"]
[White "A"]

1. d4 d5 2. Bf4 {The London bishop.} Nf6 (2... c5 3. e3 {Solid.} (3. c3 Nc6) 3... Nc6) 3. e3! e6?! $1 4. Nf3 *`

describe('parsePgn', () => {
  it('turns nested variations into one line per leaf', () => {
    expect(show(parsePgn(NESTED))).toBe('d4 d5 Bf4 Nf6 e3 e6 Nf3 | d4 d5 Bf4 c5 e3 Nc6 | d4 d5 Bf4 c5 c3 Nc6')
  })

  it('keeps comments, keyed by ply, on every line that passes through the move', () => {
    const lines = parsePgn(NESTED)
    expect(lines[0].comments).toEqual({ '3': 'The London bishop.' })
    expect(lines[1].comments).toEqual({ '3': 'The London bishop.', '5': 'Solid.' })
  })

  it('merges several games into one tree', () => {
    const pgn = '[Event "g1"]\n1. e4 e5 2. Nf3 1-0\n\n[Event "g2"]\n1. e4 c5 2. Nf3 d6 *\n\n1.e4 e5 2.Nc3'
    expect(show(parsePgn(pgn))).toBe('e4 e5 Nf3 | e4 e5 Nc3 | e4 c5 Nf3 d6')
  })

  it('accepts castling written with zeros, move numbers without spaces and line comments', () => {
    expect(show(parsePgn('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. 0-0 Nf6'))).toMatch(/O-O Nf6$/)
    expect(show(parsePgn('1.d4 d5 ; ignored\n2.c4'))).toBe('d4 d5 c4')
  })

  it('reports an illegal move with its context', () => {
    expect(() => parsePgn('1. e4 e5 2. Ke3')).toThrow('Game 1: "Ke3" is not a legal move after e4 e5.')
  })

  it('rejects unbalanced brackets and empty input', () => {
    expect(() => parsePgn('1. e4 (1. d4 d5')).toThrow(/never closed/)
    expect(() => parsePgn('1. e4 ) e5')).toThrow(/unmatched/)
    expect(() => parsePgn('[Event "x"]\n*')).toThrow('No moves found in that PGN.')
  })
})

describe('cleanLines', () => {
  it('drops a trailing opponent move and says so', () => {
    const white = cleanLines(parsePgn(NESTED), 'WHITE')
    expect(show(white.lines)).toBe('d4 d5 Bf4 Nf6 e3 e6 Nf3 | d4 d5 Bf4 c5 e3 | d4 d5 Bf4 c5 c3')
    expect(white.warnings).toHaveLength(2)
    expect(white.warnings[0]).toContain("opponent's")
    // The comment on the dropped move goes with it; earlier ones stay.
    expect(white.lines[1].comments).toEqual({ '3': 'The London bishop.', '5': 'Solid.' })
  })

  it('trims for Black too', () => {
    expect(show(cleanLines(parsePgn(NESTED), 'BLACK').lines)).toBe(
      'd4 d5 Bf4 Nf6 e3 e6 | d4 d5 Bf4 c5 e3 Nc6 | d4 d5 Bf4 c5 c3 Nc6',
    )
  })

  it('merges duplicates and lines contained in a longer one', () => {
    const raw = [{ moves: ['e4', 'e5', 'Nf3'] }, { moves: ['e4', 'e5', 'Nf3'] }, { moves: ['e4'] }, { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] }]
    expect(show(cleanLines(raw, 'WHITE').lines)).toBe('e4 e5 Nf3 Nc6 Bb5')
  })

  it('names unnamed lines and trims given names', () => {
    const names = cleanLines([{ moves: ['e4'] }, { moves: ['d4'], name: '  Queen pawn  ' }], 'WHITE').lines.map((l) => l.name)
    expect(names).toEqual(['Line 1', 'Queen pawn'])
  })

  it('rejects illegal moves and skips lines with no move for the user', () => {
    expect(() => cleanLines([{ moves: ['e4', 'e5', 'Qh9'] }], 'WHITE')).toThrow('Line 1: move 3 ("Qh9") is not legal.')
    expect(cleanLines([{ moves: ['e4'] }], 'BLACK').lines).toHaveLength(0)
  })

  it('finds the shared opening moves, capped at six plies', () => {
    const { lines } = cleanLines(parsePgn(NESTED), 'WHITE')
    expect(keyPosition(lines)).toMatchObject({ keyMoves: ['d4', 'd5', 'Bf4'], firstMove: 'd4' })
    expect(keyPosition([{ moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O'] }]).keyMoves).toHaveLength(6)
    expect(keyPosition([])).toMatchObject({ keyMoves: [], keyFen: START_FEN, firstMove: '' })
  })
})

describe('parseCourseFile', () => {
  const base = {
    title: 'London System',
    side: 'WHITE',
    startFen: START_FEN,
    keyMoves: ['d4', 'd5', 'Bf4'],
    lines: [
      { name: 'With Nf6', moves: ['d4', 'd5', 'Bf4', 'Nf6', 'e3'], comments: { '3': 'Bishop out first.' } },
      { name: 'With c5', moves: ['d4', 'd5', 'Bf4', 'c5', 'e3'] },
    ],
  }
  const withLine = (line: object) => ({ ...base, lines: [line] })

  it('accepts a valid file and fills in derived fields', () => {
    const course = parseCourseFile(base, 'london-system')
    expect(course).toMatchObject({ slug: 'london-system', difficulty: 'BEGINNER', firstMove: 'd4', pitch: '' })
    expect(course.lines.map((l) => l.order)).toEqual([1, 2])
    expect(course.lines[0].finalFen).toMatch(/^rnbqkb1r\/ppp1pppp\/5n2\/3p4\/3P1B2\/4P3\//)
    expect(course.keyFen).toMatch(/^rnbqkbnr\/ppp1pppp\/8\/3p4\/3P1B2\//)
  })

  it.each([
    ['an illegal move', withLine({ name: 'x', moves: ['d4', 'd5', 'Bf4', 'Nf6', 'Qh9'] }), 'line 1: move 5 ("Qh9") is not legal'],
    ['a line ending on the opponent', withLine({ name: 'x', moves: ['d4', 'd5', 'Bf4', 'Nf6'] }), 'line 1: must end on a white move'],
    ['a line off the key moves', withLine({ name: 'x', moves: ['e4', 'e5', 'Nf3'] }), 'does not start with the course key moves'],
    ['a comment on a ply that does not exist', withLine({ name: 'x', moves: ['d4', 'd5', 'Bf4'], comments: { '99': 'x' } }), 'comment key "99"'],
    ['a bad side', { ...base, side: 'GREEN' }, '"side" must be WHITE or BLACK'],
    ['a bad slug', { ...base, slug: 'Not A Slug' }, 'must be lowercase-words-with-dashes'],
    ['duplicate lines', { ...base, lines: [base.lines[0], base.lines[0]] }, 'duplicates an earlier line'],
  ])('rejects %s', (_label, file, message) => {
    expect(() => parseCourseFile(file, 'london-system')).toThrow(message)
  })
})

describe('sign-up and login validation', () => {
  it('normalises a valid registration', () => {
    const result = parseRegister({ email: '  Me@Example.com ', username: 'player_1', password: 'password123' })
    expect(result).toEqual({ ok: true, data: { email: 'me@example.com', username: 'player_1', password: 'password123' } })
  })

  it.each([
    [{ email: 'nope', username: 'player_1', password: 'password123' }, 'valid email'],
    [{ email: 'a@b.co', username: 'x', password: 'password123' }, 'Username must be'],
    [{ email: 'a@b.co', username: 'bad name!', password: 'password123' }, 'Username must be'],
    [{ email: 'a@b.co', username: 'player_1', password: 'short' }, 'Password must be'],
    [null, 'valid email'],
  ])('rejects registration %j', (body, message) => {
    const result = parseRegister(body)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain(message)
  })

  it('requires both fields to log in', () => {
    expect(parseLogin({ email: 'A@B.co', password: 'x' })).toEqual({ ok: true, data: { email: 'a@b.co', password: 'x' } })
    expect(parseLogin({ email: 'a@b.co' }).ok).toBe(false)
  })
})
