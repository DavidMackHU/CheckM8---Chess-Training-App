import { kindFromName, lineTags, lineTypes, tacticsScore } from '../src/content/lineTags.js'

describe('line tags', () => {
  it('scores captures and checks after the key moves only', () => {
    // 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nd4 4.Nxe5 Qg5 5.Nxf7 Qxg2 6.Rf1 Qxe4+ : piece captures 2 each, pawn 1, check 2.
    const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'Nxe5', 'Qg5', 'Nxf7', 'Qxg2', 'Rf1', 'Qxe4+']
    expect(tacticsScore(moves, 5)).toBe(1 + 1 + 1 + 1 + 2)
    expect(tacticsScore(moves, moves.length)).toBe(0)
  })

  it('calls a line tactical at the threshold, or whenever it ends in mate', () => {
    const quiet = ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'Bd6']
    expect(lineTags({ moves: quiet, keyPly: 3, type: 'main' })).toEqual(['main', 'positional'])
    expect(lineTags({ moves: ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'], keyPly: 2, type: 'checkmate' })).toEqual([
      'checkmate',
      'tactical',
    ])
  })

  it('reads the added-line kinds from their names', () => {
    expect(kindFromName('Checkmate: Vienna Game: 5... Rg8 (mate in 1)')).toBe('checkmate')
    expect(kindFromName('Punish: Italian Game: 4... Be6 (+5.7)')).toBe('punish')
    expect(kindFromName('Vienna Game: ...Nf6')).toBeNull()
  })

  it('marks the most common third of ordinary lines as main, the rest sidelines', () => {
    const types = lineTypes([
      { name: 'A', frequency: 0.1 },
      { name: 'B', frequency: 0.5 },
      { name: 'C', frequency: 0.2 },
      { name: 'D', frequency: 0.05 },
      { name: 'Punish: X: 3... Qh4 (+2.0)', frequency: 0.3 },
    ])
    expect(types).toEqual(['sideline', 'main', 'main', 'sideline', 'punish'])
  })

  it('treats every line as main when there are no frequencies (courses people build)', () => {
    expect(lineTypes([{ name: 'A' }, { name: 'B' }])).toEqual(['main', 'main'])
  })
})
